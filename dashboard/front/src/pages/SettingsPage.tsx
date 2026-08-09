import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { changeOwnPassword, readAdminUser, signOut } from '../lib/adminSession'
import type { SiteMode, SiteModeEnvelope, SiteModeSettings } from '../types/api'

/**
 * إعدادات الموقع العام: تبديل الوضع بين مباشر وتحت الإنشاء وتحت الصيانة.
 *
 * الحقول الاختيارية (موعد الإطلاق، الرسالة، مدة الصيانة) تبقى فارغة افتراضيًا
 * ولا تُخترع لها قيم: صفحات الحالة تعرض نصها المُترجم عند غيابها، وإعلان موعد
 * لم يُقرّر أسوأ من عدم إعلان موعد.
 */

const EMPTY: SiteModeSettings = {
  site_mode: 'construction',
  site_launch_at: '',
  site_status_message: '',
  maintenance_eta_minutes: '',
}

const MODE_ICON: Record<SiteMode, IconName> = {
  live: 'globe',
  construction: 'sparkles',
  maintenance: 'settings',
}

const copy = {
  ar: {
    eyebrow: 'إعدادات المنصّة',
    title: 'وضع الموقع',
    lede: 'يحدّد ما يراه زائر majarra.app. لوحة الإدارة تبقى متاحة في كل الأوضاع، فلا يمكن أن يحجبك الوضع عن هذه الصفحة.',
    current: 'الوضع الحالي',
    modes: {
      live: { title: 'مباشر', description: 'صفحة الهبوط تُعرض كما هي لكل زائر.' },
      construction: { title: 'تحت الإنشاء', description: 'لم يُطلق بعد: تُعرض صفحة «قريبًا» مع عدّاد اختياري.' },
      maintenance: { title: 'تحت الصيانة', description: 'انقطاع مؤقّت: صفحة صيانة تُعيد 503 للمحركات فلا تُسقط صفحاتك المفهرسة.' },
    } as Record<SiteMode, { title: string; description: string }>,
    launchLabel: 'موعد الإطلاق المتوقّع',
    launchHint: 'اختياري. يظهر كعدّاد في صفحة «تحت الإنشاء». اتركه فارغًا إن لم يُقرّر موعد.',
    messageLabel: 'رسالة تُعرض للزائر',
    messageHint: 'اختيارية. تُعرض كما تكتبها بدل النص المُترجم الافتراضي. حتى 500 حرف.',
    etaLabel: 'مدة الصيانة المتوقّعة (دقائق)',
    etaHint: 'اختيارية. تُرسل في ترويسة Retry-After. اتركها فارغة إن كانت المدة غير محدّدة.',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    saved: 'حُفظت الإعدادات',
    preview: 'معاينة الصفحات',
    previewHint: 'المعاينة لا تغيّر أي إعداد.',
    previewConstruction: 'تحت الإنشاء',
    previewMaintenance: 'تحت الصيانة',
    preview404: 'صفحة 404',
    liveWarn: 'الموقع مباشر الآن ومرئي لكل زائر.',
    blockedWarn: 'الموقع محجوب عن الزوّار الآن. صفحة الهبوط لا تُعرض.',
    session: 'حسابي والجلسة',
    signOut: 'تسجيل الخروج',
    signOutHint: 'ينهي الجلسة على الخادم ويمسحها من هذا المتصفح.',
    signedInAs: 'مسجَّل الدخول بـ',
    rolesLabel: 'دوري',
    passwordTitle: 'تغيير كلمة المرور',
    passwordHint: 'تغيير كلمة المرور يسحب كل جلساتك على كل الأجهزة، فستحتاج الدخول من جديد.',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور الجديدة',
    newPasswordHint: 'عشرة أحرف على الأقل.',
    changeSubmit: 'تغيير كلمة المرور',
    changing: 'جارٍ التغيير…',
    mismatch: 'كلمتا المرور غير متطابقتين',
    tooShort: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل',
    changed: 'تغيّرت كلمة المرور. سيُطلب منك الدخول من جديد.',
  },
  en: {
    eyebrow: 'Platform settings',
    title: 'Site mode',
    lede: 'Controls what a visitor to majarra.app sees. The admin dashboard stays reachable in every mode, so a mode can never lock you out of this page.',
    current: 'Current mode',
    modes: {
      live: { title: 'Live', description: 'The landing page is shown to every visitor.' },
      construction: { title: 'Under construction', description: 'Not launched yet: a coming-soon page with an optional countdown.' },
      maintenance: { title: 'Under maintenance', description: 'Temporary outage: returns 503 so search engines keep your indexed pages.' },
    } as Record<SiteMode, { title: string; description: string }>,
    launchLabel: 'Expected launch date',
    launchHint: 'Optional. Shown as a countdown on the construction page. Leave empty if no date is decided.',
    messageLabel: 'Message shown to visitors',
    messageHint: 'Optional. Replaces the default translated text. Up to 500 characters.',
    etaLabel: 'Expected maintenance duration (minutes)',
    etaHint: 'Optional. Sent as the Retry-After header. Leave empty if the duration is unknown.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Settings saved',
    preview: 'Preview pages',
    previewHint: 'Previewing does not change any setting.',
    previewConstruction: 'Under construction',
    previewMaintenance: 'Under maintenance',
    preview404: '404 page',
    liveWarn: 'The site is live and visible to every visitor.',
    blockedWarn: 'The site is currently hidden from visitors. The landing page is not shown.',
    session: 'My account and session',
    signOut: 'Sign out',
    signOutHint: 'Ends the session on the server and clears it from this browser.',
    signedInAs: 'Signed in as',
    rolesLabel: 'My role',
    passwordTitle: 'Change password',
    passwordHint: 'Changing your password revokes all your sessions on every device, so you will need to sign in again.',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    newPasswordHint: 'At least ten characters.',
    changeSubmit: 'Change password',
    changing: 'Changing…',
    mismatch: 'The passwords do not match',
    tooShort: 'The password must be at least 10 characters',
    changed: 'Password changed. You will be asked to sign in again.',
  },
}

