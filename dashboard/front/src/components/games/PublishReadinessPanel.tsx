import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { ErrorState, LoadingState } from '../PageState'
import { usePreferences } from '../../context/preferences'
import { api } from '../../lib/api'
import type { GameReadiness, ReadinessOwner, ReadinessStatus } from '../../types/gamePack'

/**
 * لوحة جاهزية النشر من `GET /admin/games/:id/readiness`.
 *
 * ## لماذا قائمة لا رسالة
 *
 * قبل مسار الجاهزية كان النشر يُرفض برسالة 400 واحدة، فيتعلّم المحرّر عن عائق
 * واحد في كل محاولة: صورة غير منتَجة، ثم صوت غير مسجَّل، ثم مراجعة معلَّقة، ثم
 * ترجمتان ناقصتان. عرضها مجتمعة هو الفرق بين قائمة تحقّق وبين التخمين.
 *
 * ## لا جاهزية مُختلقة
 *
 * الحالات تُعرض كما وردت من الخادم: أصل مفقود يظهر «مفقود» وأصل غير جاهز يظهر
 * بحالته الفعلية. لا صفّ يُعرض «جاهزًا» لأن الشاشة تفترض ذلك، ولا حالة تُلطَّف.
 *
 * ## المالك ليس تفصيلًا تجميليًا
 *
 * تسجيل صوتي ناقص ليس مهمّة هندسية، وعرضه بلا مالك يجعله يبدو كذلك. الخادم
 * يُرجع `owner` لكل عائق، وهذه الشاشة تُظهره لأن السؤال العملي هو «من يُصلحه».
 */

const copy = {
  ar: {
    kicker: 'قائمة تحقّق النشر',
    title: 'جاهزية النشر',
    loading: 'جارٍ فحص الجاهزية...',
    loadError: 'تعذر تحميل فحص الجاهزية',
    refresh: 'تحديث',
    publishable: 'كل الفحوص مجتازة: لا عائق يمنع النشر من جهة البيانات.',
    blocked: (count: number) => `${count} عائق يمنع النشر:`,
    check: 'الفحص',
    detail: 'التفصيل',
    owner: 'المسؤول',
    items: 'البنود',
    statuses: {
      pass: 'مجتاز',
      blocked: 'يمنع النشر',
      warn: 'تنبيه',
      not_applicable: 'لا ينطبق',
    } as Record<ReadinessStatus, string>,
    owners: {
      editor: 'محرّر المحتوى',
      engineering: 'الهندسة',
      reviewer: 'مراجع لغوي',
      production: 'الإنتاج',
      provider: 'مزوّد خارجي',
    } as Record<ReadinessOwner, string>,
    assets: 'قائمة الأصول',
    assetId: 'المعرّف',
    assetKind: 'النوع',
    assetState: 'الحالة',
    assetReady: 'جاهز',
    assetMissing: 'مفقود',
    kinds: { audio: 'صوت', image: 'صورة' } as Record<string, string>,
    noAssets: 'الحزمة لا تشير إلى أي أصل.',
    packWarnings: 'تنبيهات الحزمة',
    promptKeys: 'مفاتيح التوجيه المطلوبة',
    engine: 'المحرّك',
    status: 'حالة اللعبة',
    yes: 'نعم',
    no: 'لا',
  },
  en: {
    kicker: 'Publish checklist',
    title: 'Publish readiness',
    loading: 'Checking readiness...',
    loadError: 'Unable to load the readiness check',
    refresh: 'Refresh',
    publishable: 'Every check passes: nothing in the data blocks publication.',
    blocked: (count: number) => `${count} blocker(s) prevent publication:`,
    check: 'Check',
    detail: 'Detail',
    owner: 'Owner',
    items: 'Items',
    statuses: {
      pass: 'Pass',
      blocked: 'Blocks publish',
      warn: 'Warning',
      not_applicable: 'Not applicable',
    } as Record<ReadinessStatus, string>,
    owners: {
      editor: 'Content editor',
      engineering: 'Engineering',
      reviewer: 'Language reviewer',
      production: 'Production',
      provider: 'External provider',
    } as Record<ReadinessOwner, string>,
    assets: 'Asset checklist',
    assetId: 'Id',
    assetKind: 'Kind',
    assetState: 'State',
    assetReady: 'Ready',
    assetMissing: 'Missing',
    kinds: { audio: 'Audio', image: 'Image' } as Record<string, string>,
    noAssets: 'The pack references no assets.',
    packWarnings: 'Pack warnings',
    promptKeys: 'Required prompt keys',
    engine: 'Engine',
    status: 'Game status',
    yes: 'Yes',
    no: 'No',
  },
}

