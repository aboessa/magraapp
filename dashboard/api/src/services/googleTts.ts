import type { Env } from '../lib/db';

/// Gemini-TTS client.
///
/// Two transports, because the same models are reachable two ways and the
/// credentials are not interchangeable:
///
///  * `cloud_tts` — `texttospeech.googleapis.com/v1/text:synthesize`, OAuth via a
///    service-account JWT. Accepts `prompt` and `text` as separate fields and can
///    return **MP3 directly**, so no client-side conversion is needed.
///  * `ai_studio` — `generativelanguage.googleapis.com/.../generateContent` with a
///    plain API key. Fastest to set up, but returns **raw 16-bit 24 kHz PCM with
///    no container**, so this module prepends a WAV header before returning.
///
/// Cloud TTS is preferred when both are configured: MP3 out of the box matters on
/// Workers, which cannot transcode.
///
/// Documented limits (Google Cloud Text-to-Speech, Gemini-TTS page):
///   text ≤ 4,000 bytes, prompt ≤ 4,000 bytes, combined ≤ 8,000 bytes,
///   output audio ≈ 655 s — longer input is silently TRUNCATED by the provider,
///   so this module rejects over-long input rather than shipping a cut story page.
const CLOUD_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/// Gemini-TTS requires `aiplatform.endpoints.predict`, granted by
/// `roles/aiplatform.user`. The broad cloud-platform scope is what the
/// service-account flow needs to obtain it.
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export const DEFAULT_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

/// Byte limits, not character limits. This distinction matters for Arabic: UTF-8
/// encodes Arabic letters as 2 bytes, so 4,000 bytes is roughly 2,000 letters.
export const MAX_TEXT_BYTES = 4_000;
export const MAX_PROMPT_BYTES = 4_000;
export const MAX_COMBINED_BYTES = 8_000;

/// Voices published for Gemini-TTS. Kept as an allowlist so a typo becomes a 400
/// here instead of an opaque provider error, and so the admin UI can offer a
/// closed set.
export const TTS_VOICES = [
  'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe',
  'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux',
  'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Pulcherrima', 'Puck',
  'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel',
  'Vindemiatrix', 'Zephyr', 'Zubenelgenubi',
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number];

/// Encodings Cloud TTS can return. `MP3` is the default choice here because it is
/// the only widely-cached, small-on-CDN option among them.
export type TtsEncoding = 'MP3' | 'LINEAR16' | 'OGG_OPUS';

export type TtsTransport = 'cloud_tts' | 'ai_studio';

export type SynthesizeRequest = {
  /// The words to speak.
  text: string;
  /// Performance direction, e.g. "اقرأ بصوت حكاءٍ دافئ وبإيقاع هادئ". This is what
  /// distinguishes Gemini-TTS from a plain voice: it steers tone, pace and accent.
  prompt?: string;
  /// BCP-47 tag. `ar-EG` is GA for Gemini-TTS; `ar-001` is Preview.
  languageCode: string;
  voice: string;
  model?: string;
  encoding?: TtsEncoding;
};

export type SynthesizeResult = {
  audio: Uint8Array;
  mimeType: string;
  /// Extension without a leading dot, for asset keying.
  extension: string;
  transport: TtsTransport;
  model: string;
  voice: string;
  languageCode: string;
};

export class GoogleTtsError extends Error {
  readonly code:
    | 'unconfigured'
    | 'invalid_request'
    | 'text_too_long'
    | 'provider_unavailable'
    | 'provider_rejected';
  readonly detail?: string;

