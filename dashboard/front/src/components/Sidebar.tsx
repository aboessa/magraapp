import { NavLink } from 'react-router-dom'
import logo from '../assets/majarra-logo.webp'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { adminPath } from '../lib/adminPath'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

type NavItem = { key: string; to?: string; icon: IconName; end?: boolean }
type NavGroup = { key: string; items: NavItem[] }

// كل الروابط تُبنى بـadminPath، فتغيير قاعدة المسار يحدث في مكان واحد
// (lib/adminPath.ts) ولا يتسرّب رابط قديم إلى القائمة.
const groups: NavGroup[] = [
  { key: 'overview', items: [{ key: 'dashboard', to: adminPath(), icon: 'dashboard', end: true }, { key: 'analytics', to: adminPath('analytics'), icon: 'analytics' }, { key: 'tasks', to: adminPath('tasks'), icon: 'reviews' }, { key: 'workflows', to: adminPath('workflows'), icon: 'reviews' }, { key: 'ops', to: adminPath('ops'), icon: 'analytics' }, { key: 'ops-sla', to: adminPath('ops-sla'), icon: 'analytics' }] },
  { key: 'content', items: [
    { key: 'planets', to: adminPath('planets'), icon: 'planets' },
    { key: 'series', to: adminPath('series'), icon: 'series' },
    { key: 'seasons', to: adminPath('seasons'), icon: 'seasons' },
    { key: 'episodes', to: adminPath('episodes'), icon: 'episodes' },
    { key: 'characters', to: adminPath('characters'), icon: 'characters' },
    { key: 'books', to: adminPath('stories'), icon: 'books' },
    { key: 'media', to: adminPath('media'), icon: 'media' },
    // توليد السرد جنب مكتبة الوسائط لا في إعدادات المنصّة: هو خطوة إنتاج محتوى،
    // ومخرجه ينتهي في المكتبة. services/googleTts.ts (518 سطرًا) كان بلا واجهة.
    { key: 'narration', to: adminPath('narration'), icon: 'play' },
    { key: 'styles', to: adminPath('visual-styles'), icon: 'styles' },
    { key: 'games', to: adminPath('library-content'), icon: 'games' },
    // ثلاث شاشات على مستوى الكتالوج تقرأ مسارات الإنتاج والعمليّات الجديدة.
    // موضعها جنب المحتوى لا في إعدادات المنصّة: أسئلتها إنتاجية يومية — ما يجب
    // تسجيله، وما يجب رسمه، وأين تعطّل الكتالوج.
    { key: 'games-ops', to: adminPath('games-ops'), icon: 'analytics' },
    { key: 'games-audio-queue', to: adminPath('games-audio-queue'), icon: 'play' },
    { key: 'games-art-queue', to: adminPath('games-art-queue'), icon: 'media' },
    // فحص الجاهزية جنب المحتوى لا في إعدادات المنصّة: هو القرار الأخير قبل
    // النشر. المسارَان كانا بلا واجهة وفيهما أربع علل أُصلحت في الخادم.
    { key: 'quality', to: adminPath('quality'), icon: 'reviews' },
  ] },
  // skills و objectives كانا معطَّلين بلافتة «قريبًا» بينما مساراتهما في
  // adminCatalogue.ts كاملة منذ إنشائه ولم يكن لها مستدعٍ في الواجهة.
  //
  // mastery كان آخر عنصر معطَّل في القائمة كلها، وبحقّ: mastery و attempts
  // جدولان بلا أي مسار مخصَّص. صار لهما /admin/mastery/* و /admin/attempts.
  { key: 'learning', items: [{ key: 'skills', to: adminPath('skills'), icon: 'skills' }, { key: 'objectives', to: adminPath('objectives'), icon: 'objectives' }, { key: 'mastery', to: adminPath('mastery'), icon: 'reviews' }, { key: 'translation', to: adminPath('translation'), icon: 'books' }, { key: 'quiz', to: adminPath('quiz'), icon: 'reviews' }, { key: 'school', to: adminPath('school'), icon: 'parents' }] },
  { key: 'app', items: [{ key: 'app-experience', to: adminPath('app-experience'), icon: 'dashboard' }, { key: 'remote-config', to: adminPath('remote-config'), icon: 'styles' }, { key: 'campaigns', to: adminPath('campaigns'), icon: 'bell' }, { key: 'recommendations', to: adminPath('recommendations'), icon: 'sparkles' }] },
  // devices كان معطَّلًا بلافتة «قريبًا» بينما DevicesAdminPage مبنية بالكامل
  // وتنادي /admin/devices العامل. الصفحة كانت تُفتح بكتابة المسار يدويًا فقط.
  { key: 'users', items: [{ key: 'parents', to: adminPath('parents'), icon: 'parents' }, { key: 'children', to: adminPath('children'), icon: 'children' }, { key: 'devices', to: adminPath('devices-admin'), icon: 'devices' }, { key: 'support-center', to: adminPath('support-center'), icon: 'search' }, { key: 'teams', to: adminPath('teams'), icon: 'parents' }, { key: 'roles', to: adminPath('roles'), icon: 'rights' }] },
  // reviews يبقى في مجموعته الحالية لا يُنقل: تغيير تصنيف القائمة قرار تصميم
  // لا يلزم لتشغيل الصفحة. كان معطَّلًا بلافتة «قريبًا» و/admin/content-reviews
  // جاهز، وهو المسار الذي يفرض فصل الإنشاء عن الاعتماد.
  { key: 'commerce', items: [{ key: 'subscriptions', to: adminPath('billing'), icon: 'subscriptions' }, { key: 'packages', to: adminPath('packages'), icon: 'subscriptions' }, { key: 'rights', to: adminPath('rights'), icon: 'rights' }, { key: 'reviews', to: adminPath('content-reviews'), icon: 'reviews' }, { key: 'revenue', to: adminPath('revenue'), icon: 'analytics' }, { key: 'finance-advanced', to: adminPath('finance-advanced'), icon: 'analytics' }] },
  { key: 'growth', items: [{ key: 'partnerships', to: adminPath('partnerships'), icon: 'link' }] },
  { key: 'platform', items: [
    { key: 'team-access', to: adminPath('team-access'), icon: 'parents' },
    // سجل التدقيق يُكتب من كل وحدة إدارة ولم يكن له قارئ. صلاحيته المستقلة
    // `view_audit_log` تجعله بابًا مقصورًا على من يملكها لا على كل موظف.
    { key: 'audit-logs', to: adminPath('audit-logs'), icon: 'reviews' },
    // أحداث العائلة الفاشلة: كل صفّ يعني إسقاط عائلة متأخّرًا عن حالتها
    // الحقيقية. المسارات بُنيت مع المهاجرة 0021 ولم يكن لها قارئ إلا بـcurl.
    { key: 'failed-events', to: adminPath('failed-events'), icon: 'refresh' },
    { key: 'settings', to: adminPath('settings'), icon: 'settings' },
  ] },
]

