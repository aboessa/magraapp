import { Hono } from 'hono'
import { requirePermission } from '../lib/adminAuth'
import { actorId, auditStatement } from '../lib/auditLog'
import { bucketForAsset } from '../lib/assetBuckets'
import type { Env } from '../lib/db'
import {
  DEFAULT_TTS_MODEL,
  GoogleTtsError,
  MAX_COMBINED_BYTES,
  MAX_PROMPT_BYTES,
  MAX_TEXT_BYTES,
  TTS_VOICES,
  googleTtsIsConfigured,
  synthesizeSpeech,
  ttsTransport,
  type TtsEncoding,
} from '../services/googleTts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

/// A single narration take is a few minutes of speech at most, never a
/// full-length production audio track. 30 MiB is generous for that (roughly
/// half an hour of MP3 at a typical bitrate) and keeps a misused endpoint from
/// becoming a general-purpose upload path.
const MAX_NARRATION_BYTES = 30 * 1024 * 1024

/// Maps a provider failure to a status code.
///
/// Distinguishing these matters operationally: a 400 means the request was wrong
/// and retrying will not help, while a 503 means the provider was unreachable and
/// a retry is appropriate.
function ttsErrorResponse(error: unknown) {
  if (!(error instanceof GoogleTtsError)) {
    return { status: 500 as const, body: { success: false, error: 'Narration generation failed' } }
  }
  const status = error.code === 'unconfigured'
    ? 503 as const
    : error.code === 'provider_unavailable'
      ? 503 as const
      : 400 as const
  return {
    status,
    body: { success: false, error: error.code, detail: error.detail ?? null },
  }
}

// GET /api/v1/admin/tts/config
//
// Reports whether narration can be generated and through which transport, without
// ever returning the credential itself. The admin UI uses this to decide between
// showing the generate action and showing setup instructions.
route.get('/tts/config', (c) => {
  const transport = ttsTransport(c.env)
  return c.json({
    success: true,
    data: {
      configured: transport !== null,
      // 'cloud_tts' returns MP3 directly; 'ai_studio' returns PCM that the
      // service wraps as WAV. Surfaced so the UI can explain the difference.
      transport,
      default_model: DEFAULT_TTS_MODEL,
      voices: TTS_VOICES,
      limits: {
        text_bytes: MAX_TEXT_BYTES,
        prompt_bytes: MAX_PROMPT_BYTES,
        combined_bytes: MAX_COMBINED_BYTES,
        // Arabic is 2 bytes per letter in UTF-8, so the byte budget is roughly
        // half in letters. Stated explicitly because the limit is easy to
        // misread as a character count.
        note_ar: 'الحدود بالبايت لا بالحرف. الحرف العربي = 2 بايت، أي ~2000 حرف للنص.',
      },
      // Only ar-EG is GA for Gemini-TTS; ar-001 is still Preview.
      recommended_language: 'ar-EG',
    },
  })
})

// POST /api/v1/admin/tts/preview
//
// Synthesizes one utterance and streams the audio straight back. Deliberately does
// NOT persist anything: this is the "does my key work and does this voice suit the
// story" loop, and writing a content_assets row for every experiment would fill
// the media library with throwaway takes.
//
// `upload_audio` رغم أنه لا يرفع شيئًا: هذا المسار ينادي واجهة Google مدفوعة
// على كل طلب، فهو ينفق من رصيد المنصّة ويُصدر نداءً خارجيًا باسمها. كان بلا أي
// فحص صلاحية، فأي حساب لوحة — حتى `viewer` — يستنزف الرصيد بالتكرار.
// `upload_audio` هي أقرب صلاحية موجودة للمعنى: من يملك حق إنتاج صوت للقصص.
route.post('/tts/preview', requirePermission('upload_audio'), async (c) => {
  if (!googleTtsIsConfigured(c.env)) {
    return c.json(
      { success: false, error: 'unconfigured', detail: 'No Google TTS credential is configured' },
      503,
    )
  }

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400)

  const text = typeof body.text === 'string' ? body.text : ''
  const prompt = typeof body.prompt === 'string' ? body.prompt : undefined
  const voice = typeof body.voice === 'string' ? body.voice : 'Kore'
  const languageCode = typeof body.language_code === 'string' ? body.language_code : 'ar-EG'
  const model = typeof body.model === 'string' ? body.model : undefined
  const encoding = typeof body.encoding === 'string' ? body.encoding as TtsEncoding : undefined

  try {
    const result = await synthesizeSpeech(c.env, {
      text,
      prompt,
      voice,
      languageCode,
      model,
      encoding,
    })
    // Returned as audio rather than base64 JSON so the dashboard can point an
    // <audio> element straight at it.
    return new Response(result.audio as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(result.audio.length),
        'Cache-Control': 'no-store',
        // Echoed so the UI can show what actually produced the sample.
        'X-Tts-Transport': result.transport,
        'X-Tts-Model': result.model,
        'X-Tts-Voice': result.voice,
      },
    })
  } catch (error) {
    const mapped = ttsErrorResponse(error)
    return c.json(mapped.body, mapped.status)
  }
})

