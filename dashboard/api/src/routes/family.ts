import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import {
  authenticateParent,
  createParentProof,
  parseParentProofPurpose,
  PARENT_PROOF_PURPOSES,
  verifyParentProof,
  type ParentPrincipal,
  type ParentProofPurpose,
} from '../lib/parentAuth.ts';
import {
  CONSENT_TYPES,
  evaluateConsent,
  parseConsentWrite,
  type ConsentRow,
} from '../lib/consent.ts';
import {
  boolean,
  integer,
  list,
  oneOf,
  opaque,
  parseBody,
  text,
  validationFailure,
  type BodySchema,
} from '../lib/requestSchema.ts';

type AppEnv = { Bindings: Env };
type JsonBody = Record<string, unknown>;
type Envelope<T> = { success: boolean; data?: T; error?: string };

const familyRoute = new Hono<AppEnv>();
/**
 * Purposes a `parent_area` session may exchange for without re-entering the PIN.
 *
 * Derived from `PARENT_PROOF_PURPOSES` minus `parent_area` itself rather than
 * listed by hand: the hand-written list had drifted, and it still offered
 * `manage_billing`, `support_ticket` and `approve_tv` — purposes no endpoint ever
 * checked. A set that can issue something unverifiable is how the gate became
 * decorative in the first place.
 */
const exchangeableParentPurposes = new Set<ParentProofPurpose>(
  PARENT_PROOF_PURPOSES.filter((purpose) => purpose !== 'parent_area'),
);

async function principal(c: { env: Env; req: { header(name: string): string | undefined } }) {
  return authenticateParent(c.env, c.req.header('Authorization'));
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

function parentProofDenied(reason: 'unconfigured' | 'invalid') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured'
      ? 'Parent authentication is not configured'
      : 'A current parent proof is required',
  }, { status: reason === 'unconfigured' ? 503 : 403 });
}

async function requireParentProof(
  env: Env,
  parent: ParentPrincipal,
  header: string | undefined,
  purpose: ParentProofPurpose,
  consume = false,
) {
  return verifyParentProof(env, {
    principal: parent,
    header,
    purpose,
    consume,
  });
}

/// SEC-110: مخطَّطات أجسام الطلبات لكل نقطة كتابة في هذا الموجّه.
///
/// ## لماذا مجموعة في مكان واحد
///
/// «ما يقبله هذا الموجّه» صار **مقروءًا في شاشة واحدة** بدل أن يُستخرَج من أحد
/// عشر معالجًا. وقراءته شرط مراجعته: لا يُلاحظ حقلٌ فائض ما لم يُرَ بجانب أشباهه.
///
/// ## والمعرّفات نصوص مقيَّدة لا نصوص حرّة
///
/// كل معرّف هنا يُولَّد خادميًّا (`crypto.randomUUID` أو ما شابه)، فحدّه المعلَن
/// أكثر من كافٍ. وسقف الطول ليس تجميلًا: حقل بلا سقف هو طلب واحد يمرّر ميغابايت
/// إلى الكائن الدائم.
const ID = { min: 1, max: 128 } as const;