const copy: Record<Locale, {
  aria: string
  close: string
  center: string
  groups: Record<string, string>
  items: Record<string, string>
  soon: string
  tracks: string
  ages: string
  back: string
}> = {
  ar: {
    aria: 'التنقل الرئيسي', close: 'إغلاق القائمة', center: 'مركز إدارة المحتوى', soon: 'قريبًا',
    groups: { overview: 'نظرة عامة', content: 'إدارة المحتوى', learning: 'الإطار التعليمي', users: 'المستخدمون', commerce: 'التجارة والخصوصية', app: 'تجربة التطبيق', growth: 'النمو والشراكات', platform: 'إعدادات المنصّة' },
    items: { dashboard: 'لوحة التحكم', analytics: 'التحليلات', planets: 'الكواكب', series: 'السلاسل', seasons: 'المواسم', episodes: 'الحلقات والوحدات', characters: 'الشخصيات', books: 'القصص والكوميكس', media: 'مكتبة الوسائط', styles: 'الاستايلات البصرية', games: 'الكتب والألعاب والمشروعات', skills: 'خريطة المهارات', objectives: 'الأهداف القابلة للقياس', mastery: 'الإتقان والمحاولات', parents: 'أولياء الأمور', children: 'ملفات الأطفال', devices: 'الأجهزة والتنزيلات', subscriptions: 'الاشتراكات', rights: 'الحقوق والتراخيص', reviews: 'مراجعات المحتوى', teams: 'الفرق', roles: 'الأدوار', tasks: 'مهامي', 'app-experience': 'بناء الصفحة الرئيسية', 'remote-config': 'التحكم عن بعد', ops: 'المراقبة', search: 'البحث', campaigns: 'الحملات', revenue: 'الإيرادات', translation: 'الترجمة', quiz: 'بنك الأسئلة', recommendations: 'التوصيات', school: 'المدارس', 'finance-advanced': 'المالية المتقدمة', partnerships: 'طلبات الشراكة', settings: 'وضع الموقع', 'team-access': 'الموظفون والصلاحيات', workflows: 'سير العمل والاعتماد', 'ops-sla': 'مهل المراجعة والتكاملات', 'support-center': 'مركز الدعم', packages: 'الباقات والأسعار', 'audit-logs': 'سجل التدقيق', 'failed-events': 'الأحداث الفاشلة', narration: 'توليد السرد', quality: 'فحص الجاهزية', 'games-ops': 'عمليّات الألعاب', 'games-audio-queue': 'طابور الصوت', 'games-art-queue': 'طابور الرسوم' },
    tracks: '3 مسارات عمرية', ages: 'محتوى مناسب للأعمار 3–12', back: 'العودة للموقع',
  },
  en: {
    aria: 'Main navigation', close: 'Close menu', center: 'Content management center', soon: 'Soon',
    groups: { overview: 'Overview', content: 'Content management', learning: 'Learning framework', users: 'Users', commerce: 'Commerce & privacy', app: 'App Experience', growth: 'Growth & partnerships', platform: 'Platform settings' },
    items: { dashboard: 'Dashboard', analytics: 'Analytics', planets: 'Planets', series: 'Series', seasons: 'Seasons', episodes: 'Episodes & units', characters: 'Characters', books: 'Stories & comics', media: 'Media library', styles: 'Visual styles', games: 'Books, games & projects', skills: 'Skills map', objectives: 'Measurable objectives', mastery: 'Mastery & attempts', parents: 'Parents', children: 'Child profiles', devices: 'Devices & downloads', subscriptions: 'Subscriptions', rights: 'Rights & licensing', reviews: 'Content reviews', teams: 'Teams', roles: 'Roles', tasks: 'My Tasks', 'app-experience': 'Home Builder', 'remote-config': 'Remote Config', ops: 'Ops', search: 'Search', campaigns: 'Campaigns', revenue: 'Revenue', translation: 'Translation', quiz: 'Quiz Bank', recommendations: 'Recommendations', school: 'Schools', 'finance-advanced': 'Advanced Finance', partnerships: 'Partnership requests', settings: 'Site mode', 'team-access': 'Staff and permissions', workflows: 'Workflow & approvals', 'ops-sla': 'SLA & integrations', 'support-center': 'Support centre', packages: 'Plans & pricing', 'audit-logs': 'Audit log', 'failed-events': 'Failed events', narration: 'Narration', quality: 'Readiness check', 'games-ops': 'Games operations', 'games-audio-queue': 'Voice-over queue', 'games-art-queue': 'Art queue' },
    tracks: '3 age tracks', ages: 'Age-appropriate content for 3–12', back: 'Back to website',
  },
}

