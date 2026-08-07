export const FAMILY_EVENT_TYPES = [
  'family.initialized',
  'session.created',
  'session.revoked',
  'child.created',
  'progress.updated',
  'content.completed',
  'favorite.updated',
  'playback.started',
  'playback.revoked',
  'playback.ended',
  'entitlement.updated',
] as const;

export type FamilyEventType = typeof FAMILY_EVENT_TYPES[number];

export type FamilyEvent = {
  eventId: string;
  type: FamilyEventType;
  schemaVersion: 1;
  parentId: string;
  occurredAt: number;
  payload: Record<string, unknown>;
};

export function parseFamilyEvent(value: unknown): FamilyEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (typeof event.eventId !== 'string' || event.eventId.length < 8 || event.eventId.length > 200) return null;
  if (typeof event.parentId !== 'string' || event.parentId.length < 8 || event.parentId.length > 200) return null;
  if (typeof event.type !== 'string' || !FAMILY_EVENT_TYPES.includes(event.type as FamilyEventType)) return null;
  if (event.schemaVersion !== 1 || !Number.isInteger(event.occurredAt) || Number(event.occurredAt) < 1) return null;
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return null;
  return event as FamilyEvent;
}
