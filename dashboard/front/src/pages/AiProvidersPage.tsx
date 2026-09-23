import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Icon } from './../components/Icon'
import { Modal } from './../components/Modal'
import { ErrorState, LoadingState } from './../components/PageState'
import { usePreferences } from './../context/preferences'
import { api, ApiError } from './../lib/api'
import { hasPermission } from './../lib/adminSession'
import type {
  AiAuthMode,
  AiModality,
  AiModelPayload,
  AiModelRecord,
  AiPriceUnit,
  AiProviderPayload,
  AiProviderRecord,
  AiRegistry,
  AiRoutePayload,
  AiRouteSkipReason,
  AiTaskRecord,
} from './../types/api'

/**
 * سجل مزوّدي الذكاء الاصطناعي وتوجيه المهام.
 *
 * ## ما تفعله هذه الشاشة
 *
 * تجيب عن سؤال واحد لكل مهمة: **أي موديل سيخدمها الآن، ولماذا لا يخدمها غيره؟**
 * التوجيه لا يُحسب هنا؛ الخادم يحسبه بـ`evaluateTaskRoutes` — نفس الدالة التي
 * سيستخدمها كود التوليد — ويُرسل `resolved_model_id` مع قائمة `skipped` وسببها.
 * فما تعرضه الشاشة هو ما سيحدث فعلًا، لا تقديرًا مستقلًا قد ينحرف عنه.
 *
 * ## لا حقل لمفتاح، بقصد
 *
 * `credential_ref` يسمّي سرّ Worker ولا يحمل قيمته. `platform_settings.value`
 * نصّ صريح (المهاجرة 0017)، ولهذا يقرّر `api/src/lib/db.ts` أن مفاتيح المزوّدين
 * تبقى أسرار Worker. الشاشة تقول ذلك صراحةً بدل أن يبحث المسؤول عن حقل غائب.
 *
 * ## `is_wired`
 *
 * مهمة غير موصولة تعني أن التوجيه قابل للضبط ولا كود إنتاج يقرأه بعد. تُعرض
 * كذلك بوضوح: شاشة تُظهر مهمة مضبوطة بينما لا شيء يستدعيها أسوأ من شاشة تقول
 * «لم تُوصَل بعد».
 */

type PanelKey = 'providers' | 'models' | 'tasks' | 'usage'

const PANELS: PanelKey[] = ['providers', 'models', 'tasks', 'usage']

