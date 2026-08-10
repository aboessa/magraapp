import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { adminPath } from '../lib/adminPath'
import { api } from '../lib/api'
import { hasPermission } from '../lib/adminSession'
import { usePreferences } from '../context/preferences'
import type { Locale } from '../context/preferences'
import type { GlobalSearch, GlobalSearchResult } from '../types/api'

/**
 * لوحة الأوامر: بحث واحد وإنشاء واحد لكل اللوحة (UX-33، UX-34).
 *
 * ## المشكلة التي تحلّها
 *
 * اللوحة فيها ٦٧ مسارًا. من يعرف عنوان سلسلة أو مرجع تذكرة أو معرّف عائلة كان
 * عليه أن يعرف أولًا أيّ شاشة تملكه. وحقل البحث في الشريط العلوي كان يوجّه كل
 * شيء إلى `/series?q=` مهما كان المكتوب، فالبحث عن تذكرة كان ينتهي على قائمة
 * سلاسل فارغة.
 *
 * ## الصلاحيات في الخادم لا هنا
 *
 * النتائج تأتي مُصفّاة من `/admin/search`: المنح المقصورة على كوكب لا تُعيد
 * محتوى غيره، والمصادر التي تحتاج صلاحية لا تعمل بلا صلاحيتها. الفلترة في
 * العميل كانت ستعني أن العنوان وصل المتصفح أصلًا — وهو التسريب نفسه.
 *
 * أما **أوامر الإنشاء** فتُفلتر هنا أيضًا بـ`hasPermission`، لكن ذلك عرضيّ لا
 * أمني: الخادم يرفض الإنشاء بلا صلاحية على أي حال، وإخفاء الزر يمنع رحلة تنتهي
 * بـ403 لا أكثر.
 *
 * ## لماذا الإنشاء يُوجّه بـ`?new=1` ولا يفتح نموذجًا هنا
 *
 * نموذج إنشاء السلسلة يعرف الكواكب والمسارات العمرية والتحقّقات الخاصة به، وهو
 * موجود في صفحته. نسخه في اللوحة كان سينتج نموذجًا ثانيًا ينحرف عن الأول. فالأمر
 * يفتح الصفحة المالكة ويطلب منها فتح نموذجها (`hooks/useQuickCreate.ts`).
 */

// --- نسخ الواجهة ------------------------------------------------------------

const TYPE_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    planet: 'كوكب', series: 'سلسلة', season: 'موسم', episode: 'حلقة', character: 'شخصية',
    story: 'قصة', book: 'كتاب', game: 'لعبة', project: 'مشروع', media: 'وسائط',
    family: 'عائلة', ticket: 'تذكرة', employee: 'موظف', team: 'فريق',
    website_page: 'صفحة موقع', blog_post: 'مقال', rights: 'حقوق',
  },
  en: {
    planet: 'Planet', series: 'Series', season: 'Season', episode: 'Episode', character: 'Character',
    story: 'Story', book: 'Book', game: 'Game', project: 'Project', media: 'Media',
    family: 'Family', ticket: 'Ticket', employee: 'Employee', team: 'Team',
    website_page: 'Website page', blog_post: 'Blog post', rights: 'Rights record',
  },
}

const TYPE_ICONS: Record<string, IconName> = {
  planet: 'planets', series: 'series', season: 'seasons', episode: 'episodes',
  character: 'characters', story: 'books', book: 'books', game: 'games', project: 'skills',
  media: 'media', family: 'parents', ticket: 'bell', employee: 'parents', team: 'parents',
  website_page: 'website', blog_post: 'blog', rights: 'rights',
}