  constructor(code: GoogleTtsError['code'], detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

// ------------------------------------------------------------------ encoding

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeBase64(value: string): Uint8Array {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new GoogleTtsError('provider_unavailable', 'audio payload was not valid base64');
  }
}

function parsePrivateKey(pem: string) {
  // Secrets set through `wrangler secret put` commonly arrive with literal "\n"
  // rather than real newlines, so both spellings are stripped.
  const encoded = pem
    .replace(/\\n/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  if (!encoded) throw new GoogleTtsError('unconfigured', 'private key is empty');
  try {
    return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new GoogleTtsError('unconfigured', 'private key is not valid base64 PKCS#8');
  }
}

// -------------------------------------------------------------- configuration

/// Which transport this environment can use, or null when neither is configured.
///
/// The service account wins when both are present: it is the production path, and
/// an API key left over from local testing must not silently take over.
export function ttsTransport(env: Env): TtsTransport | null {
  if (
    env.GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL
    && env.GOOGLE_TTS_PRIVATE_KEY
    && env.GOOGLE_TTS_PROJECT_ID
  ) {
    return 'cloud_tts';
  }
  if (env.GOOGLE_TTS_API_KEY) return 'ai_studio';
  return null;
}

export function googleTtsIsConfigured(env: Env) {
  return ttsTransport(env) !== null;
}

// ------------------------------------------------------------------ validation

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

/// Rejects input the provider would truncate.
///
/// Failing loudly is the point: Gemini-TTS silently cuts audio past its limits, so
/// accepting an over-long page would produce narration that stops mid-sentence
/// and looks like a content bug rather than a rejected request.
function assertWithinLimits(text: string, prompt: string) {
  if (!text.trim()) throw new GoogleTtsError('invalid_request', 'text is required');

  const textBytes = byteLength(text);
  const promptBytes = byteLength(prompt);

  if (textBytes > MAX_TEXT_BYTES) {
    throw new GoogleTtsError(
      'text_too_long',
      `text is ${textBytes} bytes; the limit is ${MAX_TEXT_BYTES}`,
    );
  }
  if (promptBytes > MAX_PROMPT_BYTES) {
    throw new GoogleTtsError(
      'text_too_long',
      `prompt is ${promptBytes} bytes; the limit is ${MAX_PROMPT_BYTES}`,
    );
  }
  if (textBytes + promptBytes > MAX_COMBINED_BYTES) {
    throw new GoogleTtsError(
      'text_too_long',
      `text and prompt total ${textBytes + promptBytes} bytes; the limit is ${MAX_COMBINED_BYTES}`,
    );
  }
}

function assertVoice(voice: string) {
  if (!(TTS_VOICES as readonly string[]).includes(voice)) {
    throw new GoogleTtsError('invalid_request', `unknown voice "${voice}"`);
  }
}

/// Guards the model id before it reaches a URL path on the AI Studio transport.
function assertModel(model: string) {
  if (!/^[a-z0-9][a-z0-9.-]{2,80}$/.test(model)) {
    throw new GoogleTtsError('invalid_request', `unsupported model id "${model}"`);
  }
}

function assertLanguage(languageCode: string) {
  // BCP-47 subset: `ar`, `ar-EG`, `ar-001`, `es-419`.
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/.test(languageCode)) {
    throw new GoogleTtsError('invalid_request', `unsupported language "${languageCode}"`);
  }
}

// --------------------------------------------------------------------- OAuth

type CachedAccessToken = { key: string; token: string; expiresAt: number };
let cachedAccessToken: CachedAccessToken | null = null;

/// Exchanges a self-signed service-account JWT for an OAuth access token.
///
/// Mirrors `services/googlePlay.ts` deliberately rather than sharing code: that
/// module is scoped to the Android Publisher API and throws `GooglePlayError`, and
/// entangling billing auth with content generation would mean a TTS
/// misconfiguration could surface as a billing error.
async function serviceAccountAccessToken(env: Env) {
  const email = env.GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_TTS_PRIVATE_KEY;
  if (!email || !privateKey) throw new GoogleTtsError('unconfigured');

  const cacheKey = `${email}:${env.GOOGLE_TTS_PROJECT_ID ?? ''}`;
  // Refresh a minute early so a token cannot expire mid-flight.
  if (cachedAccessToken?.key === cacheKey && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const claims = encodeJson({
    iss: email,
    scope: CLOUD_PLATFORM_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${claims}`;

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'pkcs8',
      parsePrivateKey(privateKey).buffer as ArrayBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch (error) {
    if (error instanceof GoogleTtsError) throw error;
    throw new GoogleTtsError('unconfigured', 'private key could not be imported');
  }

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput) as BufferSource,
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response?.ok) throw new GoogleTtsError('provider_unavailable', 'token exchange failed');
  const token = await response.json().catch(() => null) as
    { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof token?.access_token !== 'string') {
    throw new GoogleTtsError('provider_unavailable', 'token response had no access_token');
  }

  const expiresIn = typeof token.expires_in === 'number'
    ? Math.min(Math.max(token.expires_in, 60), 3600)
    : 3600;
  cachedAccessToken = {
    key: cacheKey,
    token: token.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return token.access_token;
}

// ------------------------------------------------------------------ WAV header

/// Wraps raw PCM in a 44-byte RIFF/WAVE header.
///
/// Needed only by the AI Studio transport, which returns bare 16-bit little-endian
/// PCM. This is a container change, not transcoding: no audio data is touched, so
/// it is safe inside a Worker's CPU budget.
function wrapPcmAsWav(pcm: Uint8Array, sampleRate: number, channels = 1) {
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);

  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) out[offset + i] = value.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true); // file size minus the first 8 bytes
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk length
  view.setUint16(20, 1, true); // format 1 = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/// Reads the sample rate out of a mime type such as
/// `audio/L16;codec=pcm;rate=24000`. Falls back to the documented 24 kHz default.
function sampleRateFromMime(mimeType: string) {
  const match = /rate=(\d{4,6})/.exec(mimeType);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) ? parsed : 24_000;
}

// ------------------------------------------------------------------ transports

const ENCODING_MIME: Record<TtsEncoding, { mimeType: string; extension: string }> = {
  MP3: { mimeType: 'audio/mpeg', extension: 'mp3' },
  LINEAR16: { mimeType: 'audio/wav', extension: 'wav' },
  OGG_OPUS: { mimeType: 'audio/ogg', extension: 'ogg' },
};

async function synthesizeViaCloudTts(
  env: Env,
  request: SynthesizeRequest,
  model: string,
  encoding: TtsEncoding,
): Promise<SynthesizeResult> {
  const accessToken = await serviceAccountAccessToken(env);

  const response = await fetch(CLOUD_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Quota and billing attribution; the API rejects the call without it when
      // the credential is a service account.
      'x-goog-user-project': env.GOOGLE_TTS_PROJECT_ID!,
    },
    body: JSON.stringify({
      input: {
        text: request.text,
        ...(request.prompt ? { prompt: request.prompt } : {}),
      },
      voice: {
        languageCode: request.languageCode,
        name: request.voice,
        model_name: model,
      },
      audioConfig: { audioEncoding: encoding },
    }),
    // Long-form narration is slower than a typical API call, and a page can take
    // tens of seconds. The Worker's own limit still applies above this.
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);

  if (!response) throw new GoogleTtsError('provider_unavailable', 'no response from Cloud TTS');
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GoogleTtsError(
      response.status >= 500 ? 'provider_unavailable' : 'provider_rejected',
      `Cloud TTS returned ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const payload = await response.json().catch(() => null) as { audioContent?: unknown } | null;
  if (typeof payload?.audioContent !== 'string' || !payload.audioContent) {
    throw new GoogleTtsError('provider_unavailable', 'Cloud TTS response had no audioContent');
  }

  const { mimeType, extension } = ENCODING_MIME[encoding];
  return {
    audio: decodeBase64(payload.audioContent),
    mimeType,
    extension,
    transport: 'cloud_tts',
    model,
    voice: request.voice,
    languageCode: request.languageCode,
  };
}

async function synthesizeViaAiStudio(
  env: Env,
  request: SynthesizeRequest,
  model: string,
): Promise<SynthesizeResult> {
  // AI Studio takes a single `contents` string; the documented convention is
  // "{prompt}: {text}".
  const contents = request.prompt
    ? `${request.prompt}: ${request.text}`
    : request.text;

  const response = await fetch(`${AI_STUDIO_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GOOGLE_TTS_API_KEY!,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: contents }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: request.voice } },
        },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);

  if (!response) throw new GoogleTtsError('provider_unavailable', 'no response from AI Studio');
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GoogleTtsError(
      response.status >= 500 ? 'provider_unavailable' : 'provider_rejected',
      `AI Studio returned ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  const inline = inlineAudio(payload);
  if (!inline) {
    throw new GoogleTtsError('provider_unavailable', 'AI Studio response had no inline audio');
  }

  // Documented behaviour: this transport returns headerless PCM, so a container
  // has to be added before the bytes are usable as a file.
  const wav = wrapPcmAsWav(decodeBase64(inline.data), sampleRateFromMime(inline.mimeType));
  return {
    audio: wav,
    mimeType: 'audio/wav',
    extension: 'wav',
    transport: 'ai_studio',
    model,
    voice: request.voice,
    languageCode: request.languageCode,
  };
}

/// Walks `candidates[0].content.parts[]` for the first inline audio part.
function inlineAudio(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || !candidates.length) return null;
  const content = (candidates[0] as Record<string, unknown>)?.content;
  const parts = content && typeof content === 'object'
    ? (content as Record<string, unknown>).parts
    : null;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    // Both spellings appear across Google SDK versions.
    const blob = (part as Record<string, unknown>).inlineData
      ?? (part as Record<string, unknown>).inline_data;
    if (!blob || typeof blob !== 'object') continue;
    const record = blob as Record<string, unknown>;
    const data = record.data;
    if (typeof data !== 'string' || !data) continue;
    const mimeType = typeof record.mimeType === 'string'
      ? record.mimeType
      : typeof record.mime_type === 'string' ? record.mime_type : '';
    return { data, mimeType };
  }
  return null;
}

// ------------------------------------------------------------------ public API

/// Synthesizes one utterance.
///
/// Throws [GoogleTtsError] for every failure mode so callers can map a cause to a
/// status code instead of guessing from a message string.
export async function synthesizeSpeech(
  env: Env,
  request: SynthesizeRequest,
): Promise<SynthesizeResult> {
  const transport = ttsTransport(env);
  if (!transport) throw new GoogleTtsError('unconfigured');

  const model = request.model ?? DEFAULT_TTS_MODEL;
  const prompt = request.prompt ?? '';

  assertModel(model);
  assertVoice(request.voice);
  assertLanguage(request.languageCode);
  assertWithinLimits(request.text, prompt);

  if (transport === 'cloud_tts') {
    return synthesizeViaCloudTts(env, request, model, request.encoding ?? 'MP3');
  }
  // The AI Studio transport cannot choose an encoding: it always returns PCM,
  // which this module wraps as WAV. A requested encoding is ignored rather than
  // silently producing a file whose extension lies about its contents.
  return synthesizeViaAiStudio(env, request, model);
}
