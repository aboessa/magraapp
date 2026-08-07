import { NavLink } from 'react-router-dom'
import logo from '../assets/majarra-logo.webp'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'

type NavItem = { key: string; to?: string; icon: IconName; end?: boolean }
type NavGroup = { key: string; items: NavItem[] }

const groups: NavGroup[] = [
  { key: 'overview', items: [{ key: 'dashboard', to: '/admin', icon: 'dashboard', end: true }, { key: 'analytics', to: '/admin/analytics', icon: 'analytics' }, { key: 'tasks', to: '/admin/tasks', icon: 'reviews' }, { key: 'ops', to: '/admin/ops', icon: 'analytics' }] },
  { key: 'content', items: [
    { key: 'planets', to: '/admin/taxonomy', icon: 'planets' },
    { key: 'series', to: '/admin/series', icon: 'series' },
    { key: 'seasons', to: '/admin/seasons', icon: 'seasons' },
    { key: 'episodes', to: '/admin/episodes', icon: 'episodes' },
    { key: 'characters', to: '/admin/characters', icon: 'characters' },
    { key: 'books', to: '/admin/stories', icon: 'books' },
    { key: 'media', to: '/admin/media', icon: 'media' },
    { key: 'styles', to: '/admin/visual-styles', icon: 'styles' },
    { key: 'games', to: '/admin/library-content', icon: 'games' },
  ] },
  { key: 'learning', items: [{ key: 'skills', icon: 'skills' }, { key: 'objectives', icon: 'objectives' }, { key: 'mastery', icon: 'reviews' }, { key: 'translation', to: '/admin/translation', icon: 'books' }, { key: 'quiz', to: '/admin/quiz', icon: 'reviews' }, { key: 'school', to: '/admin/school', icon: 'parents' }] },
  { key: 'app', items: [{ key: 'app-experience', to: '/admin/app-experience', icon: 'dashboard' }, { key: 'remote-config', to: '/admin/remote-config', icon: 'styles' }, { key: 'search', to: '/admin/search', icon: 'search' }, { key: 'campaigns', to: '/admin/campaigns', icon: 'bell' }, { key: 'recommendations', to: '/admin/recommendations', icon: 'sparkles' }] },
  { key: 'users', items: [{ key: 'parents', to: '/admin/parents', icon: 'parents' }, { key: 'children', to: '/admin/children', icon: 'children' }, { key: 'devices', icon: 'devices' }, { key: 'teams', to: '/admin/teams', icon: 'parents' }, { key: 'roles', to: '/admin/roles', icon: 'rights' }] },
  { key: 'commerce', items: [{ key: 'subscriptions', to: '/admin/billing', icon: 'subscriptions' }, { key: 'rights', to: '/admin/rights', icon: 'rights' }, { key: 'reviews', icon: 'reviews' }, { key: 'revenue', to: '/admin/revenue', icon: 'analytics' }, { key: 'finance-advanced', to: '/admin/finance-advanced', icon: 'analytics' }] },
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
    groups: { overview: 'نظرة عامة', content: 'إدارة المحتوى', learning: 'الإطار التعليمي', users: 'المستخدمون', commerce: 'التجارة والخصوصية', app: 'تجربة التطبيق' },
    items: { dashboard: 'لوحة التحكم', analytics: 'التحليلات', planets: 'الكواكب والتصنيفات', series: 'السلاسل', seasons: 'المواسم', episodes: 'الحلقات والوحدات', characters: 'الشخصيات', books: 'القصص والكوميكس', media: 'مكتبة الوسائط', styles: 'الاستايلات البصرية', games: 'الكتب والألعاب والمشروعات', skills: 'خريطة المهارات', objectives: 'الأهداف القابلة للقياس', mastery: 'الإتقان والمحاولات', parents: 'أولياء الأمور', children: 'ملفات الأطفال', devices: 'الأجهزة والتنزيلات', subscriptions: 'الاشتراكات', rights: 'الحقوق والتراخيص', reviews: 'مراجعات المحتوى', teams: 'الفرق', roles: 'الأدوار', tasks: 'مهامي', 'app-experience': 'بناء الصفحة الرئيسية', 'remote-config': 'التحكم عن بعد', ops: 'المراقبة', search: 'البحث', campaigns: 'الحملات', revenue: 'الإيرادات', translation: 'الترجمة', quiz: 'بنك الأسئلة', recommendations: 'التوصيات', school: 'المدارس', 'finance-advanced': 'المالية المتقدمة' },
    tracks: '3 مسارات عمرية', ages: 'محتوى مناسب للأعمار 3–12', back: 'العودة للموقع',
  },
  en: {
    aria: 'Main navigation', close: 'Close menu', center: 'Content management center', soon: 'Soon',
    groups: { overview: 'Overview', content: 'Content management', learning: 'Learning framework', users: 'Users', commerce: 'Commerce & privacy', app: 'App Experience' },
    items: { dashboard: 'Dashboard', analytics: 'Analytics', planets: 'Planets & taxonomy', series: 'Series', seasons: 'Seasons', episodes: 'Episodes & units', characters: 'Characters', books: 'Stories & comics', media: 'Media library', styles: 'Visual styles', games: 'Books, games & projects', skills: 'Skills map', objectives: 'Measurable objectives', mastery: 'Mastery & attempts', parents: 'Parents', children: 'Child profiles', devices: 'Devices & downloads', subscriptions: 'Subscriptions', rights: 'Rights & licensing', reviews: 'Content reviews', teams: 'Teams', roles: 'Roles', tasks: 'My Tasks', 'app-experience': 'Home Builder', 'remote-config': 'Remote Config', ops: 'Ops', search: 'Search', campaigns: 'Campaigns', revenue: 'Revenue', translation: 'Translation', quiz: 'Quiz Bank', recommendations: 'Recommendations', school: 'Schools', 'finance-advanced': 'Advanced Finance' },
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