const SCHEMAS = {
  createChild: {
    nickname: text({ max: 40 }),
    birth_month: integer({ min: 1, max: 12 }),
    birth_year: integer({ min: 1900, max: 2200 }),
    avatar_id: text({ max: 100 }),
    language: text({ max: 10, optional: true }),
    interests: list(text({ max: 60 }), { max: 30, optional: true }),
    // الخادم يكتب الوقت بساعته. العميل يقول «انتهى» لا «انتهى في اللحظة س».
    onboarding_completed: boolean({ optional: true }),
  },
  updateChild: {
    nickname: text({ max: 40, optional: true }),
    avatar_id: text({ max: 100, optional: true }),
    language: text({ max: 10, optional: true }),
    interests: list(text({ max: 60 }), { max: 30, optional: true }),
  },
  trackTransition: { action: oneOf(['accept', 'defer', 'review']) },
  progress: {
    child_id: text({ ...ID, optional: true }),
    childId: text({ ...ID, optional: true }),
    device_id: text({ ...ID, optional: true }),
    deviceId: text({ ...ID, optional: true }),
    contentId: text({ ...ID, optional: true }),
    // الأسماء المزدوجة عقد قائم يستهلكه عميلان بصيغتين مختلفتين. إعلانهما معًا
    // يوثّق التكرار بدل أن يُخفيه: ما يُعلَن يمكن أن يُنظَّف يومًا.
    content_id: text({ ...ID, optional: true }),
    episode_id: text({ ...ID, optional: true }),
    content_type: oneOf(['episode', 'game', 'story', 'book'], { optional: true }),
    event_id: text({ ...ID, optional: true }),
    eventId: text({ ...ID, optional: true }),
    position_ms: integer({ min: 0, optional: true }),
    positionMs: integer({ min: 0, optional: true }),
    duration_ms: integer({ min: 0, optional: true }),
    durationMs: integer({ min: 0, optional: true }),
    progress_seconds: integer({ min: 0, optional: true }),
    duration_seconds: integer({ min: 0, optional: true }),
    sequence: integer({ min: 0, optional: true }),
    game_id: text({ ...ID, optional: true }),

    // حمولة محاولة لعبة (`game_services.dart:206`). كانت تمرّ كلّها بلا إعلان،
    // فصار إعلانها هو أوّل توثيق لعقدها: مقاييس محاولة، بلا إحداثيات ولا نصّ حرّ.
    objective_id: text({ ...ID, optional: true }),
    completed: boolean({ optional: true }),
    score: integer({ min: 0, optional: true }),
    max_score: integer({ min: 0, optional: true }),
    time_spent: integer({ min: 0, optional: true }),
    help_used: boolean({ optional: true }),
    // العناصر تفحصها اللعبة نفسها: شكلها يختلف بنوع اللعبة، والسقف هو الحماية.
    answers: list(opaque(), { max: 200, optional: true }),
  },
  consent: {
    consent_type: text({ max: 64 }),
    version: text({ max: 32, optional: true }),
    child_id: text({ ...ID, optional: true, nullable: true }),
    revoke: boolean({ optional: true }),
  },
  reward: {
    child_id: text(ID),
    reward_key: text({ max: 64 }),
    source_type: oneOf(['game', 'episode', 'project']),
    source_id: text(ID),
  },
  favorite: {
    child_id: text(ID),
    entity_type: text({ max: 32 }),
    entity_id: text(ID),
    action: oneOf(['add', 'remove'], { optional: true }),
  },
  revokeDevice: { device_id: text(ID) },
  // الرمز أرقام فقط وطوله محدَّد: المخطَّط يرفض «رمزًا» طوله ألف حرف قبل أن يصل
  // إلى دالّة التقطيع، فلا تُستهلك دورة معالجة في تقطيع ما لا يُقبل.
  parentPin: { pin: text({ min: 4, max: 12, pattern: /^\d+$/ }) },
  verifyPin: {
    pin: text({ min: 4, max: 12, pattern: /^\d+$/ }),
    purpose: text({ max: 64, optional: true }),
  },
  authorizeProof: { purpose: text({ max: 64 }) },
} satisfies Record<string, BodySchema>;

/// يقرأ الجسم مقابل مخطَّط، ويعيد ردَّ الرفض الموحَّد جاهزًا عند الفشل.
async function schemaBody<T extends JsonBody>(
  c: { req: { json(): Promise<unknown> } },
  schema: BodySchema,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const parsed = await parseBody<T>(c, schema);
  if (parsed.ok) return { ok: true, value: parsed.value };
  return { ok: false, response: Response.json(validationFailure(parsed), { status: 400 }) };
}

function forward(result: { status: number; data: unknown }) {
  return Response.json(result.data ?? { success: false, error: 'Family service unavailable' }, { status: result.status });
}