// POST /api/v1/admin/tts/assets
//
// Persists a narration take the editor has already previewed into the media
// library, so "download the file and re-upload it from the media page" is no
// longer the only way to keep a generated narration. This does not call
// Google again: the audio bytes are the request body, exactly what the editor
// already heard in the preview player, so approving a take never risks
// regenerating a different one.
//
// Narration audio is always private (assetClassification.ts: "narration
// classifies private, not public CDN artwork"), so visibility is not a
// caller-supplied field here — unlike POST /assets, which lets the caller
// declare it for catalogue artwork that may legitimately be public.
route.post('/tts/assets', requirePermission('upload_audio'), async (c) => {
  // Header values must be ASCII; the editor's title is usually Arabic, so the
  // client percent-encodes it. Matches X-File-Name in adminAssets.ts.
  const rawTitle = c.req.header('X-Narration-Title')?.trim()
  let title = rawTitle
  if (rawTitle) {
    try { title = decodeURIComponent(rawTitle) } catch { /* keep the raw header value */ }
  }
  if (!title) return c.json({ success: false, error: 'X-Narration-Title is required' }, 400)

  const mime = (c.req.header('Content-Type') || '').split(';')[0].trim().toLowerCase()
  if (!mime.startsWith('audio/')) return c.json({ success: false, error: 'Content-Type must be an audio type' }, 415)

  const size = Number.parseInt(c.req.header('Content-Length') ?? '', 10)
  if (!Number.isInteger(size) || size < 1) return c.json({ success: false, error: 'Content-Length is required' }, 411)
  if (size > MAX_NARRATION_BYTES) return c.json({ success: false, error: 'Narration audio exceeds the size limit' }, 413)
  if (!c.req.raw.body) return c.json({ success: false, error: 'Audio body is required' }, 400)

  const voice = c.req.header('X-Narration-Voice')?.trim() || null
  const model = c.req.header('X-Narration-Model')?.trim() || null
  const transport = c.req.header('X-Narration-Transport')?.trim() || null
  const language = c.req.header('X-Narration-Language')?.trim() || null

  const extension = mime.includes('mpeg') ? 'mp3' : mime.includes('ogg') ? 'ogg' : 'wav'
  const id = crypto.randomUUID()
  const visibility = 'private' as const
  const bucketName = bucketForAsset({ visibility, kind: 'audio' })
  const bucket = bucketName === 'thumbs' ? c.env.THUMBS_BUCKET : c.env.MEDIA_BUCKET
  const key = `private/audio/${new Date().toISOString().slice(0, 10)}/narration-${id}.${extension}`

  const result = await bucket.put(key, c.req.raw.body, {
    httpMetadata: { contentType: mime, cacheControl: 'private, no-store' },
    customMetadata: { assetId: id, visibility, source: 'tts_generated' },
  })

  const metadata = {
    tts_voice: voice,
    tts_model: model,
    tts_transport: transport,
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO content_assets (
        id, title_ar, kind, source, status, r2_key, bucket, mime_type, size_bytes,
        etag, visibility, language, metadata, uploaded_by
      ) VALUES (?, ?, 'audio', 'generated', 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, title, key, bucketName, mime, size, result.etag, visibility, language, JSON.stringify(metadata), actorId(c)),
    auditStatement(c.env.DB, actorId(c), 'create', 'content_asset', id, { title_ar: title, kind: 'audio', source: 'tts_generated', voice, model, transport }),
  ])

  return c.json({ success: true, data: { id, status: 'ready', r2_key: key } }, 201)
})

export default route
