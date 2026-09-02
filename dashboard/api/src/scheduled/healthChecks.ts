/// دورة فحص الصحة (`OPS-106`).
///
/// ## العلّة
///
/// `ops_services` فيه اثنتا عشرة خدمة معرَّفة، و`ops_health_checks` **صفر صفّ**.
/// فشاشة العمليات كانت تعرض كل خدمة بحالة `unknown` — وهي حالة تُقرأ في لمحة
/// كـ«لا مشاكل» بينما معناها الحقيقي «لا نعرف».
///
/// ## ما يُفحَص وما **لا** يُفحَص
///
/// تُكتب صفوف للخدمات التي نستطيع قياسها **من داخل الـWorker بصدق**:
///
/// | الخدمة | الإشارة الحقيقية |
/// |---|---|
/// | `d1` | استعلام حقيقي + زمنه |
/// | `admin_api` | الـWorker يعمل (هذه الدورة تعمل) + زمن رحلة D1 |
/// | `queue_family_events` | حداثة آخر حدث مُسقَط في `processed_family_events` |
/// | `queue_dlq` | عدد الأحداث الفاشلة المعلَّقة |
///
/// وثمانية خدمات أخرى **لا يُكتب لها صفّ**: `r2_media` و`cdn` تحتاج طلبًا خارجيًّا
/// لكل دورة (تكلفة وهشاشة: انقطاع شبكة مؤقّت يصير «عطل CDN»)، و`familystate`
/// تحتاج مسار تفتيش في الكائن الدائم لا وجود له، والباقي منطق تطبيقي لا خدمة
/// تُستقصى. تركها `unknown` **أصدق** من كتابة `healthy` مُفترَضة — وهذا هو الخطأ
/// الذي كان في `/ops/overview`: `api.status` مثبَّت على `'healthy'` بلا أي فحص.
///
/// ## ولماذا الفحص لا يفتح حادثة
///
/// الحادثة (`ops_incidents`) قرار إنسان: هي إعلان أن شيئًا يستحقّ تحقيقًا وتوثيقًا
/// ومالكًا. وفتحها آليًّا يُنتج حوادث بلا أصحاب تُغلَق كسلًا، فتفقد الكلمة معناها.
/// الدورة ترفع **تنبيهًا**، والإنسان هو من يرقّيه إلى حادثة.

import type { Env } from '../lib/db.ts';
import { raiseAlert, resolveAlert, type AlertSeverity } from '../lib/opsAlerts.ts';

/// تعبير الـcron الذي تعمل به هذه الدورة.
///
/// خمس دقائق: أقصر من ذلك يعني كتابةً في D1 كل دقيقة بلا فائدة تشغيلية، وأطول
/// يعني أن عطلًا يعيش ربع ساعة قبل أن يُعرَف.
export const HEALTH_CHECK_CRON = '*/5 * * * *';

/// عتبة الأحداث الفاشلة المعلَّقة التي ترفع تنبيهًا.
///
/// **واحد**، لا عشرة. حدث عائلة فاشل يعني إسقاطًا متأخّرًا لأسرة بعينها: طفل قد
/// لا يظهر، أو تقدّم لا يُحفَظ، أو استحقاق لا يُطبَّق. والأربعة والعشرون التي مرّت
/// بلا إشعار كانت ستُرصد من أوّلها بهذه العتبة.
const FAILED_EVENT_ALERT_THRESHOLD = 1;

/// بعدها يصير تأخّر الطابور تنبيهًا.
///
/// ستّون دقيقة لا ثلاثون كما في `sla_policies.queue-family`: تلك سياسة **حلّ**
/// (كم يُسمح للخلل أن يعيش)، وهذه عتبة **رصد**. ولو تساويا لصار التنبيه يُرفَع في
/// لحظة خرق السياسة نفسها — أي بلا وقت لأحد أن يتصرّف.
const QUEUE_STALE_MINUTES = 60;

/// زمن استعلام D1 الذي يُعَدّ تدهورًا.
const D1_DEGRADED_MS = 1_000;