async function state(env: Env, parent: ParentPrincipal) {
  return callDurable<Envelope<{
    family: unknown;
    children: Array<{ id: string }>;
    progress: Array<Record<string, unknown>>;
    favorites: Array<Record<string, unknown>>;
  }>>(familyStub(env, parent.parentId), '/state');
}

familyRoute.get('/state', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await state(c.env, auth.principal));
});

familyRoute.get('/children', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/children'));
});

familyRoute.post('/children', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  // Creating a child profile is a parental-control operation: it sets the age
  // track that decides which library the child is served, and it consumes a slot
  // the plan limits. It required no proof at all, so `manage_children` was
  // issuable and never checked.
  const proof = await requireParentProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'manage_children',
  );
  if (!proof.ok) return parentProofDenied(proof.reason);
  // SEC-110: الجسم كان يُمرَّر إلى الكائن الدائم كما جاء (`...value`)، فأي حقل
  // زائد يعبر الحدّ. الآن لا يعبر إلا ما أُعلن.
  const parsed = await schemaBody(c, SCHEMAS.createChild);
  if (!parsed.ok) return parsed.response;
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/children', {
    body: { ...parsed.value, session_id: auth.principal.sessionId },
  }));
});

/// `PATCH /family/children/:childId` — updates one child's profile (nickname,
/// avatar, language, interests). Never accepts birth_month/birth_year/age_track:
/// those are exclusive to the track-transition endpoint (task 25), which
/// re-derives the track through `deriveAgeTrack` and emits its own event rather
/// than letting a profile edit silently change which library a child is served.
///
/// Carries a `manage_children` proof — the same purpose `POST /children`
/// requires, since editing a profile is exactly as sensitive as creating one.
familyRoute.patch('/children/:childId', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireParentProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'manage_children',
  );
  if (!proof.ok) return parentProofDenied(proof.reason);
  // المخطَّط هو ما يفرض التعليق أعلاه: `birth_month`/`birth_year`/`age_track`
  // غير معلَنة هنا، فإرسالها يُرفض بدل أن يُهمَل صامتًا.
  const parsed = await schemaBody(c, SCHEMAS.updateChild);
  if (!parsed.ok) return parsed.response;
  const childId = c.req.param('childId');
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/children', {
    method: 'PATCH',
    body: { ...parsed.value, session_id: auth.principal.sessionId, child_id: childId },
  }));
});

/// `POST /family/children/:childId/track-transition` — إعادة حساب المسار العمري
/// وتطبيق أحد الأفعال الثلاثة: `accept` (يكتب المسار الجديد ويُصدر
/// `child.track_transitioned`)، `defer` (يؤجّل حتى 30 يومًا، مرة واحدة)، أو
/// `review` (يعرض المقارنة بلا كتابة). يحمل إثبات `manage_children` نفسه الذي
/// تحمله `POST /children` و`PATCH /children/:childId`، لأن تغيير المسار العمري
/// حساس بنفس درجة إنشاء أو تعديل ملف الطفل.
familyRoute.post('/children/:childId/track-transition', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireParentProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'manage_children',
  );
  if (!proof.ok) return parentProofDenied(proof.reason);
  const parsed = await schemaBody(c, SCHEMAS.trackTransition);
  if (!parsed.ok) return parsed.response;
  const childId = c.req.param('childId');
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/children/track-transition', {
    body: { action: parsed.value.action, session_id: auth.principal.sessionId, child_id: childId },
  }));
});

