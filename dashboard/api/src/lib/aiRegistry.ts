/// AI provider registry: reading it, and deciding which model serves a task.
///
/// ## The one rule this module exists to enforce
///
/// A provider row names a credential; it never holds one. `ai_providers.credential_ref`
/// is the *name* of a Worker secret, and the only thing this module ever reports about
/// it is whether it is present. The value is read solely at the moment of a provider
/// call, inside `services/aiText.ts`, and is never returned to any caller.
///
/// That is the same contract `GET /admin/tts/config` already follows: it answers
/// `configured: true|false` and never the key.
///
/// ## Why `credential_ref` is checked against an allow-list here
///
/// The column is operator-editable, and `env` holds far more than model credentials —
/// `AUTH_TOKEN_SECRET`, `MEDIA_TOKEN_SECRET`, `GOOGLE_TTS_PRIVATE_KEY`. Without a
/// code-side allow-list, an operator could point a provider at any of them and use the
/// registry as a presence oracle, or worse, cause a signing secret to be transmitted to
/// a third-party endpoint as an Authorization header.
///
/// So the migration constrains the *shape* of the value and this list constrains the
/// *set*. A ref outside it makes the provider unusable with an explicit reason rather
/// than silently falling back to no auth.
///
/// ## Resolution never throws
///
/// `resolveAiRoute` returns the chosen route or `null` **with the reason each candidate
/// was skipped**. A task with three configured fallbacks that all sit over their daily
/// cap is a different operational problem from a task with no route at all, and an
/// exception would flatten both into "generation failed". Same reasoning as
/// `readRows` returning `null` rather than `[]` in `routes/adminStories.ts`.

import type { Env } from './db.ts';
import { queryAll, queryFirst } from './db.ts';

/* ------------------------------------------------------------------ constants */

/// Worker secrets that may back an AI provider.
///
/// Adding a vendor means adding its secret name here **and** to the `Env` interface,
/// then `wrangler secret put`. That is the deliberate cost of keeping keys out of D1.
export const AI_CREDENTIAL_REFS = [
  'GOOGLE_AI_API_KEY',
  /// Already present in most deployments because narration uses it. Allowed so an
  /// existing Google AI Studio key can back text authoring without a second key —
  /// at the cost of one shared daily quota and one shared invoice line for narration
  /// and authoring, so exhausting either stops the other. Prefer GOOGLE_AI_API_KEY
  /// when you can afford a separate key; this exists so you are not blocked.
  'GOOGLE_TTS_API_KEY',
  'OPENAI_API_KEY',
  /// Meta Model API (Muse Spark). Meta documents the variable as MODEL_API_KEY; named
  /// with the vendor prefix here because this Env holds keys for several vendors.
  'META_MODEL_API_KEY',
  'PLAYVEO_API_KEY',
] as const;

export type AiCredentialRef = (typeof AI_CREDENTIAL_REFS)[number];

export const AI_AUTH_MODES = ['api_key_header', 'bearer', 'service_account'] as const;
export const AI_MODALITIES = ['text', 'image', 'video', 'audio'] as const;
export const AI_PRICE_UNITS = [
  'per_1k_input_tokens', 'per_1k_output_tokens', 'per_1k_characters',
  'per_image', 'per_second',
] as const;
export const AI_ENTITY_STATUSES = ['active', 'disabled'] as const;
export const AI_CALL_PURPOSES = ['production', 'probe'] as const;
export const AI_CALL_STATUSES = ['ok', 'refused', 'provider_failed', 'invalid_output'] as const;

/// Matches `0057_content_factory.sql` so both money paths use one unit.
export const MICROS_PER_CREDIT = 1_000_000;

export const MAX_PRIORITY = 5;

export type AiAuthMode = (typeof AI_AUTH_MODES)[number];
export type AiModality = (typeof AI_MODALITIES)[number];
export type AiPriceUnit = (typeof AI_PRICE_UNITS)[number];
export type AiCallPurpose = (typeof AI_CALL_PURPOSES)[number];
export type AiCallStatus = (typeof AI_CALL_STATUSES)[number];

