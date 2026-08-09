import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { TtsConfig, TtsEncoding, TtsPreviewResult } from '../types/api'

/**
 * توليد السرد الصوتي.
 *
 * ## لماذا كانت هذه الصفحة غائبة
 *
 * `services/googleTts.ts` أكبر خدمة في المشروع (518 سطرًا): نقلان، توقيع JWT
 * لحساب الخدمة، تخزين مؤقّت للرمز، وتغليف PCM في حاوية WAV. ومسارَاها
 * `GET /tts/config` و`POST /tts/preview` جاهزان. ولم يكن لأيٍّ منهما مستدعٍ في
 * الواجهة، فالخدمة كلها كانت غير قابلة للاستخدام إلا بـcurl.
 *
 * ## ثلاث قواعد من الخادم تُحترم هنا
 *
 * ١. **الحدود بالبايت لا بالحرف.** UTF-8 يرمّز الحرف العربي في بايتين، فحدّ
 *    4000 بايت هو ~2000 حرف عربي. العدّاد هنا يقيس البايتات بـ`TextEncoder`
 *    مطابقةً لـ`byteLength` في الخادم، لا `text.length`.
 *
 * ٢. **الاقتطاع الصامت هو سبب الرفض.** Gemini-TTS يقطع الصوت الزائد بلا إخطار،
 *    فالخادم يرفض بـ`text_too_long`. المنع هنا قبل النداء يوفّر نداءً مدفوعًا
 *    يُرفض.
 *
 * ٣. **الترميز المطلوب قد لا يكون المُنتَج.** نقل `ai_studio` يُعيد WAV دائمًا
 *    ويتجاهل الترميز. تُعرض القيمة الفعلية من ترويسة الاستجابة لا من الطلب، ولا
 *    يُعرض اختيار الترميز إلا على `cloud_tts`.
 *
 * ## المعاينة لا تحفظ نفسها تلقائيًا
 *
 * `POST /tts/preview` لا يكتب صفًّا في `content_assets` عمدًا: هذه حلقة «هل
 * يناسب هذا الصوت القصة»، وحفظ كل تجربة يُتخم مكتبة الوسائط بمحاولات مهملة.
 *
 * الحفظ الصريح بعد المعاينة أصبح متاحًا عبر `POST /tts/assets` (مسار مستقل):
 * يرسل نفس بايتات الصوت التي عاينها المحرّر بالضبط — لا نداءً ثانيًا لـGoogle
 * قد يُنتج أداءً مختلفًا لنفس النص — ويكتب صفًّا حقيقيًا في `content_assets`
 * برؤية خاصة دائمًا (السرد يُصنَّف خاصًا لا فنًّا عامًا). الربط بحلقة أو قصة
 * محدَّدة يتم بعدها من مكتبة الوسائط (`PUT /assets/:id/links`)، تمامًا كأي
 * أصل آخر — لا حاجة لمسار ربط مكرَّر هنا.
 */

