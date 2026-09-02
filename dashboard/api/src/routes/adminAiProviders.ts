/// AI provider registry administration.
///
/// ## What this router is allowed to know
///
/// It reads and writes *configuration*: which vendors exist, which models they expose,
/// which model serves which task, and what the daily ceilings are. It never accepts a
/// credential and never returns one. The only thing it says about a secret is whether it
/// is present, which is the contract `GET /admin/tts/config` already established.
///
/// A consequence worth stating because it will be asked: there is no field on this
/// screen for pasting an API key, by design. `platform_settings.value` is plaintext TEXT
/// (migration 0017) and `lib/db.ts` records the decision that credentials stay Worker
/// secrets. Adding a vendor therefore costs one `wrangler secret put`, one line in `Env`,
/// and one entry in `AI_CREDENTIAL_REFS`. Adding a model or repointing a task costs
/// nothing.
///
/// ## Why `manage_ai_providers` and not `publish`
///
/// `adminSiteMode.ts` and `adminPartnerships.ts` both borrow `publish` for platform
/// settings and both say in a comment that it is merely the closest existing verb.
/// Routing decides which third party receives platform credentials and platform money,
/// so migration 0063 adds a permission for it instead of widening what `publish` means.
///
/// ## Mounted directly, so it guards itself
///
/// Hono middleware belongs to the router instance it is registered on, so a router
/// mounted straight onto the app in `index.ts` does not inherit `adminRoute`'s
/// `requireAdmin`. Hence the `use('*', requireAdmin)` below.

import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { pathParam } from '../lib/routeParams.ts';
import { integer, nullableText, strictBoolInt, text } from '../lib/catalogueValidation.ts';
import {
  AI_AUTH_MODES,
  AI_CREDENTIAL_REFS,
  AI_MODALITIES,
  AI_PRICE_UNITS,
  MAX_PRIORITY,
  aiCallLogStatement,
  credentialState,
  dailyUsageByModel,
  estimateCallMicros,
  evaluateTaskRoutes,
  isAuthMode,
  isCredentialRef,
  isModality,
  isPriceUnit,
  microsToCredits,
  type AiModelRow,
  type AiProviderRow,
  type AiRouteEntry,
  type AiTaskRouteRow,
  type AiTaskRow,
  type DailyUsage,
} from '../lib/aiRegistry.ts';
import {
  AI_TEXT_ADAPTERS,
  AiTextError,
  callStatusFor,
  generateText,
  hasTextAdapter,
  httpStatusFor,
} from '../services/aiText.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

route.use('*', requireAdmin);

/* ------------------------------------------------------------------ helpers */