const copy = {
  ar: {
    eyebrow: 'التشغيل',
    title: 'مزوّدو الذكاء الاصطناعي',
    intro: 'سجّل المزوّدين والموديلات، ووجّه كل مهمة إلى موديل أساسي وبدائل، بحدود يومية.',
    loading: 'جارٍ تحميل السجل...',
    loadError: 'تعذّر تحميل سجل المزوّدين',
    denied: 'لا تملك صلاحية إدارة مزوّدي الذكاء الاصطناعي.',
    readOnly: 'العرض فقط: تعديل السجل يحتاج صلاحية manage_ai_providers.',
    retry: 'إعادة المحاولة',

    secretNotice: 'المفاتيح لا تُكتب في هذه الشاشة',
    secretBody:
      'الحقل يسمّي سرّ Worker فقط (مثل GOOGLE_AI_API_KEY)، والقيمة تُضبط بـ wrangler secret put. '
      + 'عمود القيم في platform_settings نصّ صريح ويظهر في كل نسخة احتياطية، فالمفتاح لا يُخزَّن في قاعدة البيانات.',

    panels: {
      providers: 'المزوّدون',
      models: 'الموديلات',
      tasks: 'المهام والتوجيه',
      usage: 'الاستخدام',
    } as Record<PanelKey, string>,

    // المزوّدون
    addProvider: 'مزوّد جديد',
    colProvider: 'المزوّد',
    colAuth: 'المصادقة',
    colBaseUrl: 'العنوان',
    colSecret: 'اسم السرّ',
    colConfigured: 'الحالة',
    colModels: 'الموديلات',
    configured: 'مضبوط',
    notConfigured: 'السرّ غير مضبوط',
    refNotAllowed: 'اسم سرّ غير مسموح',
    noAdapter: 'بلا محوّل نصّي',
    noAdapterHint: 'الكود لا يعرف بروتوكول هذا المزوّد، فالتوليد سيُرفض حتى يُكتب محوّل له.',
    disabled: 'معطّل',
    active: 'نشط',
    disableProvider: 'تعطيل المزوّد',
    enable: 'تنشيط',

    // الموديلات
    addModel: 'موديل جديد',
    colModel: 'الموديل',
    colModality: 'يُنتج',
    colSchema: 'JSON بمخطط',
    colPrice: 'السعر',
    colProbe: 'آخر اختبار',
    colRoutes: 'مسارات',
    probe: 'اختبار',
    probing: 'جارٍ الاختبار...',
    probeOnlyText: 'الاختبار للموديلات النصّية فقط. الإنتاج المدفوع للصور يمرّ بمصنع المحتوى.',
    unpriced: 'بلا سعر',
    never: 'لم يُختبر',
    yes: 'نعم',
    no: 'لا',

    // المهام
    tasksIntro: 'كل مهمة يخدمها أول مسار صالح بالأولوية. المسارات المستبعدة تظهر بسببها.',
    notWired: 'لم تُوصَل بعد',
    notWiredHint: 'التوجيه يُحفظ، ولا كود إنتاج يقرأه بعد.',
    wired: 'موصولة',
    serving: 'يخدمها الآن',
    noRoute: 'لا مسار صالح',
    noRoutes: 'بلا توجيه',
    editRoutes: 'تعديل التوجيه',
    needs: 'تحتاج',
    needsSchema: 'JSON بمخطط',
    todayUsage: 'اليوم',
    calls: 'نداء',

    // نموذج التوجيه
    routesTitle: 'توجيه المهمة',
    priority: 'الأولوية',
    model: 'الموديل',
    enabled: 'مفعّل',
    dailyCallCap: 'حدّ النداءات اليومي',
    dailySpendCap: 'حدّ الصرف اليومي (micros)',
    noCap: 'بلا حدّ',
    addRoute: 'إضافة مسار',
    removeRoute: 'إزالة',
    noEligibleModels: 'لا موديل مؤهَّل لهذه المهمة. أضِف موديلًا يُنتج ما تحتاجه أولًا.',
    eligibilityHint: (modality: string, schema: boolean) =>
      `المعروض هنا الموديلات التي تُنتج ${modality}${schema ? ' وتدعم JSON بمخطط' : ''} فقط — الخادم يرفض غيرها.`,

    // الاستخدام
    usageIntro: 'من ai_call_log. الاختبارات مفصولة عن الإنتاج فلا يُقرأ التشخيص كتوليد محتوى.',
    usageEmpty: 'لا نداءات مسجَّلة في هذه الفترة.',
    colTask: 'المهمة',
    colPurpose: 'الغرض',
    colStatus: 'النتيجة',
    colCalls: 'النداءات',
    colSpend: 'الصرف (micros)',
    colDay: 'اليوم',
    production: 'إنتاج',
    probePurpose: 'اختبار',

    // نماذج
    save: 'حفظ',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ...',
    slug: 'المعرّف (لاتيني صغير)',
    nameAr: 'الاسم',
    authMode: 'نمط المصادقة',
    baseUrl: 'العنوان الأساسي (HTTPS)',
    secretName: 'اسم سرّ الـWorker',
    notes: 'ملاحظات',
    providerField: 'المزوّد',
    modelRef: 'سلسلة الموديل عند المزوّد',
    modelRefHint: 'كما ينشرها المزوّد حرفيًّا، وتُرسل على السلك بلا تعديل.',
    supportsSchema: 'يدعم JSON بمخطط صارم',
    maxInput: 'أقصى توكنات إدخال',
    maxOutput: 'أقصى توكنات إخراج',
    priceMicros: 'السعر (micros)',
    priceUnit: 'وحدة السعر',
    priceHint: 'اتركهما فارغين معًا إذا كان السعر غير مسجَّل. الصفر يعني مجانًا.',
    confirmDisable: (name: string, routes: number) =>
      `تعطيل «${name}»؟ سيتأثّر ${routes} مسار توجيه مفعّل. الصفوف تبقى محفوظة ويمكن تنشيطه لاحقًا.`,
    probedOk: (ms: number) => `الاتصال ناجح — ${ms} مللي ثانية`,
    schemaHonoured: 'والمخطط صمد',
    schemaBroken: 'لكن المخطط لم يصمد',
  },
  en: {
    eyebrow: 'Operations',
    title: 'AI providers',
    intro: 'Register providers and models, then route each task to a primary model and fallbacks with daily caps.',
    loading: 'Loading registry...',
    loadError: 'Unable to load the provider registry',
    denied: 'You do not have permission to manage AI providers.',
    readOnly: 'Read only: editing the registry requires manage_ai_providers.',
    retry: 'Try again',

    secretNotice: 'API keys are not entered on this screen',
    secretBody:
      'The field names a Worker secret (such as GOOGLE_AI_API_KEY); the value is set with wrangler secret put. '
      + 'The platform_settings value column is plaintext and appears in every backup, so keys are not stored in the database.',

    panels: {
      providers: 'Providers',
      models: 'Models',
      tasks: 'Tasks and routing',
      usage: 'Usage',
    } as Record<PanelKey, string>,

    addProvider: 'New provider',
    colProvider: 'Provider',
    colAuth: 'Auth',
    colBaseUrl: 'Base URL',
    colSecret: 'Secret name',
    colConfigured: 'State',
    colModels: 'Models',
    configured: 'Configured',
    notConfigured: 'Secret not set',
    refNotAllowed: 'Secret name not allowed',
    noAdapter: 'No text adapter',
    noAdapterHint: 'The code does not know this provider protocol, so generation will refuse until an adapter exists.',
    disabled: 'Disabled',
    active: 'Active',
    disableProvider: 'Disable provider',
    enable: 'Enable',

    addModel: 'New model',
    colModel: 'Model',
    colModality: 'Produces',
    colSchema: 'Schema JSON',
    colPrice: 'Price',
    colProbe: 'Last probe',
    colRoutes: 'Routes',
    probe: 'Probe',
    probing: 'Probing...',
    probeOnlyText: 'Probing is text-only. Paid image work goes through the content factory.',
    unpriced: 'Unpriced',
    never: 'Never probed',
    yes: 'Yes',
    no: 'No',

    tasksIntro: 'Each task is served by the first eligible route by priority. Skipped routes show their reason.',
    notWired: 'Not wired yet',
    notWiredHint: 'Routing is saved; no production code reads it yet.',
    wired: 'Wired',
    serving: 'Serving now',
    noRoute: 'No eligible route',
    noRoutes: 'No routing',
    editRoutes: 'Edit routing',
    needs: 'Needs',
    needsSchema: 'schema JSON',
    todayUsage: 'Today',
    calls: 'calls',

    routesTitle: 'Task routing',
    priority: 'Priority',
    model: 'Model',
    enabled: 'Enabled',
    dailyCallCap: 'Daily call cap',
    dailySpendCap: 'Daily spend cap (micros)',
    noCap: 'No cap',
    addRoute: 'Add route',
    removeRoute: 'Remove',
    noEligibleModels: 'No eligible model for this task. Add a model that produces what it needs first.',
    eligibilityHint: (modality: string, schema: boolean) =>
      `Only models producing ${modality}${schema ? ' with schema JSON support' : ''} are listed — the server rejects the rest.`,

    usageIntro: 'From ai_call_log. Probes are separated from production so diagnosis does not read as content generation.',
    usageEmpty: 'No calls recorded in this window.',
    colTask: 'Task',
    colPurpose: 'Purpose',
    colStatus: 'Result',
    colCalls: 'Calls',
    colSpend: 'Spend (micros)',
    colDay: 'Day',
    production: 'Production',
    probePurpose: 'Probe',

    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving...',
    slug: 'Slug (lowercase)',
    nameAr: 'Name',
    authMode: 'Auth mode',
    baseUrl: 'Base URL (HTTPS)',
    secretName: 'Worker secret name',
    notes: 'Notes',
    providerField: 'Provider',
    modelRef: 'Vendor model string',
    modelRefHint: 'Exactly as the vendor publishes it; sent on the wire unchanged.',
    supportsSchema: 'Supports strict schema JSON',
    maxInput: 'Max input tokens',
    maxOutput: 'Max output tokens',
    priceMicros: 'Price (micros)',
    priceUnit: 'Price unit',
    priceHint: 'Leave both empty when the price is not recorded. Zero means free.',
    confirmDisable: (name: string, routes: number) =>
      `Disable "${name}"? ${routes} enabled route(s) will be affected. Rows are kept and it can be re-enabled.`,
    probedOk: (ms: number) => `Connected — ${ms} ms`,
    schemaHonoured: 'and the schema held',
    schemaBroken: 'but the schema did not hold',
  },
}

