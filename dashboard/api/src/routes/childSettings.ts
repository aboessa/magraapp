import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryFirst } from '../lib/db.ts';
import { authenticateParent, verifyParentProof } from '../lib/parentAuth.ts';
import {
  boolean,
  integer,
  oneOf,
  parseBody,
  text,
  validationFailure,
} from '../lib/requestSchema.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

/// `HH:MM` أو نصّ فارغ (يعني «لا حدّ»).
const HHMM_OR_EMPTY = /^$|^([01]\d|2[0-3]):([0-5]\d)$/;

/// منطقي، ويقبل `1`/`0` **انتقاليًّا**.
///
/// شاشة وليّ الأمر ترسل `allow_speed_change: v ? 1 : 0`
/// (`parent_dashboard_page.dart:553`) لأن الخادم كان يقرأ أي قيمة صادقة. صُحِّح
/// العميل ليرسل منطقيًّا، ويبقى القبول هنا لأن نسخة مثبَّتة على جهاز لا تُصلَح
/// بنشر خادم. وما لا يُقبل: `"yes"` ولا `2` ولا `""` — التسامح محدود بقيمتين
/// معلومتين، لا بمفهوم «الصادق بالتقريب».
const LEGACY_BOOLEAN = {
  optional: true,
  check: (value: unknown) => (
    typeof value === 'boolean' || value === 0 || value === 1 ? null : 'type' as const
  ),
};

route.get('/:childId', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const childId = c.req.param('childId');
  // API-105: الإسقاط وحده. حُذف الرجوع إلى `children_profiles`: الجدول صفر صفًّا
  // ولا كاتب له، فالرجوع إليه لم يكن يُنقذ حسابًا قديمًا — كان يُخفي أن المصدر
  // الوحيد هو الإسقاط، ويجعل عطلًا فيه يبدو «حسابًا غير موجود».
  const child = await queryFirst(c.env.DB, `SELECT child_id AS id FROM child_projection WHERE child_id=? AND parent_id=? AND status='active'`, [childId, auth.principal.parentId]);
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404);
  let settings = await queryFirst(c.env.DB, `SELECT * FROM child_settings WHERE child_id=?`, [childId]);
  if (!settings) {
    await c.env.DB.prepare(`INSERT INTO child_settings (child_id) VALUES (?)`).bind(childId).run();
    settings = await queryFirst(c.env.DB, `SELECT * FROM child_settings WHERE child_id=?`, [childId]);
  }
  return c.json({ success: true, data: settings });
});

route.put('/:childId', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const proof = await verifyParentProof(c.env, {
    principal: auth.principal,
    header: c.req.header('X-Parent-Proof'),
    purpose: 'parent_area',
  });
  if (!proof.ok) {
    return c.json({ success: false, error: 'A current parent proof is required' }, proof.reason === 'unconfigured' ? 503 : 403);
  }
  const childId = c.req.param('childId');
  // API-105: الإسقاط وحده هنا أيضًا. بوابة الملكية على الكتابة يجب أن تكون نفسها
  // بوابة القراءة، وإلا صار للمسارَين تعريفان لـ«طفل هذه الأسرة».
  const child = await queryFirst(c.env.DB, `SELECT child_id AS id FROM child_projection WHERE child_id=? AND parent_id=? AND status='active'`, [childId, auth.principal.parentId]);
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404);
  // SEC-110: المخطَّط يفحص النوع والمدى والقائمة المغلقة قبل أي سطر منطق.
  //
  // وما استُبدل يستحقّ الذكر: `Number(body.daily_minutes)` كان يقبل `'30'` نصًّا،
  // و`body.autoplay ? 1 : 0` كان يقبل **أي** قيمة صادقة — فيصير `"no"` تشغيلًا
  // تلقائيًّا مفعَّلًا. والمخطَّط يرفض النوع الخطأ بدل أن يخمّن مقصده.
  const parsed = await parseBody(c, {
    daily_minutes: integer({ min: 5, max: 180, optional: true }),
    max_session_minutes: integer({ min: 5, max: 180, optional: true, nullable: true }),
    // النصّ الفارغ يعني «امسح الحدّ»، وهو عقد قائم يستهلكه العميل.
    bedtime_start: text({ min: 0, max: 5, pattern: HHMM_OR_EMPTY, optional: true, nullable: true }),
    bedtime_end: text({ min: 0, max: 5, pattern: HHMM_OR_EMPTY, optional: true, nullable: true }),
    autoplay_override: oneOf(['off', 'on', 'inherit'], { optional: true, nullable: true }),
    allow_speed_change: LEGACY_BOOLEAN,
    autoplay: LEGACY_BOOLEAN,
  });
  if (!parsed.ok) return c.json(validationFailure(parsed), 400);
  const body = parsed.value;

  const fields: string[] = []; const vals: unknown[] = [];
  if ('daily_minutes' in body) { fields.push('daily_minutes=?'); vals.push(body.daily_minutes); }
  if ('max_session_minutes' in body) {
    fields.push('max_session_minutes=?'); vals.push(body.max_session_minutes);
  }
  for (const name of ['bedtime_start', 'bedtime_end'] as const) {
    if (!(name in body)) continue;
    fields.push(`${name}=?`);
    vals.push(body[name] === '' ? null : body[name]);
  }
  if ('autoplay_override' in body) { fields.push('autoplay_override=?'); vals.push(body.autoplay_override); }
  if ('allow_speed_change' in body) {
    fields.push('allow_speed_change=?'); vals.push(body.allow_speed_change ? 1 : 0);
  }
  if ('autoplay' in body) { fields.push('autoplay=?'); vals.push(body.autoplay ? 1 : 0); }
  if (!fields.length) return c.json({ success: false, error: 'No fields' }, 400);
  vals.push(childId);
  await c.env.DB.prepare(`UPDATE child_settings SET ${fields.join(', ')}, updated_at=datetime('now') WHERE child_id=?`).bind(...vals).run();
  const updated = await queryFirst(c.env.DB, `SELECT * FROM child_settings WHERE child_id=?`, [childId]);
  return c.json({ success: true, data: updated });
});

export default route;