async function body(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown> | null> {
  const parsed = await c.req.json().catch(() => null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;

function invalid(message: string, field?: string) {
  return { success: false as const, error: message, ...(field ? { field } : {}) };
}

/// Validates a provider base URL beyond the column CHECK.
///
/// The CHECK only proves the string starts with `https://`. This additionally requires it
/// to parse, to carry a host, and to have no query or fragment — a base URL with either
/// would be silently dropped when path segments are appended, sending the credential
/// somewhere other than where the operator believes.
function providerBaseUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || !url.hostname) return null;
  if (url.search || url.hash) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

/* ------------------------------------------------------- the registry read */

/// Everything the screen needs, in five statements.
///
/// Per-task routing is computed here rather than by calling `resolveAiRoute` ten times:
/// that would be twenty statements to answer one page load. The rule itself is not
/// duplicated — both paths call `evaluateTaskRoutes`, so what this screen shows is what
/// the generation code would actually pick.
route.get('/ai/registry', async (c) => {
  const db = c.env.DB;

  const [providers, models, tasks, routes, usageRows] = await Promise.all([
    queryAll<AiProviderRow>(db, 'SELECT * FROM ai_providers ORDER BY status, slug'),
    queryAll<AiModelRow>(db, 'SELECT * FROM ai_models ORDER BY provider_id, model_id'),
    queryAll<AiTaskRow>(db, 'SELECT * FROM ai_tasks ORDER BY sort_order, id'),
    queryAll<AiTaskRouteRow>(db, 'SELECT * FROM ai_task_routes ORDER BY task_id, priority'),
    queryAll<{ task_id: string; model_id: string | null; calls: number; spend_micros: number }>(db, `
      SELECT task_id, model_id,
             COUNT(*) AS calls,
             COALESCE(SUM(cost_micros), 0) AS spend_micros
        FROM ai_call_log
       WHERE purpose = 'production'
         AND status <> 'refused'
         AND date(created_at) = date('now')
       GROUP BY task_id, model_id
    `),
  ]);

  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const modelById = new Map(models.map((model) => [model.id, model]));

  const usageByTask = new Map<string, Map<string, DailyUsage>>();
  for (const row of usageRows) {
    if (!row.model_id) continue;
    if (!usageByTask.has(row.task_id)) usageByTask.set(row.task_id, new Map());
    usageByTask.get(row.task_id)!.set(row.model_id, {
      calls: Number(row.calls) || 0,
      spend_micros: Number(row.spend_micros) || 0,
    });
  }

  const serializedTasks = tasks.map((task) => {
    const entries: AiRouteEntry[] = [];
    for (const row of routes.filter((entry) => entry.task_id === task.id)) {
      const model = modelById.get(row.model_id);
      const provider = model ? providerById.get(model.provider_id) : undefined;
      if (model && provider) entries.push({ route: row, model, provider });
    }
    const usage = usageByTask.get(task.id) ?? new Map<string, DailyUsage>();
    const { chosen, skipped } = evaluateTaskRoutes(task, entries, c.env, usage);

    let calls = 0;
    let spend = 0;
    for (const entry of usage.values()) { calls += entry.calls; spend += entry.spend_micros; }

    return {
      id: task.id,
      name_ar: task.name_ar,
      description_ar: task.description_ar,
      required_modality: task.required_modality,
      requires_json_schema: Boolean(task.requires_json_schema),
      is_wired: Boolean(task.is_wired),
      sort_order: task.sort_order,
      routes: entries
        .sort((a, b) => a.route.priority - b.route.priority)
        .map((entry) => ({
          id: entry.route.id,
          model_id: entry.model.id,
          model_ref: entry.model.model_id,
          model_name_ar: entry.model.name_ar,
          provider_slug: entry.provider.slug,
          priority: entry.route.priority,
          is_enabled: Boolean(entry.route.is_enabled),
          params: entry.route.params_json,
          daily_call_cap: entry.route.daily_call_cap,
          daily_spend_cap_micros: entry.route.daily_spend_cap_micros,
        })),
      resolved_model_id: chosen?.model.id ?? null,
      skipped,
      usage_today: { calls, spend_micros: spend },
    };
  });

  return c.json({
    success: true,
    data: {
      providers: providers.map((provider) => {
        const state = credentialState(c.env, provider.credential_ref);
        return {
          id: provider.id,
          slug: provider.slug,
          name_ar: provider.name_ar,
          auth_mode: provider.auth_mode,
          base_url: provider.base_url,
          // The NAME of the secret. Reported so an operator knows which `wrangler secret
          // put` to run; the value is never read on this path.
          credential_ref: provider.credential_ref,
          configured: state.configured,
          unconfigured_reason: state.reason,
          has_text_adapter: hasTextAdapter(provider.slug),
          status: provider.status,
          notes_ar: provider.notes_ar,
          model_count: models.filter((model) => model.provider_id === provider.id).length,
          updated_at: provider.updated_at,
          updated_by: provider.updated_by,
        };
      }),
      models: models.map((model) => ({
        id: model.id,
        provider_id: model.provider_id,
        provider_slug: providerById.get(model.provider_id)?.slug ?? null,
        model_id: model.model_id,
        name_ar: model.name_ar,
        modality: model.modality,
        supports_json_schema: Boolean(model.supports_json_schema),
        max_input_tokens: model.max_input_tokens,
        max_output_tokens: model.max_output_tokens,
        price_micros: model.price_micros,
        price_credits: model.price_micros === null ? null : microsToCredits(model.price_micros),
        price_unit: model.price_unit,
        status: model.status,
        last_probe_at: model.last_probe_at,
        last_probe_status: model.last_probe_status,
        last_probe_detail: model.last_probe_detail,
        route_count: routes.filter((entry) => entry.model_id === model.id).length,
        updated_at: model.updated_at,
      })),
      tasks: serializedTasks,
      // Sent with the data so the form cannot offer a value the server rejects.
      options: {
        auth_modes: AI_AUTH_MODES,
        modalities: AI_MODALITIES,
        price_units: AI_PRICE_UNITS,
        credential_refs: AI_CREDENTIAL_REFS,
        text_adapters: AI_TEXT_ADAPTERS,
        max_priority: MAX_PRIORITY,
      },
      notes: [
        'المفاتيح لا تُخزَّن هنا. الحقل يسمّي سرّ Worker فقط، والقيمة تُضبط بـ wrangler secret put.',
        'المهام مبذورة في المهاجرة: is_wired = false يعني أن التوجيه قابل للضبط لكن لا كود يستدعيه بعد.',
      ],
      generated_at: new Date().toISOString(),
    },
  });
});

/* --------------------------------------------------------------- the usage */

route.get('/ai/usage', async (c) => {
  const days = Math.min(Math.max(integer(c.req.query('days')) ?? 7, 1), 90);

  const [byTask, byDay] = await Promise.all([
    queryAll<Row>(c.env.DB, `
      SELECT task_id, provider_slug, model_ref, purpose, status,
             COUNT(*) AS calls, COALESCE(SUM(cost_micros), 0) AS spend_micros
        FROM ai_call_log
       WHERE created_at >= datetime('now', ?)
       GROUP BY task_id, provider_slug, model_ref, purpose, status
       ORDER BY calls DESC
    `, [`-${days} days`]),
    queryAll<Row>(c.env.DB, `
      SELECT date(created_at) AS day, purpose,
             COUNT(*) AS calls, COALESCE(SUM(cost_micros), 0) AS spend_micros
        FROM ai_call_log
       WHERE created_at >= datetime('now', ?)
       GROUP BY day, purpose
       ORDER BY day DESC
    `, [`-${days} days`]),
  ]);

  return c.json({ success: true, data: { days, by_task: byTask, by_day: byDay } });
});

type Row = Record<string, unknown>;

/* ------------------------------------------------------------- providers */

route.post('/ai/providers', requirePermission('manage_ai_providers'), async (c) => {
  const value = await body(c);
  if (!value) return c.json(invalid('A JSON object is required'), 400);

  const slug = text(value.slug);
  const nameAr = text(value.name_ar);
  const authMode = text(value.auth_mode);
  const baseUrl = providerBaseUrl(value.base_url);
  const credentialRef = text(value.credential_ref);

  if (!slug || !SLUG.test(slug)) return c.json(invalid('slug must be lowercase letters, digits and dashes', 'slug'), 400);
  if (!nameAr) return c.json(invalid('name_ar is required', 'name_ar'), 400);
  if (!authMode || !isAuthMode(authMode)) return c.json(invalid('Unsupported auth_mode', 'auth_mode'), 400);
  if (!baseUrl) return c.json(invalid('base_url must be an HTTPS origin with no query or fragment', 'base_url'), 400);

  // The allow-list, not just the column shape. Without it a provider could be pointed at
  // AUTH_TOKEN_SECRET and used to discover whether it is set — or to transmit it.
  if (!credentialRef || !isCredentialRef(credentialRef)) {
    return c.json(invalid(
      `credential_ref must be one of: ${AI_CREDENTIAL_REFS.join(', ')}. أضِف اسمًا جديدًا في lib/aiRegistry.ts وEnv أولًا.`,
      'credential_ref',
    ), 400);
  }

  const id = `aip-${crypto.randomUUID()}`;
  const actor = actorId(c);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO ai_providers (id, slug, name_ar, auth_mode, base_url, credential_ref, status, notes_ar, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).bind(id, slug, nameAr, authMode, baseUrl, credentialRef, nullableText(value.notes_ar) ?? null, actor),
      // The ref is a secret NAME, so recording it is not a disclosure — and knowing which
      // secret a provider was pointed at is the whole point of the entry.
      auditStatement(c.env.DB, actor, 'create', 'ai_provider', id, { slug, auth_mode: authMode, base_url: baseUrl, credential_ref: credentialRef }),
    ]);
  } catch (error) {
    return c.json(invalid(`تعذّر إنشاء المزوّد: ${error instanceof Error ? error.message : String(error)}`), 409);
  }
  return c.json({ success: true, data: { id, slug } }, 201);
});

