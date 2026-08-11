import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '../assets/majarra-logo.webp'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { adminPath } from '../lib/adminPath'
import { hasPermission } from '../lib/adminSession'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

/**
 * تنقّل اللوحة: أحد عشر مجموعة منطقية، ومرئيّة حسب الصلاحية.
 *
 * ## ما تغيّر
 *
 * كانت المجموعات تسعًا وتُخفي علاقات حقيقية: «مركز الإنتاج» و«سير العمل»
 * و«فحص الجاهزية» و«طوابير الصوت والرسوم» موزّعة بين «نظرة عامة» و«إدارة
 * المحتوى»، وهي كلها خطّ إنتاج واحد. و«المدارس» كانت داخل «الإطار التعليمي»
 * وهي كتلة B2B لا علاقة لها بالمهارات والأهداف. والأهم: كل عنصر كان يظهر لكل
 * موظّف، فيرى مراجعُ المحتوى «الأدوار والصلاحيات» و«سجل التدقيق» ثم يصطدم
 * بـ403.
 *
 * ## الرؤية تتبع حرس الخادم
 *
 * الصلاحية المكتوبة على كل عنصر هي **نفس** الصلاحية التي يفرضها المسار في
 * الخادم. لا صلاحية مخترعة هنا: عنصر يُخفى بقاعدة لا يفرضها الخادم يعني بابًا
 * مغلقًا في الواجهة ومفتوحًا بـcurl، وهو أسوأ من إظهاره.
 *
 * الإخفاء عرضيّ لا أمني — الخادم يرفض على أي حال — لكنه يمنع رحلة تنتهي بـ403.
 *
 * ## المجموعات قابلة للطيّ ويُحفظ اختيارها
 *
 * أحد عشر مجموعة مفتوحة كلها تعني تمريرًا طويلًا. حالة الطيّ في `localStorage`
 * لأنها تفضيل عرض لا بيانات.
 */

type NavItem = {
  key: string
  to: string
  icon: IconName
  end?: boolean
  /// الصلاحية التي يفرضها الخادم على هذا المسار، أو undefined لما هو مفتوح لكل مسؤول.
  permission?: string
}
type NavGroup = { key: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', to: adminPath(), icon: 'dashboard', end: true },
      { key: 'calendar', to: adminPath('calendar'), icon: 'calendar' },
      { key: 'analytics', to: adminPath('analytics'), icon: 'analytics' },
      { key: 'tasks', to: adminPath('tasks'), icon: 'reviews' },
    ],
  },
  {
    key: 'content',
    items: [
      { key: 'planets', to: adminPath('planets'), icon: 'planets' },
      { key: 'taxonomy', to: adminPath('taxonomy'), icon: 'tree' },
      { key: 'series', to: adminPath('series'), icon: 'series' },
      { key: 'seasons', to: adminPath('seasons'), icon: 'seasons' },
      { key: 'episodes', to: adminPath('episodes'), icon: 'episodes' },
      { key: 'characters', to: adminPath('characters'), icon: 'characters' },
      { key: 'library', to: adminPath('library'), icon: 'books' },
      { key: 'stories', to: adminPath('stories'), icon: 'books' },
      { key: 'books', to: adminPath('books'), icon: 'books' },
      { key: 'games', to: adminPath('games'), icon: 'games' },
      { key: 'projects', to: adminPath('projects'), icon: 'objectives' },
      { key: 'media', to: adminPath('media'), icon: 'media' },
      { key: 'styles', to: adminPath('visual-styles'), icon: 'styles' },
    ],
  },
  {
    // خطّ الإنتاج كاملًا في مكان واحد: كان موزّعًا بين «نظرة عامة» و«المحتوى».
    key: 'production',
    items: [
      { key: 'production', to: adminPath('production'), icon: 'reviews' },
      { key: 'workflows', to: adminPath('workflows'), icon: 'reviews' },
      { key: 'reviews', to: adminPath('content-reviews'), icon: 'reviews' },
      { key: 'quality', to: adminPath('quality'), icon: 'check' },
      { key: 'narration', to: adminPath('narration'), icon: 'play', permission: 'upload_audio' },
      { key: 'games-ops', to: adminPath('games-ops'), icon: 'analytics' },
      { key: 'games-audio-queue', to: adminPath('games-audio-queue'), icon: 'play' },
      { key: 'games-art-queue', to: adminPath('games-art-queue'), icon: 'media' },
    ],
  },
  {
    key: 'learning',
    items: [
      { key: 'skills', to: adminPath('skills'), icon: 'skills' },
      { key: 'objectives', to: adminPath('objectives'), icon: 'objectives' },
      { key: 'mastery', to: adminPath('mastery'), icon: 'reviews' },
      { key: 'quiz', to: adminPath('quiz'), icon: 'reviews' },
      { key: 'translation', to: adminPath('translation'), icon: 'text' },
    ],
  },
  {
    key: 'customers',
    items: [
      { key: 'customers', to: adminPath('customers'), icon: 'parents' },
      { key: 'parents', to: adminPath('parents'), icon: 'parents' },
      { key: 'children', to: adminPath('children'), icon: 'children' },
      { key: 'devices', to: adminPath('devices-admin'), icon: 'devices' },
      { key: 'support-center', to: adminPath('support-center'), icon: 'bell' },
    ],
  },
  {
    key: 'commercial',
    items: [
      { key: 'subscriptions', to: adminPath('billing'), icon: 'subscriptions' },
      { key: 'packages', to: adminPath('packages'), icon: 'subscriptions' },
      { key: 'rights', to: adminPath('rights'), icon: 'rights' },
      { key: 'revenue', to: adminPath('revenue'), icon: 'analytics' },
      { key: 'finance-advanced', to: adminPath('finance-advanced'), icon: 'analytics' },
    ],
  },
  {
    key: 'growth',
    items: [
      { key: 'website-pages', to: adminPath('website/pages'), icon: 'website' },
      { key: 'blog-posts', to: adminPath('blog/posts'), icon: 'blog' },
      { key: 'blog-taxonomy', to: adminPath('blog/taxonomy'), icon: 'objectives' },
      { key: 'seo', to: adminPath('seo'), icon: 'seo' },
      { key: 'campaigns', to: adminPath('campaigns'), icon: 'bell' },
      { key: 'partnerships', to: adminPath('partnerships'), icon: 'link' },
    ],
  },
  {
    // كتلة B2B مستقلّة: كانت «المدارس» داخل الإطار التعليمي بلا علاقة به.
    key: 'b2b',
    items: [
      { key: 'school', to: adminPath('school'), icon: 'parents' },
    ],
  },
  {
    key: 'appControl',
    items: [
      { key: 'app-experience', to: adminPath('app-experience'), icon: 'dashboard' },
      { key: 'recommendations', to: adminPath('recommendations'), icon: 'sparkles' },
      { key: 'remote-config', to: adminPath('remote-config'), icon: 'styles', permission: 'publish' },
      { key: 'settings', to: adminPath('settings'), icon: 'settings', permission: 'publish' },
    ],
  },
  {
    key: 'operations',
    items: [
      { key: 'ops', to: adminPath('ops'), icon: 'analytics' },
      { key: 'ops-sla', to: adminPath('ops-sla'), icon: 'clock' },
      { key: 'failed-events', to: adminPath('failed-events'), icon: 'refresh', permission: 'publish' },
    ],
  },
  {
    key: 'administration',
    items: [
      { key: 'team-access', to: adminPath('team-access'), icon: 'parents', permission: 'manage_permissions' },
      { key: 'teams', to: adminPath('teams'), icon: 'parents', permission: 'manage_team' },
      { key: 'roles', to: adminPath('roles'), icon: 'rights', permission: 'manage_permissions' },
      { key: 'audit-logs', to: adminPath('audit-logs'), icon: 'reviews', permission: 'view_audit_log' },
    ],
  },
]