type Probe = {
  serviceId: string;
  status: 'healthy' | 'degraded' | 'partial_outage' | 'outage' | 'unknown';
  latencyMs: number | null;
  details: string | null;
  /// التنبيه المصاحب. `null` يعني «لا شيء يُرفَع ولا شيء يُغلَق».
  alert: { fingerprint: string; severity: AlertSeverity; condition: string } | null;
  /// حين تكون الحالة سليمة: البصمة التي تُغلَق.
  clears: string | null;
};

/// ينفّذ دورة كاملة: يقيس، يكتب، يرفع أو يغلق.
///
/// كل خطوة مستقلّة بـtry/catch: فحصٌ يفشل لا يمنع البقيّة، وقاعدةٌ ساقطة تُنتج
/// صفَّ `outage` لـD1 بدل أن تُسقط الدورة كلّها صامتة.
export async function runHealthChecks(env: Env): Promise<{ written: number; raised: number }> {
  const probes: Probe[] = [];

  probes.push(await probeDatabase(env));
  // الباقي يعتمد على استعلامات: لا معنى لتشغيلها إن كانت القاعدة ساقطة.
  if (probes[0].status !== 'outage') {
    probes.push(await probeDeadLetterQueue(env));
    probes.push(await probeEventQueue(env));
    probes.push(selfProbe(probes[0].latencyMs));
  }

  let written = 0;
  let raised = 0;

  for (const probe of probes) {
    try {
      await env.DB.prepare(`
        INSERT INTO ops_health_checks (id, service_id, status, latency_ms, checked_at, details)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
      `).bind(
        crypto.randomUUID(), probe.serviceId, probe.status, probe.latencyMs, probe.details,
      ).run();
      written++;
    } catch (error) {
      console.error('health_check_write_failed', probe.serviceId, error);
    }

    try {
      if (probe.alert) {
        const result = await raiseAlert(env, {
          fingerprint: probe.alert.fingerprint,
          serviceId: probe.serviceId,
          severity: probe.alert.severity,
          condition: probe.alert.condition,
        });
        if (result.raised) raised++;
      } else if (probe.clears) {
        await resolveAlert(env, probe.clears);
      }
    } catch (error) {
      console.error('health_check_alert_failed', probe.serviceId, error);
    }
  }

  // `telemetry_sources.last_data_at` كان `NULL` دائمًا، فجدول «ما نستطيع قياسه»
  // لم يكن يعرف أنه قِيس. الآن يُختَم بكل دورة نجحت.
  try {
    await env.DB.prepare(`
      UPDATE telemetry_sources SET last_data_at = datetime('now')
       WHERE signal IN ('HTTP health checks', 'D1 status', 'Queue backlog')
    `).run();
  } catch (error) {
    console.error('telemetry_stamp_failed', error);
  }

  return { written, raised };
}

async function probeDatabase(env: Env): Promise<Probe> {
  const started = Date.now();
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
    const latency = Date.now() - started;
    const slow = latency >= D1_DEGRADED_MS;
    return {
      serviceId: 'd1',
      status: slow ? 'degraded' : 'healthy',
      latencyMs: latency,
      details: slow ? `SELECT 1 took ${latency}ms` : null,
      alert: slow
        ? { fingerprint: 'd1:slow', severity: 'medium', condition: `استعلام D1 البسيط استغرق ${latency}ms` }
        : null,
      clears: slow ? null : 'd1:slow',
    };
  } catch (error) {
    return {
      serviceId: 'd1',
      status: 'outage',
      latencyMs: null,
      details: String(error).slice(0, 500),
      alert: {
        fingerprint: 'd1:unreachable',
        severity: 'critical',
        condition: 'قاعدة D1 لا تستجيب لاستعلام بسيط',
      },
      clears: null,
    };
  }
}

