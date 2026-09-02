/// ENC-001 — جلسة التنزيل وترخيص الاستخدام دون إنترنت.
///
/// ## العلّة
///
/// خطة التشفير تبني كل حمايتها على جلسة تنزيل خادمية تُصدر ترخيصًا موقَّعًا، ولم
/// يكن منها شيء: صفر نقطة نهاية وصفر جدول. العميل يقرّر بنفسه أن التنزيل
/// مسموح، ويشفّر بمفتاحه، ويمنح نفسه صلاحية 30 يومًا محسوبة على ساعة الجهاز.
/// الخادم لا يعرف أن تنزيلًا حدث، فلا يعدّه ولا يحدّه ولا يبطله.
///
/// ## تقسيم المسؤوليات
///
/// * **هذا الموجّه** يحلّ المحتوى: هل هو منشور، وأي أصول يضمّ، وما بصماتها،
///   وهل يُتاح في هذه المنطقة، وأي باقة يتطلّب. ثم يوقّع الترخيص ويمنح قدرات
///   وسائط قصيرة العمر لتنزيل البايتات.
/// * **`FamilyState`** هو السلطة على الحدود والحالة: حدّ أجهزة التنزيل، وعدد
///   العناصر، والملكية، والإبطال. لا يُفرض حدّ هنا: عدٌّ في الـWorker يسمح
///   لطلبين متوازيين بتجاوزه.
///
/// ## ما لا يُصدره هذا المسار
///
/// لا مفتاح محتوى (CEK) مغلَّفًا للجهاز — ذلك `ENC-002`، ويحتاج تغيير صيغة
/// الحزمة في العميل ليأتي المفتاح من الخادم بدل أن يُشتَقّ من مفتاح التطبيق.
/// التشفير على الجهاز اليوم بمفتاح تطبيق مشتقّ لكل حزمة، وهذا مُوثَّق كحدّ.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import type { Plan } from '../lib/familyPolicy.ts';
import {
  authenticateParent,
  createMediaToken,
  mediaIsConfigured,
  type ParentPrincipal,
} from '../lib/parentAuth.ts';
import {
  OFFLINE_LICENSE_KEY_ID,
  offlineLicensingIsConfigured,
  signOfflineLicense,
} from '../lib/offlineLicense.ts';
import { availabilityContext, availabilityFor, availabilityRefusal } from '../lib/requestGeo.ts';
import {
  integrityAuditDetails,
  integrityRisk,
  INTEGRITY_SIGNALS,
  licenceTtlFor,
  parseIntegritySignals,
} from '../lib/deviceIntegrity.ts';
import { bodyOr400, boolean, nested, text } from '../lib/requestSchema.ts';

type AppEnv = { Bindings: Env };
type Envelope<T> = { success: boolean; data?: T; error?: string; code?: string };

/// مدة الترخيص. تأتي من الخادم لا من ثابت في العميل (`ENC-005`).
///
/// ثلاثون يومًا كما كان العميل يمنح نفسه، لكن القرار صار هنا: تغييره لباقة أو
/// لنوع محتوى لا يحتاج تحديث تطبيق.
const LICENSE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/// الأدوار التي تُعدّ أصلًا قابلًا للتنزيل لكل نوع كيان.
///
/// صريحة لا استبعادية: أصل بدور جديد لا يُنزَّل حتى يُضاف هنا بقرار، فلا يتسرّب
/// أصل داخلي إلى حزمة تنزيل بمجرّد ربطه بالكيان.
type DownloadableEntity = 'episode' | 'book' | 'story';

const DOWNLOADABLE_ROLES: Record<DownloadableEntity, readonly string[]> = {
  episode: ['stream', 'video'],
  book: ['narration', 'audio'],
  story: ['narration', 'audio'],
};

function downloadableEntity(value: unknown): DownloadableEntity | null {
  return value === 'episode' || value === 'book' || value === 'story' ? value : null;
}