route.patch('/ai/providers/:id', requirePermission('manage_ai_providers'), async (c) => {
  const id = pathParam(c, 'id');
  const value = await body(c);
  if (!value) return c.json(invalid('A JSON object is required'), 400);
  if (!await queryFirst(c.env.DB, 'SELECT id FROM ai_providers WHERE id = ?', [id])) {
    return c.json(invalid('Provider not found'), 404);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue); };

  if (value.name_ar !== undefined) {
    const nameAr = text(value.name_ar);
    if (!nameAr) return c.json(invalid('name_ar cannot be empty', 'name_ar'), 400);
    add('name_ar', nameAr);
  }
  if (value.auth_mode !== undefined) {
    const authMode = text(value.auth_mode);
    if (!authMode || !isAuthMode(authMode)) return c.json(invalid('Unsupported auth_mode', 'auth_mode'), 400);
    add('auth_mode', authMode);
  }
  if (value.base_url !== undefined) {
    const baseUrl = providerBaseUrl(value.base_url);
    if (!baseUrl) return c.json(invalid('base_url must be an HTTPS origin with no query or fragment', 'base_url'), 400);
    add('base_url', baseUrl);
  }
  if (value.credential_ref !== undefined) {
    const credentialRef = text(value.credential_ref);
    if (!credentialRef || !isCredentialRef(credentialRef)) {
      return c.json(invalid(`credential_ref must be one of: ${AI_CREDENTIAL_REFS.join(', ')}`, 'credential_ref'), 400);
    }
    add('credential_ref', credentialRef);
  }
  if (value.status !== undefined) {
    const status = text(value.status);
    if (status !== 'active' && status !== 'disabled') return c.json(invalid('Invalid status', 'status'), 400);
    add('status', status);
  }
  if (value.notes_ar !== undefined) add('notes_ar', nullableText(value.notes_ar) ?? null);

  if (!sets.length) return c.json(invalid('No supported fields supplied'), 400);
  sets.push(`updated_at = datetime('now')`);
  add('updated_by', actorId(c));

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE ai_providers SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      auditStatement(c.env.DB, actorId(c), 'update', 'ai_provider', id, value),
    ]);
  } catch (error) {
    return c.json(invalid(`تعذّر التحديث: ${error instanceof Error ? error.message : String(error)}`), 409);
  }
  return c.json({ success: true, data: { id, updated: true } });
});