const copy: Record<Locale, {
  open: string; title: string; placeholder: string; hint: string; searching: string
  noResults: string; minLength: string; create: string; navigate: string; results: string
  restricted: string; unavailable: string; failed: string; close: string; error: string
  retry: string
}> = {
  ar: {
    open: 'لوحة الأوامر',
    title: 'ابحث أو نفّذ أمرًا',
    placeholder: 'ابحث عن سلسلة، حلقة، عائلة، تذكرة…',
    hint: 'Ctrl+K للفتح · الأسهم للتنقل · Enter للفتح · Esc للإغلاق',
    searching: 'جارٍ البحث…',
    noResults: 'لا نتائج مطابقة.',
    minLength: 'اكتب حرفين على الأقل.',
    create: 'إنشاء',
    navigate: 'انتقال',
    results: 'نتائج',
    restricted: 'منح وصولك مقصورة على محتوى محدّد، فبعض الأنواع غير معروضة:',
    unavailable: 'أنواع بلا جدول في قاعدة البيانات:',
    failed: 'مصادر فشلت في هذا النداء:',
    close: 'إغلاق',
    error: 'تعذّر تنفيذ البحث.',
    retry: 'إعادة المحاولة',
  },
  en: {
    open: 'Command palette',
    title: 'Search or run a command',
    placeholder: 'Search a series, episode, family, ticket…',
    hint: 'Ctrl+K to open · arrows to move · Enter to open · Esc to close',
    searching: 'Searching…',
    noResults: 'No matches.',
    minLength: 'Type at least two characters.',
    create: 'Create',
    navigate: 'Go to',
    results: 'Results',
    restricted: 'Your grants are limited to specific content, so some types are not shown:',
    unavailable: 'Types with no table in the database:',
    failed: 'Sources that failed on this call:',
    close: 'Close',
    error: 'The search could not run.',
    retry: 'Retry',
  },
}

// --- الأوامر ----------------------------------------------------------------

interface Command {
  id: string
  kind: 'create' | 'navigate'
  label: Record<Locale, string>
  to: string
  icon: IconName
  /// الصلاحية التي يفرضها الخادم على هذه العملية، أو null لأوامر التنقّل.
  permission?: string
}

/**
 * أوامر الإنشاء.
 *
 * كل أمر هنا يقابل صفحة تفتح نموذجها فعلًا عند `?new=1`. أمر يفتح صفحة لا تعرف
 * العلم كان سينقل المستخدم ولا يفتح شيئًا، وهو أسوأ من غياب الأمر.
 *
 * الصلاحية مأخوذة من حرس الخادم للمسار المقابل: `create` لإنشاء أي كيان كتالوج،
 * و`edit_text` لمقال المدوّنة (adminBlog.ts)، و`assign_members` لتذكرة الدعم.
 */
const CREATE_COMMANDS: Command[] = [
  { id: 'new-series', kind: 'create', label: { ar: 'سلسلة جديدة', en: 'New series' }, to: 'series?new=1', icon: 'series', permission: 'create' },
  { id: 'new-episode', kind: 'create', label: { ar: 'حلقة جديدة', en: 'New episode' }, to: 'episodes?new=1', icon: 'episodes', permission: 'create' },
  { id: 'new-story', kind: 'create', label: { ar: 'قصة جديدة', en: 'New story' }, to: 'stories?new=1', icon: 'books', permission: 'create' },
  { id: 'new-skill', kind: 'create', label: { ar: 'مهارة جديدة', en: 'New skill' }, to: 'skills?new=1', icon: 'skills', permission: 'create' },
  { id: 'new-objective', kind: 'create', label: { ar: 'هدف تعليمي جديد', en: 'New objective' }, to: 'objectives?new=1', icon: 'objectives', permission: 'create' },
  { id: 'new-review', kind: 'create', label: { ar: 'مراجعة محتوى جديدة', en: 'New content review' }, to: 'content-reviews?new=1', icon: 'reviews', permission: 'review' },
  { id: 'new-website-page', kind: 'create', label: { ar: 'صفحة موقع جديدة', en: 'New website page' }, to: 'website/pages?new=1', icon: 'website', permission: 'create' },
  { id: 'new-blog-post', kind: 'create', label: { ar: 'مقال جديد', en: 'New blog post' }, to: 'blog/posts?new=1', icon: 'blog', permission: 'create' },
  { id: 'new-ticket', kind: 'create', label: { ar: 'تذكرة دعم جديدة', en: 'New support ticket' }, to: 'support-center?new=1', icon: 'bell', permission: 'assign_members' },
]