/// أسباب الاستبعاد بنصّ يقول ما العمل، لا رمزًا يُترك للتخمين.
const SKIP_LABELS: Record<'ar' | 'en', Record<AiRouteSkipReason, string>> = {
  ar: {
    route_disabled: 'المسار معطَّل',
    model_disabled: 'الموديل معطَّل',
    provider_disabled: 'المزوّد معطَّل',
    credential_ref_not_allowed: 'اسم السرّ غير مسموح في الكود',
    credential_missing: 'سرّ المزوّد غير مضبوط في هذه البيئة',
    modality_mismatch: 'الموديل يُنتج نوعًا آخر',
    json_schema_unsupported: 'الموديل لا يدعم JSON بمخطط',
    daily_call_cap_reached: 'بلغ حدّ النداءات اليومي',
    daily_spend_cap_reached: 'بلغ حدّ الصرف اليومي',
  },
  en: {
    route_disabled: 'Route disabled',
    model_disabled: 'Model disabled',
    provider_disabled: 'Provider disabled',
    credential_ref_not_allowed: 'Secret name not allowed in code',
    credential_missing: 'Provider secret not set in this environment',
    modality_mismatch: 'Model produces a different modality',
    json_schema_unsupported: 'Model does not support schema JSON',
    daily_call_cap_reached: 'Daily call cap reached',
    daily_spend_cap_reached: 'Daily spend cap reached',
  },
}

const MODALITY_LABELS: Record<'ar' | 'en', Record<AiModality, string>> = {
  ar: { text: 'نصًّا', image: 'صورة', video: 'فيديو', audio: 'صوتًا' },
  en: { text: 'text', image: 'image', video: 'video', audio: 'audio' },
}

const EMPTY_PROVIDER: AiProviderPayload = {
  slug: '', name_ar: '', auth_mode: 'api_key_header', base_url: '', credential_ref: '', notes_ar: '',
}

type ModelForm = {
  provider_id: string
  model_id: string
  name_ar: string
  modality: AiModality
  supports_json_schema: boolean
  max_input_tokens: string
  max_output_tokens: string
  price_micros: string
  price_unit: '' | AiPriceUnit
}

const EMPTY_MODEL: ModelForm = {
  provider_id: '', model_id: '', name_ar: '', modality: 'text',
  supports_json_schema: false, max_input_tokens: '', max_output_tokens: '',
  price_micros: '', price_unit: '',
}

/// صفٌّ في محرّر التوجيه. نصوص لا أرقام: حقل فارغ يعني «بلا حدّ»، وتحويله إلى
/// صفر مبكّرًا كان سيعني «أوقف كل شيء».
type RouteDraft = {
  model_id: string
  priority: number
  is_enabled: boolean
  daily_call_cap: string
  daily_spend_cap_micros: string
}