const copy: Record<Locale, {
  aria: string
  close: string
  groups: Record<string, string>
  items: Record<string, string>
  tracks: string
  ages: string
  back: string
  collapse: string
}> = {
  ar: {
    aria: 'التنقل الرئيسي', close: 'إغلاق القائمة', collapse: 'طيّ المجموعة',
    groups: {
      overview: 'نظرة عامة', content: 'المحتوى', production: 'الإنتاج',
      learning: 'الإطار التعليمي', customers: 'العملاء', commercial: 'التجارة',
      growth: 'النمو والموقع', b2b: 'الأعمال', appControl: 'التحكّم في التطبيق',
      operations: 'التشغيل', administration: 'الإدارة',
    },
    items: { dashboard: 'لوحة التحكم', calendar: 'تقويم المحتوى', analytics: 'التحليلات', planets: 'الكواكب', taxonomy: 'الكواكب والتصنيفات', series: 'السلاسل', seasons: 'المواسم', episodes: 'الحلقات والوحدات', characters: 'الشخصيات', library: 'مكتبة المحتوى', stories: 'القصص والكوميكس', books: 'الكتب', games: 'الألعاب', projects: 'المشروعات', media: 'مكتبة الوسائط', styles: 'الاستايلات البصرية', skills: 'خريطة المهارات', objectives: 'الأهداف القابلة للقياس', mastery: 'الإتقان والمحاولات', parents: 'أولياء الأمور', customers: 'ملف العميل 360', children: 'ملفات الأطفال', devices: 'الأجهزة والتنزيلات', subscriptions: 'الاشتراكات', rights: 'الحقوق والتراخيص', reviews: 'مراجعات المحتوى', teams: 'الفرق', roles: 'الأدوار', tasks: 'مهامي', production: 'مركز الإنتاج', 'app-experience': 'بناء الصفحة الرئيسية', 'remote-config': 'التحكم عن بعد', ops: 'المراقبة', campaigns: 'الحملات', revenue: 'الإيرادات', translation: 'الترجمة', quiz: 'بنك الأسئلة', recommendations: 'التوصيات', school: 'المدارس', 'finance-advanced': 'المالية المتقدمة', partnerships: 'طلبات الشراكة', settings: 'وضع الموقع', 'team-access': 'الموظفون والصلاحيات', workflows: 'سير العمل والاعتماد', 'ops-sla': 'مهل المراجعة والتكاملات', 'support-center': 'مركز الدعم', packages: 'الباقات والأسعار', 'audit-logs': 'سجل التدقيق', 'failed-events': 'الأحداث الفاشلة', narration: 'توليد السرد', quality: 'فحص الجاهزية', 'games-ops': 'عمليّات الألعاب', 'games-audio-queue': 'طابور الصوت', 'games-art-queue': 'طابور الرسوم', 'website-pages': 'صفحات الموقع', 'blog-posts': 'مقالات المدوّنة', 'blog-taxonomy': 'كُتّاب وتصنيفات', seo: 'عمليّات SEO' },
    tracks: '3 مسارات عمرية', ages: 'محتوى مناسب للأعمار 3–12', back: 'العودة للموقع',
  },
  en: {
    aria: 'Main navigation', close: 'Close menu', collapse: 'Collapse group',
    groups: {
      overview: 'Overview', content: 'Content', production: 'Production',
      learning: 'Learning framework', customers: 'Customers', commercial: 'Commercial',
      growth: 'Growth & website', b2b: 'B2B', appControl: 'App control',
      operations: 'Operations', administration: 'Administration',
    },
    items: { dashboard: 'Dashboard', calendar: 'Content calendar', analytics: 'Analytics', planets: 'Planets', taxonomy: 'Planets & taxonomy', series: 'Series', seasons: 'Seasons', episodes: 'Episodes & units', characters: 'Characters', library: 'Content library', stories: 'Stories & comics', books: 'Books', games: 'Games', projects: 'Projects', media: 'Media library', styles: 'Visual styles', skills: 'Skills map', objectives: 'Measurable objectives', mastery: 'Mastery & attempts', parents: 'Parents', customers: 'Customer 360', children: 'Child profiles', devices: 'Devices & downloads', subscriptions: 'Subscriptions', rights: 'Rights & licensing', reviews: 'Content reviews', teams: 'Teams', roles: 'Roles', tasks: 'My Tasks', production: 'Production centre', 'app-experience': 'Home Builder', 'remote-config': 'Remote Config', ops: 'Ops', campaigns: 'Campaigns', revenue: 'Revenue', translation: 'Translation', quiz: 'Quiz Bank', recommendations: 'Recommendations', school: 'Schools', 'finance-advanced': 'Advanced Finance', partnerships: 'Partnership requests', settings: 'Site mode', 'team-access': 'Staff and permissions', workflows: 'Workflow & approvals', 'ops-sla': 'SLA & integrations', 'support-center': 'Support centre', packages: 'Plans & pricing', 'audit-logs': 'Audit log', 'failed-events': 'Failed events', narration: 'Narration', quality: 'Readiness check', 'games-ops': 'Games operations', 'games-audio-queue': 'Voice-over queue', 'games-art-queue': 'Art queue', 'website-pages': 'Website pages', 'blog-posts': 'Blog posts', 'blog-taxonomy': 'Authors & categories', seo: 'SEO operations' },
    tracks: '3 age tracks', ages: 'Age-appropriate content for 3–12', back: 'Back to website',
  },
}