export function isCredentialRef(value: string): value is AiCredentialRef {
  return (AI_CREDENTIAL_REFS as readonly string[]).includes(value);
}

export function isAuthMode(value: string): value is AiAuthMode {
  return (AI_AUTH_MODES as readonly string[]).includes(value);
}

export function isModality(value: string): value is AiModality {
  return (AI_MODALITIES as readonly string[]).includes(value);
}

export function isPriceUnit(value: string): value is AiPriceUnit {
  return (AI_PRICE_UNITS as readonly string[]).includes(value);
}

/* ---------------------------------------------------------------------- rows */

export type AiProviderRow = {
  id: string;
  slug: string;
  name_ar: string;
  auth_mode: AiAuthMode;
  base_url: string;
  credential_ref: string;
  status: string;
  notes_ar: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type AiModelRow = {
  id: string;
  provider_id: string;
  model_id: string;
  name_ar: string;
  modality: AiModality;
  supports_json_schema: number;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  price_micros: number | null;
  price_unit: AiPriceUnit | null;
  status: string;
  last_probe_at: string | null;
  last_probe_status: string | null;
  last_probe_detail: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type AiTaskRow = {
  id: string;
  name_ar: string;
  description_ar: string;
  required_modality: AiModality;
  requires_json_schema: number;
  is_wired: number;
  sort_order: number;
};

export type AiTaskRouteRow = {
  id: string;
  task_id: string;
  model_id: string;
  priority: number;
  is_enabled: number;
  params_json: string;
  daily_call_cap: number | null;
  daily_spend_cap_micros: number | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

/* ------------------------------------------------------- credential presence */

/// Whether the secret a provider names is actually present in this environment.
///
/// Returns a reason rather than a bare boolean so the dashboard can distinguish
/// "nobody has run `wrangler secret put`" from "this ref is not one the code accepts".
export type CredentialState =
  | { configured: true; reason: null }
  | { configured: false; reason: 'credential_ref_not_allowed' | 'credential_missing' };

export function credentialState(env: Env, credentialRef: string): CredentialState {
  if (!isCredentialRef(credentialRef)) {
    return { configured: false, reason: 'credential_ref_not_allowed' };
  }
  // Indexed read rather than a switch: the allow-list above is the security boundary,
  // so by this point the key is known-safe to look up.
  const value = (env as unknown as Record<string, unknown>)[credentialRef];
  if (typeof value !== 'string' || value.trim() === '') {
    return { configured: false, reason: 'credential_missing' };
  }
  return { configured: true, reason: null };
}

/// The secret itself, for the one place that may have it: an outbound provider call.
///
/// Separate from [credentialState] so that reading a key is a distinct, greppable act
/// rather than a side effect of checking configuration.
export function credentialValue(env: Env, credentialRef: string): string | null {
  if (!isCredentialRef(credentialRef)) return null;
  const value = (env as unknown as Record<string, unknown>)[credentialRef];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/* ------------------------------------------------------------- daily usage */

export type DailyUsage = { calls: number; spend_micros: number };

/// Today's production usage per model for one task, in one statement.
///
/// `status <> 'refused'` because a refusal never reached the provider: counting it
/// against a cap would let a misconfiguration exhaust the day's budget without a single
/// generation. Probes are excluded so diagnosing an outage cannot consume the
/// production allowance.
///
/// `date(created_at) = date('now')` works because every row is written with
/// `datetime('now')`, which D1 stores as UTC `YYYY-MM-DD HH:MM:SS`.
export async function dailyUsageByModel(
  db: D1Database,
  taskId: string,
): Promise<Map<string, DailyUsage>> {
  const rows = await queryAll<{ model_id: string | null; calls: number; spend_micros: number }>(db, `
    SELECT model_id,
           COUNT(*) AS calls,
           COALESCE(SUM(cost_micros), 0) AS spend_micros
      FROM ai_call_log
     WHERE task_id = ?
       AND purpose = 'production'
       AND status <> 'refused'
       AND date(created_at) = date('now')
     GROUP BY model_id
  `, [taskId]);

  const usage = new Map<string, DailyUsage>();
  for (const row of rows) {
    if (!row.model_id) continue;
    usage.set(row.model_id, {
      calls: Number(row.calls) || 0,
      spend_micros: Number(row.spend_micros) || 0,
    });
  }
  return usage;
}

/* --------------------------------------------------------------- resolution */

/// Why a candidate route was passed over. Every value is actionable by an operator.
export type AiRouteSkipReason =
  | 'route_disabled'
  | 'model_disabled'
  | 'provider_disabled'
  | 'credential_ref_not_allowed'
  | 'credential_missing'
  | 'modality_mismatch'
  | 'json_schema_unsupported'
  | 'daily_call_cap_reached'
  | 'daily_spend_cap_reached';

export type AiRouteCandidate = {
  route: AiTaskRouteRow;
  model: AiModelRow;
  provider: AiProviderRow;
  params: Record<string, unknown>;
  usage: DailyUsage;
};

export type AiRouteSkip = {
  priority: number;
  model_id: string;
  model_ref: string;
  provider_slug: string;
  reason: AiRouteSkipReason;
};

export type AiRouteResolution = {
  task: AiTaskRow | null;
  chosen: AiRouteCandidate | null;
  skipped: AiRouteSkip[];
  /// Present only when `task` is null, so a caller can tell "unknown task" from
  /// "known task with nothing usable behind it".
  error: 'unknown_task' | null;
};

function parseParams(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/// Evaluates one candidate. Order matters: cheap, local checks first, so a
/// misconfiguration is reported without touching the usage table.
export function skipReasonFor(
  route: AiTaskRouteRow,
  model: AiModelRow,
  provider: AiProviderRow,
  task: AiTaskRow,
  env: Env,
  usage: DailyUsage,
): AiRouteSkipReason | null {
  if (!route.is_enabled) return 'route_disabled';
  if (model.status !== 'active') return 'model_disabled';
  if (provider.status !== 'active') return 'provider_disabled';

  const credential = credentialState(env, provider.credential_ref);
  if (!credential.configured) return credential.reason;

  // A text model cannot produce an image however it is routed. Checked against what the
  // task needs rather than trusting the operator to pair them correctly.
  if (model.modality !== task.required_modality) return 'modality_mismatch';

  // Tasks that must return structured JSON refuse a model without schema support,
  // rather than parsing prose and failing partway through a paid batch.
  if (task.requires_json_schema && !model.supports_json_schema) return 'json_schema_unsupported';

  if (route.daily_call_cap !== null && usage.calls >= route.daily_call_cap) {
    return 'daily_call_cap_reached';
  }
  if (route.daily_spend_cap_micros !== null && usage.spend_micros >= route.daily_spend_cap_micros) {
    return 'daily_spend_cap_reached';
  }
  return null;
}

/// One task's routes, already joined. The shape both callers of [evaluateTaskRoutes]
/// produce: `resolveAiRoute` from a per-task query, the registry endpoint from a bulk read.
export type AiRouteEntry = {
  route: AiTaskRouteRow;
  model: AiModelRow;
  provider: AiProviderRow;
};

/// Walks a task's routes in priority order and returns the first usable one.
///
/// Pure, and the single home of the routing rule. The registry screen and the code that
/// actually spends money must agree about which model would serve a task; two
/// implementations of this walk would eventually disagree, and the screen would then be
/// confidently wrong about where the next call is going.
export function evaluateTaskRoutes(
  task: AiTaskRow,
  entries: AiRouteEntry[],
  env: Env,
  usageByModel: Map<string, DailyUsage>,
): { chosen: AiRouteCandidate | null; skipped: AiRouteSkip[] } {
  const skipped: AiRouteSkip[] = [];

  for (const entry of [...entries].sort((a, b) => a.route.priority - b.route.priority)) {
    const usage = usageByModel.get(entry.model.id) ?? { calls: 0, spend_micros: 0 };
    const reason = skipReasonFor(entry.route, entry.model, entry.provider, task, env, usage);

    if (reason) {
      skipped.push({
        priority: entry.route.priority,
        model_id: entry.model.id,
        model_ref: entry.model.model_id,
        provider_slug: entry.provider.slug,
        reason,
      });
      continue;
    }

    return {
      chosen: {
        route: entry.route,
        model: entry.model,
        provider: entry.provider,
        params: parseParams(entry.route.params_json),
        usage,
      },
      skipped,
    };
  }

  return { chosen: null, skipped };
}

/// Picks the model that should serve `taskId`, or explains why none can.
///
/// Reads three small statements: the task, its routes joined to models and providers,
/// and today's usage. Callers are expected to run this immediately before a generation
/// so a cap reached mid-batch stops the next item.
export async function resolveAiRoute(
  db: D1Database,
  env: Env,
  taskId: string,
): Promise<AiRouteResolution> {
  const task = await queryFirst<AiTaskRow>(db, 'SELECT * FROM ai_tasks WHERE id = ?', [taskId]);
  if (!task) return { task: null, chosen: null, skipped: [], error: 'unknown_task' };

  const rows = await queryAll<AiTaskRouteRow & {
    m_id: string; m_provider_id: string; m_model_id: string; m_name_ar: string;
    m_modality: AiModality; m_supports_json_schema: number;
    m_max_input_tokens: number | null; m_max_output_tokens: number | null;
    m_price_micros: number | null; m_price_unit: AiPriceUnit | null; m_status: string;
    m_last_probe_at: string | null; m_last_probe_status: string | null;
    m_last_probe_detail: string | null; m_created_at: string; m_updated_at: string;
    m_updated_by: string | null;
    p_id: string; p_slug: string; p_name_ar: string; p_auth_mode: AiAuthMode;
    p_base_url: string; p_credential_ref: string; p_status: string; p_notes_ar: string | null;
    p_created_at: string; p_updated_at: string; p_updated_by: string | null;
  }>(db, `
    SELECT r.*,
           m.id AS m_id, m.provider_id AS m_provider_id, m.model_id AS m_model_id,
           m.name_ar AS m_name_ar, m.modality AS m_modality,
           m.supports_json_schema AS m_supports_json_schema,
           m.max_input_tokens AS m_max_input_tokens, m.max_output_tokens AS m_max_output_tokens,
           m.price_micros AS m_price_micros, m.price_unit AS m_price_unit,
           m.status AS m_status, m.last_probe_at AS m_last_probe_at,
           m.last_probe_status AS m_last_probe_status, m.last_probe_detail AS m_last_probe_detail,
           m.created_at AS m_created_at, m.updated_at AS m_updated_at,
           m.updated_by AS m_updated_by,
           p.id AS p_id, p.slug AS p_slug, p.name_ar AS p_name_ar,
           p.auth_mode AS p_auth_mode, p.base_url AS p_base_url,
           p.credential_ref AS p_credential_ref, p.status AS p_status,
           p.notes_ar AS p_notes_ar, p.created_at AS p_created_at,
           p.updated_at AS p_updated_at, p.updated_by AS p_updated_by
      FROM ai_task_routes r
      JOIN ai_models m ON m.id = r.model_id
      JOIN ai_providers p ON p.id = m.provider_id
     WHERE r.task_id = ?
     ORDER BY r.priority
  `, [taskId]);

  const usageByModel = await dailyUsageByModel(db, taskId);
  const entries: AiRouteEntry[] = [];

  for (const row of rows) {
    const model: AiModelRow = {
      id: row.m_id, provider_id: row.m_provider_id, model_id: row.m_model_id,
      name_ar: row.m_name_ar, modality: row.m_modality,
      supports_json_schema: row.m_supports_json_schema,
      max_input_tokens: row.m_max_input_tokens, max_output_tokens: row.m_max_output_tokens,
      price_micros: row.m_price_micros, price_unit: row.m_price_unit, status: row.m_status,
      last_probe_at: row.m_last_probe_at, last_probe_status: row.m_last_probe_status,
      last_probe_detail: row.m_last_probe_detail, created_at: row.m_created_at,
      updated_at: row.m_updated_at, updated_by: row.m_updated_by,
    };
    const provider: AiProviderRow = {
      id: row.p_id, slug: row.p_slug, name_ar: row.p_name_ar, auth_mode: row.p_auth_mode,
      base_url: row.p_base_url, credential_ref: row.p_credential_ref, status: row.p_status,
      notes_ar: row.p_notes_ar, created_at: row.p_created_at, updated_at: row.p_updated_at,
      updated_by: row.p_updated_by,
    };
    const route: AiTaskRouteRow = {
      id: row.id, task_id: row.task_id, model_id: row.model_id, priority: row.priority,
      is_enabled: row.is_enabled, params_json: row.params_json,
      daily_call_cap: row.daily_call_cap,
      daily_spend_cap_micros: row.daily_spend_cap_micros,
      created_at: row.created_at, updated_at: row.updated_at, updated_by: row.updated_by,
    };
    entries.push({ route, model, provider });
  }

  const { chosen, skipped } = evaluateTaskRoutes(task, entries, env, usageByModel);
  return { task, chosen, skipped, error: null };
}

/* ----------------------------------------------------------------- the log */

export type AiCallRecord = {
  task_id: string;
  model_id: string | null;
  provider_slug: string;
  model_ref: string;
  purpose: AiCallPurpose;
  status: AiCallStatus;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_micros?: number;
  latency_ms?: number | null;
  prompt_sha256?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  error_code?: string | null;
  actor: string;
};

/// One usage/spend row. Returned as a statement so callers can batch it with their own
/// writes, matching `auditStatement`.
export function aiCallLogStatement(db: D1Database, record: AiCallRecord): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO ai_call_log (
      id, task_id, model_id, provider_slug, model_ref, purpose, status,
      input_tokens, output_tokens, cost_micros, latency_ms, prompt_sha256,
      entity_type, entity_id, error_code, actor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    record.task_id,
    record.model_id ?? null,
    record.provider_slug,
    record.model_ref,
    record.purpose,
    record.status,
    record.input_tokens ?? null,
    record.output_tokens ?? null,
    record.cost_micros ?? 0,
    record.latency_ms ?? null,
    record.prompt_sha256 ?? null,
    record.entity_type ?? null,
    record.entity_id ?? null,
    record.error_code ?? null,
    record.actor,
  );
}

/* ---------------------------------------------------------------- estimation */

/// Cost of one call in micros, or null when the model is unpriced.
///
/// Null is propagated rather than coerced to zero: an unpriced model must appear as
/// unknown spend in the ledger and in the UI, because zero would let it run under any
/// budget cap forever.
export function estimateCallMicros(
  model: Pick<AiModelRow, 'price_micros' | 'price_unit'>,
  usage: { input_tokens?: number | null; output_tokens?: number | null; characters?: number | null; images?: number | null; seconds?: number | null },
): number | null {
  if (model.price_micros === null || model.price_unit === null) return null;

  const per1k = (count: number | null | undefined) =>
    typeof count === 'number' && count >= 0
      ? Math.round((count / 1000) * model.price_micros!)
      : null;

  switch (model.price_unit) {
    case 'per_1k_input_tokens': return per1k(usage.input_tokens);
    case 'per_1k_output_tokens': return per1k(usage.output_tokens);
    case 'per_1k_characters': return per1k(usage.characters);
    case 'per_image':
      return typeof usage.images === 'number' && usage.images >= 0
        ? model.price_micros * usage.images
        : null;
    case 'per_second':
      return typeof usage.seconds === 'number' && usage.seconds >= 0
        ? Math.round(model.price_micros * usage.seconds)
        : null;
    default: return null;
  }
}

export function microsToCredits(value: number): number {
  return Number((value / MICROS_PER_CREDIT).toFixed(6));
}
