import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { signIn, type AdminUser } from '../lib/adminSession'

/**
 * شاشة دخول اللوحة: بريد وكلمة مرور.
 *
 * ## ما سبقها ولماذا استُبدل
 *
 * كانت الشاشة تطلب مفتاح ADMIN_API_KEY المشترك. المفتاح الواحد لا يصلح لفريق:
 * كل من يعرفه يملك كل شيء، ولا يميّز موظفًا عن آخر، فسجل التدقيق كان يعتمد على
 * اسم «المُشغّل» يكتبه المستخدم بنفسه بلا تحقّق — أي أن أي شخص يستطيع نسبة
 * تعديلاته إلى غيره.
 *
 * ## قرارات التصميم
 *
 * **لوحان لا بطاقة واحدة.** اللوح الأيمن يحمل الهوية والسياق، والأيسر النموذج.
 * البطاقة الوحيدة وسط الشاشة كانت تترك النموذج بلا سياق: من يفتحها لا يعرف
 * ما هذه اللوحة ولا لماذا يحتاج حسابًا. على الشاشات الضيقة يُخفى لوح الهوية
 * بصريًا ويبقى النموذج وحده، فلا يُدفع الحقل تحت الطيّة.
 *
 * **لا حقل «اسم المُشغّل».** كان موجودًا في النسخة القديمة ويُسجَّل في التدقيق
 * بلا تحقّق. الهوية الآن من الحساب نفسه، فحذف الحقل يمنع الانتحال ويقصّر
 * النموذج إلى حقلين.
 *
 * **إظهار كلمة المرور.** خطأ مطبعي في حقل مخفي هو أشيع سبب لفشل الدخول، وكلمة
 * المرور المولَّدة هنا ٢٤ محرفًا عشوائيًا. الزر يجعل التحقّق ممكنًا بلا لصق
 * الكلمة في مكان ظاهر.
 *
 * **الخطأ فوق الزر لا تحته.** قارئ الشاشة يصل إليه قبل إعادة المحاولة، و`role`
 * يتبع نوع الخطأ: `alert` لخطأ يحتاج تدخلًا فوريًا و`status` لحالة انتظار.
 */

const copy = {
  ar: {
    brand: 'مجرة',
    brandSub: 'مركز إدارة المحتوى',
    heroTitle: 'محتوى عربي للأطفال، مُدار بعناية',
    heroLede: 'كل تعديل يُسجَّل باسم صاحبه، وكل دور يرى ما يخصّه فقط.',
    points: [
      'صلاحيات بأربع طبقات: دور ونطاق ونوع محتوى ولغة',
      'سجل تدقيق يربط كل تغيير بحساب حقيقي',
      'جلسات قابلة للسحب فورًا من أي جهاز',
    ],
    title: 'تسجيل الدخول',
    subtitle: 'أدخل بيانات حسابك للمتابعة',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'name@majarra.app',
    passwordLabel: 'كلمة المرور',
    show: 'إظهار كلمة المرور',
    hide: 'إخفاء كلمة المرور',
    submit: 'دخول',
    checking: 'جارٍ التحقق…',
    emptyEmail: 'البريد الإلكتروني مطلوب',
    emptyPassword: 'كلمة المرور مطلوبة',
    invalid: 'البريد أو كلمة المرور غير صحيحة',
    locked: 'محاولات كثيرة. انتظر دقيقة وأعد المحاولة.',
    disabled: 'هذا الحساب معطَّل. راجع مدير النظام.',
    network: 'تعذر الوصول إلى الخادم. تحقّق من اتصالك.',
    storage: 'تعذر حفظ الجلسة: التخزين محجوب في هذا المتصفح.',
    note: 'الجلسة تُحفظ لهذا التبويب فقط وتزول بإغلاقه.',
    forgot: 'نسيت كلمة المرور؟',
    forgotHint: 'إعادة الضبط تتم من مدير النظام، فلا يُرسل النظام روابط استعادة.',
    back: 'العودة للموقع',
    langAria: 'اللغة',
  },
  en: {
    brand: 'Majarra',
    brandSub: 'Content management',
    heroTitle: 'Arabic content for children, managed with care',
    heroLede: 'Every change is recorded against its author, and every role sees only its own scope.',
    points: [
      'Four-layer permissions: role, scope, content type and language',
      'An audit log tying each change to a real account',
      'Sessions that can be revoked instantly on any device',
    ],
    title: 'Sign in',
    subtitle: 'Enter your account details to continue',
    emailLabel: 'Email address',
    emailPlaceholder: 'name@majarra.app',
    passwordLabel: 'Password',
    show: 'Show password',
    hide: 'Hide password',
    submit: 'Sign in',
    checking: 'Verifying…',
    emptyEmail: 'Email is required',
    emptyPassword: 'Password is required',
    invalid: 'Email or password is incorrect',
    locked: 'Too many attempts. Wait a minute and try again.',
    disabled: 'This account is disabled. Contact your system administrator.',
    network: 'Unable to reach the server. Check your connection.',
    storage: 'Unable to store the session: storage is blocked in this browser.',
    note: 'The session is kept for this tab only and clears when it closes.',
    forgot: 'Forgot your password?',
    forgotHint: 'Resets are done by a system administrator; no recovery emails are sent.',
    back: 'Back to website',
    langAria: 'Language',
  },
}