type DownloadableAsset = {
  asset_id: string;
  r2_key: string;
  bucket: 'media' | 'thumbs';
  mime_type: string | null;
  original_filename: string | null;
  version: number;
  etag: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
};

const route = new Hono<AppEnv>();

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

function forward(result: { status: number; data: unknown }) {
  return Response.json(
    result.data ?? { success: false, error: 'Family service unavailable' },
    { status: result.status },
  );
}

/// يحلّ الكيان إلى أصوله القابلة للتنزيل، ويرفض ما ليس منشورًا.
///
/// الاستعلام يفرض نفس شروط مسار التشغيل (`episodes.ts:catalogMedia`): منشور،
/// والأصل `ready` و`private`. فحص النشر هنا وليس في العميل: عميل يحمل معرّفًا
/// قديمًا يصل إلى هذه النقطة مباشرة.
/// أنواع الكيانات التي يقبلها `content_rights.entity_type` (قيد CHECK).
///
/// `story` **ليست** فيها، فلا يمكن أن يوجد لها صفّ حقوق مهما أراد المحرّر. وهذا قيد
/// مخطوطة لا تقصير، فلا يجوز أن يُحاسَب عليه التنزيل.
const RIGHTS_BEARING: readonly DownloadableEntity[] = ['episode', 'book'];

/**
 * هل الحقوق المُعلَنة تسمح بالتنزيل؟ (`CNT-110`)
 *
 * ## العلّة
 *
 * `content_rights.licenses` تحمل **الاستعمالات المسموح بها** (`streaming`,
 * `offline`)، ومسار التنزيل لم يكن يقرؤها أصلًا. فمنصّةٌ تُنزِّل عنصرًا حقوقه
 * المُعلَنة «بثّ فقط» تُمارس حقًّا لم تُعلنه — وهذا هو معنى معيار «مصفوفة
 * DRM/Offline/Watermark» بعد قرار المالك بلا DRM (`DECIDE-101`): لا تشفير، لكن ما
 * يُعلَن يجب أن يُحترَم.
 *
 * ## ولماذا لا تُرفَض الحقوق الغائبة
 *
 * لأن الغياب ليس منعًا. وبالقياس على البيانات: الحلقات والكتب كلّها تُعلن `offline`
 * (33 و13)، والألعاب كلّها «بثّ فقط» (56) وليست قابلة للتنزيل أصلًا، و**القصص لا
 * يمكن أن تحمل صفّ حقوق** لأن قيد CHECK يستثنيها. فالرفض عند الغياب كان سيُعطّل
 * تنزيل القصص كلّها بسبب قيدٍ في المخطوطة لا بسبب حقوق — وهو «حجبُ الكلّ» الذي
 * يُعلِّم الناس تجاوز البوابات. والغياب يُحذَّر عليه في بوابة النشر أصلًا.
 *
 * فالرفض هنا **حين تُعلَن الحقوق وتستثني `offline`** فقط: دعوى صريحة تُخالَف.
 */
async function offlineRightDeclared(
  env: Env,
  entityType: DownloadableEntity,
  entityId: string,
): Promise<boolean> {
  if (!RIGHTS_BEARING.includes(entityType)) return true;
  const rows = await queryAll<{ licenses: string }>(env.DB, `
    SELECT licenses FROM content_rights WHERE entity_type = ? AND entity_id = ?
  `, [entityType, entityId]);
  if (rows.length === 0) return true;
  return rows.some((row) => {
    const parsed = ((): string[] => {
      try {
        const value = JSON.parse(row.licenses || '[]');
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
      } catch { return []; }
    })();
    // قائمة معطوبة أو فارغة ليست إعلانًا، فتُعامَل كالغياب لا كالمنع.
    return parsed.length === 0 || parsed.includes('offline');
  });
}

