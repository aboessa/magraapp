/// Text generation across registry providers.
///
/// ## Scope, stated plainly
///
/// This module can talk to two wire protocols: Google AI Studio (`generateContent`) and
/// OpenAI (`chat/completions`). The registry in D1 lets an operator add **models** and
/// change **routing** without a deploy; it does not let them add a vendor whose request
/// and response shape nobody has written. A provider slug without an adapter here fails
/// with `unsupported_provider` rather than being sent a guessed payload — the same
/// choice `services/contentFactoryProvider.ts` makes for `UNSUPPORTED_PROVIDER`.
///
/// ## Structured output is a request, and then a verification
///
/// Both vendors can be asked for schema-conforming JSON, and both can still return prose
/// on a bad day. So a schema request is followed by an actual parse, and a response that
/// does not parse is `invalid_output` — not a string handed onward for someone else to
/// discover. This is the difference between "we asked for JSON" and "we have JSON".
///
/// ## What never leaves this module
///
/// The credential. It is read from `env` through `credentialValue` at call time, placed
/// in one header, and never returned, logged, or included in an error. Provider error
/// bodies are truncated before being surfaced because they echo request context.

import type { Env } from '../lib/db.ts';
import { credentialValue, type AiModelRow, type AiProviderRow } from '../lib/aiRegistry.ts';

/// Provider slug to wire protocol.
///
/// Two protocols, more than two vendors: Meta Model API is documented as OpenAI-compatible
/// (Chat Completions at `api.meta.ai/v1`, `Authorization: Bearer`, `response_format` for
/// structured output), so it reuses the OpenAI request shape.
///
/// Written as an explicit map rather than an `=== 'google-ai' ? … : openai` ternary. With a
/// ternary, every future slug would silently inherit the OpenAI shape and appear to work
/// until a response came back malformed — a vendor must be *declared* compatible by
/// someone who checked, not become compatible by falling through a default.
const TEXT_PROTOCOL_BY_SLUG = {
  'google-ai': 'google_generate_content',
  openai: 'openai_chat_completions',
  meta: 'openai_chat_completions',
} as const;

export const AI_TEXT_ADAPTERS = Object.keys(TEXT_PROTOCOL_BY_SLUG) as Array<keyof typeof TEXT_PROTOCOL_BY_SLUG>;
export type AiTextAdapter = keyof typeof TEXT_PROTOCOL_BY_SLUG;

export function hasTextAdapter(slug: string): slug is AiTextAdapter {
  return Object.hasOwn(TEXT_PROTOCOL_BY_SLUG, slug);
}

/// Byte, not character, limits. Arabic is 2 bytes per letter in UTF-8, so a character
/// budget would be half of what an operator expects. Same reasoning as
/// `services/googleTts.ts`.
export const MAX_PROMPT_BYTES = 200_000;
export const MAX_SYSTEM_BYTES = 20_000;
/// Provider replies are JSON text. A cap keeps a misbehaving endpoint from filling
/// Worker memory, and 1 MB is far above any structured story payload.
export const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 120_000;

export class AiTextError extends Error {
  readonly code:
    | 'unconfigured'
    | 'unsupported_provider'
    | 'invalid_request'
    | 'text_too_long'
    | 'provider_unavailable'
    | 'provider_rejected'
    | 'invalid_output';
  readonly detail?: string;

  constructor(code: AiTextError['code'], detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AiTextError';
    this.code = code;
    this.detail = detail;
  }
}

export type GenerateTextRequest = {
  prompt: string;
  /// Role/behaviour instruction. Sent as `systemInstruction` on Google and as a
  /// `system` message on OpenAI.
  system?: string;
  /// When present, the provider is asked to return JSON conforming to it and the reply
  /// is parsed before returning. Must be a JSON Schema object.
  jsonSchema?: Record<string, unknown>;
  /// Name for the schema. OpenAI requires one; Google ignores it.
  schemaName?: string;
  maxOutputTokens?: number;
  /// Only sent when supplied: several current models reject an explicit temperature,
  /// and sending a default would break them for no gain.
  temperature?: number;
};

export type GenerateTextResult = {
  text: string;
  /// Populated only when `jsonSchema` was requested and the reply parsed.
  parsed: unknown | null;
  input_tokens: number | null;
  output_tokens: number | null;
  provider_slug: string;
  model_ref: string;
  latency_ms: number;
};