/// Disables rather than deletes.
///
/// A hard delete cascades to every model and every route pointing at it, silently
/// emptying the routing of any task that depended on it. Disabling keeps the rows, and
/// `skipReasonFor` reports `provider_disabled` so the screen names the cause.
route.delete('/ai/providers/:id', requirePermission('manage_ai_providers'), async (c) => {
  const id = pathParam(c, 'id');
  if (!await queryFirst(c.env.DB, 'SELECT id FROM ai_providers WHERE id = ?', [id])) {
    return c.json(invalid('Provider not found'), 404);
  }
  const affected = await queryFirst<{ total: number }>(c.env.DB, `
    SELECT COUNT(*) AS total FROM ai_task_routes r
      JOIN ai_models m ON m.id = r.model_id
     WHERE m.provider_id = ? AND r.is_enabled = 1
  `, [id]);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE ai_providers SET status = 'disabled', updated_at = datetime('now'), updated_by = ? WHERE id = ?`)
      .bind(actorId(c), id),
    auditStatement(c.env.DB, actorId(c), 'archive', 'ai_provider', id, { affected_routes: Number(affected?.total ?? 0) }),
  ]);
  return c.json({
    success: true,
    data: { id, status: 'disabled', affected_routes: Number(affected?.total ?? 0) },
  });
});

/* ---------------------------------------------------------------- models */

/// Validates the optional numeric/price fields shared by create and update.
///
/// Returns an error message rather than throwing so both handlers can answer 400 with a
/// field name, and so the price pairing rule is stated once.
function modelNumbers(value: Record<string, unknown>): { error?: string; field?: string; price?: [number | null, string | null] } {
  for (const field of ['max_input_tokens', 'max_output_tokens'] as const) {
    if (value[field] === undefined || value[field] === null || value[field] === '') continue;
    const parsed = integer(value[field]);
    if (parsed === null || parsed < 1) return { error: `${field} must be a positive integer`, field };
  }

  const hasMicros = value.price_micros !== undefined && value.price_micros !== null && value.price_micros !== '';
  const hasUnit = value.price_unit !== undefined && value.price_unit !== null && value.price_unit !== '';
  if (!hasMicros && !hasUnit) return {};

  // The column CHECK enforces this too; refusing here produces a field-named 400 instead
  // of an opaque constraint failure.
  if (hasMicros !== hasUnit) {
    return { error: 'price_micros and price_unit must be supplied together', field: 'price_micros' };
  }
  const micros = integer(value.price_micros);
  if (micros === null || micros < 0) return { error: 'price_micros must be a non-negative integer', field: 'price_micros' };
  const unit = text(value.price_unit);
  if (!unit || !isPriceUnit(unit)) return { error: 'Unsupported price_unit', field: 'price_unit' };
  return { price: [micros, unit] };
}

route.post('/ai/models', requirePermission('manage_ai_providers'), async (c) => {
  const value = await body(c);
  if (!value) return c.json(invalid('A JSON object is required'), 400);

  const providerId = text(value.provider_id);
  const modelRef = text(value.model_id);
  const nameAr = text(value.name_ar);
  const modality = text(value.modality);

  if (!providerId) return c.json(invalid('provider_id is required', 'provider_id'), 400);
  if (!modelRef) return c.json(invalid('model_id is required', 'model_id'), 400);
  if (!nameAr) return c.json(invalid('name_ar is required', 'name_ar'), 400);
  if (!modality || !isModality(modality)) return c.json(invalid('Unsupported modality', 'modality'), 400);
  if (!await queryFirst(c.env.DB, 'SELECT id FROM ai_providers WHERE id = ?', [providerId])) {
    return c.json(invalid('Provider not found', 'provider_id'), 400);
  }

  const numbers = modelNumbers(value);
  if (numbers.error) return c.json(invalid(numbers.error, numbers.field), 400);

  const supportsSchema = value.supports_json_schema === undefined
    ? 0
    : strictBoolInt(value.supports_json_schema);
  if (supportsSchema === null) return c.json(invalid('supports_json_schema must be a boolean', 'supports_json_schema'), 400);

  const id = `aim-${crypto.randomUUID()}`;
  const actor = actorId(c);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO ai_models (
          id, provider_id, model_id, name_ar, modality, supports_json_schema,
          max_input_tokens, max_output_tokens, price_micros, price_unit, status, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).bind(
        id, providerId, modelRef, nameAr, modality, supportsSchema,
        integer(value.max_input_tokens), integer(value.max_output_tokens),
        numbers.price?.[0] ?? null, numbers.price?.[1] ?? null, actor,
      ),
      auditStatement(c.env.DB, actor, 'create', 'ai_model', id, { provider_id: providerId, model_id: modelRef, modality }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json(invalid(message.includes('UNIQUE')
      ? 'هذا الموديل مسجَّل بالفعل لهذا المزوّد'
      : `تعذّر إنشاء الموديل: ${message}`), 409);
  }
  return c.json({ success: true, data: { id, model_id: modelRef } }, 201);
});

route.patch('/ai/models/:id', requirePermission('manage_ai_providers'), async (c) => {
  const id = pathParam(c, 'id');
  const value = await body(c);
  if (!value) return c.json(invalid('A JSON object is required'), 400);
  if (!await queryFirst(c.env.DB, 'SELECT id FROM ai_models WHERE id = ?', [id])) {
    return c.json(invalid('Model not found'), 404);
  }

  const numbers = modelNumbers(value);
  if (numbers.error) return c.json(invalid(numbers.error, numbers.field), 400);

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue); };

  if (value.name_ar !== undefined) {
    const nameAr = text(value.name_ar);
    if (!nameAr) return c.json(invalid('name_ar cannot be empty', 'name_ar'), 400);
    add('name_ar', nameAr);
  }
  if (value.model_id !== undefined) {
    const modelRef = text(value.model_id);
    if (!modelRef) return c.json(invalid('model_id cannot be empty', 'model_id'), 400);
    add('model_id', modelRef);
  }
  if (value.modality !== undefined) {
    const modality = text(value.modality);
    if (!modality || !isModality(modality)) return c.json(invalid('Unsupported modality', 'modality'), 400);
    add('modality', modality);
  }
  if (value.supports_json_schema !== undefined) {
    const flag = strictBoolInt(value.supports_json_schema);
    if (flag === null) return c.json(invalid('supports_json_schema must be a boolean', 'supports_json_schema'), 400);
    add('supports_json_schema', flag);
  }
  for (const field of ['max_input_tokens', 'max_output_tokens'] as const) {
    if (value[field] === undefined) continue;
    add(field, value[field] === null || value[field] === '' ? null : integer(value[field]));
  }
  if (value.price_micros !== undefined || value.price_unit !== undefined) {
    add('price_micros', numbers.price?.[0] ?? null);
    add('price_unit', numbers.price?.[1] ?? null);
  }
  if (value.status !== undefined) {
    const status = text(value.status);
    if (status !== 'active' && status !== 'disabled') return c.json(invalid('Invalid status', 'status'), 400);
    add('status', status);
  }

  if (!sets.length) return c.json(invalid('No supported fields supplied'), 400);
  sets.push(`updated_at = datetime('now')`);
  add('updated_by', actorId(c));

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE ai_models SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      auditStatement(c.env.DB, actorId(c), 'update', 'ai_model', id, value),
    ]);
  } catch (error) {
    return c.json(invalid(`تعذّر التحديث: ${error instanceof Error ? error.message : String(error)}`), 409);
  }
  return c.json({ success: true, data: { id, updated: true } });
});

route.delete('/ai/models/:id', requirePermission('manage_ai_providers'), async (c) => {
  const id = pathParam(c, 'id');
  if (!await queryFirst(c.env.DB, 'SELECT id FROM ai_models WHERE id = ?', [id])) {
    return c.json(invalid('Model not found'), 404);
  }
  const affected = await queryFirst<{ total: number }>(
    c.env.DB, 'SELECT COUNT(*) AS total FROM ai_task_routes WHERE model_id = ? AND is_enabled = 1', [id],
  );
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE ai_models SET status = 'disabled', updated_at = datetime('now'), updated_by = ? WHERE id = ?`)
      .bind(actorId(c), id),
    auditStatement(c.env.DB, actorId(c), 'archive', 'ai_model', id, { affected_routes: Number(affected?.total ?? 0) }),
  ]);
  return c.json({ success: true, data: { id, status: 'disabled', affected_routes: Number(affected?.total ?? 0) } });
});