export function Sidebar() {
  const { locale, menuOpen, setMenuOpen } = usePreferences()
  const text = copy[locale]

  return (
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label={text.aria}>
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true"><img src={logo} alt="" /></span>
        <div><strong>مجرة</strong><small>MAJARRA CMS</small></div>
        <button className="icon-button sidebar__close" type="button" onClick={() => setMenuOpen(false)} aria-label={text.close}><Icon name="close" /></button>
      </div>

      <nav className="sidebar__nav">
        {groups.map((group) => (
          <div className="nav-group" key={group.key}>
            <div className="nav-group__label">{text.groups[group.key]}</div>
            {group.items.map((item) => item.to ? (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
              >
                <Icon name={item.icon} size={18} />
                <span>{text.items[item.key]}</span>
              </NavLink>
            ) : (
              <div className="nav-link nav-link--soon" aria-disabled="true" title={text.soon} key={item.key}>
                <Icon name={item.icon} size={18} />
                <span>{text.items[item.key]}</span>
                <small>{text.soon}</small>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar-note">
          <span className="sidebar-note__icon"><Icon name="sparkles" size={18} /></span>
          <div><strong>{text.tracks}</strong><small>{text.ages}</small></div>
        </div>
        <NavLink className="back-link" to="/" onClick={() => setMenuOpen(false)}><Icon name="logout" size={18} /><span>{text.back}</span></NavLink>
      </div>
    </aside>
  )
}