const copy = {
  ar: {
    eyebrow: 'الإنتاج الصوتي',
    title: 'توليد السرد',
    lede: 'اكتب نصًّا وتوجيهًا للأداء، واستمع للنتيجة قبل استخدامها. المعاينة لا تُحفظ في مكتبة الوسائط.',
    reload: 'إعادة الفحص',
    unconfiguredTitle: 'التوليد غير مُهيَّأ',
    unconfiguredBody: 'لا يوجد اعتماد Google مضبوط في هذه البيئة، فلا يمكن توليد صوت. يلزم أحد الخيارين:',
    unconfiguredCloud: 'حساب خدمة: GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL و GOOGLE_TTS_PRIVATE_KEY و GOOGLE_TTS_PROJECT_ID — يُعيد MP3 مباشرة، وهو المسار المُفضَّل.',
    unconfiguredStudio: 'مفتاح API: GOOGLE_TTS_API_KEY — أسرع في الضبط لكنه يُعيد WAV أكبر حجمًا.',
    unconfiguredHint: 'تُضبط كأسرار عبر wrangler secret put، ولا تُعرض قيمتها في اللوحة أبدًا.',
    transportLabel: 'النقل',
    transportCloud: 'حساب خدمة (MP3 مباشرة)',
    transportStudio: 'مفتاح API (يُلَفّ كـWAV)',
    textLabel: 'النص المقروء *',
    textPlaceholder: 'اكتب نصّ الصفحة كما يُقرأ على الطفل.',
    promptLabel: 'توجيه الأداء',
    promptPlaceholder: 'مثال: اقرأ بصوت حكّاءٍ دافئ وبإيقاع هادئ يناسب وقت النوم.',
    promptHint: 'هذا ما يميّز Gemini-TTS عن صوت عاديّ: يوجّه النبرة والإيقاع واللهجة.',
    voiceLabel: 'الصوت',
    languageLabel: 'اللغة',
    languageHint: (recommended: string) => `${recommended} هو الوحيد المستقرّ للعربية؛ غيره ما زال تجريبيًّا.`,
    encodingLabel: 'الترميز',
    encodingCloudHint: 'MP3 أصغر حجمًا وأنسب للتوزيع.',
    encodingStudioHint: 'هذا النقل يُعيد WAV دائمًا ويتجاهل الترميز المطلوب.',
    generate: 'توليد',
    generating: 'جارٍ التوليد…',
    generateHint: 'كل توليد نداءٌ مدفوع على حساب المنصّة.',
    bytesUsed: (used: string, max: string) => `${used} / ${max} بايت`,
    lettersApprox: (letters: string) => `~${letters} حرف عربي`,
    overTextLimit: 'النص أطول من الحدّ. Gemini-TTS يقتطع الزائد بصمت، فالتوليد مرفوض.',
    overPromptLimit: 'التوجيه أطول من الحدّ.',
    overCombinedLimit: 'مجموع النص والتوجيه أكبر من الحدّ المشترك.',
    textRequired: 'النص مطلوب.',
    resultTitle: 'النتيجة',
    resultTransport: 'النقل الفعلي',
    resultModel: 'الموديل',
    resultVoice: 'الصوت',
    resultType: 'النوع',
    resultSize: 'الحجم',
    download: 'تنزيل',
    saveTitleLabel: 'عنوان الأصل في مكتبة الوسائط *',
    saveTitlePlaceholder: 'مثال: سرد صفحة 3 — قصة أرنوب والقمر',
    saveTitleRequired: 'العنوان مطلوب قبل الحفظ.',
    save: 'حفظ في مكتبة الوسائط',
    saving: 'جارٍ الحفظ…',
    savedOk: 'حُفظ السرد في مكتبة الوسائط.',
    saveError: 'تعذر حفظ السرد',
    savedHint: 'يمكن ربط الأصل المحفوظ بحلقة أو قصة من مكتبة الوسائط.',
    openInLibrary: 'فتح في مكتبة الوسائط',
    loadError: 'تعذر تحميل إعدادات التوليد',
    generateError: 'تعذر توليد الصوت',
    limitsNote: 'الحدود بالبايت لا بالحرف: الحرف العربي بايتان في UTF-8.',
    errorUnconfigured: 'الاعتماد غير مضبوط في الخادم.',
    errorTooLong: 'النص أو التوجيه أطول من حدّ المزوّد.',
    errorProviderDown: 'المزوّد غير متاح الآن. أعِد المحاولة.',
    errorProviderRejected: 'المزوّد رفض الطلب.',
    errorInvalid: 'الطلب غير صالح.',
  },
  en: {
    eyebrow: 'Audio production',
    title: 'Narration',
    lede: 'Write text and a performance direction, then listen before using it. A preview is not saved to the media library.',
    reload: 'Re-check',
    unconfiguredTitle: 'Generation is not configured',
    unconfiguredBody: 'No Google credential is set in this environment, so audio cannot be generated. One of these is required:',
    unconfiguredCloud: 'Service account: GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL, GOOGLE_TTS_PRIVATE_KEY and GOOGLE_TTS_PROJECT_ID — returns MP3 directly and is the preferred path.',
    unconfiguredStudio: 'API key: GOOGLE_TTS_API_KEY — quicker to set up but returns larger WAV audio.',
    unconfiguredHint: 'Set as secrets via wrangler secret put; their values are never shown in the dashboard.',
    transportLabel: 'Transport',
    transportCloud: 'Service account (direct MP3)',
    transportStudio: 'API key (wrapped as WAV)',
    textLabel: 'Spoken text *',
    textPlaceholder: 'Write the page text as it should be read to the child.',
    promptLabel: 'Performance direction',
    promptPlaceholder: 'For example: read as a warm storyteller with a calm bedtime pace.',
    promptHint: 'This is what separates Gemini-TTS from a plain voice: it steers tone, pace and accent.',
    voiceLabel: 'Voice',
    languageLabel: 'Language',
    languageHint: (recommended: string) => `${recommended} is the only stable option for Arabic; others remain preview.`,
    encodingLabel: 'Encoding',
    encodingCloudHint: 'MP3 is smaller and better suited to distribution.',
    encodingStudioHint: 'This transport always returns WAV and ignores the requested encoding.',
    generate: 'Generate',
    generating: 'Generating…',
    generateHint: 'Every generation is a paid call against the platform account.',
    bytesUsed: (used: string, max: string) => `${used} / ${max} bytes`,
    lettersApprox: (letters: string) => `~${letters} Arabic letters`,
    overTextLimit: 'The text exceeds the limit. Gemini-TTS truncates silently, so generation is refused.',
    overPromptLimit: 'The direction exceeds the limit.',
    overCombinedLimit: 'Text and direction together exceed the combined limit.',
    textRequired: 'Text is required.',
    resultTitle: 'Result',
    resultTransport: 'Actual transport',
    resultModel: 'Model',
    resultVoice: 'Voice',
    resultType: 'Type',
    resultSize: 'Size',
    download: 'Download',
    saveTitleLabel: 'Media library asset title *',
    saveTitlePlaceholder: 'For example: Page 3 narration — Arnoub and the Moon',
    saveTitleRequired: 'A title is required before saving.',
    save: 'Save to media library',
    saving: 'Saving…',
    savedOk: 'The narration was saved to the media library.',
    saveError: 'Unable to save the narration',
    savedHint: 'The saved asset can be linked to an episode or story from the media library.',
    openInLibrary: 'Open in media library',
    loadError: 'Unable to load generation settings',
    generateError: 'Unable to generate audio',
    limitsNote: 'Limits are in bytes, not characters: an Arabic letter is two bytes in UTF-8.',
    errorUnconfigured: 'The credential is not configured on the server.',
    errorTooLong: 'The text or direction exceeds the provider limit.',
    errorProviderDown: 'The provider is unavailable right now. Try again.',
    errorProviderRejected: 'The provider rejected the request.',
    errorInvalid: 'The request is invalid.',
  },
}

