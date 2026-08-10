import { useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import { adminPath } from '../lib/adminPath'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

/**
 * شريط علوي يعرض عنوان الصفحة الحالية.
 *
 * ## العلّة التي أُصلحت هنا
 *
 * كانت مفاتيح `pageNames` مكتوبة حرفيًا ببادئة `/admin`، بينما مسار اللوحة
 * الحقيقي `/iamnotsite` (انظر lib/adminPath.ts). فلا مفتاح يمكن أن يطابق
 * `location.pathname` أبدًا — بما في ذلك مفتاح الاحتياط نفسه — فكانت **كل**
 * صفحة في اللوحة تعرض عنوان «لوحة التحكم» ووصفها. التسعة عناوين المكتوبة
 * كانت بيانات ميتة.
 *
 * الآن تُبنى المفاتيح بـ`adminPath()`، فتغيير قاعدة المسار مرة واحدة في
 * adminPath.ts يسري على كل العناوين تلقائيًا ولا يعود ممكنًا أن تنحرف.
 *
 * وأُكملت العناوين لكل المسارات المسجّلة في AdminRoutes: مسار بلا عنوان يرجع
 * إلى عنوان لوحة التحكم، وهو خطأ ظاهر للمستخدم لا نقص تجميلي.
 */

type PageMeta = { title: string; subtitle: string }

/// المفاتيح هي المقطع الفرعي كما هو مسجَّل في AdminRoutes، و`''` للفهرس.
/// تُحوَّل إلى مسارات كاملة أدناه، فلا تُكتب البادئة يدويًا في أي سطر.
const PAGES: Record<Locale, Record<string, PageMeta>> = {
  ar: {
    '': { title: 'لوحة التحكم', subtitle: 'صورة مباشرة من قاعدة بيانات المحتوى والعائلات' },

    // نظرة عامة
    analytics: { title: 'التحليلات', subtitle: 'أرقام سلوكية مجهولة الهوية: تشغيل ومسارات وإتقان' },
    calendar: { title: 'تقويم المحتوى', subtitle: 'كل ما تجدوله المنصّة في نافذة واحدة، مع تنبيهات الجدولة' },
    tasks: { title: 'مهامي', subtitle: 'المهام المسنَدة إليك من سير عمل المحتوى' },
    ops: { title: 'المراقبة', subtitle: 'أرقام مقروءة من قاعدة البيانات مباشرة' },
    'ops-sla': { title: 'مستويات الخدمة', subtitle: 'زمن المراجعة والتصعيد عند التأخير' },

    // إدارة المحتوى
    planets: { title: 'الكواكب', subtitle: 'افتح كوكبًا لرؤية سلاسله وإحصاءاته كاملة' },
    taxonomy: { title: 'إدارة الكواكب والتصنيفات', subtitle: 'إنشاء وتعديل الهيكل الذي يُبنى عليه كل المحتوى' },
    series: { title: 'إدارة السلاسل', subtitle: 'هوية مستقلة لكل سلسلة ومسار عمري واضح' },
    seasons: { title: 'المواسم', subtitle: 'تجميع الحلقات وترتيب المشاهدة' },
    episodes: { title: 'الحلقات والوحدات', subtitle: 'إدارة النشر والأهداف والأنشطة المرتبطة' },
    characters: { title: 'الشخصيات', subtitle: 'أبطال القصص وأدوارهم وأوصافهم' },
    stories: { title: 'القصص والكوميكس', subtitle: 'الصفحات والنصوص والترجمات والفقاعات' },
    media: { title: 'مكتبة الوسائط', subtitle: 'الصور والصوت والفيديو ومواضعها في R2' },
    'visual-styles': { title: 'الاستايلات البصرية', subtitle: 'الأسلوب الفني الموحّد لكل نوع محتوى' },
    'library-content': { title: 'مكتبة المحتوى', subtitle: 'إدارة الكتب والألعاب والمشروعات من مكان واحد' },

    // الإطار التعليمي
    translation: { title: 'مركز الترجمة', subtitle: 'حالة اللغات والمصطلحات الموحّدة' },
    quiz: { title: 'بنك الأسئلة', subtitle: 'أسئلة مرتبطة بالأهداف التعليمية' },
    school: { title: 'حسابات المدارس', subtitle: 'الفصول والطلاب ومتابعة الإتقان' },

    // تجربة التطبيق
    'app-experience': { title: 'بناء الصفحة الرئيسية', subtitle: 'ترتيب الأقسام واستهدافها حسب الدولة والعمر والباقة' },
    'remote-config': { title: 'التحكم عن بعد', subtitle: 'تفعيل ميزة أو ضبط نسبة إطلاقها بلا إصدار جديد' },
    campaigns: { title: 'الحملات', subtitle: 'الإشعارات والعروض الموجّهة' },
    recommendations: { title: 'التوصيات', subtitle: 'التثبيت والتعزيز وقواعد الاقتراح' },

    // المستخدمون
    parents: { title: 'أولياء الأمور', subtitle: 'الحسابات والباقات وملفات الأسرة' },
    children: { title: 'ملفات الأطفال', subtitle: 'المسار مشتق تلقائيًا من شهر وسنة الميلاد' },
    'devices-admin': { title: 'الأجهزة والتنزيلات', subtitle: 'أجهزة العائلات وسحب الوصول عند الحاجة' },
    'support-center': { title: 'مركز الدعم', subtitle: 'بحث عن عائلة لخدمة العملاء بلا بيانات دفع كاملة' },
    teams: { title: 'الفرق', subtitle: 'تجميع الموظفين تحت نطاق واحد' },
    roles: { title: 'الأدوار والصلاحيات', subtitle: 'المنح بأربع طبقات: دور ونطاق ونوع محتوى ولغة' },

    // التجارة
    billing: { title: 'الاشتراكات والفوترة', subtitle: 'Google Play مصدر الحقيقة للاستحقاق' },
    rights: { title: 'الحقوق والتراخيص', subtitle: 'المالك والدول واللغات وتاريخ الانتهاء' },
    revenue: { title: 'الإيرادات', subtitle: 'الإيراد الشهري المتكرّر والاشتراكات الجديدة' },
    'finance-advanced': { title: 'المالية المتقدمة', subtitle: 'تكلفة المحتوى وعمر العميل والميزانيات' },
    packages: { title: 'الباقات والأسعار', subtitle: 'الخطط وحدودها والأسعار حسب الدولة' },

    // سير العمل
    workflows: { title: 'سير العمل', subtitle: 'تشغيلات المراجعة وقراراتها' },

    // النمو والمنصّة
    partnerships: { title: 'طلبات الشراكة', subtitle: 'الطلبات الواردة من نموذج الشراكات في صفحة الهبوط' },
    'team-access': { title: 'الموظفون والصلاحيات', subtitle: 'حسابات الفريق وأدوارها: لكل موظف بريده وكلمة مروره' },
    settings: { title: 'وضع الموقع', subtitle: 'مباشر أو تحت الإنشاء أو تحت الصيانة — اللوحة تبقى متاحة دائمًا' },
  },
  en: {
    '': { title: 'Dashboard', subtitle: 'Live content and family data from the database' },

    analytics: { title: 'Analytics', subtitle: 'Anonymous behavioural figures: plays, tracks and mastery' },
    calendar: { title: 'Content calendar', subtitle: 'Everything the platform schedules in one window, with scheduling alerts' },
    tasks: { title: 'My tasks', subtitle: 'Tasks assigned to you by the content workflow' },
    ops: { title: 'Monitoring', subtitle: 'Figures read directly from the database' },
    'ops-sla': { title: 'Service levels', subtitle: 'Review turnaround and escalation on delay' },

    planets: { title: 'Planets', subtitle: 'Open a planet to see its full series list and stats' },
    taxonomy: { title: 'Manage planets & taxonomy', subtitle: 'Create and edit the structure all content is built on' },
    series: { title: 'Series management', subtitle: 'A distinct identity and clear age track for every series' },
    seasons: { title: 'Seasons', subtitle: 'Grouping episodes and watch order' },
    episodes: { title: 'Episodes & units', subtitle: 'Manage publishing, objectives, and linked activities' },
    characters: { title: 'Characters', subtitle: 'Story heroes, their roles and descriptions' },
    stories: { title: 'Stories & comics', subtitle: 'Pages, text, localisations and bubbles' },
    media: { title: 'Media library', subtitle: 'Images, audio and video, and where they live in R2' },
    'visual-styles': { title: 'Visual styles', subtitle: 'A consistent art direction per content type' },
    'library-content': { title: 'Content library', subtitle: 'Manage books, games, and projects in one place' },

    translation: { title: 'Translation centre', subtitle: 'Language status and shared glossary' },
    quiz: { title: 'Quiz bank', subtitle: 'Questions tied to learning objectives' },
    school: { title: 'School accounts', subtitle: 'Classes, students and mastery tracking' },

    'app-experience': { title: 'Home page builder', subtitle: 'Order sections and target by country, age and plan' },
    'remote-config': { title: 'Remote config', subtitle: 'Enable a feature or set its rollout without a release' },
    campaigns: { title: 'Campaigns', subtitle: 'Targeted notifications and offers' },
    recommendations: { title: 'Recommendations', subtitle: 'Pins, boosts and suggestion rules' },

    parents: { title: 'Parents', subtitle: 'Accounts, plans, and family profiles' },
    children: { title: 'Child profiles', subtitle: 'Track is derived automatically from birth month and year' },
    'devices-admin': { title: 'Devices & downloads', subtitle: 'Family devices and revoking access when needed' },
    'support-center': { title: 'Support centre', subtitle: 'Family lookup for support, without full payment data' },
    teams: { title: 'Teams', subtitle: 'Grouping staff under a single scope' },
    roles: { title: 'Roles & permissions', subtitle: 'Grants in four layers: role, scope, content type and language' },

    billing: { title: 'Subscriptions & billing', subtitle: 'Google Play is the source of truth for entitlement' },
    rights: { title: 'Rights & licensing', subtitle: 'Holder, territories, languages and expiry' },
    revenue: { title: 'Revenue', subtitle: 'Monthly recurring revenue and new subscriptions' },
    'finance-advanced': { title: 'Advanced finance', subtitle: 'Content cost, customer lifetime and budgets' },
    packages: { title: 'Plans & pricing', subtitle: 'Plans, their limits, and per-country pricing' },

    workflows: { title: 'Workflow', subtitle: 'Review runs and their decisions' },

    partnerships: { title: 'Partnership requests', subtitle: 'Requests from the landing page partnerships form' },
    'team-access': { title: 'Staff & permissions', subtitle: 'Team accounts and roles: every member has their own email and password' },
    settings: { title: 'Site mode', subtitle: 'Live, under construction, or under maintenance — the dashboard stays reachable' },
  },
}

/// يبني خريطة المسار الكامل ← العنوان، فلا تُكتب بادئة اللوحة في أي مكان.
function pageMap(locale: Locale): Record<string, PageMeta> {
  const map: Record<string, PageMeta> = {}
  for (const [sub, meta] of Object.entries(PAGES[locale])) {
    map[adminPath(sub)] = meta
  }
  return map
}

const copy = {
  ar: { menu: 'فتح القائمة', placeholder: 'ابحث في كل شيء…', search: 'بحث شامل', shortcut: 'Ctrl+K', light: 'تفعيل الوضع الفاتح', dark: 'تفعيل الوضع الداكن', language: 'اللغة', account: 'حساب الإدارة', role: 'مدير المحتوى', org: 'إدارة مجرة' },
  en: { menu: 'Open menu', placeholder: 'Search everything…', search: 'Global search', shortcut: 'Ctrl+K', light: 'Enable light mode', dark: 'Enable dark mode', language: 'Language', account: 'Admin account', role: 'Content manager', org: 'Majarra administration' },
}

/**
 * ## علّة ثانية أُصلحت هنا
 *
 * كان حقل البحث في هذا الشريط يوجّه **كل** استعلام إلى `/series?q=`، فالبحث عن
 * تذكرة أو عائلة أو مقال ينتهي على قائمة سلاسل فارغة. لا شيء في الشاشة يقول إن
 * البحث للسلاسل وحدها، فالنتيجة الفارغة تُقرأ كـ«لا يوجد».
 *
 * الآن الحقل زرّ يفتح لوحة الأوامر، وهي تبحث في سبعة عشر نوعًا عبر
 * `/admin/search` وتُفلتر بالصلاحيات في الخادم.
 */
export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const location = useLocation()
  const { theme, toggleTheme, locale, setLocale, setMenuOpen } = usePreferences()
  const text = copy[locale]

  // المسار قد ينتهي بشرطة مائلة، فتُقصّ قبل المطابقة لئلا يفشل مفتاح صحيح
  const path = location.pathname.replace(/\/+$/, '') || adminPath()
  const pages = pageMap(locale)
  const page = pages[path] ?? pages[adminPath()]

  return (
    <header className="topbar">
      <div className="topbar__heading">
        <button className="icon-button menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label={text.menu}><Icon name="menu" /></button>
        <div><h1>{page.title}</h1><p>{page.subtitle}</p></div>
      </div>

      <div className="topbar__actions">
        <button className="global-search global-search--button" type="button" onClick={onOpenPalette} aria-label={text.search}>
          <Icon name="search" size={17} />
          <span className="global-search__label">{text.placeholder}</span>
          <kbd>{text.shortcut}</kbd>
        </button>
        <div className="language-toggle" aria-label={text.language}>
          <button className={locale === 'ar' ? 'active' : ''} type="button" aria-pressed={locale === 'ar'} onClick={() => setLocale('ar')}>العربية</button>
          <button className={locale === 'en' ? 'active' : ''} type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        </div>
        <button className="icon-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? text.light : text.dark} title={theme === 'dark' ? text.light : text.dark}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <div className="admin-profile" title={text.account}><span>{locale === 'ar' ? 'م' : 'M'}</span><div><strong>{text.role}</strong><small>{text.org}</small></div></div>
      </div>
    </header>
  )
}