async function downloadable(env: Env, entityType: DownloadableEntity, entityId: string) {
  const roles = DOWNLOADABLE_ROLES[entityType];

  if (entityType === 'episode') {
    const head = await queryFirst<{ id: string; is_free: number; price_tier: Plan }>(env.DB, `
      SELECT e.id, e.is_free, s.price_tier
        FROM episodes e JOIN series s ON s.id = e.series_id
       WHERE e.id = ? AND e.status = 'published' AND e.is_published = 1
         AND s.status = 'published'
    `, [entityId]);
    if (!head) return null;
    const tracks = await queryAll<{ track_id: string }>(env.DB, `
      SELECT track_id FROM episode_tracks WHERE episode_id = ? ORDER BY track_id
    `, [entityId]);
    const assets = await assetsFor(env, 'episode', entityId, roles);
    if (!assets.length) return null;
    return {
      requiredPlan: (head.is_free ? 'free' : head.price_tier) as Plan,
      tracks: tracks.map((row) => row.track_id),
      assets,
    };
  }

  const table = entityType === 'book' ? 'books' : 'stories';
  const head = await queryFirst<{ id: string; is_free: number | null }>(env.DB, `
    SELECT id, is_free FROM ${table} WHERE id = ? AND status = 'published'
  `, [entityId]);
  if (!head) return null;
  const assets = await assetsFor(env, entityType, entityId, roles);
  if (!assets.length) return null;
  return {
    // لا `price_tier` على الكتب والقصص اليوم، فالمجاني مجاني وما عداه يتطلّب
    // `family`. الافتراض الأصرم مقصود: خطأ في الاتجاه الآخر يمنح محتوى مدفوعًا.
    requiredPlan: (head.is_free === 1 ? 'free' : 'family') as Plan,
    // لا مسارات عمرية على هذين النوعين، فكلها مسموحة.
    tracks: ['preschool', 'kids', 'junior'],
    assets,
  };
}

async function assetsFor(env: Env, entityType: string, entityId: string, roles: readonly string[]) {
  return queryAll<DownloadableAsset>(env.DB, `
    SELECT ca.id AS asset_id, ca.r2_key, ca.bucket, ca.mime_type, ca.original_filename,
           ca.version, ca.etag, ca.size_bytes, ca.checksum_sha256
      FROM asset_links al
      JOIN content_assets ca ON ca.id = al.asset_id
     WHERE al.entity_type = ? AND al.entity_id = ?
       AND al.role IN (${roles.map(() => '?').join(', ')})
       AND ca.status = 'ready' AND ca.visibility = 'private'
       AND ca.r2_key IS NOT NULL AND ca.bucket IS NOT NULL
     ORDER BY al.sort_order ASC, ca.id ASC
  `, [entityType, entityId, ...roles]);
}

async function capabilityFor(env: Env, principal: ParentPrincipal, licenseId: string, asset: DownloadableAsset) {
  return createMediaToken(env, {
    sub: principal.parentId,
    sid: principal.sessionId,
    // القدرة مربوطة بالترخيص لا بعقد تشغيل: هذا ما يجعل «لماذا نُزّل هذا
    // البايت» قابلًا للإجابة.
    lid: licenseId,
    aid: asset.asset_id,
    r2_key: asset.r2_key,
    bucket: asset.bucket,
    mime_type: asset.mime_type,
    filename: asset.original_filename,
    asset_version: asset.version,
    etag: asset.etag,
  });
}