/* ------------------------------------------------------------------ helpers */

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function assertWithinLimits(request: GenerateTextRequest) {
  if (!request.prompt.trim()) throw new AiTextError('invalid_request', 'prompt is required');

  const promptBytes = byteLength(request.prompt);
  if (promptBytes > MAX_PROMPT_BYTES) {
    throw new AiTextError('text_too_long', `prompt is ${promptBytes} bytes; the limit is ${MAX_PROMPT_BYTES}`);
  }
  if (request.system) {
    const systemBytes = byteLength(request.system);
    if (systemBytes > MAX_SYSTEM_BYTES) {
      throw new AiTextError('text_too_long', `system is ${systemBytes} bytes; the limit is ${MAX_SYSTEM_BYTES}`);
    }
  }
  if (request.maxOutputTokens !== undefined
    && (!Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens < 1)) {
    throw new AiTextError('invalid_request', 'maxOutputTokens must be a positive integer');
  }
  if (request.temperature !== undefined
    && (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 2)) {
    throw new AiTextError('invalid_request', 'temperature must be between 0 and 2');
  }
}

/// Guards the model id before it is interpolated into a URL path.
///
/// Google puts the model in the path (`/models/{model}:generateContent`), so an
/// unvalidated value is a path-traversal vector into another API surface.
function assertModelRef(model: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,100}$/.test(model)) {
    throw new AiTextError('invalid_request', `unsupported model id "${model.slice(0, 60)}"`);
  }
}

/// Reads a bounded response body. Streaming past the cap is abandoned rather than
/// buffered, so a provider cannot decide how much Worker memory to consume.
async function boundedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get('Content-Length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new AiTextError('provider_unavailable', `response declared ${declared} bytes`);
  }
  const body = await response.text();
  if (byteLength(body) > MAX_RESPONSE_BYTES) {
    throw new AiTextError('provider_unavailable', 'response exceeded the size limit');
  }
  return body;
}

function providerFailure(response: Response, body: string): never {
  // Truncated because provider error bodies echo the request, which carries story text.
  throw new AiTextError(
    response.status >= 500 || response.status === 429 ? 'provider_unavailable' : 'provider_rejected',
    `provider returned ${response.status}: ${body.slice(0, 300)}`,
  );
}

async function postJson(url: string, headers: Record<string, string>, payload: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => null);
  if (!response) throw new AiTextError('provider_unavailable', 'no response from provider');
  return response;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/// Parses the reply when a schema was requested.
///
/// Models sometimes wrap JSON in a fenced code block even when asked not to, so one
/// fence is stripped before parsing. Anything still unparseable is `invalid_output`:
/// returning prose to a caller expecting a schema moves the failure somewhere harder to
/// diagnose.
function parseStructured(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new AiTextError('invalid_output', 'provider did not return parseable JSON');
  }
}

/* ------------------------------------------------------------- Google AI Studio */

/// Keys Google accepts inside `generationConfig.responseSchema`.
///
/// It is a subset of OpenAPI 3.0 Schema, not full JSON Schema.
const GOOGLE_SCHEMA_KEYS = new Set([
  'type', 'format', 'description', 'nullable', 'enum',
  'items', 'properties', 'required', 'propertyOrdering', 'anyOf',
  'minItems', 'maxItems', 'minimum', 'maximum',
]);

/// Translates a JSON Schema into the dialect Google accepts.
///
/// ## Why this is not the caller's problem
///
/// OpenAI strict mode *requires* `additionalProperties: false` on every object, and
/// Google rejects the same key outright with
/// `Unknown name "additionalProperties" ... Cannot find field`. A caller cannot satisfy
/// both with one schema, so each adapter translates instead of every task author writing
/// two schemas and keeping them in step.
///
/// Implemented as an allow-list rather than deleting known-bad keys: an unknown key added
/// by a future JSON Schema draft would otherwise reach Google and fail the same way, and
/// the failure would look like a model problem rather than a translation gap.
function googleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(googleSchema);
  if (!value || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(source)) {
    if (!GOOGLE_SCHEMA_KEYS.has(key)) continue;
    if (key === 'properties' && entry && typeof entry === 'object') {
      const properties: Record<string, unknown> = {};
      for (const [name, definition] of Object.entries(entry as Record<string, unknown>)) {
        properties[name] = googleSchema(definition);
      }
      result[key] = properties;
    } else if (key === 'items' || key === 'anyOf') {
      result[key] = googleSchema(entry);
    } else {
      result[key] = entry;
    }
  }
  return result;
}

