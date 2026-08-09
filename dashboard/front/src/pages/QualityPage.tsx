import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { EmptyState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { QualityEntityType, QualityReport } from '../types/api'

/**
 * فحص الجاهزية والتصدير.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * `GET /admin/quality/:type/:id` و`GET /admin/backup/:type/:id` موجودان بلا أي
 * مستدعٍ في الواجهة. وفحص الجاهزية قرار يُتخذ كل يوم في الإنتاج: «هل هذه القصة
 * قابلة للنشر؟».
 *
 * ## أربع علل أُصلحت في الخادم قبل بناء هذه الصفحة
 *
 * بناء واجهة على فحص معطوب يعني عرض نتائج خاطئة بثقة، فأُصلح المصدر أولًا:
 *
 * ١. النوع `story` كان يُقرأ من جدول `books`، و`story_pages.story_id` يشير إلى
 *    `stories(id)` — فلا ينجح الفحص على أي مدخل صحيح.
 * ٢. فحص الغلاف كان `!!x || true`، أي `true` دائمًا، على عمود لا وجود له أصلًا.
 * ٣. `series` و`book` و`game` و`project` كانت تُعيد `readyToPublish: true`
 *    بقائمة فحوص فارغة، لأن `[].every()` قيمته `true`.
 * ٤. حدّ «4 صفحات» كان مخترعًا لا وجود له في أي بوابة نشر.
 *
 * الفحص الآن يستدعي بوابات النشر نفسها من `lib/catalogueValidation.ts`، فما
 * تقوله هذه الصفحة هو ما سيفعله `PATCH /stories/:id` فعلًا عند النشر.
 */

const ENTITY_TYPES: QualityEntityType[] = ['series', 'story', 'book', 'game', 'project']

const entityLabels: Record<'ar' | 'en', Record<QualityEntityType, string>> = {
  ar: { series: 'سلسلة', story: 'قصة', book: 'كتاب', game: 'لعبة', project: 'مشروع' },
  en: { series: 'Series', story: 'Story', book: 'Book', game: 'Game', project: 'Project' },
}

/// أسماء الفحوص كما يُعيدها الخادم. الرسالة تأتي منه جاهزة بالعربية، وهذا
/// العنوان يشرح ما يقيسه الفحص.
const checkLabels: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    pages_and_text: 'الصفحات والنصوص',
    page_images: 'صور الصفحات',
    visual_style: 'الاستايل البصري',
    pages: 'الصفحات',
    content_pack: 'حزمة المحتوى',
    engine: 'المحرّك',
    materials: 'المواد',
    steps: 'الخطوات',
    episodes: 'الحلقات',
    planet: 'الكوكب',
  },
  en: {
    pages_and_text: 'Pages and text',
    page_images: 'Page images',
    visual_style: 'Visual style',
    pages: 'Pages',
    content_pack: 'Content pack',
    engine: 'Engine',
    materials: 'Materials',
    steps: 'Steps',
    episodes: 'Episodes',
    planet: 'Planet',
  },
}