async function probeDeadLetterQueue(env: Env): Promise<Probe> {
  try {
    const row = await env.DB.prepare(`
      SELECT COUNT(*) AS pending, MIN(failed_at) AS oldest
        FROM failed_family_events WHERE status = 'pending'
    `).first<{ pending: number; oldest: string | null }>();
    const pending = Number(row?.pending ?? 0);
    const breached = pending >= FAILED_EVENT_ALERT_THRESHOLD;

    // `queue_health` كان بذرةً مجمَّدة يقرؤها الشاشة كأنها قياس. الآن تُحدَّث.
    await env.DB.prepare(`
      UPDATE queue_health
         SET failed = ?, status = ?, updated_at = datetime('now')
       WHERE queue_name = 'family_events-dlq'
    `).bind(pending, breached ? 'degraded' : 'healthy').run();

    return {
      serviceId: 'queue_dlq',
      status: breached ? 'degraded' : 'healthy',
      latencyMs: null,
      details: breached ? `${pending} pending since ${row?.oldest ?? 'unknown'}` : null,
      alert: breached
        ? {
          fingerprint: 'dlq:pending',
          severity: 'high',
          condition: `${pending} حدث عائلة فاشل معلَّق (أقدمه ${row?.oldest ?? 'غير معروف'})`,
        }
        : null,
      clears: breached ? null : 'dlq:pending',
    };
  } catch (error) {
    return unknownProbe('queue_dlq', error);
  }
}

async function probeEventQueue(env: Env): Promise<Probe> {
  try {
    const row = await env.DB.prepare(`
      SELECT MAX(processed_at) AS last FROM processed_family_events
    `).first<{ last: string | null }>();

    // لا حدث قطّ ليس عطلًا: منصّة بلا نشاط بعد. تمييزها عن التأخّر شرطُ ألّا
    // يبدأ الرصد حياته بتنبيه كاذب.
    if (!row?.last) {
      await stampQueueHealth(env, null, 'unknown');
      return {
        serviceId: 'queue_family_events',
        status: 'unknown',
        latencyMs: null,
        details: 'no events processed yet',
        alert: null,
        clears: 'queue:stale',
      };
    }

    const ageMinutes = Math.floor((Date.now() - Date.parse(`${row.last}Z`)) / 60_000);
    const stale = Number.isFinite(ageMinutes) && ageMinutes >= QUEUE_STALE_MINUTES;
    await stampQueueHealth(env, row.last, stale ? 'degraded' : 'healthy');

    return {
      serviceId: 'queue_family_events',
      status: stale ? 'degraded' : 'healthy',
      latencyMs: null,
      details: `last processed ${ageMinutes}m ago`,
      alert: stale
        ? {
          fingerprint: 'queue:stale',
          severity: 'high',
          condition: `طابور أحداث الأسرة لم يُسقِط حدثًا منذ ${ageMinutes} دقيقة`,
        }
        : null,
      clears: stale ? null : 'queue:stale',
    };
  } catch (error) {
    return unknownProbe('queue_family_events', error);
  }
}

async function stampQueueHealth(env: Env, lastSuccess: string | null, status: string) {
  await env.DB.prepare(`
    UPDATE queue_health
       SET last_success_at = ?, status = ?, updated_at = datetime('now')
     WHERE queue_name = 'family_events'
  `).bind(lastSuccess, status).run();
}

/// الـWorker نفسه: وجودُ هذه الدورة **هو** الإشارة.
///
/// لا طلب HTTP إلى أنفسنا: يقيس شيئًا آخر (الحافة والتوجيه) ويُنتج استدعاءً
/// مدوَّرًا. وزمن رحلة D1 مُعاد استخدامه هنا لأنه أقرب ما نملك إلى «زمن طلب حقيقي».
function selfProbe(latencyMs: number | null): Probe {
  return {
    serviceId: 'admin_api',
    status: 'healthy',
    latencyMs,
    details: 'observed from the scheduled worker; not an external probe',
    alert: null,
    clears: null,
  };
}

function unknownProbe(serviceId: string, error: unknown): Probe {
  return {
    serviceId,
    status: 'unknown',
    latencyMs: null,
    details: String(error).slice(0, 500),
    alert: null,
    clears: null,
  };
}