async function generateViaGoogleAi(
  apiKey: string,
  baseUrl: string,
  modelRef: string,
  request: GenerateTextRequest,
): Promise<Omit<GenerateTextResult, 'provider_slug' | 'model_ref' | 'latency_ms'>> {
  const generationConfig: Record<string, unknown> = {};
  if (request.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = request.maxOutputTokens;
  if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
  if (request.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    // Translated, not passed through: see googleSchema above.
    generationConfig.responseSchema = googleSchema(request.jsonSchema);
  }

  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
  };

  const response = await postJson(
    `${baseUrl}/v1beta/models/${modelRef}:generateContent`,
    { 'x-goog-api-key': apiKey },
    payload,
  );
  const body = await boundedText(response);
  if (!response.ok) providerFailure(response, body);

  let parsedBody: Record<string, unknown> | null = null;
  try { parsedBody = JSON.parse(body) as Record<string, unknown>; } catch { parsedBody = null; }
  if (!parsedBody) throw new AiTextError('provider_unavailable', 'provider response was not JSON');

  const candidates = parsedBody.candidates;
  const first = Array.isArray(candidates) ? candidates[0] as Record<string, unknown> | undefined : undefined;

  // A blocked or truncated generation returns 200 with no usable part, so the finish
  // reason is surfaced instead of an empty string that reads as a successful call.
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => (part && typeof part === 'object' ? (part as Record<string, unknown>).text : null))
      .filter((value): value is string => typeof value === 'string').join('')
    : '';
  if (!text) {
    const finish = typeof first?.finishReason === 'string' ? first.finishReason : 'no_content';
    throw new AiTextError('invalid_output', `provider returned no text (finishReason: ${finish})`);
  }

  const usage = parsedBody.usageMetadata as Record<string, unknown> | undefined;
  return {
    text,
    parsed: request.jsonSchema ? parseStructured(text) : null,
    input_tokens: integerOrNull(usage?.promptTokenCount),
    output_tokens: integerOrNull(usage?.candidatesTokenCount),
  };
}

/* -------------------------------------------------------------------- OpenAI */