export function SettingsPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const text = copy[locale]

  const [settings, setSettings] = useState<SiteModeSettings>(EMPTY)
  const [meta, setMeta] = useState<SiteModeEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // حسابي: يُقرأ من الجلسة المحفوظة، فلا نداء إضافي عند فتح الصفحة
  const self = readAdminUser()
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.siteMode()
      setSettings({ ...EMPTY, ...response.data.settings })
      setMeta(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الإعدادات' : 'Unable to load settings')
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => { void load() }, [load])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await api.saveSiteMode(settings)
      setSettings({ ...EMPTY, ...response.data.settings })
      setMeta(response.data)
      setNotice(text.saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر الحفظ' : 'Unable to save')
    } finally {
      setSaving(false)
    }
  }

  /**
   * تغيير كلمة مروري.
   *
   * التأكيد يُفحص في الواجهة لا الخادم: الخادم لا يعرف نية المستخدم من حقلين
   * متطابقين، والفحص هنا يوفّر رحلة كاملة على خطأ مطبعي.
   *
   * النجاح يسحب كل الجلسات على الخادم بما فيها الحالية، فتُعاد الصفحة لتظهر
   * شاشة الدخول. بلا إعادة التحميل يبقى المستخدم أمام لوحة كل نداءاتها تفشل
   * بـ401 بلا سبب ظاهر.
   */
  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError('')

    if (passwordForm.next.length < 10) {
      setPasswordError(text.tooShort)
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError(text.mismatch)
      return
    }

    setPasswordBusy(true)
    const result = await changeOwnPassword(passwordForm.current, passwordForm.next)
    if (!result.ok) {
      setPasswordBusy(false)
      setPasswordError(result.message)
      return
    }

    window.alert(text.changed)
    window.location.reload()
  }

  if (loading) return <LoadingState />
  if (error && !meta) return <ErrorState message={error} onRetry={() => void load()} />

  const activeMode = settings.site_mode
  // الأوضاع تأتي من الخادم فلا تنحرف القائمة عنه عند إضافة وضع
  const modes = meta?.modes ?? (['live', 'construction', 'maintenance'] as SiteMode[])
  const savedMode = meta?.preview.mode ?? activeMode

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      <section className="mode-current">
        <span className={`mode-dot mode-dot--${savedMode}`} aria-hidden="true" />
        <strong>{text.current}: {text.modes[savedMode].title}</strong>
        <span>{savedMode === 'live' ? text.liveWarn : text.blockedWarn}</span>
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}

      <form className="panel" onSubmit={submit}>
        <div className="panel__header">
          <h3>{text.title}</h3>
        </div>

        <div className="entity-form">
          <div className="mode-grid" role="radiogroup" aria-label={text.title}>
            {modes.map((mode) => (
              <label
                className={`mode-card mode-card--${mode} ${activeMode === mode ? 'mode-card--active' : ''}`}
                key={mode}
              >
                <input
                  type="radio"
                  name="site_mode"
                  value={mode}
                  checked={activeMode === mode}
                  onChange={() => setSettings((current) => ({ ...current, site_mode: mode }))}
                />
                <span className="mode-card__icon"><Icon name={MODE_ICON[mode]} size={18} /></span>
                <strong>{text.modes[mode].title}</strong>
                <small>{text.modes[mode].description}</small>
              </label>
            ))}
          </div>

          {/* الحقول المعروضة تتبع الوضع المختار: لا معنى لمدة صيانة في وضع مباشر */}
          {activeMode === 'construction' ? (
            <label className="field">
              <span>{text.launchLabel}</span>
              <input
                type="datetime-local"
                value={toLocalInput(settings.site_launch_at)}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  site_launch_at: fromLocalInput(event.target.value),
                }))}
              />
              <small>{text.launchHint}</small>
            </label>
          ) : null}

          {activeMode === 'maintenance' ? (
            <label className="field">
              <span>{text.etaLabel}</span>
              <input
                type="number"
                min={1}
                max={20160}
                value={settings.maintenance_eta_minutes}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  maintenance_eta_minutes: event.target.value,
                }))}
                dir="ltr"
              />
              <small>{text.etaHint}</small>
            </label>
          ) : null}

          {activeMode !== 'live' ? (
            <label className="field">
              <span>{text.messageLabel}</span>
              <textarea
                rows={3}
                maxLength={500}
                value={settings.site_status_message}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  site_status_message: event.target.value,
                }))}
              />
              <small>{text.messageHint}</small>
            </label>
          ) : null}

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="form-actions">
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? text.saving : text.save}
            </button>
          </div>
        </div>
      </form>

      <section className="panel">
        <div className="panel__header">
          <h3>{text.preview}</h3>
          <span className="panel__kicker">{text.previewHint}</span>
        </div>
        <div className="entity-form">
          <div className="mode-preview-links">
            {/* ?preview= يعرض التصميم بلا تغيير أي إعداد */}
            <a className="button button--ghost" href="/?preview=construction" target="_blank" rel="noreferrer">
              <Icon name="sparkles" size={16} />{text.previewConstruction}
            </a>
            <a className="button button--ghost" href="/?preview=maintenance" target="_blank" rel="noreferrer">
              <Icon name="settings" size={16} />{text.previewMaintenance}
            </a>
            <a className="button button--ghost" href="/_not-found-preview" target="_blank" rel="noreferrer">
              <Icon name="search" size={16} />{text.preview404}
            </a>
          </div>
        </div>
      </section>

      <form className="panel" onSubmit={submitPassword}>
        <div className="panel__header">
          <h3>{text.passwordTitle}</h3>
          <span className="panel__kicker">{text.passwordHint}</span>
        </div>
        <div className="entity-form">
          <label className="field">
            <span>{text.currentPassword}</span>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
              autoComplete="current-password"
              dir="ltr"
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{text.newPassword}</span>
              <input
                type="password"
                value={passwordForm.next}
                onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
                autoComplete="new-password"
                dir="ltr"
                minLength={10}
                required
              />
              <small>{text.newPasswordHint}</small>
            </label>
            <label className="field">
              <span>{text.confirmPassword}</span>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })}
                autoComplete="new-password"
                dir="ltr"
                minLength={10}
                required
              />
            </label>
          </div>

          {passwordError ? <p className="form-error" role="alert">{passwordError}</p> : null}

          <div className="form-actions">
            <button className="button button--primary" type="submit" disabled={passwordBusy}>
              {passwordBusy ? text.changing : text.changeSubmit}
            </button>
          </div>
        </div>
      </form>

      <section className="panel">
        <div className="panel__header">
          <h3>{text.session}</h3>
          <span className="panel__kicker">{text.signOutHint}</span>
        </div>
        <div className="entity-form">
          {self ? (
            <dl className="detail-list">
              <div>
                <dt>{text.signedInAs}</dt>
                {/* البريد لاتيني فيُعرض يسارًا-يمينًا داخل واجهة عربية */}
                <dd dir="ltr">{self.email}</dd>
              </div>
              <div>
                <dt>{text.rolesLabel}</dt>
                <dd>{self.roles.join(', ') || '—'}</dd>
              </div>
            </dl>
          ) : null}
          <div className="form-actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => { void signOut().then(() => window.location.reload()) }}
            >
              <Icon name="logout" size={16} />{text.signOut}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * يحوّل ISO المخزّن إلى صيغة datetime-local، وهي بلا منطقة زمنية.
 *
 * `toISOString().slice(0,16)` كان سيعرض التوقيت العالمي في حقل يفهمه المتصفح
 * كتوقيت محلي، فيرى المسؤول ساعة غير التي حفظها. الطرح يصحّح الفرق.
 */
function toLocalInput(iso: string): string {
  if (!iso.trim()) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const offsetMs = parsed.getTimezoneOffset() * 60_000
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16)
}

/** يعيد قيمة الحقل المحلية إلى ISO، أو نصًا فارغًا. */
function fromLocalInput(value: string): string {
  if (!value.trim()) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}