const SYMBOL: Record<ReadinessStatus, string> = {
  pass: '✓',
  blocked: '✕',
  warn: '!',
  not_applicable: '–',
}

export function PublishReadinessPanel({
  gameId,
  onLoaded,
}: {
  gameId: string
  /// تُرفع النتيجة إلى الصفحة حتى تعرض العوائق في نظرتها العامة بلا نداء ثانٍ.
  onLoaded?: (readiness: GameReadiness) => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [readiness, setReadiness] = useState<GameReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.gameReadiness(gameId)
      setReadiness(response.data)
      onLoaded?.(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [gameId, onLoaded, text.loadError])

  useEffect(() => { void load() }, [load])

  if (loading && !readiness) return <LoadingState label={text.loading} />
  if (error && !readiness) return <ErrorState message={error} onRetry={() => void load()} />
  if (!readiness) return null

  return (
    <section className="panel">
      <header className="panel__header panel__header--filters">
        <div>
          <span className="panel__kicker">{text.kicker}</span>
          <h3>{text.title}</h3>
          <p>{text.engine}: <span dir="ltr">{readiness.engine_id}</span> · {text.status}: <span dir="ltr">{readiness.status}</span></p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => void load()}>
          <Icon name="refresh" size={16} />{text.refresh}
        </button>
      </header>

      <div className="entity-form">
        {readiness.publishable ? (
          <div className="inline-alert inline-alert--info">{text.publishable}</div>
        ) : (
          <div className="inline-alert inline-alert--error">
            <strong>{text.blocked(readiness.blocking_reasons.length)}</strong>
            {/* أسباب المنع كما وردت من الخادم حرفيًا: رسالة عامة هي بالضبط ما
                كانت هذه اللوحة موجودة لإلغائه. */}
            <ul className="planned-list">
              {readiness.blocking_reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th /><th>{text.check}</th><th>{text.detail}</th><th>{text.owner}</th></tr>
            </thead>
            <tbody>
              {readiness.checks.map((check) => (
                <tr key={check.id}>
                  <td>
                    <span
                      className={`readiness-status readiness-status--${check.status}`}
                      role="img"
                      aria-label={text.statuses[check.status]}
                      title={text.statuses[check.status]}
                    >{SYMBOL[check.status]}</span>
                  </td>
                  <td>
                    <strong>{check.label_ar}</strong>
                    <small dir="ltr">{check.id}</small>
                  </td>
                  <td>
                    <span className="table-secondary">{check.detail ?? '—'}</span>
                    {check.items && check.items.length > 0 && (
                      <details className="readiness-items">
                        <summary>{text.items} ({check.items.length})</summary>
                        <ul className="planned-list">{check.items.map((item) => <li key={item}>{item}</li>)}</ul>
                      </details>
                    )}
                  </td>
                  <td>{check.owner ? <span className="track-badge">{text.owners[check.owner]}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>{text.assets}</h4>
        {readiness.assets.length === 0 ? <p className="data-unavailable">{text.noAssets}</p> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{text.assetId}</th><th>{text.assetKind}</th><th>{text.assetState}</th><th>{text.assetReady}</th></tr>
              </thead>
              <tbody>
                {readiness.assets.map((asset) => (
                  <tr key={asset.asset_id}>
                    <td><code dir="ltr">{asset.asset_id}</code></td>
                    <td>{text.kinds[asset.kind] ?? asset.kind}</td>
                    <td>
                      <span className={asset.ready ? 'asset-status asset-status--ready' : asset.state ? 'asset-status asset-status--planned' : 'asset-status asset-status--failed'}>
                        {asset.state ?? text.assetMissing}
                      </span>
                    </td>
                    <td>{asset.ready ? text.yes : text.no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {readiness.pack_warnings.length > 0 && (
          <details className="readiness-items">
            <summary>{text.packWarnings} ({readiness.pack_warnings.length})</summary>
            <ul className="planned-list">{readiness.pack_warnings.map((item) => <li key={item}>{item}</li>)}</ul>
          </details>
        )}

        {readiness.required_prompt_keys.length > 0 && (
          <details className="readiness-items">
            <summary>{text.promptKeys} ({readiness.required_prompt_keys.length})</summary>
            <ul className="planned-list">{readiness.required_prompt_keys.map((item) => <li key={item}><code dir="ltr">{item}</code></li>)}</ul>
          </details>
        )}
      </div>
    </section>
  )
}
