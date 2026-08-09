import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type {
  PublishableEntityType,
  PublishGateFinding,
  PublishGateResult,
  PublishRefusal,
} from '../types/api'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { usePreferences } from '../context/preferences'

/**
 * حوار جاهزية النشر: كل العوائق مرة واحدة، لكل عائق مالكه وإجراؤه المطلوب.
 *
 * ## ما يستبدله
 *
 * كان زر نشر السلسلة يستدعي فحص الجودة ثم يعرض `window.confirm` بقائمة نصية،
 * والنشر يستمر بعد التأكيد. أي أن الفحص كان تنبيهًا في المتصفح لا بوابة: نداء
 * `POST /admin/series/:id/publish` بـcurl يتجاوزه كليًا، والمجدول لا يفتح
 * متصفحًا أصلًا. الآن الخادم هو من يفرض (`lib/publishGate.ts`)، وهذه الشاشة
 * تعرض **نفس** نتيجة المصدر نفسه قبل الضغط، فلا يفاجأ المحرّر برفض.
 *
 * ## لماذا يبقى الزر ظاهرًا ومعطَّلًا عند وجود عائق
 *
 * إخفاؤه يجعل الشاشة تبدو كأن النشر غير متاح لهذا الدور — وهو سبب مختلف تمامًا
 * عن «المحتوى غير مكتمل». الزر يبقى مع سبب صريح: العائق هو ما يمنع، لا الصلاحية.
 *
 * ## عند الرفض من الخادم
 *
 * إن تغيّر شيء بين الفحص والنشر (شخص أرشف الأصل، انتهى ترخيص) يرفض الخادم بـ409
 * ويُعيد قائمة العوائق في `data`. تُعرض كما هي بدل رسالة عامة، لأن السبب الحقيقي
 * موجود في الاستجابة ولا عذر لإخفائه.
 */

const copy = {
  ar: {
    title: 'جاهزية النشر',
    loading: 'جارٍ فحص الجاهزية...',
    loadError: 'تعذر تشغيل فحص الجاهزية',
    blockers: (count: number) => `عوائق تمنع النشر (${count})`,
    warnings: (count: number) => `تنبيهات لا تمنع النشر (${count})`,
    passed: (count: number) => `فحوص مكتملة (${count})`,
    skipped: (count: number) => `غير منطبقة (${count})`,
    ready: 'كل الفحوص الحاجبة مكتملة.',
    owner: 'المسؤول',
    action: 'الإجراء المطلوب',
    publish: 'نشر',
    publishAnyway: 'نشر مع التنبيهات',
    publishing: 'جارٍ النشر...',
    blocked: 'النشر متوقف حتى تُعالَج العوائق أعلاه.',
    close: 'إغلاق',
    refused: 'رفض الخادم النشر لأن الحالة تغيّرت. العوائق الحالية:',
    retry: 'إعادة الفحص',
    owners: {
      editor: 'المحرّر', reviewer: 'المراجع', translator: 'المترجم', production: 'الإنتاج',
      engineering: 'الهندسة', rights: 'الحقوق', legal: 'الشأن القانوني', publisher: 'مسؤول النشر',
      provider: 'مزوّد خارجي',
    } as Record<string, string>,
  },
  en: {
    title: 'Publish readiness',
    loading: 'Checking readiness...',
    loadError: 'Unable to run the readiness check',
    blockers: (count: number) => `Blocking issues (${count})`,
    warnings: (count: number) => `Warnings, not blocking (${count})`,
    passed: (count: number) => `Passing checks (${count})`,
    skipped: (count: number) => `Not applicable (${count})`,
    ready: 'Every blocking check passes.',
    owner: 'Owner',
    action: 'Required action',
    publish: 'Publish',
    publishAnyway: 'Publish with warnings',
    publishing: 'Publishing...',
    blocked: 'Publishing is held until the issues above are resolved.',
    close: 'Close',
    refused: 'The server refused the publish because the state changed. Current blockers:',
    retry: 'Re-check',
    owners: {
      editor: 'Editor', reviewer: 'Reviewer', translator: 'Translator', production: 'Production',
      engineering: 'Engineering', rights: 'Rights', legal: 'Legal', publisher: 'Publisher',
      provider: 'External provider',
    } as Record<string, string>,
  },
}

