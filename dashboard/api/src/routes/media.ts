import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { mediaIsConfigured, verifyMediaToken } from '../lib/parentAuth.ts';

type AppEnv = { Bindings: Env };

const mediaRoute = new Hono<AppEnv>();

function bucket(env: Env, name: 'media' | 'thumbs') {
  return name === 'thumbs' ? env.THUMBS_BUCKET : env.MEDIA_BUCKET;
}

function cleanEtag(value: string) {
  return value.replace(/^W\//, '').replace(/^"|"$/g, '');
}

/// `GET /api/v1/media/assets/:assetId`
///
/// ## لماذا تُقبل القدرة في سلسلة الاستعلام أيضًا
///
/// الترويسة هي المسار المُفضَّل ويستخدمها كل عميل يستطيع ضبطها:
/// `playback_page.dart` و`audio_player_page.dart` و`reader_narration.dart` كلها
/// تُرسل `Authorization` عن قصد وبتعليق يشرح ذلك.
///
/// لكن مستهلكَين لا يستطيعان ضبط ترويسة لكل طلب:
///
/// 1. **متغيّرات HLS.** `routes/episodes.ts` يكتب روابط الـvariants داخل
///    الـmaster playlist، والمشغّل يجلبها بنفسه بلا وسيط يضيف ترويسة.
/// 2. **صوت الألعاب.** `media_audio_player.dart` يبني الرابط عبر `urlBuilder`
///    ويسلّمه لمشغّل يقبل رابطًا فقط.
///
/// إسقاط هذا الفرع كان سيكسر الاثنين صامتًا، فهو **تنازل موثَّق** لا سهو. ما
/// يجعله مقبولًا هو أن التوكن قدرة قصيرة العمر (ثلاث دقائق،
/// `MEDIA_TOKEN_TTL_SECONDS` في `lib/parentAuth.ts`) مربوطة بأصل واحد
/// (`claims.aid`)، وأن الاستجابة تحمل `no-store` و`no-referrer` فلا يتسرّب
/// الرابط عبر `Referer` إلى أي أصل خارجي.
///
/// ما يبقى مطلوبًا (متابعة، ليس هنا): تمرير الترويسة في مسار صوت الألعاب —
/// يستلزم توسيع `GameAudioPlayer` ليقبل ترويسات — حتى يبقى هذا الفرع لـHLS
/// وحده. وحتى ذلك الحين لا يجوز تسجيل سلسلة الاستعلام على الحافة.
mediaRoute.get('/assets/:assetId', async (c) => {
  if (!mediaIsConfigured(c.env)) return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  const queryToken = c.req.query('token');
  const authHeader = c.req.header('Authorization') ?? (queryToken ? `Bearer ${queryToken}` : undefined);
  const claims = await verifyMediaToken(c.env, authHeader);
  const assetId = c.req.param('assetId');
  if (!claims || claims.aid !== assetId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  // Every field required to locate the private R2 object is carried in the
  // short-lived signed capability. No D1 or Durable Object read occurs here.
  const range = c.req.header('Range');
  const object = await bucket(c.env, claims.bucket).get(
    claims.r2_key,
    range ? { range: c.req.raw.headers } : undefined,
  );
  if (!object || (claims.etag && cleanEtag(object.etag) !== cleanEtag(claims.etag))) {
    return c.json({ success: false, error: 'Media is unavailable' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', claims.mime_type ?? headers.get('Content-Type') ?? 'application/octet-stream');
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Content-Disposition', `inline; filename="${(claims.filename ?? 'media').replace(/["\r\n]/g, '')}"`);

  if (range && 'range' in object && object.range) {
    const objectRange = object.range as { offset: number; length: number };
    headers.set('Content-Range', `bytes ${objectRange.offset}-${objectRange.offset + objectRange.length - 1}/${object.size}`);
    headers.set('Content-Length', String(objectRange.length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
});

export default mediaRoute;