export function AiProvidersPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [registry, setRegistry] = useState<AiRegistry | null>(null)
  const [usage, setUsage] = useState<import('./../types/api').AiUsageEnvelope | null>(null)
  const [panel, setPanel] = useState<PanelKey>('providers')
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [probingId, setProbingId] = useState<string | null>(null)

  const [providerModal, setProviderModal] = useState(false)
  const [providerEditing, setProviderEditing] = useState<AiProviderRecord | null>(null)
  const [providerForm, setProviderForm] = useState<AiProviderPayload>(EMPTY_PROVIDER)

  const [modelModal, setModelModal] = useState(false)
  const [modelEditing, setModelEditing] = useState<AiModelRecord | null>(null)
  const [modelForm, setModelForm] = useState<ModelForm>(EMPTY_MODEL)

  const [routeTask, setRouteTask] = useState<AiTaskRecord | null>(null)
  const [routeDrafts, setRouteDrafts] = useState<RouteDraft[]>([])

  const canManage = hasPermission('manage_ai_providers')

  const load = useCallback(async () => {
    setError('')
    try {
      const [registryResponse, usageResponse] = await Promise.all([
        api.aiRegistry(),
        // الاستخدام ليس شرطًا لعرض السجل، فتعذّره لا يُفشل الصفحة.
        api.aiUsage(7).catch(() => null),
      ])
      setRegistry(registryResponse.data)
      setUsage(usageResponse?.data ?? null)
      setState('ok')
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) setState('denied')
      else setState('error')
      setError(caught instanceof Error ? caught.message : text.loadError)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const providerById = useMemo(
    () => new Map((registry?.providers ?? []).map((provider) => [provider.id, provider])),
    [registry],
  )

  async function run(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      await load()
      setNotice({ tone: 'ok', message: successMessage })
    } catch (caught) {
      setNotice({ tone: 'bad', message: caught instanceof Error ? caught.message : text.loadError })
    } finally {
      setBusy(false)
    }
  }

  /* ----------------------------------------------------------- providers */

  function openProviderCreate() {
    setProviderEditing(null)
    setProviderForm({ ...EMPTY_PROVIDER, credential_ref: registry?.options.credential_refs[0] ?? '' })
    setProviderModal(true)
  }

  function openProviderEdit(provider: AiProviderRecord) {
    setProviderEditing(provider)
    setProviderForm({
      slug: provider.slug,
      name_ar: provider.name_ar,
      auth_mode: provider.auth_mode,
      base_url: provider.base_url,
      credential_ref: provider.credential_ref,
      notes_ar: provider.notes_ar ?? '',
    })
    setProviderModal(true)
  }

  async function submitProvider(event: FormEvent) {
    event.preventDefault()
    const payload = { ...providerForm, notes_ar: providerForm.notes_ar?.trim() || null }
    setProviderModal(false)
    await run(
      () => (providerEditing
        // المعرّف لا يُعدَّل: هو ما يربط المزوّد بمحوّله في الكود.
        ? api.updateAiProvider(providerEditing.id, {
          name_ar: payload.name_ar,
          auth_mode: payload.auth_mode,
          base_url: payload.base_url,
          credential_ref: payload.credential_ref,
          notes_ar: payload.notes_ar,
        })
        : api.createAiProvider(payload)),
      text.save,
    )
  }

  /* -------------------------------------------------------------- models */

  function openModelCreate() {
    setModelEditing(null)
    setModelForm({ ...EMPTY_MODEL, provider_id: registry?.providers[0]?.id ?? '' })
    setModelModal(true)
  }

  function openModelEdit(model: AiModelRecord) {
    setModelEditing(model)
    setModelForm({
      provider_id: model.provider_id,
      model_id: model.model_id,
      name_ar: model.name_ar,
      modality: model.modality,
      supports_json_schema: model.supports_json_schema,
      max_input_tokens: model.max_input_tokens === null || model.max_input_tokens === undefined ? '' : String(model.max_input_tokens),
      max_output_tokens: model.max_output_tokens === null || model.max_output_tokens === undefined ? '' : String(model.max_output_tokens),
      price_micros: model.price_micros === null || model.price_micros === undefined ? '' : String(model.price_micros),
      price_unit: model.price_unit ?? '',
    })
    setModelModal(true)
  }

  async function submitModel(event: FormEvent) {
    event.preventDefault()
    // الفراغ يُرسل `null` لا صفرًا: صفر سعر يعني مجانًا، والفراغ يعني غير مسجَّل.
    const payload: AiModelPayload = {
      provider_id: modelForm.provider_id,
      model_id: modelForm.model_id.trim(),
      name_ar: modelForm.name_ar.trim(),
      modality: modelForm.modality,
      supports_json_schema: modelForm.supports_json_schema,
      max_input_tokens: modelForm.max_input_tokens.trim() ? Number(modelForm.max_input_tokens) : null,
      max_output_tokens: modelForm.max_output_tokens.trim() ? Number(modelForm.max_output_tokens) : null,
      price_micros: modelForm.price_micros.trim() ? Number(modelForm.price_micros) : null,
      price_unit: modelForm.price_unit || null,
    }
    setModelModal(false)
    await run(
      () => (modelEditing ? api.updateAiModel(modelEditing.id, payload) : api.createAiModel(payload)),
      text.save,
    )
  }

  async function probe(model: AiModelRecord) {
    setProbingId(model.id)
    setNotice(null)
    try {
      const response = await api.probeAiModel(model.id)
      const result = response.data
      const schemaNote = result.schema_honoured === null
        ? ''
        : ` · ${result.schema_honoured ? text.schemaHonoured : text.schemaBroken}`
      setNotice({ tone: 'ok', message: `${text.probedOk(result.latency_ms)}${schemaNote}` })
      await load()
    } catch (caught) {
      setNotice({ tone: 'bad', message: caught instanceof Error ? caught.message : text.loadError })
      // الاختبار الفاشل يُسجَّل على الموديل في الخادم، فيُعاد التحميل ليظهر.
      await load()
    } finally {
      setProbingId(null)
    }
  }

  /* ------------------------------------------------------------- routing */

  function openRoutes(task: AiTaskRecord) {
    setRouteTask(task)
    setRouteDrafts(task.routes.map((entry) => ({
      model_id: entry.model_id,
      priority: entry.priority,
      is_enabled: entry.is_enabled,
      daily_call_cap: entry.daily_call_cap === null || entry.daily_call_cap === undefined ? '' : String(entry.daily_call_cap),
      daily_spend_cap_micros: entry.daily_spend_cap_micros === null || entry.daily_spend_cap_micros === undefined
        ? '' : String(entry.daily_spend_cap_micros),
    })))
  }

  /// الموديلات المؤهَّلة لمهمة: نفس الشرطين الذين يفرضهما الخادم عند الحفظ.
  /// عرض غير المؤهَّل كان سيعني اختيارًا يُرفض بعد الضغط على «حفظ».
  const eligibleModels = useMemo(() => {
    if (!routeTask || !registry) return []
    return registry.models.filter((model) => (
      model.status === 'active'
      && model.modality === routeTask.required_modality
      && (!routeTask.requires_json_schema || model.supports_json_schema)
    ))
  }, [routeTask, registry])

  async function submitRoutes() {
    if (!routeTask) return
    const routes: AiRoutePayload[] = routeDrafts
      .filter((draft) => draft.model_id)
      .map((draft, index) => ({
        model_id: draft.model_id,
        priority: index + 1,
        is_enabled: draft.is_enabled,
        daily_call_cap: draft.daily_call_cap.trim() ? Number(draft.daily_call_cap) : null,
        daily_spend_cap_micros: draft.daily_spend_cap_micros.trim() ? Number(draft.daily_spend_cap_micros) : null,
      }))
    const taskId = routeTask.id
    setRouteTask(null)
    await run(() => api.saveAiTaskRoutes(taskId, routes), text.save)
  }

  /* --------------------------------------------------------------- render */

  if (state === 'loading' && !registry) return <LoadingState label={text.loading} />
  if (state === 'denied') return <div className="page-stack"><ErrorState message={error || text.denied} /></div>
  if (!registry) return <div className="page-stack"><ErrorState message={error} onRetry={() => void load()} /></div>

  const providerStateChip = (provider: AiProviderRecord) => {
    if (provider.configured) return <span className="ai-chip ai-chip--ok">{text.configured}</span>
    return (
      <span className="ai-chip ai-chip--bad">
        {provider.unconfigured_reason === 'credential_ref_not_allowed' ? text.refNotAllowed : text.notConfigured}
      </span>
    )
  }

  const wiredTasksCount = registry?.tasks.filter((t) => t.is_wired).length ?? 0
  const unroutedTasksCount = registry?.tasks.filter((t) => !t.resolved_model_id).length ?? 0
  const totalCalls = usage?.by_task.reduce((acc, r) => acc + r.calls, 0) ?? 0
  const totalSpendMicros = usage?.by_task.reduce((acc, r) => acc + r.spend_micros, 0) ?? 0

  return (
    <div className="content-studio-root ai-page">
      {/* 1. Commercial Command Strip */}
      <section className="commercial-command-strip">
        <div className="commercial-command-strip__left">
          <div className="status-beacon">
            <span className="status-beacon__dot status-beacon__dot--emerald" />
            <div className="status-beacon__meta">
              <span className="status-beacon__title">
                {locale === 'ar' ? 'بوابة الذكاء الاصطناعي والتوجيه نشطة' : 'AI Gateway & Routing Live'}
              </span>
              <span className="status-beacon__sub">
                {locale === 'ar' ? 'تحكّم في المزوّدين وتوجيه المهام وحدود الصرف' : 'Multi-provider routing & daily caps active'}
              </span>
            </div>
          </div>

          <div className="filter-pill-group" role="group" aria-label={text.title}>
            {PANELS.map((key) => (
              <button
                key={key}
                type="button"
                className={`filter-pill ${panel === key ? 'filter-pill--active' : ''}`}
                onClick={() => setPanel(key)}
              >
                <span>{text.panels[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="commercial-command-strip__right">
          {panel === 'providers' && (
            <button className="button button--primary button--small" type="button" onClick={openProviderCreate} disabled={!canManage || busy}>
              <Icon name="plus" size={14} />
              <span>{text.addProvider}</span>
            </button>
          )}
          {panel === 'models' && (
            <button
              className="button button--primary button--small"
              type="button"
              onClick={openModelCreate}
              disabled={!canManage || busy || (registry?.providers.length ?? 0) === 0}
            >
              <Icon name="plus" size={14} />
              <span>{text.addModel}</span>
            </button>
          )}
          <button className="button button--ghost button--small" type="button" onClick={() => void load()} disabled={busy}>
            <Icon name="refresh" size={14} />
            <span>{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {/* 2. Executive Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.28) 0%, rgba(59, 130, 246, 0.16) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" />
              {registry?.providers.length ?? 0} {locale === 'ar' ? 'مزوّدين مسجلين' : 'providers registered'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.intro}</p>
        </div>
      </section>

      {/* 3. Executive Bento Grid Matrix */}
      <div className="commercial-bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div
          className="commercial-bento-card commercial-bento-card--indigo"
          onClick={() => setPanel('providers')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.panels.providers}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="globe" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{registry?.providers.length ?? 0}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'مزوّدو النماذج المعتمدون' : 'Active vendors'}</span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--purple"
          onClick={() => setPanel('models')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{text.panels.models}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="layers" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{registry?.models.length ?? 0}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'موديلات نص وصوت ورؤية' : 'Registered models'}</span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--emerald"
          onClick={() => setPanel('tasks')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'مهام موصولة' : 'Wired Tasks'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{wiredTasksCount}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend commercial-bento-card__trend--up">
              {locale === 'ar' ? 'مربوطة بكود الإنتاج الفعلي' : 'Connected in production'}
            </span>
          </div>
        </div>

        <div
          className={`commercial-bento-card ${unroutedTasksCount > 0 ? 'commercial-bento-card--rose' : 'commercial-bento-card--slate'}`}
          onClick={() => setPanel('tasks')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'مهام بلا مسار' : 'Unrouted Tasks'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="alert-triangle" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{unroutedTasksCount}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend" style={{ color: unroutedTasksCount > 0 ? '#f43f5e' : undefined }}>
              {unroutedTasksCount > 0 ? (locale === 'ar' ? 'يتطلب توجيه لموديل' : 'No route configured') : (locale === 'ar' ? 'كل المهام موجهة' : 'All routed')}
            </span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--cyan"
          onClick={() => setPanel('usage')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'نداءات آخر 7 أيام' : 'Calls (7d)'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="clock" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{totalCalls}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">{locale === 'ar' ? 'إجمالي الاستدعاءات' : 'Total calls logged'}</span>
          </div>
        </div>

        <div
          className="commercial-bento-card commercial-bento-card--amber"
          onClick={() => setPanel('usage')}
          style={{ cursor: 'pointer' }}
        >
          <div className="commercial-bento-card__header">
            <span className="commercial-bento-card__title">{locale === 'ar' ? 'الصرف التقديري' : 'Spend (micros)'}</span>
            <div className="commercial-bento-card__icon">
              <Icon name="dollar" size={18} />
            </div>
          </div>
          <div className="commercial-bento-card__metric">{totalSpendMicros}</div>
          <div className="commercial-bento-card__footer">
            <span className="commercial-bento-card__trend">micros</span>
          </div>
        </div>
      </div>

      {/* 4. Architectural Security Note */}
      <section className="panel panel--notice" style={{ margin: '16px 0 12px 0' }}>
        <strong>{text.secretNotice}</strong>
        <p>{text.secretBody}</p>
      </section>

      {!canManage && (
        <section className="panel panel--notice" role="status" style={{ margin: '0 0 12px 0' }}>
          <strong>{text.readOnly}</strong>
        </section>
      )}

      {notice && (
        <section
          className={`panel panel--notice panel--notice--${notice.tone}`}
          role={notice.tone === 'bad' ? 'alert' : 'status'}
          style={{ margin: '0 0 12px 0' }}
        >
          <strong>{notice.tone === 'ok' ? '✓' : '!'}</strong>
          <p>{notice.message}</p>
        </section>
      )}

      {/* 5. Luxury Panel Tabs */}
      <div className="detail-tabs" role="tablist" style={{ margin: '16px 0 12px 0' }}>
        {PANELS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={panel === key}
            className={`detail-tab ${panel === key ? 'detail-tab--active' : ''}`}
            onClick={() => setPanel(key)}
          >
            {text.panels[key]}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------ providers */}
      {panel === 'providers' && (
        <section className="panel panel--table">
          <header className="panel__header">
            <div>
              <span className="panel__kicker">{text.panels.providers}</span>
              <h3>{registry.providers.length}</h3>
            </div>
            <button className="button button--primary" type="button" onClick={openProviderCreate} disabled={!canManage || busy}>
              <Icon name="plus" size={16} />{text.addProvider}
            </button>
          </header>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.colProvider}</th>
                  <th>{text.colAuth}</th>
                  <th>{text.colBaseUrl}</th>
                  <th>{text.colSecret}</th>
                  <th>{text.colConfigured}</th>
                  <th>{text.colModels}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {registry.providers.map((provider) => (
                  <tr key={provider.id} className={provider.status === 'disabled' ? 'ai-row--muted' : undefined}>
                    <td>
                      <strong>{provider.name_ar}</strong>
                      <small dir="ltr">{provider.slug}</small>
                      {!provider.has_text_adapter && (
                        <span className="ai-chip ai-chip--warn" title={text.noAdapterHint}>{text.noAdapter}</span>
                      )}
                    </td>
                    <td dir="ltr">{provider.auth_mode}</td>
                    <td dir="ltr" className="ai-cell--url">{provider.base_url}</td>
                    {/* اسم السرّ لا قيمته */}
                    <td dir="ltr"><code>{provider.credential_ref}</code></td>
                    <td>{providerStateChip(provider)}</td>
                    <td dir="ltr">{provider.model_count}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button icon-button--small"
                          type="button"
                          onClick={() => openProviderEdit(provider)}
                          disabled={!canManage || busy}
                          title={text.editRoutes}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        {provider.status === 'active' ? (
                          <button
                            className="icon-button icon-button--small icon-button--danger"
                            type="button"
                            disabled={!canManage || busy}
                            title={text.disableProvider}
                            onClick={() => {
                              // الأثر يُقال قبل التنفيذ، لا بعده.
                              const enabled = registry.tasks.reduce((total, task) => total
                                + task.routes.filter((entry) => entry.provider_slug === provider.slug && entry.is_enabled).length, 0)
                              if (!window.confirm(text.confirmDisable(provider.name_ar, enabled))) return
                              void run(() => api.disableAiProvider(provider.id), text.save)
                            }}
                          >
                            <Icon name="archive" size={15} />
                          </button>
                        ) : (
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            disabled={!canManage || busy}
                            onClick={() => void run(() => api.updateAiProvider(provider.id, { status: 'active' }), text.save)}
                          >
                            {text.enable}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- models */}
      {panel === 'models' && (
        <section className="panel panel--table">
          <header className="panel__header">
            <div>
              <span className="panel__kicker">{text.panels.models}</span>
              <h3>{registry.models.length}</h3>
              <p className="panel__note">{text.probeOnlyText}</p>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={openModelCreate}
              disabled={!canManage || busy || registry.providers.length === 0}
            >
              <Icon name="plus" size={16} />{text.addModel}
            </button>
          </header>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.colModel}</th>
                  <th>{text.colProvider}</th>
                  <th>{text.colModality}</th>
                  <th>{text.colSchema}</th>
                  <th>{text.colPrice}</th>
                  <th>{text.colRoutes}</th>
                  <th>{text.colProbe}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {registry.models.map((model) => (
                  <tr key={model.id} className={model.status === 'disabled' ? 'ai-row--muted' : undefined}>
                    <td>
                      <strong>{model.name_ar}</strong>
                      <small dir="ltr">{model.model_id}</small>
                    </td>
                    <td dir="ltr">{model.provider_slug ?? '—'}</td>
                    <td>{MODALITY_LABELS[locale][model.modality]}</td>
                    <td>{model.supports_json_schema ? text.yes : text.no}</td>
                    <td dir="ltr">
                      {/* «بلا سعر» لا «صفر»: الصفر يُقرأ مجانًا ويمرّ تحت أي سقف */}
                      {model.price_micros === null || model.price_micros === undefined
                        ? <span className="ai-chip">{text.unpriced}</span>
                        : `${model.price_micros} / ${model.price_unit}`}
                    </td>
                    <td dir="ltr">{model.route_count}</td>
                    <td>
                      {model.last_probe_status === null || model.last_probe_status === undefined ? (
                        <span className="ai-chip">{text.never}</span>
                      ) : (
                        <span
                          className={`ai-chip ai-chip--${model.last_probe_status === 'ok' ? 'ok' : 'bad'}`}
                          title={model.last_probe_detail ?? undefined}
                        >
                          {model.last_probe_status === 'ok' ? '✓' : '!'} {model.last_probe_detail ?? ''}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => void probe(model)}
                          // الاختبار للنصّ فقط: غيره إنتاج مدفوع بلا خطة صرف.
                          disabled={!canManage || busy || model.modality !== 'text' || probingId === model.id}
                          title={model.modality === 'text' ? undefined : text.probeOnlyText}
                        >
                          {probingId === model.id ? text.probing : text.probe}
                        </button>
                        <button
                          className="icon-button icon-button--small"
                          type="button"
                          onClick={() => openModelEdit(model)}
                          disabled={!canManage || busy}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        {model.status === 'active' ? (
                          <button
                            className="icon-button icon-button--small icon-button--danger"
                            type="button"
                            disabled={!canManage || busy}
                            onClick={() => {
                              if (!window.confirm(text.confirmDisable(model.name_ar, model.route_count))) return
                              void run(() => api.disableAiModel(model.id), text.save)
                            }}
                          >
                            <Icon name="archive" size={15} />
                          </button>
                        ) : (
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            disabled={!canManage || busy}
                            onClick={() => void run(() => api.updateAiModel(model.id, { status: 'active' }), text.save)}
                          >
                            {text.enable}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- tasks */}
      {panel === 'tasks' && (
        <section className="ai-tasks">
          <p className="panel__note">{text.tasksIntro}</p>
          {registry.tasks.map((task) => {
            const resolved = task.routes.find((entry) => entry.model_id === task.resolved_model_id)
            return (
              <article key={task.id} className="panel ai-task">
                <header className="ai-task__head">
                  <div>
                    <h3>{task.name_ar}</h3>
                    <small dir="ltr">{task.id}</small>
                    <p>{task.description_ar}</p>
                  </div>
                  <div className="ai-task__flags">
                    <span className={`ai-chip ai-chip--${task.is_wired ? 'ok' : 'warn'}`} title={task.is_wired ? undefined : text.notWiredHint}>
                      {task.is_wired ? text.wired : text.notWired}
                    </span>
                    <span className="ai-chip">
                      {text.needs} {MODALITY_LABELS[locale][task.required_modality]}
                      {task.requires_json_schema ? ` + ${text.needsSchema}` : ''}
                    </span>
                  </div>
                </header>

                <div className="ai-task__resolved">
                  {resolved ? (
                    <p>
                      <strong>{text.serving}:</strong>{' '}
                      <code dir="ltr">{resolved.model_ref}</code>{' '}
                      <span className="ai-muted" dir="ltr">({resolved.provider_slug})</span>
                    </p>
                  ) : (
                    <p className="ai-task__none">
                      <Icon name="warning" size={15} />
                      {task.routes.length === 0 ? text.noRoutes : text.noRoute}
                    </p>
                  )}
                  <span className="ai-muted">
                    {text.todayUsage}: {task.usage_today.calls} {text.calls} · {task.usage_today.spend_micros} micros
                  </span>
                </div>

                {/* كل مسار مستبعد وسببه: «لا مسار صالح» بلا سبب تُترك للتخمين */}
                {task.skipped.length > 0 && (
                  <ul className="ai-skips">
                    {task.skipped.map((skip) => (
                      <li key={`${skip.priority}-${skip.model_id}`}>
                        <span className="ai-skips__priority" dir="ltr">#{skip.priority}</span>
                        <code dir="ltr">{skip.model_ref}</code>
                        <span className="ai-muted">— {SKIP_LABELS[locale][skip.reason]}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <footer className="ai-task__foot">
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => openRoutes(task)}
                    disabled={!canManage || busy}
                  >
                    <Icon name="settings" size={15} />{text.editRoutes}
                  </button>
                </footer>
              </article>
            )
          })}
        </section>
      )}

      {/* ---------------------------------------------------------- usage */}
      {panel === 'usage' && (
        <section className="panel panel--table">
          <header className="panel__header">
            <div>
              <span className="panel__kicker">{text.panels.usage}</span>
              <h3>{usage?.days ?? 7}</h3>
              <p className="panel__note">{text.usageIntro}</p>
            </div>
          </header>
          {!usage || usage.by_task.length === 0 ? (
            <p className="panel__note ai-empty">{text.usageEmpty}</p>
          ) : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.colTask}</th>
                    <th>{text.colProvider}</th>
                    <th>{text.colModel}</th>
                    <th>{text.colPurpose}</th>
                    <th>{text.colStatus}</th>
                    <th>{text.colCalls}</th>
                    <th>{text.colSpend}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.by_task.map((row, index) => (
                    <tr key={`${row.task_id}-${row.model_ref}-${row.purpose}-${row.status}-${index}`}>
                      <td dir="ltr">{row.task_id}</td>
                      <td dir="ltr">{row.provider_slug}</td>
                      <td dir="ltr">{row.model_ref}</td>
                      <td>{row.purpose === 'production' ? text.production : text.probePurpose}</td>
                      <td>
                        <span className={`ai-chip ai-chip--${row.status === 'ok' ? 'ok' : 'bad'}`}>{row.status}</span>
                      </td>
                      <td dir="ltr">{row.calls}</td>
                      <td dir="ltr">{row.spend_micros}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------ provider modal */}
      <Modal
        open={providerModal}
        onClose={() => !busy && setProviderModal(false)}
        title={providerEditing ? text.panels.providers : text.addProvider}
        description={text.secretBody}
      >
        <form className="entity-form" onSubmit={submitProvider}>
          <div className="form-grid">
            <label className="field">
              <span>{text.slug}</span>
              <input
                dir="ltr"
                value={providerForm.slug}
                required
                // المعرّف يربط المزوّد بمحوّله في الكود، فتغييره يفصلهما.
                disabled={!!providerEditing}
                onChange={(event) => setProviderForm({ ...providerForm, slug: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.nameAr}</span>
              <input
                value={providerForm.name_ar}
                required
                onChange={(event) => setProviderForm({ ...providerForm, name_ar: event.target.value })}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>{text.authMode}</span>
              <select
                value={providerForm.auth_mode}
                onChange={(event) => setProviderForm({ ...providerForm, auth_mode: event.target.value as AiAuthMode })}
              >
                {registry.options.auth_modes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text.secretName}</span>
              {/* قائمة مغلقة: الأسماء المسموحة معرَّفة في الكود، والحرّ منها يُرفض */}
              <select
                value={providerForm.credential_ref}
                onChange={(event) => setProviderForm({ ...providerForm, credential_ref: event.target.value })}
              >
                {registry.options.credential_refs.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>{text.baseUrl}</span>
            <input
              dir="ltr"
              type="url"
              value={providerForm.base_url}
              required
              onChange={(event) => setProviderForm({ ...providerForm, base_url: event.target.value })}
            />
          </label>
          <label className="field">
            <span>{text.notes}</span>
            <textarea
              rows={2}
              value={providerForm.notes_ar ?? ''}
              onChange={(event) => setProviderForm({ ...providerForm, notes_ar: event.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setProviderModal(false)}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={busy}>{busy ? text.saving : text.save}</button>
          </div>
        </form>
      </Modal>

      {/* --------------------------------------------------------- model modal */}
      <Modal
        open={modelModal}
        onClose={() => !busy && setModelModal(false)}
        title={modelEditing ? text.panels.models : text.addModel}
      >
        <form className="entity-form" onSubmit={submitModel}>
          <div className="form-grid">
            <label className="field">
              <span>{text.providerField}</span>
              <select
                value={modelForm.provider_id}
                required
                onChange={(event) => setModelForm({ ...modelForm, provider_id: event.target.value })}
              >
                {registry.providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name_ar} ({provider.slug})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{text.modelRef}</span>
              <input
                dir="ltr"
                value={modelForm.model_id}
                required
                onChange={(event) => setModelForm({ ...modelForm, model_id: event.target.value })}
              />
              <small>{text.modelRefHint}</small>
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>{text.nameAr}</span>
              <input
                value={modelForm.name_ar}
                required
                onChange={(event) => setModelForm({ ...modelForm, name_ar: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.colModality}</span>
              <select
                value={modelForm.modality}
                onChange={(event) => setModelForm({ ...modelForm, modality: event.target.value as AiModality })}
              >
                {registry.options.modalities.map((modality) => (
                  <option key={modality} value={modality}>{MODALITY_LABELS[locale][modality]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field field--inline">
            <input
              type="checkbox"
              checked={modelForm.supports_json_schema}
              onChange={(event) => setModelForm({ ...modelForm, supports_json_schema: event.target.checked })}
            />
            <span>{text.supportsSchema}</span>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{text.maxInput}</span>
              <input
                dir="ltr"
                type="number"
                min="1"
                value={modelForm.max_input_tokens}
                onChange={(event) => setModelForm({ ...modelForm, max_input_tokens: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{text.maxOutput}</span>
              <input
                dir="ltr"
                type="number"
                min="1"
                value={modelForm.max_output_tokens}
                onChange={(event) => setModelForm({ ...modelForm, max_output_tokens: event.target.value })}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>{text.priceMicros}</span>
              <input
                dir="ltr"
                type="number"
                min="0"
                value={modelForm.price_micros}
                onChange={(event) => setModelForm({ ...modelForm, price_micros: event.target.value })}
              />
              <small>{text.priceHint}</small>
            </label>
            <label className="field">
              <span>{text.priceUnit}</span>
              <select
                value={modelForm.price_unit}
                onChange={(event) => setModelForm({ ...modelForm, price_unit: event.target.value as ModelForm['price_unit'] })}
              >
                <option value="">—</option>
                {registry.options.price_units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="button button--ghost" type="button" onClick={() => setModelModal(false)}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={busy}>{busy ? text.saving : text.save}</button>
          </div>
        </form>
      </Modal>

      {/* -------------------------------------------------------- routes modal */}
      <Modal
        open={!!routeTask}
        onClose={() => !busy && setRouteTask(null)}
        title={`${text.routesTitle} — ${routeTask?.name_ar ?? ''}`}
        description={routeTask
          ? text.eligibilityHint(MODALITY_LABELS[locale][routeTask.required_modality], routeTask.requires_json_schema)
          : undefined}
      >
        {routeTask && (
          <div className="entity-form">
            {eligibleModels.length === 0 ? (
              <p className="panel__note">{text.noEligibleModels}</p>
            ) : (
              <>
                {routeDrafts.map((draft, index) => (
                  <div key={`${draft.model_id}-${index}`} className="ai-route-row">
                    <span className="ai-route-row__priority" dir="ltr">#{index + 1}</span>
                    <label className="field">
                      <span>{text.model}</span>
                      <select
                        value={draft.model_id}
                        onChange={(event) => {
                          const next = [...routeDrafts]
                          next[index] = { ...draft, model_id: event.target.value }
                          setRouteDrafts(next)
                        }}
                      >
                        {eligibleModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.model_id} ({providerById.get(model.provider_id)?.slug ?? '—'})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{text.dailyCallCap}</span>
                      <input
                        dir="ltr"
                        type="number"
                        min="1"
                        placeholder={text.noCap}
                        value={draft.daily_call_cap}
                        onChange={(event) => {
                          const next = [...routeDrafts]
                          next[index] = { ...draft, daily_call_cap: event.target.value }
                          setRouteDrafts(next)
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>{text.dailySpendCap}</span>
                      <input
                        dir="ltr"
                        type="number"
                        min="0"
                        placeholder={text.noCap}
                        value={draft.daily_spend_cap_micros}
                        onChange={(event) => {
                          const next = [...routeDrafts]
                          next[index] = { ...draft, daily_spend_cap_micros: event.target.value }
                          setRouteDrafts(next)
                        }}
                      />
                    </label>
                    <label className="field field--inline">
                      <input
                        type="checkbox"
                        checked={draft.is_enabled}
                        onChange={(event) => {
                          const next = [...routeDrafts]
                          next[index] = { ...draft, is_enabled: event.target.checked }
                          setRouteDrafts(next)
                        }}
                      />
                      <span>{text.enabled}</span>
                    </label>
                    <button
                      className="icon-button icon-button--small icon-button--danger"
                      type="button"
                      title={text.removeRoute}
                      onClick={() => setRouteDrafts(routeDrafts.filter((_, position) => position !== index))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={routeDrafts.length >= registry.options.max_priority}
                  onClick={() => setRouteDrafts([...routeDrafts, {
                    model_id: eligibleModels[0]?.id ?? '',
                    priority: routeDrafts.length + 1,
                    is_enabled: true,
                    daily_call_cap: '',
                    daily_spend_cap_micros: '',
                  }])}
                >
                  <Icon name="plus" size={15} />{text.addRoute}
                </button>
              </>
            )}
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setRouteTask(null)}>{text.cancel}</button>
              <button className="button button--primary" type="button" onClick={() => void submitRoutes()} disabled={busy}>
                {busy ? text.saving : text.save}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
