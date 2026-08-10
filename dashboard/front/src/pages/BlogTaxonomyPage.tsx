import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Icon } from '../components/Icon'
import { DetailTabs } from '../components/DetailTabs'
import { MediaField, MediaThumb } from '../components/MediaPicker'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import type { BlogTaxonomy, CmsLanguage } from '../types/api'

/**
 * كُتّاب المدوّنة وتصنيفاتها ووسومها.
 *
 * ## لماذا التصنيف لكل لغة والوسم مشترك
 *
 * `blog_categories` مفتاحه `(category_key, language)`: التصنيف عنصر تنقّل يراه
 * الزائر، فاسمه ورابطه يجب أن يكونا بلغته. `blog_tags` صفّ واحد بأسماء ثلاثة،
 * لأن الوسم مُرشِّح لا صفحة محتوى — ونسخه ثلاث مرات كان سيجعل «المقالات الموسومة
 * بالفضاء» ثلاث مجموعات منفصلة.
 *
 * الوسم يُنشَأ تلقائيًا حين يكتبه المحرِّر في المقال؛ هذه الشاشة لتسمية الوسم
 * بلغاته الثلاث بعد ذلك، ولرؤية عدد مقالاته.
 */

const copy = {
  ar: {
    eyebrow: 'المدوّنة',
    title: 'الكُتّاب والتصنيفات والوسوم',
    lede: 'الكاتب إلزامي للنشر. التصنيف لكل لغة، والوسم صفّ واحد بثلاثة أسماء.',
    tabAuthors: 'الكُتّاب',
    tabCategories: 'التصنيفات',
    tabTags: 'الوسوم',
    author: 'الكاتب',
    authors: 'الكُتّاب',
    displayName: 'الاسم المعروض',
    bio: 'نبذة',
    avatar: 'الصورة',
    adminUser: 'حساب إداري مرتبط',
    adminUserHint: 'اتركه فارغًا لكاتب ضيف. الكاتب الضيف حالة حقيقية لا استثناء.',
    active: 'نشط',
    add: 'إضافة',
    adding: 'جارٍ الإضافة…',
    categories: 'التصنيفات',
    categoryKey: 'مفتاح التصنيف (لاتيني)',
    name: 'الاسم',
    slug: 'الاختصار',
    language: 'اللغة',
    sortOrder: 'الترتيب',
    description: 'الوصف',
    tags: 'الوسوم',
    tagSlug: 'اختصار الوسم',
    nameAr: 'الاسم بالعربية',
    nameEn: 'الاسم بالإنجليزية',
    nameFr: 'الاسم بالفرنسية',
    postCount: 'المقالات',
    empty: 'لا عناصر بعد.',
    loadError: 'تعذر تحميل التصنيفات',
    saveError: 'تعذر الحفظ',
    none: '—',
  },
  en: {
    eyebrow: 'Blog',
    title: 'Authors, categories and tags',
    lede: 'An author is required to publish. Categories are per language; a tag is one row with three names.',
    tabAuthors: 'Authors',
    tabCategories: 'Categories',
    tabTags: 'Tags',
    author: 'Author',
    authors: 'Authors',
    displayName: 'Display name',
    bio: 'Bio',
    avatar: 'Avatar',
    adminUser: 'Linked admin account',
    adminUserHint: 'Leave empty for a guest author. A guest author is a real case, not an exception.',
    active: 'Active',
    add: 'Add',
    adding: 'Adding…',
    categories: 'Categories',
    categoryKey: 'Category key (latin)',
    name: 'Name',
    slug: 'Slug',
    language: 'Language',
    sortOrder: 'Sort order',
    description: 'Description',
    tags: 'Tags',
    tagSlug: 'Tag slug',
    nameAr: 'Arabic name',
    nameEn: 'English name',
    nameFr: 'French name',
    postCount: 'Posts',
    empty: 'Nothing yet.',
    loadError: 'Unable to load taxonomy',
    saveError: 'Unable to save',
    none: '—',
  },
}

const LANGUAGES: CmsLanguage[] = ['ar', 'en', 'fr']