familyRoute.post('/progress', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await schemaBody(c, SCHEMAS.progress);
  if (!parsed.ok) return parsed.response;
  const value = parsed.value;

  const progressSeconds = typeof value.progress_seconds === 'number' ? value.progress_seconds : null;
  const durationSeconds = typeof value.duration_seconds === 'number' ? value.duration_seconds : null;
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/progress', {
    body: {
      ...value,
      session_id: auth.principal.sessionId,
      event_id: value.event_id ?? value.eventId ?? crypto.randomUUID(),
      // SEC-110 كشف هذا: التطبيق يرسل `childId` و`contentId` بصيغة camelCase
      // (`majarra_api_client.dart:542`)، والكائن الدائم يقرأ `child_id` وحده —
      // فكان **كل حفظ تقدّم من المشغّل يُرفض** بـ400. والنداء «أطلق وانسَ» مع
      // كتم الفشل («must never interrupt playback») هو ما جعل العطل صامتًا.
      //
      // الترجمة هنا لا في العميل: نسخة التطبيق المنشورة لا تُصلَح بنشر خادم.
      child_id: value.child_id ?? value.childId,
      device_id: value.device_id ?? value.deviceId,
      content_id: value.content_id ?? value.contentId ?? value.episode_id,
      content_type: value.content_type ?? 'episode',
      position_ms: value.position_ms ?? value.positionMs ?? (progressSeconds === null ? undefined : Math.floor(progressSeconds * 1000)),
      duration_ms: value.duration_ms ?? value.durationMs ?? (durationSeconds === null ? 0 : Math.floor(durationSeconds * 1000)),
    },
  }));
});

familyRoute.get('/progress', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const childId = c.req.query('childId') ?? c.req.query('child_id');
  if (!childId) return c.json({ success: false, error: 'childId is required' }, 400);

  const result = await state(c.env, auth.principal);
  if (!result.ok || !result.data?.success || !result.data.data) return forward(result);
  const ownsChild = result.data.data.children.some((child) => child.id === childId);
  if (!ownsChild) return c.json({ success: false, error: 'Active child profile not found' }, 404);
  return c.json({
    success: true,
    data: result.data.data.progress.filter((item) => item.child_id === childId),
  });
});

familyRoute.get('/mastery', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const childId = c.req.query('child_id') ?? c.req.query('childId');
  if (!childId) return c.json({ success: false, error: 'child_id is required' }, 400);

  const owned = await state(c.env, auth.principal);
  if (!owned.ok || !owned.data?.success || !owned.data.data) return forward(owned);
  if (!owned.data.data.children.some((child) => child.id === childId)) {
    return c.json({ success: false, error: 'Active child profile not found' }, 404);
  }

  const result = await callDurable<{ success: boolean; data?: { mastery?: Array<Record<string, unknown>> } }>(
    familyStub(c.env, auth.principal.parentId), '/mastery', {},
  );
  if (result.status !== 200) return forward(result);
  const mastery = result.data?.data?.mastery ?? [];
  return c.json({
    success: true,
    data: mastery.filter((row) => String(row.child_id) === childId),
  });
});

// --- Parental consent -------------------------------------------------------
//
// `parental_consents` existed in D1 from migration 0001 and had no HTTP surface at
// all, so nothing could grant or read a consent and nothing could enforce one.

familyRoute.get('/consents', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);

  const result = await callDurable<{ success: boolean; data?: { consents?: ConsentRow[] } }>(
    familyStub(c.env, auth.principal.parentId), '/consents', {},
  );
  if (result.status !== 200) return forward(result);
  const rows = result.data?.data?.consents ?? [];

  const childId = c.req.query('child_id') ?? null;
  return c.json({
    success: true,
    data: {
      rows,
      // The decision per type, so a client does not reimplement the policy and
      // then disagree with the server about what a parent allowed.
      decisions: Object.fromEntries(
        CONSENT_TYPES.map((type) => [type, evaluateConsent(rows, type, childId)]),
      ),
    },
  });
});