/// `POST /api/v1/downloads/sessions`
///
/// يفتح جلسة تنزيل لعنصر واحد: يتحقّق، يُصدر ترخيصًا موقَّعًا، ويمنح قدرات
/// وسائط عمرها ثلاث دقائق لتنزيل البايتات.
route.post('/sessions', async (c) => {
  if (!mediaIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  }
  // الرفض قبل أي عمل: ترخيص بلا توقيع يقبله العميل، فيصير كل جهاز قادرًا على
  // كتابة ترخيص لنفسه. الغياب عطل تهيئة لا حالة تشغيل صالحة.
  if (!offlineLicensingIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Offline licensing is not configured' }, 503);
  }
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  // SEC-110: مخطَّط بدل قراءة أربعة حقول وتجاهل الباقي. و`integrity` كائن
  // متداخل مغلق (`SEC-107`)، فحقلٌ غير معروف داخله يُرفض كما في الجسم نفسه.
  const parsed = await bodyOr400<{
    child_id: string;
    entity_type: string;
    entity_id: string;
    integrity?: Record<string, boolean>;
  }>(c, {
    child_id: text({ max: 128 }),
    entity_type: text({ max: 32 }),
    entity_id: text({ max: 128 }),
    integrity: nested(
      Object.fromEntries(INTEGRITY_SIGNALS.map((signal) => [signal, boolean({ optional: true })])),
      { optional: true },
    ),
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const childId = body.child_id;
  const entityId = body.entity_id;
  // نوع الكيان من قائمة مغلقة: هي نفسها قائمة الأدوار القابلة للتنزيل، فلا
  // يمكن أن يُطلَب نوع بلا سياسة أصول معلَنة له.
  const entityType = downloadableEntity(body?.entity_type);
  if (!childId || !entityId) {
    return c.json({ success: false, error: 'child_id, entity_type and entity_id are required' }, 400);
  }
  if (!entityType) {
    return c.json({ success: false, error: 'This content type cannot be downloaded' }, 400);
  }

  // SEC-107: إشارات سلامة الجهاز إرشادية. لا ترفض طلبًا واحدًا، وأثرها الوحيد
  // تقصير عمر الترخيص وسطرٌ في سجلّ أودت الأسرة. وغيابها الحالة الطبيعية:
  // نسخة تطبيق أقدم لا ترسلها، وطلبها إلزاميًّا كان سيمنعها من التنزيل.
  const integritySignals = parseIntegritySignals(body?.integrity);
  const risk = integrityRisk(integritySignals);

  const content = await downloadable(c.env, entityType, entityId);
  if (!content) return c.json({ success: false, error: 'Downloadable media is unavailable' }, 404);

  // الحقوق المُعلَنة تُقرأ قبل منح ترخيص عدم اتصال (`CNT-110`). 403 لا 404: العنصر
  // موجود ومنشور، والمنع سببه حقٌّ لم يُعلَن — والرسالة تقول ذلك بدل أن تُخفيه في
  // «غير متاح».
  if (!await offlineRightDeclared(c.env, entityType, entityId)) {
    return c.json({
      success: false,
      error: 'Offline use is not among the declared rights for this content',
      code: 'offline_right_not_declared',
    }, 403);
  }

  // الإتاحة الإقليمية تُفحص عند التنزيل كما عند التشغيل: نسخة محفوظة تسافر مع
  // الجهاز، فالفحص عند التشغيل وحده كان سيسمح بحفظها قبل السفر.
  const context = availabilityContext(c.req.raw, c.env);
  const decision = await availabilityFor(c.env, entityType, entityId, context);
  if (!decision.available) {
    return c.json(availabilityRefusal(decision, context.country), 451);
  }

  // الحدود والملكية في سلطة الأسرة، لا هنا.
  const issued = await callDurable<Envelope<{
    licence: {
      id: string; child_id: string; device_id: string; auth_epoch: number;
      entity_type: string; entity_id: string; content_version: number;
      issued_at: number; expires_at: number; status: string;
    };
    assets: Array<{ asset_id: string; byte_size: number | null; source_sha256: string | null }>;
    plan: Plan;
    reused: boolean;
  }>>(familyStub(c.env, auth.principal.parentId), '/downloads/issue', {
    body: {
      session_id: auth.principal.sessionId,
      child_id: childId,
      entity_type: entityType,
      entity_id: entityId,
      // أعلى إصدار بين أصول العنصر: تغيّره يعني حزمة أخرى، والترخيص مربوط به.
      content_version: content.assets.reduce((highest, asset) => Math.max(highest, asset.version), 1),
      signature_key_id: OFFLINE_LICENSE_KEY_ID,
      required_plan: content.requiredPlan,
      allowed_tracks: content.tracks,
      ttl_ms: licenceTtlFor(risk, LICENSE_TTL_MS),
      integrity: integrityAuditDetails(integritySignals, risk),
      assets: content.assets.map((asset) => ({
        asset_id: asset.asset_id,
        byte_size: asset.size_bytes,
        source_sha256: asset.checksum_sha256,
      })),
    },
  });
  const data = issued.data?.success ? issued.data.data : null;
  if (!issued.ok || !data) return forward(issued);

  const licence = data.licence;
  const signed = await signOfflineLicense(c.env, {
    lic: licence.id,
    sub: auth.principal.parentId,
    cid: licence.child_id,
    did: licence.device_id,
    epoch: licence.auth_epoch,
    entity_type: licence.entity_type,
    entity_id: licence.entity_id,
    ver: licence.content_version,
    rights: 'offline_playback',
    plan: data.plan,
    assets: data.assets.map((asset) => ({
      id: asset.asset_id,
      sha256: asset.source_sha256,
      bytes: asset.byte_size,
    })),
    iat: Math.floor(licence.issued_at / 1000),
    exp: Math.floor(licence.expires_at / 1000),
  });

  const assets = [];
  for (const asset of content.assets) {
    assets.push({
      asset_id: asset.asset_id,
      url: `/api/v1/media/assets/${asset.asset_id}`,
      authorization: `Bearer ${await capabilityFor(c.env, auth.principal, licence.id, asset)}`,
      content_type: asset.mime_type,
      byte_size: asset.size_bytes,
      source_sha256: asset.checksum_sha256,
      asset_version: asset.version,
    });
  }

  return c.json({
    success: true,
    data: {
      licence_id: licence.id,
      licence: signed.token,
      licence_key_id: signed.claims.kid,
      expires_at: new Date(licence.expires_at).toISOString(),
      capability_expires_in: 180,
      assets,
      reused: data.reused,
      protection: 'access_controlled_no_drm',
    },
  }, data.reused ? 200 : 201);
});

/// `POST /api/v1/downloads/sessions/:licenceId/refresh`
///
/// قدرات الوسائط تعيش ثلاث دقائق، والتنزيل قد يطول. هذا يجدّدها **بلا** إصدار
/// ترخيص جديد: الترخيص عمره ثلاثون يومًا ولا علاقة له بعمر القدرة.
route.post('/sessions/:licenceId/refresh', async (c) => {
  if (!mediaIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  }
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const listed = await callDurable<Envelope<{
    licences: Array<{
      id: string; entity_type: string; entity_id: string; status: string; device_id: string;
    }>;
  }>>(familyStub(c.env, auth.principal.parentId), '/downloads/list', {
    body: { session_id: auth.principal.sessionId },
  });
  const licences = listed.data?.success ? listed.data.data?.licences ?? [] : [];
  const licence = licences.find((row) => row.id === c.req.param('licenceId'));
  // ترخيص جهاز آخر لا يُجدَّد من هذا الجهاز: القدرة تُمنح لمن يملك الترخيص.
  if (!licence || licence.device_id !== auth.principal.deviceId) {
    return c.json({ success: false, error: 'Offline licence is unavailable' }, 404);
  }

  const licenceEntity = downloadableEntity(licence.entity_type);
  const content = licenceEntity === null ? null : await downloadable(c.env, licenceEntity, licence.entity_id);
  if (!content) return c.json({ success: false, error: 'Downloadable media is unavailable' }, 404);

  const assets = [];
  for (const asset of content.assets) {
    assets.push({
      asset_id: asset.asset_id,
      url: `/api/v1/media/assets/${asset.asset_id}`,
      authorization: `Bearer ${await capabilityFor(c.env, auth.principal, licence.id, asset)}`,
    });
  }
  return c.json({ success: true, data: { assets, capability_expires_in: 180 } });
});

/// `POST /api/v1/downloads/sessions/:licenceId/complete` — التنزيل اكتمل.
route.post('/sessions/:licenceId/complete', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/downloads/complete', {
    body: { session_id: auth.principal.sessionId, licence_id: c.req.param('licenceId') },
  }));
});

