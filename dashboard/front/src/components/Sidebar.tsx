import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '../assets/majarra-logo.webp'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { ADMIN_BASE, adminPath } from '../lib/adminPath'
import { hasPermission } from '../lib/adminSession'
import { permissionForPath } from '../lib/routePermissions'
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
    key: 'drawing',
    items: [
      { key: 'drawing-coloring', to: adminPath('creative-studio/coloring'), icon: 'styles' },
      { key: 'drawing-draw-like-me', to: adminPath('creative-studio/draw-like-me'), icon: 'sparkles' },
      { key: 'drawing-connect-dots', to: adminPath('creative-studio/connect-dots'), icon: 'tree' },
      { key: 'drawing-complete', to: adminPath('creative-studio/complete'), icon: 'objectives' },
      { key: 'drawing-trace', to: adminPath('creative-studio/trace'), icon: 'text' },
      { key: 'drawing-copy-pattern', to: adminPath('creative-studio/copy-pattern'), icon: 'games' },
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
      { key: 'content-factory', to: adminPath('production/factory'), icon: 'sparkles' },
      { key: 'workflows', to: adminPath('workflows'), icon: 'reviews' },
      { key: 'reviews', to: adminPath('content-reviews'), icon: 'reviews' },
      { key: 'quality', to: adminPath('quality'), icon: 'check' },
      { key: 'narration', to: adminPath('narration'), icon: 'play' },
      // نفس الصلاحية التي يفرضها الخادم على كتابات `/admin/ai/*` حرفيًّا.
      { key: 'ai-providers', to: adminPath('ai-providers'), icon: 'sparkles' },
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
      // `ADM-101`: قيود الإتاحة الجغرافية. تحريرها في تبويب العنصر (حيث تظهر
      // سلسلة الوراثة)، وهذه القائمة تُجيب السؤال المعاكس: ما المحجوب وأين.
      { key: 'availability', to: adminPath('availability'), icon: 'globe' },
      { key: 'revenue', to: adminPath('revenue'), icon: 'analytics' },
      { key: 'finance-advanced', to: adminPath('finance-advanced'), icon: 'analytics' },
    ],
  },
  {
    key: 'growth',
    items: [
      { key: 'website-pages', to: adminPath('website/pages'), icon: 'website' },
      { key: 'website-mode', to: adminPath('website/mode'), icon: 'globe' },
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
    // CONTROL IN APP — App Home / Recommendations / Remote Config / Feature Flags
    key: 'appControl',
    items: [
      { key: 'app-experience', to: adminPath('app-experience'), icon: 'dashboard' },
      { key: 'recommendations', to: adminPath('recommendations'), icon: 'sparkles' },
      { key: 'remote-config', to: adminPath('remote-config'), icon: 'styles' },
      { key: 'feature-flags', to: adminPath('remote-config'), icon: 'check' },
      { key: 'app-releases', to: adminPath('app-releases'), icon: 'devices' },
      { key: 'app-diagnostics', to: adminPath('app-diagnostics'), icon: 'analytics' },
    ],
  },
  {
    // ADMIN / MY ACCOUNT — Profile / Password / Sessions / Security
    key: 'myAccount',
    items: [
      { key: 'my-account', to: adminPath('my-account'), icon: 'parents' },
      { key: 'security', to: adminPath('security'), icon: 'rights' },
      { key: 'sessions', to: adminPath('sessions'), icon: 'clock' },
    ],
  },
  {
    key: 'operations',
    items: [
      { key: 'ops', to: adminPath('ops'), icon: 'analytics' },
      { key: 'ops-sla', to: adminPath('ops-sla'), icon: 'clock' },
      { key: 'failed-events', to: adminPath('failed-events'), icon: 'refresh' },
    ],
  },
  {
    key: 'administration',
    items: [
      { key: 'team-access', to: adminPath('team-access'), icon: 'parents' },
      { key: 'teams', to: adminPath('teams'), icon: 'parents' },
      { key: 'roles', to: adminPath('roles'), icon: 'rights' },
      { key: 'grants', to: adminPath('grants'), icon: 'rights' },
      { key: 'governance', to: adminPath('governance'), icon: 'analytics' },
      { key: 'audit-logs', to: adminPath('audit-logs'), icon: 'reviews' },
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
      overview: 'نظرة عامة', drawing: 'الرسم', content: 'المحتوى', production: 'الإنتاج',
      learning: 'الإطار التعليمي', customers: 'العملاء', commercial: 'التجارة',
      growth: 'النمو والموقع', b2b: 'الأعمال', appControl: 'التحكّم في التطبيق',
      myAccount: 'حسابي', operations: 'التشغيل', administration: 'الإدارة',
    },
    items: { dashboard: 'لوحة التحكم', calendar: 'تقويم المحتوى', analytics: 'التحليلات', planets: 'الكواكب', taxonomy: 'الكواكب والتصنيفات', series: 'السلاسل', seasons: 'المواسم', episodes: 'الحلقات والوحدات', characters: 'الشخصيات', library: 'مكتبة المحتوى', stories: 'القصص والكوميكس', books: 'الكتب', games: 'الألعاب', 'creative-studio': 'استوديو الإبداع', 'drawing-coloring': 'تلوين', 'drawing-draw-like-me': 'ارسم مثلي', 'drawing-connect-dots': 'وصل النقاط', 'drawing-complete': 'أكمل الرسمة', 'drawing-trace': 'تتبع', 'drawing-copy-pattern': 'انسخ النمط', projects: 'المشروعات', media: 'مكتبة الوسائط', styles: 'الاستايلات البصرية', skills: 'خريطة المهارات', objectives: 'الأهداف القابلة للقياس', mastery: 'الإتقان والمحاولات', parents: 'أولياء الأمور', customers: 'ملف العميل 360', children: 'ملفات الأطفال', devices: 'الأجهزة والتنزيلات', subscriptions: 'الاشتراكات', rights: 'الحقوق والتراخيص', availability: 'قيود الإتاحة', reviews: 'مراجعات المحتوى', teams: 'الفرق', roles: 'الأدوار', grants: 'المنح', governance: 'حوكمة الوصول', tasks: 'مهامي', production: 'مركز الإنتاج', 'content-factory': 'مصنع المحتوى', 'app-experience': 'بناء الصفحة الرئيسية', 'remote-config': 'التحكم عن بعد', 'feature-flags': 'أعلام الميزات', 'app-releases': 'إصدارات التطبيق', 'app-diagnostics': 'تشخيص التطبيق', 'my-account': 'حسابي', security: 'الأمان', sessions: 'الجلسات', 'website-mode': 'وضع الموقع', ops: 'المراقبة', campaigns: 'الحملات', revenue: 'الإيرادات', translation: 'الترجمة', quiz: 'بنك الأسئلة', recommendations: 'التوصيات', school: 'المدارس', 'finance-advanced': 'المالية المتقدمة', partnerships: 'طلبات الشراكة', settings: 'الإعدادات', 'team-access': 'الموظفون والصلاحيات', workflows: 'سير العمل والاعتماد', 'ops-sla': 'مهل المراجعة والتكاملات', 'support-center': 'مركز الدعم', packages: 'الباقات والأسعار', 'audit-logs': 'سجل التدقيق', 'failed-events': 'الأحداث الفاشلة', narration: 'توليد السرد', 'ai-providers': 'مزوّدو الذكاء الاصطناعي', quality: 'فحص الجاهزية', 'games-ops': 'عمليّات الألعاب', 'games-audio-queue': 'طابور الصوت', 'games-art-queue': 'طابور الرسوم', 'website-pages': 'صفحات الموقع', 'blog-posts': 'مقالات المدوّنة', 'blog-taxonomy': 'كُتّاب وتصنيفات', seo: 'عمليّات SEO' },
    tracks: '3 مسارات عمرية', ages: 'محتوى مناسب للأعمار 3–12', back: 'العودة للموقع',
  },
  en: {
    aria: 'Main navigation', close: 'Close menu', collapse: 'Collapse group',
    groups: {
      overview: 'Overview', drawing: 'Drawing', content: 'Content', production: 'Production',
      learning: 'Learning framework', customers: 'Customers', commercial: 'Commercial',
      growth: 'Growth & website', b2b: 'B2B', appControl: 'App control',
      myAccount: 'My account', operations: 'Operations', administration: 'Administration',
    },
    items: { dashboard: 'Dashboard', calendar: 'Content calendar', analytics: 'Analytics', planets: 'Planets', taxonomy: 'Planets & taxonomy', series: 'Series', seasons: 'Seasons', episodes: 'Episodes & units', characters: 'Characters', library: 'Content library', stories: 'Stories & comics', books: 'Books', games: 'Games', 'creative-studio': 'Creative Studio', 'drawing-coloring': 'Coloring', 'drawing-draw-like-me': 'Draw Like Me', 'drawing-connect-dots': 'Connect Dots', 'drawing-complete': 'Complete', 'drawing-trace': 'Trace', 'drawing-copy-pattern': 'Copy Pattern', projects: 'Projects', media: 'Media library', styles: 'Visual styles', skills: 'Skills map', objectives: 'Measurable objectives', mastery: 'Mastery & attempts', parents: 'Parents', customers: 'Customer 360', children: 'Child profiles', devices: 'Devices & downloads', subscriptions: 'Subscriptions', rights: 'Rights & licensing', availability: 'Territory restrictions', reviews: 'Content reviews', teams: 'Teams', roles: 'Roles', grants: 'Grants', governance: 'Governance', tasks: 'My Tasks', production: 'Production centre', 'content-factory': 'Content factory', 'app-experience': 'Home Builder', 'remote-config': 'Remote Config', 'feature-flags': 'Feature flags', 'app-releases': 'App releases', 'app-diagnostics': 'App diagnostics', 'my-account': 'My account', security: 'Security', sessions: 'Sessions', 'website-mode': 'Website mode', ops: 'Ops', campaigns: 'Campaigns', revenue: 'Revenue', translation: 'Translation', quiz: 'Quiz Bank', recommendations: 'Recommendations', school: 'Schools', 'finance-advanced': 'Advanced Finance', partnerships: 'Partnership requests', settings: 'Settings', 'team-access': 'Staff and permissions', workflows: 'Workflow & approvals', 'ops-sla': 'SLA & integrations', 'support-center': 'Support centre', packages: 'Plans & pricing', 'audit-logs': 'Audit log', 'failed-events': 'Failed events', narration: 'Narration', 'ai-providers': 'AI providers', quality: 'Readiness check', 'games-ops': 'Games operations', 'games-audio-queue': 'Voice-over queue', 'games-art-queue': 'Art queue', 'website-pages': 'Website pages', 'blog-posts': 'Blog posts', 'blog-taxonomy': 'Authors & categories', seo: 'SEO operations' },
    tracks: '3 age tracks', ages: 'Age-appropriate content for 3–12', back: 'Back to website',
  },
}