familyRoute.post('/consents', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  // `manage_consents`, not the generic `parent_area`. Granting or revoking a
  // consent is the legal record of what the account holder permitted for a
  // child — analytics, cloud storage of drawings, and so on. Accepting the
  // broad parent-area proof meant any screen behind the PIN could change it with
  // a token minted for something else, and it left `manage_consents` as a purpose
  // that could be issued but was never checked.
  //
  // Exception: a brand-new family with no PIN enrolled yet cannot hold any
  // proof at all — every purpose besides `parent_area` is exchanged from a
  // `parent_area` proof, and `parent_area` is only minted by `POST
  // /parent-pin` or `/parent-pin/verify`, both of which the onboarding
  // journey runs *after* the consent step (Requirement 8.2). Without this
  // carve-out the very first consent a new family grants would be
  // unwritable by construction, not merely PIN-gated. Once a PIN exists,
  // the exception closes and `manage_consents` is required as before.
  const pinStatus = await callDurable<Envelope<{ enrolled: boolean }>>(
    familyStub(c.env, auth.principal.parentId), '/parent-pin/status', {},
  );
  const pinEnrolled = pinStatus.ok && pinStatus.data?.success
    ? pinStatus.data.data?.enrolled !== false
    : true; // fail closed: an unreadable status still requires proof.
  if (pinEnrolled) {
    const proof = await requireParentProof(
      c.env,
      auth.principal,
      c.req.header('X-Parent-Proof'),
      'manage_consents',
    );
    if (!proof.ok) return parentProofDenied(proof.reason);
  }
  const validated = await schemaBody(c, SCHEMAS.consent);
  if (!validated.ok) return validated.response;

  // المخطَّط يفحص الشكل، و`parseConsentWrite` يبقى: هو من يعرف أي نوع موافقة
  // يتطلّب طفلًا وأي إصدار مقبول لكل نوع — وهذه دلالة لا شكل.
  const parsed = parseConsentWrite(validated.value);
  if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400);
  const { type, childId, version, revoke } = parsed.write;

  // Child ownership is checked inside the object, which is the authority for which
  // children exist, rather than here from a projection that can lag.
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/consents', {
    body: {
      session_id: auth.principal.sessionId,
      consent_type: type,
      child_id: childId,
      version,
      revoke,
    },
  }));
});

// --- Rewards ---------------------------------------------------------------
//
// The stickers «مجموعتي» displays. Kept forever once earned, so there is no
// paging and no expiry.

familyRoute.get('/rewards', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const childId = c.req.query('child_id') ?? c.req.query('childId');
  if (!childId) return c.json({ success: false, error: 'child_id is required' }, 400);

  // Ownership is confirmed against the family's own children before anything is
  // returned, so a guessed child id yields 404 rather than another child's row.
  const owned = await state(c.env, auth.principal);
  if (!owned.ok || !owned.data?.success || !owned.data.data) return forward(owned);
  if (!owned.data.data.children.some((child) => child.id === childId)) {
    return c.json({ success: false, error: 'Active child profile not found' }, 404);
  }

  const result = await callDurable<{ success: boolean; data?: { rewards?: Array<Record<string, unknown>> } }>(
    familyStub(c.env, auth.principal.parentId), '/rewards', {},
  );
  if (result.status !== 200) return forward(result);
  const rewards = result.data?.data?.rewards ?? [];
  return c.json({
    success: true,
    data: rewards.filter((row) => String(row.child_id) === childId),
  });
});

familyRoute.post('/rewards', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await schemaBody(c, SCHEMAS.reward);
  if (!parsed.ok) return parsed.response;
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/rewards', {
    body: { ...parsed.value, session_id: auth.principal.sessionId },
  }));
});

familyRoute.post('/favorites', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await schemaBody(c, SCHEMAS.favorite);
  if (!parsed.ok) return parsed.response;
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/favorites', {
    body: { ...parsed.value, session_id: auth.principal.sessionId },
  }));
});

familyRoute.get('/devices', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireParentProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'parent_area',
  );
  if (!proof.ok) return parentProofDenied(proof.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/devices'));
});

familyRoute.post('/devices/revoke', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireParentProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'revoke_device',
    true,
  );
  if (!proof.ok) return parentProofDenied(proof.reason);
  const parsed = await schemaBody(c, SCHEMAS.revokeDevice);
  if (!parsed.ok) return parsed.response;
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/devices/revoke', {
    body: { device_id: parsed.value.device_id, session_id: auth.principal.sessionId },
  }));
});