/* ---------------------------------------------------------------- routing */

/// Replaces one task's routing wholesale, in a single batch.
///
/// Whole-set replacement rather than per-row edits because `UNIQUE (task_id, priority)`
/// makes incremental reordering collide the moment a route moves into an occupied slot —
/// the same constraint that forced `POST /stories/:id/pages/reorder` to exist. Deleting
/// then inserting inside one `db.batch()` means a rejected payload leaves the previous
/// routing untouched instead of half-applied.
route.put('/ai/tasks/:taskId/routes', requirePermission('manage_ai_providers'), async (c) => {
  const taskId = pathParam(c, 'taskId');
  const value = await body(c);
  if (!value) return c.json(invalid('A JSON object is required'), 400);

  const task = await queryFirst<AiTaskRow>(c.env.DB, 'SELECT * FROM ai_tasks WHERE id = ?', [taskId]);
  if (!task) return c.json(invalid('Task not found'), 404);

  const supplied = value.routes;
  if (!Array.isArray(supplied)) return c.json(invalid('routes must be an array', 'routes'), 400);
  if (supplied.length > MAX_PRIORITY) {
    return c.json(invalid(`A task accepts at most ${MAX_PRIORITY} routes`, 'routes'), 400);
  }

  const models = await queryAll<AiModelRow>(c.env.DB, 'SELECT * FROM ai_models');
  const modelById = new Map(models.map((model) => [model.id, model]));

  const prepared: Array<{
    modelId: string; priority: number; enabled: number; params: string;
    callCap: number | null; spendCap: number | null;
  }> = [];
  const seenModels = new Set<string>();
  const seenPriorities = new Set<number>();

  for (const [index, entry] of supplied.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return c.json(invalid(`routes[${index}] must be an object`, `routes[${index}]`), 400);
    }
    const item = entry as Record<string, unknown>;
    const modelId = text(item.model_id);
    if (!modelId) return c.json(invalid(`routes[${index}].model_id is required`, `routes[${index}].model_id`), 400);

    const model = modelById.get(modelId);
    if (!model) return c.json(invalid(`routes[${index}].model_id is unknown`, `routes[${index}].model_id`), 400);

    // Refused at write time, not merely reported at read time. A route whose modality can
    // never match the task is not a fallback; it is a row that will always be skipped, and
    // storing it would make the screen look configured while nothing can run.
    if (model.modality !== task.required_modality) {
      return c.json(invalid(
        `الموديل «${model.model_id}» يُنتج ${model.modality} والمهمة تحتاج ${task.required_modality}`,
        `routes[${index}].model_id`,
      ), 400);
    }
    if (task.requires_json_schema && !model.supports_json_schema) {
      return c.json(invalid(
        `المهمة تتطلّب JSON بمخطط، والموديل «${model.model_id}» لا يدعمه`,
        `routes[${index}].model_id`,
      ), 400);
    }

    const priority = integer(item.priority) ?? index + 1;
    if (priority < 1 || priority > MAX_PRIORITY) {
      return c.json(invalid(`routes[${index}].priority must be between 1 and ${MAX_PRIORITY}`, `routes[${index}].priority`), 400);
    }
    if (seenPriorities.has(priority)) return c.json(invalid(`duplicate priority ${priority}`, 'routes'), 400);
    if (seenModels.has(modelId)) return c.json(invalid('the same model is listed twice', 'routes'), 400);
    seenPriorities.add(priority);
    seenModels.add(modelId);

    const enabled = item.is_enabled === undefined ? 1 : strictBoolInt(item.is_enabled);
    if (enabled === null) return c.json(invalid(`routes[${index}].is_enabled must be a boolean`, `routes[${index}].is_enabled`), 400);

    let params = '{}';
    if (item.params !== undefined && item.params !== null) {
      if (typeof item.params === 'object' && !Array.isArray(item.params)) {
        params = JSON.stringify(item.params);
      } else if (typeof item.params === 'string' && item.params.trim()) {
        try {
          const parsed = JSON.parse(item.params);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
          params = JSON.stringify(parsed);
        } catch {
          return c.json(invalid(`routes[${index}].params must be a JSON object`, `routes[${index}].params`), 400);
        }
      }
    }

    let callCap: number | null = null;
    if (item.daily_call_cap !== undefined && item.daily_call_cap !== null && item.daily_call_cap !== '') {
      callCap = integer(item.daily_call_cap);
      if (callCap === null || callCap < 1) {
        return c.json(invalid(`routes[${index}].daily_call_cap must be a positive integer`, `routes[${index}].daily_call_cap`), 400);
      }
    }
    let spendCap: number | null = null;
    if (item.daily_spend_cap_micros !== undefined && item.daily_spend_cap_micros !== null && item.daily_spend_cap_micros !== '') {
      spendCap = integer(item.daily_spend_cap_micros);
      if (spendCap === null || spendCap < 0) {
        return c.json(invalid(`routes[${index}].daily_spend_cap_micros must be a non-negative integer`, `routes[${index}].daily_spend_cap_micros`), 400);
      }
    }

    prepared.push({ modelId, priority, enabled, params, callCap, spendCap });
  }

  const actor = actorId(c);
  const statements = [
    c.env.DB.prepare('DELETE FROM ai_task_routes WHERE task_id = ?').bind(taskId),
    ...prepared.map((entry) => c.env.DB.prepare(`
      INSERT INTO ai_task_routes (
        id, task_id, model_id, priority, is_enabled, params_json,
        daily_call_cap, daily_spend_cap_micros, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `air-${crypto.randomUUID()}`, taskId, entry.modelId, entry.priority,
      entry.enabled, entry.params, entry.callCap, entry.spendCap, actor,
    )),
    auditStatement(c.env.DB, actor, 'update', 'ai_task_routes', taskId, {
      routes: prepared.map((entry) => ({ model_id: entry.modelId, priority: entry.priority, is_enabled: entry.enabled })),
    }),
  ];

  try {
    await c.env.DB.batch(statements);
  } catch (error) {
    return c.json(invalid(
      `تعذّر حفظ التوجيه ولم يُطبَّق شيء منه: ${error instanceof Error ? error.message : String(error)}`,
    ), 409);
  }
  return c.json({ success: true, data: { task_id: taskId, routes: prepared.length } });
});

/* ------------------------------------------------------------------ probe */

/// The probe schema. Tiny, and shaped to satisfy OpenAI strict mode, which requires
/// `additionalProperties: false` and every property listed in `required`.
const PROBE_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    language: { type: 'string' },
  },
  required: ['ok', 'language'],
  additionalProperties: false,
} as const;

/// Sends one minimal generation to confirm the credential, the model id and the schema
/// path all work.
///
/// ## This spends real money, so it is gated and logged
///
/// `POST /admin/tts/preview` learned this the hard way: it originally had no permission
/// check, so any dashboard account could drain the balance by repetition. Every probe
/// writes an `ai_call_log` row with `purpose = 'probe'`, which keeps it out of production
/// cap arithmetic while still being visible as spend.
///
/// ## Image, video and audio models are not probed here
///
/// Only text is. An image probe would mean an unapproved paid render, and paid image work
/// in this platform goes through the content factory behind an immutable plan, a spend
/// approval and an idempotency key (`0057_content_factory.sql`). Letting an admin button
/// bypass that would put a hole in the one path that guarantees cost control, so this
/// endpoint refuses instead of quietly doing it.
route.post('/ai/models/:id/probe', requirePermission('manage_ai_providers'), async (c) => {
  const id = pathParam(c, 'id');
  const model = await queryFirst<AiModelRow>(c.env.DB, 'SELECT * FROM ai_models WHERE id = ?', [id]);
  if (!model) return c.json(invalid('Model not found'), 404);
  const provider = await queryFirst<AiProviderRow>(c.env.DB, 'SELECT * FROM ai_providers WHERE id = ?', [model.provider_id]);
  if (!provider) return c.json(invalid('Provider not found'), 404);

  const actor = actorId(c);

  if (model.modality !== 'text') {
    return c.json({
      success: false,
      error: 'probe_unsupported_modality',
      detail: `اختبار موديلات ${model.modality} يعني إنتاجًا مدفوعًا بلا خطة ولا اعتماد صرف. مسار الإنتاج المدفوع هو مصنع المحتوى.`,
    }, 400);
  }

  const state = credentialState(c.env, provider.credential_ref);
  if (!state.configured) {
    return c.json({
      success: false,
      error: state.reason,
      detail: state.reason === 'credential_missing'
        ? `السرّ ${provider.credential_ref} غير مضبوط في هذه البيئة.`
        : `${provider.credential_ref} ليس ضمن الأسماء المسموحة في lib/aiRegistry.ts.`,
    }, 503);
  }

  const prompt = 'Reply with JSON only: set ok to true and language to the ISO code of Arabic.';
  const promptHash = [...new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt)),
  )].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  try {
    const result = await generateText(c.env, provider, model, {
      prompt,
      system: 'You are a connectivity probe. Answer with the requested JSON and nothing else.',
      ...(model.supports_json_schema
        ? { jsonSchema: PROBE_SCHEMA as unknown as Record<string, unknown>, schemaName: 'probe' }
        : {}),
      // Generous for a two-field answer, on purpose. Reasoning models (Muse Spark, o-series)
      // spend internal reasoning tokens out of this same budget, so a tight limit gets
      // consumed before any content is emitted and the probe fails with an empty reply —
      // reporting a broken model when the only thing wrong was the probe's own ceiling.
      maxOutputTokens: 2048,
    });

    const cost = estimateCallMicros(model, {
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
    });

    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE ai_models SET last_probe_at = datetime('now'), last_probe_status = 'ok',
               last_probe_detail = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(`${result.latency_ms}ms · ${result.input_tokens ?? '?'}→${result.output_tokens ?? '?'} tokens`, id),
      aiCallLogStatement(c.env.DB, {
        task_id: 'probe',
        model_id: model.id,
        provider_slug: provider.slug,
        model_ref: model.model_id,
        purpose: 'probe',
        status: 'ok',
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        cost_micros: cost ?? 0,
        latency_ms: result.latency_ms,
        prompt_sha256: promptHash,
        actor,
      }),
      auditStatement(c.env.DB, actor, 'probe', 'ai_model', id, { provider_slug: provider.slug, model_ref: model.model_id, status: 'ok' }),
    ]);

    return c.json({
      success: true,
      data: {
        status: 'ok',
        latency_ms: result.latency_ms,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        // Whether the strict-schema path actually produced an object, not just whether it
        // was requested.
        schema_honoured: model.supports_json_schema ? result.parsed !== null : null,
        cost_micros: cost,
        cost_known: cost !== null,
        // Truncated: a probe reply is short, but an endpoint must not decide to echo an
        // unbounded provider string into the dashboard.
        sample: result.text.slice(0, 300),
      },
    });
  } catch (error) {
    const code = error instanceof AiTextError ? error.code : 'unknown';
    const detail = error instanceof AiTextError ? error.detail ?? null : null;

    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE ai_models SET last_probe_at = datetime('now'), last_probe_status = 'failed',
               last_probe_detail = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(`${code}${detail ? `: ${detail.slice(0, 200)}` : ''}`, id),
      aiCallLogStatement(c.env.DB, {
        task_id: 'probe',
        model_id: model.id,
        provider_slug: provider.slug,
        model_ref: model.model_id,
        purpose: 'probe',
        // A refusal never reached the vendor and cost nothing; a provider failure may
        // have. `callStatusFor` keeps that distinction in one place.
        status: callStatusFor(error),
        latency_ms: null,
        prompt_sha256: promptHash,
        error_code: code,
        actor,
      }),
      auditStatement(c.env.DB, actor, 'probe', 'ai_model', id, { provider_slug: provider.slug, model_ref: model.model_id, status: 'failed', error_code: code }),
    ]);

    return c.json({ success: false, error: code, detail }, httpStatusFor(error));
  }
});

export default route;