const ENCODINGS: TtsEncoding[] = ['MP3', 'LINEAR16', 'OGG_OPUS']

/// أكواد الخطأ التي يُعيدها الخادم، مطابقة لـGoogleTtsError.code.
/// تُترجَم لأن الكود الخام (`provider_unavailable`) لا يفيد المسؤول.
const ERROR_KEYS: Record<string, 'errorUnconfigured' | 'errorTooLong' | 'errorProviderDown' | 'errorProviderRejected' | 'errorInvalid'> = {
  unconfigured: 'errorUnconfigured',
  text_too_long: 'errorTooLong',
  provider_unavailable: 'errorProviderDown',
  provider_rejected: 'errorProviderRejected',
  invalid_request: 'errorInvalid',
}

/// يقيس طول النصّ بالبايتات لا بالمحارف.
///
/// مطابق لـ`byteLength` في services/googleTts.ts. استخدام `text.length` هنا كان
/// سيسمح بنصّ عربي يبلغ ضعف الحدّ الفعلي ثم يُرفض من الخادم.
function byteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function formatBytes(bytes: number, locale: 'ar' | 'en') {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024), locale)} KB`
  return `${formatNumber(Math.round((bytes / (1024 * 1024)) * 10) / 10, locale)} MB`
}

/// امتداد الملف من النوع الفعلي لا من الترميز المطلوب: نقل ai_studio يُعيد WAV
/// مهما طُلب، فاسم ملف بامتداد mp3 سيكذب على محتواه.
function extensionFor(mimeType: string) {
  if (mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'wav'
}

export function NarrationPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [config, setConfig] = useState<TtsConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [body, setBody] = useState('')
  const [prompt, setPrompt] = useState('')
  const [voice, setVoice] = useState('Kore')
  const [language, setLanguage] = useState('ar-EG')
  const [encoding, setEncoding] = useState<TtsEncoding>('MP3')

  const [result, setResult] = useState<TtsPreviewResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [saveTitle, setSaveTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedAssetId, setSavedAssetId] = useState('')

  /// عناوين الـblob تُحرَّر يدويًا: كل معاينة تحتجز ذاكرة حتى تُلغى، وعشر
  /// معاينات بلا تحرير تُبقي عشرة ملفات صوتية في ذاكرة التبويب.
  const activeUrl = useRef<string | null>(null)
  useEffect(() => () => {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await api.ttsConfig()
      setConfig(response.data)
      // الافتراضات تأتي من الخادم لا من الواجهة، فلا تنحرف عند تغيير الموديل
      setLanguage(response.data.recommended_language)
      setVoice((current) => (
        response.data.voices.includes(current) ? current : response.data.voices[0] ?? current
      ))
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const limits = config?.limits
  const textBytes = byteLength(body)
  const promptBytes = byteLength(prompt)
  const combinedBytes = textBytes + promptBytes

  /// نفس فحوص `assertWithinLimits` في الخادم، بنفس الترتيب.
  const limitError = useMemo(() => {
    if (!limits) return ''
    if (textBytes > limits.text_bytes) return text.overTextLimit
    if (promptBytes > limits.prompt_bytes) return text.overPromptLimit
    if (combinedBytes > limits.combined_bytes) return text.overCombinedLimit
    return ''
  }, [combinedBytes, limits, promptBytes, text, textBytes])

  const configured = Boolean(config?.configured)
  const isCloud = config?.transport === 'cloud_tts'
  const canGenerate = configured && Boolean(body.trim()) && !limitError && !generating

  async function generate() {
    if (!body.trim()) { setError(text.textRequired); return }
    if (limitError) { setError(limitError); return }

    setGenerating(true)
    setError('')
    try {
      const next = await api.ttsPreview({
        text: body,
        prompt: prompt.trim() || undefined,
        voice,
        language_code: language,
        // الترميز يُرسل فقط حيث يُحترم. إرساله لنقل ai_studio يوحي بأنه مؤثّر.
        ...(isCloud ? { encoding } : {}),
      })
      // المعاينة السابقة تُحرَّر قبل استبدالها
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current)
      activeUrl.current = next.url
      setResult(next)
      // نتيجة جديدة تعني حفظًا جديدًا محتملًا: تُمسح حالة الحفظ السابقة
      setSavedAssetId('')
      setSaveError('')
    } catch (caught) {
      // الخادم يُعيد كود خطأ لا رسالة بشرية، فيُترجَم متى عُرف
      const raw = caught instanceof Error ? caught.message : ''
      const key = ERROR_KEYS[raw]
      setError(key ? text[key] : raw || text.generateError)
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!result) return
    if (!saveTitle.trim()) { setSaveError(text.saveTitleRequired); return }

    setSaving(true)
    setSaveError('')
    try {
      const response = await api.saveNarrationAsset({
        title: saveTitle.trim(),
        blob: result.blob,
        voice: result.voice,
        language,
        model: result.model,
        transport: result.transport,
      })
      setSavedAssetId(response.data.id)
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (loadError && !config) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={17} />{text.reload}
          </button>
        </div>
      </section>

      {/* غياب الاعتماد يُشرح بما يلزم لضبطه، لا برسالة فشل عامة */}
      {!configured && (
        <section className="panel panel--notice">
          <strong>{text.unconfiguredTitle}</strong>
          <div>
            <p>{text.unconfiguredBody}</p>
            <ul className="planned-list">
              <li>{text.unconfiguredCloud}</li>
              <li>{text.unconfiguredStudio}</li>
            </ul>
            <p>{text.unconfiguredHint}</p>
          </div>
        </section>
      )}

      {configured && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="panel__kicker">{text.transportLabel}</span>
              <h3>{isCloud ? text.transportCloud : text.transportStudio}</h3>
            </div>
            <span className="table-secondary" dir="ltr">{config?.default_model}</span>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="entity-form">
          {error && <div className="inline-alert inline-alert--error">{error}</div>}

          <label className="field">
            <span>{text.textLabel}</span>
            <textarea
              rows={6}
              value={body}
              disabled={!configured}
              onChange={(event) => setBody(event.target.value)}
              placeholder={text.textPlaceholder}
            />
            {limits && (
              <small className={textBytes > limits.text_bytes ? 'size-warning' : undefined}>
                {text.bytesUsed(formatNumber(textBytes, locale), formatNumber(limits.text_bytes, locale))}
                {' · '}
                {text.lettersApprox(formatNumber(Math.floor(textBytes / 2), locale))}
              </small>
            )}
          </label>

          <label className="field">
            <span>{text.promptLabel}</span>
            <textarea
              rows={3}
              value={prompt}
              disabled={!configured}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={text.promptPlaceholder}
            />
            <small>{text.promptHint}</small>
            {limits && promptBytes > 0 && (
              <small className={promptBytes > limits.prompt_bytes ? 'size-warning' : undefined}>
                {text.bytesUsed(formatNumber(promptBytes, locale), formatNumber(limits.prompt_bytes, locale))}
              </small>
            )}
          </label>

          <div className="form-grid form-grid--three">
            <label className="field">
              <span>{text.voiceLabel}</span>
              <select value={voice} disabled={!configured} onChange={(event) => setVoice(event.target.value)}>
                {(config?.voices ?? []).map((item) => (
                  <option value={item} key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{text.languageLabel}</span>
              <input
                value={language}
                dir="ltr"
                disabled={!configured}
                onChange={(event) => setLanguage(event.target.value)}
              />
              <small>{text.languageHint(config?.recommended_language ?? 'ar-EG')}</small>
            </label>
            <label className="field">
              <span>{text.encodingLabel}</span>
              <select
                value={isCloud ? encoding : 'LINEAR16'}
                // نقل ai_studio يتجاهل الترميز، فالاختيار معطَّل بسبب معروض
                disabled={!configured || !isCloud}
                onChange={(event) => setEncoding(event.target.value as TtsEncoding)}
              >
                {ENCODINGS.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
              <small>{isCloud ? text.encodingCloudHint : text.encodingStudioHint}</small>
            </label>
          </div>

          {limits && <p className="table-secondary">{limits.note_ar || text.limitsNote}</p>}

          <div className="form-actions">
            <span className="table-secondary">{text.generateHint}</span>
            <button
              className="button button--primary"
              type="button"
              disabled={!canGenerate}
              onClick={() => void generate()}
            >
              {generating ? text.generating : text.generate}
            </button>
          </div>
        </div>
      </section>

      {result && (
        <>
          <section className="panel">
            <div className="panel__header"><h3>{text.resultTitle}</h3></div>
            <div className="entity-form">
              <audio controls src={result.url} className="narration-player" />
              <dl className="detail-list">
                <div>
                  <dt>{text.resultTransport}</dt>
                  <dd dir="ltr">{result.transport}</dd>
                </div>
                <div>
                  <dt>{text.resultModel}</dt>
                  <dd dir="ltr">{result.model}</dd>
                </div>
                <div>
                  <dt>{text.resultVoice}</dt>
                  <dd dir="ltr">{result.voice}</dd>
                </div>
                <div>
                  <dt>{text.resultType}</dt>
                  <dd dir="ltr">{result.mimeType}</dd>
                </div>
                <div>
                  <dt>{text.resultSize}</dt>
                  <dd dir="ltr">{formatBytes(result.bytes, locale)}</dd>
                </div>
              </dl>
              <div className="form-actions">
                <a
                  className="button button--secondary"
                  href={result.url}
                  download={`narration-${result.voice}.${extensionFor(result.mimeType)}`}
                >
                  <Icon name="upload" size={16} />{text.download}
                </a>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header"><h3>{text.save}</h3></div>
            <div className="entity-form">
              {saveError && <div className="inline-alert inline-alert--error">{saveError}</div>}
              {savedAssetId ? (
                <div className="inline-alert inline-alert--success">
                  <p>{text.savedOk}</p>
                  <p>{text.savedHint}</p>
                  <Link className="button button--secondary" to={adminPath(`media/${savedAssetId}`)}>
                    {text.openInLibrary}
                  </Link>
                </div>
              ) : (
                <>
                  <label className="field">
                    <span>{text.saveTitleLabel}</span>
                    <input
                      value={saveTitle}
                      onChange={(event) => setSaveTitle(event.target.value)}
                      placeholder={text.saveTitlePlaceholder}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={saving || !saveTitle.trim()}
                      onClick={() => void save()}
                    >
                      {saving ? text.saving : text.save}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