familyRoute.post('/parent-pin', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await schemaBody(c, SCHEMAS.parentPin);
  if (!parsed.ok) return parsed.response;
  const value = parsed.value;

  // Initial enrolment is allowed with the authenticated parent session. Once a
  // PIN exists, FamilyState refuses the write unless this route supplies the
  // exact current version from a consumed change_parent_pin proof.
  let expectedPinVersion: number | undefined;
  const proofHeader = c.req.header('X-Parent-Proof');
  if (proofHeader) {
    const proof = await requireParentProof(
      c.env,
      auth.principal,
      proofHeader,
      'change_parent_pin',
      true,
    );
    if (!proof.ok) return parentProofDenied(proof.reason);
    expectedPinVersion = proof.proof.pinVersion;
  }

  const result = await callDurable<Envelope<{
    enrolled: boolean;
    changed: boolean;
    pin_version: number;
  }>>(familyStub(c.env, auth.principal.parentId), '/parent-pin', {
    body: {
      pin: value.pin,
      session_id: auth.principal.sessionId,
      expected_pin_version: expectedPinVersion,
    },
  });
  const data = result.data?.success ? result.data.data : null;
  if (!result.ok || !data) return forward(result);

  const issued = await createParentProof(c.env, {
    principal: auth.principal,
    pinVersion: data.pin_version,
    purpose: 'parent_area',
  });
  return c.json({
    success: true,
    data: {
      ...data,
      parent_proof: issued.token,
      purpose: issued.purpose,
      issued_at: new Date(issued.issuedAt).toISOString(),
      expires_at: new Date(issued.expiresAt).toISOString(),
    },
  });
});

familyRoute.post('/parent-pin/verify', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await schemaBody(c, SCHEMAS.verifyPin);
  if (!parsed.ok) return parsed.response;
  const value = parsed.value;
  const purpose = value.purpose === undefined
    ? 'parent_area'
    : parseParentProofPurpose(value.purpose);
  if (!purpose) return c.json({ success: false, error: 'A valid proof purpose is required' }, 400);

  const result = await callDurable<Envelope<{
    verified: boolean;
    pin_version: number;
  }>>(familyStub(c.env, auth.principal.parentId), '/parent-pin/verify', {
    body: { pin: value.pin, session_id: auth.principal.sessionId },
  });
  const data = result.data?.success ? result.data.data : null;
  if (!result.ok || !data?.verified) return forward(result);

  const issued = await createParentProof(c.env, {
    principal: auth.principal,
    pinVersion: data.pin_version,
    purpose,
  });
  return c.json({
    success: true,
    data: {
      verified: true,
      parent_proof: issued.token,
      purpose: issued.purpose,
      issued_at: new Date(issued.issuedAt).toISOString(),
      expires_at: new Date(issued.expiresAt).toISOString(),
    },
  });
});

// Exchanges a still-current parent-area proof for a purpose-bound capability.
// The new token cannot outlive the proof established by the PIN verification.
familyRoute.post('/parent-proof/authorize', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const parsed = await schemaBody(c, SCHEMAS.authorizeProof);
  if (!parsed.ok) return parsed.response;
  // القائمة المغلقة تبقى في `parseParentProofPurpose`: هي مصدرها الوحيد، ونسخها
  // في المخطَّط كان سيصنع قائمتين تفترقان.
  const purpose = parseParentProofPurpose(parsed.value.purpose);
  if (!purpose || !exchangeableParentPurposes.has(purpose)) {
    return c.json({ success: false, error: 'A valid action purpose is required' }, 400);
  }

  const parentArea = await requireParentProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'parent_area',
  );
  if (!parentArea.ok) return parentProofDenied(parentArea.reason);

  const issued = await createParentProof(c.env, {
    principal: auth.principal,
    pinVersion: parentArea.proof.pinVersion,
    purpose,
    notAfter: parentArea.proof.expiresAt,
  });
  return c.json({
    success: true,
    data: {
      parent_proof: issued.token,
      purpose: issued.purpose,
      issued_at: new Date(issued.issuedAt).toISOString(),
      expires_at: new Date(issued.expiresAt).toISOString(),
      one_time: true,
    },
  }, 201);
});

export default familyRoute;