export function AdminLoginPage({ onSignedIn }: { onSignedIn: (user: AdminUser) => void }) {
  const { locale, setLocale } = usePreferences()
  const text = copy[locale]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // عنوان التبويب: من يفتح رابطًا محفوظًا يعرف أين وصل قبل أن يقرأ الصفحة
  useEffect(() => {
    document.title = `${text.title} · ${text.brand}`
  }, [text.title, text.brand])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) { setError(text.emptyEmail); return }
    if (!password) { setError(text.emptyPassword); return }

    setBusy(true)
    setError('')
    const result = await signIn(email.trim(), password)
    if (!result.ok) {
      setBusy(false)
      // رسالة الخادم تُقدَّم عند وجودها: هي أدق في حالات القفل والتعطيل
      setError(result.message || text[result.reason])
      return
    }
    onSignedIn(result.user)
  }

  return (
    <div className="login">
      {/* خلفية مزخرفة: مخفية عن قارئ الشاشة لأنها لا تحمل معلومة */}
      <span className="login__glow login__glow--one" aria-hidden="true" />
      <span className="login__glow login__glow--two" aria-hidden="true" />

      <div className="login__shell">
        <aside className="login__aside">
          <div className="login__brand">
            <span className="login__mark"><Icon name="sparkles" size={22} /></span>
            <div>
              <strong>{text.brand}</strong>
              <small>{text.brandSub}</small>
            </div>
          </div>

          <div className="login__hero">
            <h1>{text.heroTitle}</h1>
            <p>{text.heroLede}</p>
          </div>

          <ul className="login__points">
            {text.points.map((point) => (
              <li key={point}>
                <span className="login__tick" aria-hidden="true">
                  <Icon name="sparkles" size={13} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </aside>

        <main className="login__panel">
          <div className="login__panel-top">
            {/* مبدّل اللغة هنا لا في الأسفل: الاختيار قبل قراءة النموذج لا بعده */}
            <div className="login__lang" role="group" aria-label={text.langAria}>
              <button
                type="button"
                className={locale === 'ar' ? 'is-active' : ''}
                aria-pressed={locale === 'ar'}
                onClick={() => setLocale('ar')}
              >العربية</button>
              <button
                type="button"
                className={locale === 'en' ? 'is-active' : ''}
                aria-pressed={locale === 'en'}
                onClick={() => setLocale('en')}
              >EN</button>
            </div>
          </div>

          <form className="login__form" onSubmit={submit} noValidate>
            <header className="login__heading">
              <h2>{text.title}</h2>
              <p>{text.subtitle}</p>
            </header>

            <label className="login__field">
              <span className="login__label">{text.emailLabel}</span>
              <span className="login__control">
                <span className="login__icon" aria-hidden="true"><Icon name="parents" size={16} /></span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={text.emailPlaceholder}
                  autoComplete="username"
                  autoFocus
                  // البريد لاتيني دائمًا، فيُعرض يسارًا-يمينًا حتى في واجهة عربية
                  dir="ltr"
                  required
                  aria-invalid={!!error}
                />
              </span>
            </label>

            <label className="login__field">
              <span className="login__label">{text.passwordLabel}</span>
              <span className="login__control">
                <span className="login__icon" aria-hidden="true"><Icon name="rights" size={16} /></span>
                <input
                  type={reveal ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                  required
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  className="login__reveal"
                  onClick={() => setReveal(!reveal)}
                  aria-label={reveal ? text.hide : text.show}
                  aria-pressed={reveal}
                  tabIndex={0}
                >
                  <Icon name={reveal ? 'moon' : 'sun'} size={15} />
                </button>
              </span>
            </label>

            {/* فوق الزر: قارئ الشاشة يصل إليه قبل إعادة المحاولة */}
            {error ? (
              <p className="login__error" role="alert">
                <Icon name="close" size={14} />
                {error}
              </p>
            ) : null}

            <button className="login__submit" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="login__spinner" aria-hidden="true" />
                  {text.checking}
                </>
              ) : text.submit}
            </button>

            <details className="login__forgot">
              <summary>{text.forgot}</summary>
              <p>{text.forgotHint}</p>
            </details>

            <footer className="login__foot">
              <p>{text.note}</p>
              <a href="/">{text.back}</a>
            </footer>
          </form>
        </main>
      </div>
    </div>
  )
}