export function BlogTaxonomyPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [taxonomy, setTaxonomy] = useState<BlogTaxonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const [authorForm, setAuthorForm] = useState({ display_name: '', bio: '', avatar_asset_id: null as string | null, admin_user_id: '' })
  const [categoryForm, setCategoryForm] = useState({ category_key: '', language: 'ar' as CmsLanguage, name: '', slug: '', description: '', sort_order: 0 })
  const [tagForm, setTagForm] = useState({ slug: '', name_ar: '', name_en: '', name_fr: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.blogTaxonomy()
      setTaxonomy(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setFormError('')
    try {
      await action()
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !taxonomy) return <LoadingState />
  if (error && !taxonomy) return <ErrorState message={error} onRetry={() => void load()} />
  if (!taxonomy) return null

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      {formError && <p className="panel panel--notice field__error" role="alert">{formError}</p>}

      <DetailTabs
        tabs={[
          {
            key: 'authors',
            label: text.tabAuthors,
            badge: taxonomy.authors.length,
            content: (
              <div className="page-stack">
                <section className="panel panel--table">
                  <div className="panel__header"><h3>{text.authors}</h3></div>
                  {taxonomy.authors.length ? (
                    <div className="table-scroll" tabIndex={0}>
                      <table className="data-table">
                        <thead><tr><th>{text.displayName}</th><th>{text.bio}</th><th>{text.active}</th></tr></thead>
                        <tbody>
                          {taxonomy.authors.map((author) => (
                            <tr key={author.id}>
                              <td>
                                <div className="entity-cell">
                                  <MediaThumb assetId={author.avatar_asset_id} size={34} alt={author.display_name} />
                                  <div><strong>{author.display_name}</strong><small dir="ltr">{author.id}</small></div>
                                </div>
                              </td>
                              <td>{author.bio ?? text.none}</td>
                              <td>{author.is_active ? '✓' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="data-unavailable">{text.empty}</p>}
                </section>

                <section className="panel">
                  <div className="panel__header"><h3>{text.add} — {text.author}</h3></div>
                  <div className="entity-form">
                    <label className="field">
                      <span>{text.displayName} *</span>
                      <input value={authorForm.display_name} onChange={(event) => setAuthorForm({ ...authorForm, display_name: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>{text.bio}</span>
                      <textarea rows={3} value={authorForm.bio} onChange={(event) => setAuthorForm({ ...authorForm, bio: event.target.value })} />
                    </label>
                    <MediaField label={text.avatar} value={authorForm.avatar_asset_id} onChange={(assetId) => setAuthorForm({ ...authorForm, avatar_asset_id: assetId })} />
                    <label className="field">
                      <span>{text.adminUser}</span>
                      <input dir="ltr" value={authorForm.admin_user_id} onChange={(event) => setAuthorForm({ ...authorForm, admin_user_id: event.target.value })} />
                      <small>{text.adminUserHint}</small>
                    </label>
                    <div className="form-actions">
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={busy || !authorForm.display_name.trim()}
                        onClick={() => void run(async () => {
                          await api.createBlogAuthor({
                            display_name: authorForm.display_name.trim(),
                            bio: authorForm.bio.trim() || undefined,
                            avatar_asset_id: authorForm.avatar_asset_id,
                            admin_user_id: authorForm.admin_user_id.trim() || null,
                          })
                          setAuthorForm({ display_name: '', bio: '', avatar_asset_id: null, admin_user_id: '' })
                        })}
                      ><Icon name="plus" size={15} />{busy ? text.adding : text.add}</button>
                    </div>
                  </div>
                </section>
              </div>
            ),
          },
          {
            key: 'categories',
            label: text.tabCategories,
            badge: taxonomy.categories.length,
            content: (
              <div className="page-stack">
                <section className="panel panel--table">
                  <div className="panel__header"><h3>{text.categories}</h3></div>
                  {taxonomy.categories.length ? (
                    <div className="table-scroll" tabIndex={0}>
                      <table className="data-table">
                        <thead><tr><th>{text.name}</th><th>{text.categoryKey}</th><th>{text.language}</th><th>{text.slug}</th><th>{text.sortOrder}</th></tr></thead>
                        <tbody>
                          {taxonomy.categories.map((category) => (
                            <tr key={category.id}>
                              <td><strong>{category.name}</strong></td>
                              <td><code dir="ltr">{category.category_key}</code></td>
                              <td dir="ltr">{category.language}</td>
                              <td><code dir="ltr">{category.slug}</code></td>
                              <td>{category.sort_order}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="data-unavailable">{text.empty}</p>}
                </section>

                <section className="panel">
                  <div className="panel__header"><h3>{text.add} — {text.categories}</h3></div>
                  <div className="entity-form">
                    <div className="field-row">
                      <label className="field">
                        <span>{text.categoryKey} *</span>
                        <input dir="ltr" value={categoryForm.category_key} onChange={(event) => setCategoryForm({ ...categoryForm, category_key: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>{text.language}</span>
                        <select value={categoryForm.language} onChange={(event) => setCategoryForm({ ...categoryForm, language: event.target.value as CmsLanguage })}>
                          {LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      <span>{text.name} *</span>
                      <input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
                    </label>
                    <div className="field-row">
                      <label className="field">
                        <span>{text.slug}</span>
                        <input dir="ltr" value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>{text.sortOrder}</span>
                        <input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: Number(event.target.value) })} />
                      </label>
                    </div>
                    <label className="field">
                      <span>{text.description}</span>
                      <textarea rows={2} value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
                    </label>
                    <div className="form-actions">
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={busy || !categoryForm.category_key.trim() || !categoryForm.name.trim()}
                        onClick={() => void run(async () => {
                          await api.createBlogCategory({
                            category_key: categoryForm.category_key.trim(),
                            language: categoryForm.language,
                            name: categoryForm.name.trim(),
                            slug: categoryForm.slug.trim() || undefined,
                            description: categoryForm.description.trim() || undefined,
                            sort_order: categoryForm.sort_order,
                          })
                          setCategoryForm({ category_key: '', language: 'ar', name: '', slug: '', description: '', sort_order: 0 })
                        })}
                      ><Icon name="plus" size={15} />{busy ? text.adding : text.add}</button>
                    </div>
                  </div>
                </section>
              </div>
            ),
          },
          {
            key: 'tags',
            label: text.tabTags,
            badge: taxonomy.tags.length,
            content: (
              <div className="page-stack">
                <section className="panel panel--table">
                  <div className="panel__header"><h3>{text.tags}</h3></div>
                  {taxonomy.tags.length ? (
                    <div className="table-scroll" tabIndex={0}>
                      <table className="data-table">
                        <thead><tr><th>{text.tagSlug}</th><th>{text.nameAr}</th><th>{text.nameEn}</th><th>{text.nameFr}</th><th>{text.postCount}</th></tr></thead>
                        <tbody>
                          {taxonomy.tags.map((tag) => (
                            <tr key={tag.slug}>
                              <td><code dir="ltr">{tag.slug}</code></td>
                              <td>{tag.name_ar}</td>
                              <td>{tag.name_en ?? text.none}</td>
                              <td>{tag.name_fr ?? text.none}</td>
                              <td>{tag.post_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="data-unavailable">{text.empty}</p>}
                </section>

                <section className="panel">
                  <div className="panel__header"><h3>{text.add} — {text.tags}</h3></div>
                  <div className="entity-form">
                    <label className="field">
                      <span>{text.tagSlug} *</span>
                      <input dir="ltr" value={tagForm.slug} onChange={(event) => setTagForm({ ...tagForm, slug: event.target.value })} />
                    </label>
                    <div className="field-row">
                      <label className="field">
                        <span>{text.nameAr} *</span>
                        <input value={tagForm.name_ar} onChange={(event) => setTagForm({ ...tagForm, name_ar: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>{text.nameEn}</span>
                        <input value={tagForm.name_en} onChange={(event) => setTagForm({ ...tagForm, name_en: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>{text.nameFr}</span>
                        <input value={tagForm.name_fr} onChange={(event) => setTagForm({ ...tagForm, name_fr: event.target.value })} />
                      </label>
                    </div>
                    <div className="form-actions">
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={busy || !tagForm.slug.trim() || !tagForm.name_ar.trim()}
                        onClick={() => void run(async () => {
                          await api.createBlogTag({
                            slug: tagForm.slug.trim(),
                            name_ar: tagForm.name_ar.trim(),
                            name_en: tagForm.name_en.trim() || undefined,
                            name_fr: tagForm.name_fr.trim() || undefined,
                          })
                          setTagForm({ slug: '', name_ar: '', name_en: '', name_fr: '' })
                        })}
                      ><Icon name="plus" size={15} />{busy ? text.adding : text.add}</button>
                    </div>
                  </div>
                </section>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