/// `POST /api/v1/downloads/licences/:licenceId/renew`
///
/// يُصدر سجلًّا جديدًا موقَّعًا ولا يُحيي القديم. ويُرفض إن سقط الاشتراك.
route.post('/licences/:licenceId/renew', async (c) => {
  if (!offlineLicensingIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Offline licensing is not configured' }, 503);
  }
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const renewed = await callDurable<Envelope<{
    licence: {
      id: string; child_id: string; device_id: string; auth_epoch: number;
      entity_type: string; entity_id: string; content_version: number;
      issued_at: number; expires_at: number;
    };
    assets: Array<{ asset_id: string; byte_size: number | null; source_sha256: string | null }>;
    plan: Plan;
  }>>(familyStub(c.env, auth.principal.parentId), '/downloads/renew', {
    body: {
      session_id: auth.principal.sessionId,
      licence_id: c.req.param('licenceId'),
      ttl_ms: LICENSE_TTL_MS,
      signature_key_id: OFFLINE_LICENSE_KEY_ID,
    },
  });
  const data = renewed.data?.success ? renewed.data.data : null;
  if (!renewed.ok || !data) return forward(renewed);

  const licence = data.licence;

  // التجديد يُمارس الحقّ من جديد، فيُفحَص من جديد (`CNT-110`).
  //
  // فحصُ الإصدار وحده كان يجعل حقًّا **سُحب بعد التنزيل** يبقى ممتدًّا شهرًا بعد
  // شهر: صاحب الحقوق يُغيّر «بثّ وعدم اتصال» إلى «بثّ فقط»، ولا شيء يمنع التجديد.
  // وهي نفس علّة «البوابة تعمل مرّةً ولا تُعاد» في `CNT-101`.
  const renewEntity = downloadableEntity(licence.entity_type);
  if (renewEntity && !await offlineRightDeclared(c.env, renewEntity, licence.entity_id)) {
    return c.json({
      success: false,
      error: 'Offline use is no longer among the declared rights for this content',
      code: 'offline_right_not_declared',
    }, 403);
  }
  const signed = await signOfflineLicense(c.env, {
    lic: licence.id,
    sub: auth.principal.parentId,
    cid: licence.child_id,
    did: licence.device_id,
    epoch: licence.auth_epoch,
    entity_type: licence.entity_type,
    entity_id: licence.entity_id,
    ver: licence.content_version,
    rights: 'offline_playback',
    plan: data.plan,
    assets: data.assets.map((asset) => ({
      id: asset.asset_id, sha256: asset.source_sha256, bytes: asset.byte_size,
    })),
    iat: Math.floor(licence.issued_at / 1000),
    exp: Math.floor(licence.expires_at / 1000),
  });

  return c.json({
    success: true,
    data: {
      licence_id: licence.id,
      licence: signed.token,
      licence_key_id: signed.claims.kid,
      expires_at: new Date(licence.expires_at).toISOString(),
      renewed_from: c.req.param('licenceId'),
    },
  }, 201);
});

/// `POST /api/v1/downloads/licences/:licenceId/revoke` — بأمر وليّ الأمر.
route.post('/licences/:licenceId/revoke', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/downloads/revoke', {
    body: { session_id: auth.principal.sessionId, licence_id: c.req.param('licenceId') },
  }));
});

/// `GET /api/v1/downloads` — ما هو مرخَّص الآن، وحدود الباقة.
route.get('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/downloads/list', {
    body: { session_id: auth.principal.sessionId },
  }));
});

export default route;