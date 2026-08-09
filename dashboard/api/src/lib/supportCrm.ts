/// Support CRM rules: validation, SLA arithmetic, status transitions and escalation.
///
/// Pure — no D1, no request, no clock. `routes/adminSupport.ts` loads the rows and
/// passes `now` in, so an SLA test cannot become flaky at a minute boundary and every
/// rule below is unit testable.
///
/// ## Two clocks
///
/// A first-response clock and a resolution clock, tracked separately. A ticket
/// answered in ten minutes and resolved in three days is a good support experience; a
/// ticket resolved in three days with no reply for two of them is not, and one
/// "resolution SLA" cannot tell them apart. `waiting_customer` pauses the resolution
/// clock in reporting, because a queue that counts our waiting and their waiting the
/// same way tells you nothing about either.
///
/// ## What is not here
///
/// Nothing sends anything. Recording a first response is an operator statement that
/// they replied through whatever channel the customer used, not evidence that this
/// system delivered a message — it cannot, and `migrations/0031` explains why the
/// obvious table for that was deliberately not created.

export const TICKET_CATEGORIES = [
  'billing', 'subscription', 'playback', 'downloads', 'account',
  'device', 'child_profile', 'content', 'privacy', 'bug', 'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_EVENT_KINDS = [
  'note', 'status_change', 'assignment', 'priority_change', 'escalation', 'action', 'link',
] as const;
export type TicketEventKind = (typeof TICKET_EVENT_KINDS)[number];

/// Operational actions an operator can record.
///
/// The list is short on purpose, and `SUPPORTED_ACTIONS` is shorter still: an action
/// appears in the UI only when the platform can actually perform it. Everything else
/// is named in `UNAVAILABLE_ACTIONS` with the reason, so the gap is visible instead of
/// being a control that fails.
export const TICKET_ACTIONS = [
  'entitlement_resync', 'subscription_resync', 'restore_purchase',
  'device_revoke', 'pin_reset', 'account_recovery', 'manual_note',
] as const;
export type TicketAction = (typeof TICKET_ACTIONS)[number];

/// Actions with a real server capability today.
///
/// `manual_note` is the honest catch-all: it records that an operator did something
/// outside the platform (spoke to the family, escalated to engineering, raised a
/// refund with the store console) without pretending the platform did it.
export const SUPPORTED_ACTIONS: readonly TicketAction[] = ['manual_note'];

/// Why each unsupported action is unsupported, in Arabic, shown in the admin.
///
/// Written per action rather than as one generic sentence because the reasons are
/// genuinely different, and an operator who knows *why* can route the request
/// correctly instead of retrying.
export const UNAVAILABLE_ACTIONS: Record<Exclude<TicketAction, 'manual_note'>, string> = {
  entitlement_resync:
    'لا مسار إداري لإعادة مزامنة الاستحقاق: التطبيق يعيد المزامنة من متجر الشراء، '
    + 'ولا يوجد مزوّد دفع مُهيّأ يمكن الاستعلام منه.',
  subscription_resync:
    'حالة الاشتراك تُشتق من دفتر الاستحقاقات في FamilyState؛ لا مسار كتابة إداري له.',
  restore_purchase:
    'استعادة الشراء عملية على جهاز العميل مقابل المتجر، ولا يمكن تنفيذها من الخادم.',
  device_revoke:
    'مسار سحب الجهاز في FamilyState يتحقّق من جلسة والٍ فعليًا، فلا يمكن للوحة تنفيذه '
    + '— القراءة الحيّة متاحة والسحب ليس كذلك.',
  pin_reset:
    'رمز الوالد محفوظ مُشتقًّا (KDF) داخل FamilyState ولا يُقرأ ولا يُعاد ضبطه من الخارج؛ '
    + 'إعادة الضبط تجري من التطبيق بمصادقة الوالد.',
  account_recovery:
    'الاسترداد يحتاج تحقّقًا من ملكية البريد عبر IdentityState، ولا مسار إداري له بعد.',
};

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === 'string' && (TICKET_CATEGORIES as readonly string[]).includes(value);
}
export function isTicketPriority(value: unknown): value is TicketPriority {
  return typeof value === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(value);
}
export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}
export function isTicketAction(value: unknown): value is TicketAction {
  return typeof value === 'string' && (TICKET_ACTIONS as readonly string[]).includes(value);
}