const NAVIGATE_COMMANDS: Command[] = [
  { id: 'go-calendar', kind: 'navigate', label: { ar: 'تقويم المحتوى', en: 'Content calendar' }, to: 'calendar', icon: 'calendar' },
  { id: 'go-production', kind: 'navigate', label: { ar: 'مركز الإنتاج', en: 'Production centre' }, to: 'production', icon: 'reviews' },
  { id: 'go-support', kind: 'navigate', label: { ar: 'مركز الدعم', en: 'Support centre' }, to: 'support-center', icon: 'bell' },
  { id: 'go-seo', kind: 'navigate', label: { ar: 'عمليّات SEO', en: 'SEO operations' }, to: 'seo', icon: 'seo' },
  { id: 'go-media', kind: 'navigate', label: { ar: 'مكتبة الوسائط', en: 'Media library' }, to: 'media', icon: 'media' },
  { id: 'go-audit', kind: 'navigate', label: { ar: 'سجل التدقيق', en: 'Audit log' }, to: 'audit-logs', icon: 'reviews', permission: 'view_audit_log' },
]

/// نتيجة واحدة قابلة للتحديد بلوحة المفاتيح: أمر أو كيان.
type Row =
  | { key: string; kind: 'command'; command: Command }
  | { key: string; kind: 'result'; result: GlobalSearchResult }

const normalise = (value: string) => value.trim().toLowerCase()

