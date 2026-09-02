#!/usr/bin/env node
/**
 * بذر أول حساب مسؤول للوحة.
 *
 * ## المشكلة التي يحلها
 *
 * `admin_users` كان صفر صفًا (SEC-102 في `AUDIT_FULL_2026.md`). في هذه الحالة
 * يقبل `lib/adminAuth.ts` المفتاح المشترك `ADMIN_API_KEY` كباب وحيد — هوية واحدة
 * للفريق كله، وسجل تدقيق يسجّل `legacy-admin-key` بدل شخص، ولا سبيل لسحب وصول
 * فرد دون تبديل المفتاح على الجميع.
 *
 * وبعد بذر أول مستخدم يرفض الحرس المفتاح المشترك تلقائيًّا (`hasAnyAdminUser`)،
 * فهذا السكربت هو الخطوة التي تُغلق ذلك الباب.
 *
 * ## الاستخدام
 *
 *   node tools/ops/seed-admin.mjs \
 *     --base https://api.majarra.app \
 *     --email owner@example.com \
 *     --name "اسم المالك" \
 *     --role owner
 *
 * المفتاح يُقرأ من البيئة لا من وسيط سطر أوامر، لأن سطر الأوامر يُسجَّل في
 * تاريخ الصدفة وفي قائمة العمليات:
 *
 *   $env:MAJARRA_ADMIN_API_KEY = "..."   (PowerShell)
 *   export MAJARRA_ADMIN_API_KEY="..."   (bash)
 *
 * كلمة المرور تُولَّد هنا وتُطبع مرة واحدة. الخادم يضبطها بـ`must_change_password`،
 * فهي مؤقتة بحكم التصميم ويجب تغييرها في أول دخول.
 *
 * ## بعد النجاح
 *
 * 1. سجّل الدخول بالحساب الجديد وغيّر كلمة المرور.
 * 2. أكّد أن المفتاح المشترك لم يعد مقبولًا (السكربت يفحص ذلك ويطبع النتيجة).
 * 3. احذف `ADMIN_API_KEY` من أسرار الإنتاج ومن `.secrets.local.txt`.
 */

import { randomBytes } from 'node:crypto';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

/// كلمة مرور مؤقتة قوية بلا محارف تُشبه غيرها (0/O، 1/l/I) لأنها تُنقل يدويًّا.
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(24);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

async function main() {
  const base = (arg('base') ?? 'https://api.majarra.app').replace(/\/$/, '');
  const email = arg('email');
  const displayName = arg('name');
  const roleId = arg('role', 'owner');
  const key = process.env.MAJARRA_ADMIN_API_KEY;

  if (!email || !displayName) {
    console.error('required: --email <address> --name "<display name>"');
    process.exit(2);
  }
  if (!key) {
    console.error('required: MAJARRA_ADMIN_API_KEY in the environment (never as a CLI argument)');
    process.exit(2);
  }

  const password = temporaryPassword();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${key}`,
  };

  // ١. تأكيد أن القاعدة لم تُبذَر بعد. الخادم يرفض المفتاح المشترك متى وُجد
  // مستخدم واحد، فرمز 401 هنا يعني «مبذورة أصلًا» لا «مفتاح خاطئ» بالضرورة —
  // ولذلك تُطبع الحالتان بوضوح بدل رسالة واحدة غامضة.
  const listed = await fetch(`${base}/api/v1/admin/users?limit=1`, { headers });
  if (listed.status === 401) {
    console.error(
      'refused with 401.\n'
      + 'either an admin user already exists (the shared key is then rejected by design),\n'
      + 'or the key is wrong. check with: curl -s -H "Authorization: Bearer <key>" '
      + `${base}/api/v1/admin/auth/status`,
    );
    process.exit(1);
  }
  if (listed.status === 503) {
    console.error('the admin API is not configured on this deployment (no ADMIN_API_KEY, no users).');
    process.exit(1);
  }
  if (!listed.ok) {
    console.error(`unexpected ${listed.status} while listing users: ${await listed.text()}`);
    process.exit(1);
  }
  const existing = await listed.json();
  const total = Number(existing?.meta?.total ?? 0);
  if (total > 0) {
    console.error(`refusing: ${total} admin user(s) already exist. seed only the first one with this script.`);
    process.exit(1);
  }

  // ٢. إنشاء الحساب.
  const created = await fetch(`${base}/api/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, display_name: displayName, password, role_id: roleId }),
  });
  const body = await created.json().catch(() => null);
  if (!created.ok) {
    console.error(`create failed (${created.status}): ${body?.error ?? 'unknown error'}`);
    process.exit(1);
  }

  console.log('created admin user:');
  console.log(`  id       ${body?.data?.id}`);
  console.log(`  email    ${email}`);
  console.log(`  role     ${roleId}`);
  console.log(`  password ${password}`);
  console.log('  (temporary — the server set must_change_password, change it on first sign-in)');

  // ٣. إثبات أن الباب المشترك أُغلق. هذا هو الجزء الذي يجعل البذر إجراءً أمنيًّا
  // لا مجرد إنشاء حساب: بلا هذا الفحص لا أحد يعرف أن المفتاح لم يبقَ مقبولًا.
  const recheck = await fetch(`${base}/api/v1/admin/users?limit=1`, { headers });
  if (recheck.status === 401) {
    console.log('\nverified: the shared ADMIN_API_KEY is now rejected (401).');
    console.log('next: delete ADMIN_API_KEY from production secrets and from .secrets.local.txt.');
  } else {
    console.warn(
      `\nWARNING: the shared key still answers ${recheck.status}. `
      + 'do not consider SEC-102 closed until it returns 401.',
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