export interface SlaPolicy {
  category: string;
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
}

/// The policy that applies, most specific first.
///
/// `(category, priority)` beats `('any', priority)`. Returning null rather than a
/// built-in default is deliberate: a ticket with no policy has no due date, and the
/// reports say "no target" instead of inventing one nobody committed to.
export function resolveSlaPolicy(
  policies: SlaPolicy[],
  category: string,
  priority: TicketPriority,
): SlaPolicy | null {
  return policies.find((policy) => policy.category === category && policy.priority === priority)
    ?? policies.find((policy) => policy.category === 'any' && policy.priority === priority)
    ?? null;
}

export interface SlaDueDates {
  first_response_due_at: string | null;
  resolution_due_at: string | null;
}

export function slaDueDates(policy: SlaPolicy | null, from: string): SlaDueDates {
  if (!policy) return { first_response_due_at: null, resolution_due_at: null };
  const base = new Date(from).getTime();
  return {
    first_response_due_at: new Date(base + policy.first_response_minutes * 60_000).toISOString(),
    resolution_due_at: new Date(base + policy.resolution_minutes * 60_000).toISOString(),
  };
}

/// Allowed status transitions.
///
/// A closed ticket is terminal: reopening it would lose the distinction between "this
/// happened twice" and "this was never fixed", and the second is the one a support
/// lead needs to see. Resolved may still be reopened, because "resolved" is a claim
/// and claims turn out wrong.
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'waiting_customer', 'resolved', 'closed'],
  in_progress: ['waiting_customer', 'resolved', 'closed', 'open'],
  waiting_customer: ['in_progress', 'resolved', 'closed', 'open'],
  resolved: ['closed', 'in_progress', 'open'],
  closed: [],
};

/// Null when the transition is allowed, otherwise the Arabic reason.
export function transitionError(from: TicketStatus, to: TicketStatus): string | null {
  if (from === to) return null;
  if (!TRANSITIONS[from].includes(to)) {
    return from === 'closed'
      ? 'التذكرة مغلقة نهائيًا؛ افتح تذكرة جديدة مرتبطة بها بدل إعادة فتح المغلقة.'
      : `انتقال غير مسموح من «${from}» إلى «${to}».`;
  }
  return null;
}

/// SLA state of one ticket at a point in time.
export interface SlaState {
  first_response_breached: boolean;
  resolution_breached: boolean;
  /// Minutes past the resolution due time, 0 when not breached or not applicable.
  resolution_minutes_late: number;
  /// True when the resolution clock is not running.
  paused: boolean;
  reason: string;
}