/// يطابق نصّ الأمر بأي من اللغتين، فلا يعتمد على لغة الواجهة الحالية.
function commandMatches(command: Command, query: string): boolean {
  if (!query) return true
  const needle = normalise(query)
  return normalise(command.label.ar).includes(needle)
    || normalise(command.label.en).includes(needle)
    || command.id.includes(needle)
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [payload, setPayload] = useState<GlobalSearch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // الأوامر المسموح بها فقط. الفلترة عرضية: الخادم يرفض بلا صلاحية على أي حال.
  const commands = useMemo(
    () => [...CREATE_COMMANDS, ...NAVIGATE_COMMANDS]
      .filter((command) => !command.permission || hasPermission(command.permission)),
    [],
  )

  /// بلا استعلام تُعرض ثمانية أوامر فقط: قائمة مفتوحة بخمسة عشر أمرًا تُقرأ
  /// كحائط لا كاختصار. مع استعلام تُعرض كل المطابقات، لأن من كتب «تذكرة» يريد
  /// أمر التذكرة لا أول ثمانية أوامر أبجديًا.
  const visibleCommands = useMemo(
    () => commands.filter((command) => commandMatches(command, query)).slice(0, query.trim() ? 12 : 8),
    [commands, query],
  )

  const results = useMemo(
    () => (payload?.groups ?? []).flatMap((group) => group.results),
    [payload],
  )

  const rows: Row[] = useMemo(() => [
    ...visibleCommands.map((command) => ({ key: `c:${command.id}`, kind: 'command' as const, command })),
    ...results.map((result) => ({ key: `r:${result.type}:${result.id}`, kind: 'result' as const, result })),
  ], [results, visibleCommands])

  const search = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setPayload(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.globalSearch(value.trim(), { limit: 5 })
      setPayload(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.error)
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [text.error])

  // نداء واحد بعد سكون المفاتيح: نداء لكل حرف يستهلك حصّة الإدارة ويصل متأخّرًا.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => { void search(query) }, 220)
    return () => window.clearTimeout(timer)
  }, [open, query, search])

  useEffect(() => { setActive(0) }, [rows.length])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setPayload(null)
    setError(null)
    setActive(0)
    // التركيز في إطار لاحق: العنصر لم يُركَّب بعد في نفس الدورة.
    const frame = window.requestAnimationFrame(() => input.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const run = useCallback((row: Row) => {
    onClose()
    if (row.kind === 'command') navigate(adminPath(row.command.to))
    else navigate(adminPath(row.result.admin_route))
  }, [navigate, onClose])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (rows.length ? (current + 1) % rows.length : 0))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[active]
      if (row) run(row)
    }
  }

  if (!open) return null

  const activeRow = rows[active]

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={text.title}>
        <div className="palette__search">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={text.placeholder}
            aria-label={text.title}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="palette-list"
            aria-activedescendant={activeRow ? `palette-row-${activeRow.key}` : undefined}
            aria-autocomplete="list"
          />
          <button className="icon-button" type="button" onClick={onClose} aria-label={text.close}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="palette__body" id="palette-list" role="listbox" aria-label={text.title} ref={listRef}>
          {visibleCommands.length > 0 && (
            <>
              <p className="palette__group">{text.create} · {text.navigate}</p>
              {visibleCommands.map((command, index) => {
                const row = rows[index]
                const selected = active === index
                return (
                  <button
                    key={command.id}
                    id={`palette-row-c:${command.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`palette__row ${selected ? 'palette__row--active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => row && run(row)}
                  >
                    <span className="palette__icon"><Icon name={command.icon} size={16} /></span>
                    <span className="palette__label">{command.label[locale]}</span>
                    <span className="palette__kind">{command.kind === 'create' ? text.create : text.navigate}</span>
                  </button>
                )
              })}
            </>
          )}

          {loading && <p className="palette__note" role="status">{text.searching}</p>}
          {error && (
            <p className="palette__note palette__note--error" role="alert">
              {error}
              <button className="button button--ghost button--small" type="button" onClick={() => void search(query)}>{text.retry}</button>
            </p>
          )}

          {payload?.groups.map((group) => (
            <div key={group.type}>
              <p className="palette__group">{TYPE_LABELS[locale][group.type] ?? group.type}</p>
              {group.results.map((result) => {
                const index = rows.findIndex((row) => row.key === `r:${result.type}:${result.id}`)
                const selected = active === index
                return (
                  <button
                    key={`${result.type}:${result.id}`}
                    id={`palette-row-r:${result.type}:${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`palette__row ${selected ? 'palette__row--active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run({ key: '', kind: 'result', result })}
                  >
                    <span className="palette__icon">
                      {result.image_url
                        ? <img src={result.image_url} alt="" />
                        : <Icon name={TYPE_ICONS[result.type] ?? 'search'} size={16} />}
                    </span>
                    <span className="palette__label">
                      {result.title}
                      {result.subtitle && <small dir="auto">{result.subtitle}</small>}
                    </span>
                    {result.context && <span className="palette__context">{result.context}</span>}
                    {result.status && <span className={`status-chip status-chip--${result.status}`}>{result.status}</span>}
                  </button>
                )
              })}
            </div>
          ))}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <p className="palette__note">{text.noResults}</p>
          )}
          {!loading && query.trim().length > 0 && query.trim().length < 2 && (
            <p className="palette__note">{text.minLength}</p>
          )}

          {payload?.scope.restricted && payload.scope.omitted_types.length > 0 && (
            <div className="palette__declaration">
              <strong>{text.restricted}</strong>
              <ul>
                {payload.scope.omitted_types.map((entry) => (
                  <li key={entry.type}>{TYPE_LABELS[locale][entry.type] ?? entry.type} — {entry.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {payload && payload.failed.length > 0 && (
            <div className="palette__declaration palette__declaration--error">
              <strong>{text.failed}</strong>
              <ul>{payload.failed.map((entry) => <li key={entry.type}>{entry.type} — {entry.reason}</li>)}</ul>
            </div>
          )}
          {payload && query.trim().length >= 2 && payload.unavailable.length > 0 && (
            <div className="palette__declaration">
              <strong>{text.unavailable}</strong>
              <ul>{payload.unavailable.map((entry) => <li key={entry.type}>{entry.type} — {entry.reason}</li>)}</ul>
            </div>
          )}
        </div>

        <footer className="palette__footer">{text.hint}</footer>
      </div>
    </div>
  )
}

/**
 * يربط اختصار لوحة المفاتيح العام.
 *
 * `Ctrl+K` و`Cmd+K` معًا: الأول ما يتوقّعه مستخدم ويندوز ولينكس، والثاني ما
 * يتوقّعه مستخدم ماك. و`/` مقصود ألا يكون اختصارًا: هو حرف عربي شائع في
 * الكتابة ويكسر الإدخال في الحقول.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { open, setOpen }
}