const copy = {
  ar: {
    eyebrow: 'ضبط الجودة',
    title: 'فحص الجاهزية والتصدير',
    lede: 'افحص جاهزية كيان للنشر بالبوابات نفسها التي يفرضها الخادم، أو صدّره كملف JSON.',
    typeLabel: 'النوع',
    idLabel: 'المعرّف',
    idPlaceholder: 'الصق معرّف الكيان',
    check: 'فحص',
    checking: 'جارٍ الفحص…',
    idRequired: 'المعرّف مطلوب.',
    notFound: 'لا كيان بهذا المعرّف',
    notFoundHint: 'تأكّد من النوع والمعرّف. القصة والكتاب كيانان مختلفان لا مترادفان.',
    readyTitle: 'جاهز للنشر',
    readyBody: 'كل الفحوص مرّت. النشر لن يُرفض بسبب الجاهزية.',
    blockedTitle: 'غير جاهز للنشر',
    blockedBody: 'فحص واحد على الأقل لم يمرّ. النشر سيُرفض حتى يُعالَج.',
    checksTitle: 'الفحوص',
    checkColumn: 'الفحص',
    resultColumn: 'النتيجة',
    detailColumn: 'التفصيل',
    passed: 'مرّ',
    failed: 'لم يمرّ',
    exportTitle: 'التصدير',
    exportBody: 'نسخة JSON كاملة من الكيان. للقصص تشمل الصفحات وترجماتها، وللسلاسل تشمل الحلقات.',
    export: 'تصدير JSON',
    exporting: 'جارٍ التصدير…',
    exported: 'نُزّل الملف.',
    restoreNote: 'الاستعادة غير منفَّذة',
    restoreHint: 'الخادم يرفض /restore بـ501 صريحًا: كان يُعيد نجاحًا بلا كتابة في قاعدة البيانات. استخدم ملف النسخة يدويًا.',
    checkError: 'تعذر إجراء الفحص',
    exportError: 'تعذر التصدير',
    gateNote: 'الفحوص هي بوابات النشر نفسها في الخادم، لا قواعد موازية.',
  },
  en: {
    eyebrow: 'Quality control',
    title: 'Readiness check and export',
    lede: 'Check whether an entity can be published using the same gates the server enforces, or export it as JSON.',
    typeLabel: 'Type',
    idLabel: 'Identifier',
    idPlaceholder: 'Paste the entity id',
    check: 'Check',
    checking: 'Checking…',
    idRequired: 'An identifier is required.',
    notFound: 'No entity with that id',
    notFoundHint: 'Verify the type and id. A story and a book are different entities, not synonyms.',
    readyTitle: 'Ready to publish',
    readyBody: 'Every check passed. Publishing will not be refused on readiness grounds.',
    blockedTitle: 'Not ready to publish',
    blockedBody: 'At least one check failed. Publishing will be refused until it is resolved.',
    checksTitle: 'Checks',
    checkColumn: 'Check',
    resultColumn: 'Result',
    detailColumn: 'Detail',
    passed: 'Passed',
    failed: 'Failed',
    exportTitle: 'Export',
    exportBody: 'A full JSON copy of the entity. Stories include pages and their localizations; series include episodes.',
    export: 'Export JSON',
    exporting: 'Exporting…',
    exported: 'The file was downloaded.',
    restoreNote: 'Restore is not implemented',
    restoreHint: 'The server refuses /restore with an explicit 501: it used to return success without writing anything. Use the backup file manually.',
    checkError: 'Unable to run the check',
    exportError: 'Unable to export',
    gateNote: 'These checks are the server\u2019s own publish gates, not a parallel set of rules.',
  },
}