const COLLAPSE_KEY = 'majarra-admin-nav-collapsed'

function readCollapsed(): string[] {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function Sidebar() {
  const { locale, menuOpen, setMenuOpen } = usePreferences()
  const text = copy[locale]
  const [collapsed, setCollapsed] = useState<string[]>(() => readCollapsed())

  // تُحسب مرة: الصلاحيات تأتي من الجلسة المحفوظة ولا تتغيّر أثناء الجلسة.
  const visibleGroups = useMemo(
    () => groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
      }))
      // مجموعة فرغت بالكامل لا تُرسم: عنوان مجموعة بلا عناصر يقول للمستخدم إن
      // هناك شيئًا مخفيًّا عنه بلا أن يقول ما هو.
      .filter((group) => group.items.length > 0),
    [],
  )

  const toggle = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((item) => item !== key) : [...collapsed, key]
    setCollapsed(next)
    try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)) } catch { /* تفضيل عرض */ }
  }

  return (
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label={text.aria}>
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true"><img src={logo} alt="" /></span>
        <div><strong>مجرة</strong><small>MAJARRA CMS</small></div>
        <button className="icon-button sidebar__close" type="button" onClick={() => setMenuOpen(false)} aria-label={text.close}><Icon name="close" /></button>
      </div>

      <nav className="sidebar__nav">
        {visibleGroups.map((group) => {
          const isCollapsed = collapsed.includes(group.key)
          return (
            <div className="nav-group" key={group.key}>
              <button
                type="button"
                className="nav-group__label nav-group__label--button"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(group.key)}
              >
                <span>{text.groups[group.key]}</span>
                <Icon name="arrow" size={12} />
              </button>
              {!isCollapsed && group.items.map((item) => (
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
              ))}
            </div>
          )
        })}
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