async function generateViaOpenAi(
  apiKey: string,
  baseUrl: string,
  modelRef: string,
  request: GenerateTextRequest,
): Promise<Omit<GenerateTextResult, 'provider_slug' | 'model_ref' | 'latency_ms'>> {
  const messages: Array<Record<string, string>> = [];
  if (request.system) messages.push({ role: 'system', content: request.system });
  messages.push({ role: 'user', content: request.prompt });

  const payload: Record<string, unknown> = { model: modelRef, messages };
  if (request.maxOutputTokens !== undefined) payload.max_completion_tokens = request.maxOutputTokens;
  if (request.temperature !== undefined) payload.temperature = request.temperature;
  if (request.jsonSchema) {
    // `strict: true` is what makes this a guarantee rather than a request. It requires
    // the schema to set additionalProperties:false and list every property as required;
    // a schema that does not is rejected by OpenAI with a 400, which surfaces here as
    // `provider_rejected` with the reason intact.
    //
    // Verified against OpenAI. On Meta Model API this is documented support for
    // `response_format` structured output, but it is NOT confirmed on the wire: Meta
    // checks the key before validating the body, so a probe with an invalid key returns
    // 401 and never exercises the schema. The first probe with a real Meta key is what
    // settles it, and a rejection will arrive here as `provider_rejected` naming the
    // offending field rather than as a silent fallback to prose.
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: request.schemaName ?? 'structured_output',
        strict: true,
        schema: request.jsonSchema,
      },
    };
  }

  const response = await postJson(
    `${baseUrl}/v1/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    payload,
  );
  const body = await boundedText(response);
  if (!response.ok) providerFailure(response, body);

  let parsedBody: Record<string, unknown> | null = null;
  try { parsedBody = JSON.parse(body) as Record<string, unknown>; } catch { parsedBody = null; }
  if (!parsedBody) throw new AiTextError('provider_unavailable', 'provider response was not JSON');

  const choices = parsedBody.choices;
  const first = Array.isArray(choices) ? choices[0] as Record<string, unknown> | undefined : undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === 'string' ? message.content : '';

  if (!text) {
    // A refusal is a distinct, documented field on the strict-schema path.
    const refusal = typeof message?.refusal === 'string' ? message.refusal : null;
    const finish = typeof first?.finish_reason === 'string' ? first.finish_reason : 'no_content';
    if (refusal) throw new AiTextError('invalid_output', `provider refused: ${refusal.slice(0, 200)}`);
    // Named rather than left as a bare finish_reason: on a reasoning model this is almost
    // always the output budget being spent on internal reasoning before any content, and
    // "no text" alone sends the reader looking at the model instead of the limit.
    if (finish === 'length') {
      throw new AiTextError('invalid_output',
        'output budget was exhausted before any text; reasoning models spend maxOutputTokens on internal reasoning, so raise it');
    }
    throw new AiTextError('invalid_output', `provider returned no text (finish_reason: ${finish})`);
  }

  const usage = parsedBody.usage as Record<string, unknown> | undefined;
  return {
    text,
    parsed: request.jsonSchema ? parseStructured(text) : null,
    input_tokens: integerOrNull(usage?.prompt_tokens),
    output_tokens: integerOrNull(usage?.completion_tokens),
  };
}

/* ---------------------------------------------------------------- public API */

/// Generates text through the provider and model given by the registry.
///
/// Throws [AiTextError] for every failure mode so a caller can map a cause to a status
/// code and to an `ai_call_log` status, rather than inferring it from a message string.
export async function generateText(
  env: Env,
  provider: Pick<AiProviderRow, 'slug' | 'base_url' | 'credential_ref' | 'auth_mode'>,
  model: Pick<AiModelRow, 'model_id' | 'modality'>,
  request: GenerateTextRequest,
): Promise<GenerateTextResult> {
  if (model.modality !== 'text') {
    throw new AiTextError('invalid_request', `model produces ${model.modality}, not text`);
  }
  if (!hasTextAdapter(provider.slug)) {
    throw new AiTextError('unsupported_provider', `no text adapter for provider "${provider.slug}"`);
  }
  // HTTPS is already a CHECK on the column; re-asserted here because this is the line
  // that actually transmits a credential.
  if (!provider.base_url.toLowerCase().startsWith('https://')) {
    throw new AiTextError('invalid_request', 'provider base_url must be HTTPS');
  }

  assertModelRef(model.model_id);
  assertWithinLimits(request);

  const apiKey = credentialValue(env, provider.credential_ref);
  if (!apiKey) throw new AiTextError('unconfigured', `secret ${provider.credential_ref} is not set`);

  const baseUrl = provider.base_url.replace(/\/+$/, '');
  const started = Date.now();
  const result = TEXT_PROTOCOL_BY_SLUG[provider.slug] === 'google_generate_content'
    ? await generateViaGoogleAi(apiKey, baseUrl, model.model_id, request)
    : await generateViaOpenAi(apiKey, baseUrl, model.model_id, request);

  return {
    ...result,
    provider_slug: provider.slug,
    model_ref: model.model_id,
    latency_ms: Date.now() - started,
  };
}

/// Maps a text-generation failure to the `ai_call_log.status` value that describes it.
///
/// Kept beside the error class so the log cannot drift from the failure taxonomy: a
/// refusal that never reached the provider must not be recorded as a provider failure,
/// because caps count everything except refusals.
export function callStatusFor(error: unknown): 'refused' | 'provider_failed' | 'invalid_output' {
  if (!(error instanceof AiTextError)) return 'provider_failed';
  switch (error.code) {
    case 'unconfigured':
    case 'unsupported_provider':
    case 'invalid_request':
    case 'text_too_long':
      // None of these reached the vendor, so none of them cost anything.
      return 'refused';
    case 'invalid_output':
      return 'invalid_output';
    default:
      return 'provider_failed';
  }
}

/// HTTP status for a text-generation failure. `unconfigured` and provider outages are
/// 503 (retry may help); everything else is 400 (retrying the same request will not).
export function httpStatusFor(error: unknown): 400 | 500 | 503 {
  if (!(error instanceof AiTextError)) return 500;
  if (error.code === 'unconfigured' || error.code === 'provider_unavailable') return 503;
  return 400;
}