/// Whether a ticket has breached either clock.
///
/// A resolved or closed ticket is judged against when it was resolved, not against
/// now — otherwise every historical ticket drifts into breach forever and the breach
/// count becomes a function of how long ago the ticket existed.
export function slaState(
  ticket: {
    status: TicketStatus;
    first_response_due_at: string | null;
    resolution_due_at: string | null;
    first_response_at: string | null;
    resolved_at: string | null;
  },
  now: string,
): SlaState {
  const currentTime = new Date(now).getTime();
  const respondedAt = ticket.first_response_at ? new Date(ticket.first_response_at).getTime() : null;
  const responseDue = ticket.first_response_due_at ? new Date(ticket.first_response_due_at).getTime() : null;
  const resolutionDue = ticket.resolution_due_at ? new Date(ticket.resolution_due_at).getTime() : null;
  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : null;

  const firstResponseBreached = responseDue !== null
    && (respondedAt === null ? currentTime > responseDue : respondedAt > responseDue);

  const settled = ticket.status === 'resolved' || ticket.status === 'closed';
  const paused = ticket.status === 'waiting_customer';
  const measuredAt = settled ? (resolvedAt ?? currentTime) : currentTime;

  const resolutionBreached = resolutionDue !== null && !paused && measuredAt > resolutionDue;
  const minutesLate = resolutionBreached && resolutionDue !== null
    ? Math.round((measuredAt - resolutionDue) / 60_000)
    : 0;

  const reason = paused
    ? 'ساعة الحلّ متوقّفة: التذكرة في انتظار العميل.'
    : settled
      ? 'محسومة؛ تُقاس على وقت الحلّ لا على الآن.'
      : resolutionDue === null
        ? 'لا سياسة SLA مطابقة، فلا هدف زمني.'
        : 'ساعة الحلّ تعمل.';

  return {
    first_response_breached: firstResponseBreached,
    resolution_breached: resolutionBreached,
    resolution_minutes_late: minutesLate,
    paused,
    reason,
  };
}

export interface TicketInput {
  subject: string;
  body: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  family_id: string | null;
  subscription_ref: string | null;
  purchase_ref: string | null;
  device_id: string | null;
  assignee_id: string | null;
  team_id: string | null;
  tags: string[];
}

const trimmed = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
};

/// Validates a create payload, or returns the 400 message.
export function ticketCreateInput(body: Record<string, unknown>): { error: string } | { input: TicketInput } {
  const subject = trimmed(body.subject, 200);
  if (!subject) return { error: 'subject is required' };
  if (!isTicketCategory(body.category)) {
    return { error: `category must be one of: ${TICKET_CATEGORIES.join(', ')}` };
  }
  const priority = body.priority === undefined ? 'normal' : body.priority;
  if (!isTicketPriority(priority)) {
    return { error: `priority must be one of: ${TICKET_PRIORITIES.join(', ')}` };
  }

  const tags: string[] = [];
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return { error: 'tags must be an array' };
    for (const raw of body.tags) {
      const tag = trimmed(raw, 40)?.toLowerCase();
      // Tags are normalised to lower case and de-duplicated here rather than at the
      // call site: "Refund" and "refund" as two tags makes every tag filter wrong in a
      // way nobody notices until a report is short.
      if (!tag) return { error: 'tags must be non-empty strings' };
      if (!tags.includes(tag)) tags.push(tag);
    }
  }

  return {
    input: {
      subject,
      body: trimmed(body.body, 5_000),
      category: body.category,
      priority,
      family_id: trimmed(body.family_id, 120),
      subscription_ref: trimmed(body.subscription_ref, 120),
      purchase_ref: trimmed(body.purchase_ref, 120),
      device_id: trimmed(body.device_id, 120),
      assignee_id: trimmed(body.assignee_id, 120),
      team_id: trimmed(body.team_id, 120),
      tags,
    },
  };
}

/// A short, sortable, human-readable reference.
///
/// Derived from a monotonic counter supplied by the caller (the current row count),
/// not from a random string: an operator reads these aloud and types them from notes,
/// and `MJ-000481` survives that where a UUID prefix does not.
export function ticketReference(sequence: number): string {
  return `MJ-${String(Math.max(sequence, 1)).padStart(6, '0')}`;
}

/// Whether a status change should stamp `first_response_at`.
///
/// Moving a ticket off `open` is the operator asserting they have engaged with it. It
/// is stamped once and never overwritten, because a first response by definition
/// happens once and re-stamping it would erase the only evidence of a late reply.
export function stampsFirstResponse(from: TicketStatus, to: TicketStatus, existing: string | null): boolean {
  if (existing) return false;
  return from === 'open' && to !== 'open' && to !== 'closed';
}