export function QualityPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [type, setType] = useState<QualityEntityType>('story')
  const [id, setId] = useState('')
  const [report, setReport] = useState<QualityReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [notFound, setNotFound] = useState(false)

  const run = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const value = id.trim()
    if (!value) { setError(text.idRequired); return }

    setLoading(true)
    setError('')
    setNotice('')
    setNotFound(false)
    setReport(null)
    try {
      const response = await api.qualityReport(type, value)
      setReport(response.data)
    } catch (caught) {
      // 404 حالة قائمة بذاتها: كيان غير موجود ليس كيانًا فاشل الفحص
      const status = (caught as { status?: number } | null)?.status
      if (status === 404) setNotFound(true)
      else setError(caught instanceof Error ? caught.message : text.checkError)
    } finally {
      setLoading(false)
    }
  }, [id, text.checkError, text.idRequired, type])

  /// التصدير يبني ملفًا في المتصفح من استجابة JSON.
  ///
  /// العنوان يُحرَّر فورًا بعد النقر لا في cleanup: التنزيل لحظيّ ولا حاجة
  /// للاحتفاظ بالعنوان بعده، بخلاف مشغّل الصوت في صفحة السرد.
  async function exportEntity() {
    const value = id.trim()
    if (!value) { setError(text.idRequired); return }

    setExporting(true)
    setError('')
    setNotice('')
    try {
      const response = await api.backupExport(type, value)
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${type}-${value}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice(text.exported)
    } catch (caught) {
      const status = (caught as { status?: number } | null)?.status
      if (status === 404) setNotFound(true)
      else setError(caught instanceof Error ? caught.message : text.exportError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <form className="panel" onSubmit={run}>
        <div className="entity-form">
          {error && <div className="inline-alert inline-alert--error">{error}</div>}
          {notice && <div className="inline-alert inline-alert--info">{notice}</div>}

          <div className="filters-row">
            <label className="field">
              <span>{text.typeLabel}</span>
              <select value={type} onChange={(event) => setType(event.target.value as QualityEntityType)}>
                {ENTITY_TYPES.map((item) => (
                  <option value={item} key={item}>{entityLabels[locale][item]}</option>
                ))}
              </select>
            </label>
            <label className="field search-field">
              <span>{text.idLabel}</span>
              <input
                value={id}
                dir="ltr"
                onChange={(event) => setId(event.target.value)}
                placeholder={text.idPlaceholder}
              />
            </label>
            <button className="button button--primary" type="submit" disabled={loading}>
              {loading ? text.checking : text.check}
            </button>
          </div>
        </div>
      </form>

      {loading ? <LoadingState /> : null}

      {notFound ? <EmptyState title={text.notFound} description={text.notFoundHint} /> : null}

      {report && (
        <>
          {/* الحكم أولًا: هو ما جاء المسؤول لأجله */}
          <section className={`panel ${report.readyToPublish ? '' : 'panel--notice'}`}>
            <div className="panel__header">
              <div>
                <span className="panel__kicker">
                  {entityLabels[locale][report.entity_type]}
                </span>
                <h3>{report.readyToPublish ? text.readyTitle : text.blockedTitle}</h3>
              </div>
              <span className={`status-badge ${report.readyToPublish ? 'status-badge--published' : 'status-badge--review'}`}>
                {report.readyToPublish ? text.passed : text.failed}
              </span>
            </div>
            <div className="entity-form">
              <p className="table-secondary">
                {report.readyToPublish ? text.readyBody : text.blockedBody}
              </p>
            </div>
          </section>

          <section className="panel panel--table">
            <div className="panel__header"><h3>{text.checksTitle}</h3></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.checkColumn}</th>
                    <th>{text.resultColumn}</th>
                    <th>{text.detailColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.checks.map((item) => (
                    <tr key={item.check}>
                      <td>
                        <div>
                          <strong>{checkLabels[locale][item.check] ?? item.check}</strong>
                          <small className="table-secondary" dir="ltr">{item.check}</small>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${item.passed ? 'status-badge--published' : 'status-badge--archived'}`}>
                          {item.passed ? text.passed : text.failed}
                        </span>
                      </td>
                      {/* الرسالة تحمل السبب لا الحكم: «الصفحة 3 بلا صورة» لا «فشل» */}
                      <td><span className="table-secondary">{item.message}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="panel__footer">
              <span>{text.gateNote}</span>
            </footer>
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel__header"><h3>{text.exportTitle}</h3></div>
        <div className="entity-form">
          <p className="table-secondary">{text.exportBody}</p>
          <div className="form-actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={exporting || !id.trim()}
              onClick={() => void exportEntity()}
            >
              <Icon name="upload" size={16} />{exporting ? text.exporting : text.export}
            </button>
          </div>
        </div>
      </section>

      {/* الاستعادة مرفوضة بـ501 في الخادم: يُعلَن بدل زرٍّ يُوهم بها */}
      <section className="panel panel--notice">
        <strong>{text.restoreNote}</strong>
        <p>{text.restoreHint}</p>
      </section>
    </div>
  )
}