function FindingList({ findings, showOwner }: { findings: PublishGateFinding[]; showOwner: boolean }) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  return (
    <ul className="readiness-list">
      {findings.map((finding) => (
        <li key={finding.id} className={`readiness-item readiness-item--${finding.status}`}>
          <div className="readiness-item__head">
            <span className="readiness-item__label">{finding.label_ar}</span>
            {showOwner && finding.owner && (
              <span className="readiness-item__owner">
                {text.owner}: {text.owners[finding.owner] ?? finding.owner}
              </span>
            )}
          </div>
          {finding.detail && <p className="readiness-item__detail">{finding.detail}</p>}
          {finding.items && finding.items.length > 0 && (
            <ul className="readiness-item__items">
              {finding.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          {showOwner && finding.required_action && (
            <p className="readiness-item__action">{text.action}: {finding.required_action}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

export function PublishReadinessDialog({
  open,
  entityType,
  entityId,
  entityTitle,
  onClose,
  onPublish,
  onPublished,
}: {
  open: boolean
  entityType: PublishableEntityType
  entityId: string
  entityTitle: string
  onClose: () => void
  /// عملية النشر الحقيقية للنوع، يمرّرها المتصل لأن كل نوع له مساره الخاص.
  onPublish: (id: string) => Promise<unknown>
  onPublished: () => void | Promise<void>
}) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [result, setResult] = useState<PublishGateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [refusal, setRefusal] = useState<PublishRefusal | null>(null)

  const check = useCallback(async () => {
    setLoading(true)
    setError('')
    setRefusal(null)
    try {
      const response = await api.publishReadiness(entityType, entityId)
      setResult(response.data)
    } catch (caught) {
      setResult(null)
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, text.loadError])

  useEffect(() => {
    if (open) void check()
  }, [check, open])

  async function publish() {
    setPublishing(true)
    setError('')
    try {
      await onPublish(entityId)
      await onPublished()
      onClose()
    } catch (caught) {
      // 409 من بوابة النشر يحمل العوائق في `data`؛ عرضها أدقّ من رسالة عامة.
      if (caught instanceof ApiError && caught.status === 409 && caught.payload) {
        const payload = caught.payload as PublishRefusal
        if (Array.isArray(payload.blockers)) setRefusal(payload)
        else setError(caught.message)
      } else {
        setError(caught instanceof Error ? caught.message : text.loadError)
      }
    } finally {
      setPublishing(false)
    }
  }

  const blockers = refusal?.blockers ?? result?.blockers ?? []
  const warnings = refusal?.warnings ?? result?.warnings ?? []
  const passed = (result?.findings ?? []).filter((finding) => finding.status === 'pass')
  const skipped = (result?.findings ?? []).filter((finding) => finding.status === 'not_applicable')
  const publishable = blockers.length === 0 && !!result

  return (
    <Modal open={open} title={`${text.title} — ${entityTitle}`} onClose={onClose}>
      {loading && <p className="readiness-note" role="status">{text.loading}</p>}
      {error && <p className="inline-alert inline-alert--error" role="alert">{error}</p>}

      {refusal && <p className="inline-alert inline-alert--error" role="alert">{text.refused}</p>}

      {!loading && blockers.length > 0 && (
        <section className="readiness-group readiness-group--blocked">
          <h3>{text.blockers(blockers.length)}</h3>
          <FindingList findings={blockers} showOwner />
        </section>
      )}

      {!loading && warnings.length > 0 && (
        <section className="readiness-group readiness-group--warn">
          <h3>{text.warnings(warnings.length)}</h3>
          <FindingList findings={warnings} showOwner />
        </section>
      )}

      {!loading && result && blockers.length === 0 && (
        <p className="inline-alert inline-alert--success">{text.ready}</p>
      )}

      {!loading && passed.length > 0 && (
        <details className="readiness-group">
          <summary>{text.passed(passed.length)}</summary>
          <FindingList findings={passed} showOwner={false} />
        </details>
      )}

      {!loading && skipped.length > 0 && (
        <details className="readiness-group">
          <summary>{text.skipped(skipped.length)}</summary>
          <FindingList findings={skipped} showOwner={false} />
        </details>
      )}

      <div className="form-actions">
        <button type="button" className="button button--ghost" onClick={onClose}>{text.close}</button>
        <button type="button" className="button button--ghost" onClick={() => void check()} disabled={loading || publishing}>
          <Icon name="refresh" /> {text.retry}
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void publish()}
          disabled={!publishable || publishing}
          // العنوان يشرح سبب التعطيل: بلا هذا يبدو الزر معطَّلًا لسبب مجهول،
          // وهو النمط الذي حُذف من صفحات أخرى في هذه اللوحة لأنه مضلّل.
          title={publishable ? undefined : text.blocked}
        >
          {publishing ? text.publishing : warnings.length ? text.publishAnyway : text.publish}
        </button>
      </div>
      {!publishable && !loading && <p className="readiness-note">{text.blocked}</p>}
    </Modal>
  )
}