const COLLAPSE_KEY = 'majarra-admin-nav-collapsed'

const DRAWING_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    'drawing-coloring': 'تلوين',
    'drawing-draw-like-me': 'ارسم مثلي',
    'drawing-connect-dots': 'وصل النقاط',
    'drawing-complete': 'أكمل الرسمة',
    'drawing-trace': 'تتبع',
    'drawing-copy-pattern': 'انسخ النمط',
  },
  en: {
    'drawing-coloring': 'Coloring',
    'drawing-draw-like-me': 'Draw Like Me',
    'drawing-connect-dots': 'Connect Dots',
    'drawing-complete': 'Complete',
    'drawing-trace': 'Trace',
    'drawing-copy-pattern': 'Copy Pattern',
  },
}

function readCollapsed(): string[] {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function navigationLabel(label: string | undefined) {
  return (label ?? '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

export function Sidebar() {
  const { locale, menuOpen, setMenuOpen } = usePreferences()
  const text = copy[locale]
  const [collapsed, setCollapsed] = useState<string[]>(() => readCollapsed())
  const [search, setSearch] = useState('')

  // تُحسب مرة: الصلاحيات تأتي من الجلسة المحفوظة ولا تتغيّر أثناء الجلسة.
  //
  // الصلاحية **مشتقّة من `ROUTE_PERMISSIONS`** لا مكتوبة على كل عنصر. كانت
  // مكتوبة، فصارت قائمة ثانية تُصان بيدٍ وخالفت الأولى في خمسة مواضع: عنصرٌ
  // مخفيّ ومساره مفتوح، أو ظاهرٌ ومساره سيُحجَب. الاشتقاق يجعل «القائمة تعكس
  // الصلاحيات» صحيحًا بالبناء لا بالمواظبة.
  const visibleGroups = useMemo(
    () => groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const required = permissionForPath(item.to.replace(ADMIN_BASE, ''))
          return !required || hasPermission(required)
        }),
      }))
      .filter((group) => group.items.length > 0),
    [],
  )

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return visibleGroups
    const q = search.trim().toLowerCase()
    return visibleGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          const label = (DRAWING_LABELS[locale][item.key] ?? text.items[item.key] ?? item.key).toLowerCase()
          const groupLabel = (text.groups[g.key] ?? g.key).toLowerCase()
          return label.includes(q) || groupLabel.includes(q) || item.key.toLowerCase().includes(q)
        }),
      }))
      .filter((g) => g.items.length > 0)
  }, [visibleGroups, search, locale, text.groups, text.items])

  const toggle = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((item) => item !== key) : [...collapsed, key]
    setCollapsed(next)
    try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)) } catch { /* تفضيل عرض */ }
  }

  return (
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label={text.aria}>
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true"><img src={logo} alt="" /></span>
        <div><strong>مجرة</strong><small>MAJARRA • OS</small></div>
        <button className="icon-button sidebar__close" type="button" onClick={() => setMenuOpen(false)} aria-label={text.close}><Icon name="close" /></button>
      </div>

      <div className="sidebar-search">
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === 'ar' ? 'ابحث في القائمة…' : 'Search menu…'}
          aria-label={locale === 'ar' ? 'بحث في القائمة' : 'Search navigation'}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'transparent', border:0, color:'var(--muted)', cursor:'pointer', padding:4 }}
            aria-label={locale==='ar'?'مسح':'Clear'}
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>

      <nav className="sidebar__nav">
        {filteredGroups.map((group) => {
          const isCollapsed = collapsed.includes(group.key) && !search.trim()
          return (
            <div className="nav-group" key={group.key}>
              <button
                type="button"
                className="nav-group__label nav-group__label--button"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(group.key)}
              >
                <span>{text.groups[group.key]}</span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:10, opacity:.6, fontWeight:600, minWidth:18, textAlign:'center', background:'rgba(255,255,255,0.06)', borderRadius:6, padding:'1px 5px' }}>{group.items.length}</span>
                  <Icon name="arrow" size={12} />
                </span>
              </button>
              <div className="nav-group__content" data-collapsed={isCollapsed ? 'true' : 'false'}>
                <div>
                  {group.items.map((item, idx) => (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                      style={{ animationDelay: `${idx * 18 + 40}ms` } as any}
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{DRAWING_LABELS[locale][item.key] ?? navigationLabel(text.items[item.key])}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {filteredGroups.length===0 && (
          <div style={{ padding:'24px 16px', textAlign:'center', color:'var(--muted)', fontSize:12 }}>
            <Icon name="search" size={18} />
            <div style={{ marginTop:8 }}>{locale==='ar'?'لا نتائج مطابقة':'No matching items'}</div>
            <button className="button button--ghost button--small" style={{ marginTop:8 }} onClick={()=> setSearch('')}>{locale==='ar'?'مسح البحث':'Clear search'}</button>
          </div>
        )}
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
