import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'

const copy = {
  ar: {
    eyebrow: 'مكتبة المحتوى',
    title: 'مكتبة المحتوى',
    intro: 'مركز توجيهي فقط. اختر نوع المحتوى للانتقال إلى مجموعته المخصصة بفلاترها وجاهزيتها ومساحة عملها.',
    books: 'الكتب',
    games: 'الألعاب',
    projects: 'المشروعات / الأنشطة',
    total: 'إجمالي',
    ready: 'جاهزة',
    review: 'قيد المراجعة',
    missing: 'ناقصة',
    open: 'فتح المجموعة',
    loading: 'جارٍ تحميل الملخص...',
    noData: 'لا بيانات',
  },
  en: {
    eyebrow: 'Content library',
    title: 'Content library',
    intro: 'Hub only. Choose a content type to open its dedicated collection with its own filters, readiness and workspace.',
    books: 'Books',
    games: 'Games',
    projects: 'Projects / Activities',
    total: 'Total',
    ready: 'Ready',
    review: 'In review',
    missing: 'Missing',
    open: 'Open collection',
    loading: 'Loading summary...',
    noData: 'No data',
  },
}

export function LibraryHubPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [books, setBooks] = useState<{ total: number; ready: number; review: number; missingPages: number } | null>(null)
  const [games, setGames] = useState<{ total: number; ready: number; review: number; blocked: number } | null>(null)
  const [projects, setProjects] = useState<{ total: number; ready: number; review: number; missingMedia: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void Promise.allSettled([api.books({ limit: 100 }), api.games({ limit: 100 }), api.projects({ limit: 100 })]).then(([b, g, p]) => {
      if (!alive) return
      if (b.status === 'fulfilled') {
        const data: any[] = (b.value as any).data ?? []
        const total = data.length
        const ready = data.filter((x) => x.status === 'ready' || x.status === 'published').length
        const review = data.filter((x) => String(x.status).startsWith('review')).length
        const missingPages = data.filter((x) => !x.pages || (Array.isArray(x.pages) && x.pages.length === 0)).length
        setBooks({ total, ready, review, missingPages })
      }
      if (g.status === 'fulfilled') {
        const data: any[] = (g.value as any).data ?? []
        const total = data.length
        const ready = data.filter((x) => x.status === 'ready' || x.status === 'published').length
        const review = data.filter((x) => String(x.status).startsWith('review')).length
        const blocked = data.filter((x) => x.status === 'production' || x.status === 'qa').length
        setGames({ total, ready, review, blocked })
      }
      if (p.status === 'fulfilled') {
        const data: any[] = (p.value as any).data ?? []
        const total = data.length
        const ready = data.filter((x) => x.status === 'ready' || x.status === 'published').length
        const review = data.filter((x) => String(x.status).startsWith('review')).length
        const missingMedia = data.filter((x) => !x.cover_url && (!x.materials || x.materials.length === 0)).length
        setProjects({ total, ready, review, missingMedia })
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const Block = ({ title, icon, to, data, missingLabel }: { title: string; icon: any; to: string; data: { total: number; ready: number; review: number; missingPages?: number; blocked?: number; missingMedia?: number } | null; missingLabel: string }) => (
    <Link to={to} className="library-hub__block">
      <header>
        <span className="library-hub__icon"><Icon name={icon} size={22} /></span>
        <h3>{title}</h3>
      </header>
      {loading ? <p className="data-unavailable">{text.loading}</p> : !data ? <p className="data-unavailable">{text.noData}</p> : (
        <dl>
          <div><dt>{text.total}</dt><dd>{formatNumber(data.total, locale)}</dd></div>
          <div><dt>{text.ready}</dt><dd>{formatNumber(data.ready, locale)}</dd></div>
          <div><dt>{text.review}</dt><dd>{formatNumber(data.review, locale)}</dd></div>
          <div><dt>{missingLabel}</dt><dd>{formatNumber((data.missingPages ?? data.blocked ?? data.missingMedia ?? 0), locale)}</dd></div>
        </dl>
      )}
      <span className="button button--secondary button--small">{text.open} <Icon name="arrow" size={14} /></span>
    </Link>
  )

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
      </section>
      <section className="library-hub">
        <Block title={text.books} icon="books" to={adminPath('books')} data={books} missingLabel={locale === 'ar' ? 'ناقصة صفحات' : 'Missing pages'} />
        <Block title={text.games} icon="games" to={adminPath('games')} data={games} missingLabel={locale === 'ar' ? 'قيد الإنتاج' : 'Blocked'} />
        <Block title={text.projects} icon="objectives" to={adminPath('projects')} data={projects} missingLabel={locale === 'ar' ? 'ناقصة وسائط' : 'Missing media'} />
      </section>
    </div>
  )
}
