import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { CharacterDetail } from '../types/api'

const roleLabels = {
  ar: { hero: 'بطل', side: 'مساند', villain: 'خصم', narrator: 'راوٍ', presenter: 'مقدم' },
  en: { hero: 'Hero', side: 'Supporting', villain: 'Antagonist', narrator: 'Narrator', presenter: 'Presenter' },
}

export function CharacterDetailPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const { id = '' } = useParams()
  const [character, setCharacter] = useState<CharacterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'visual' | 'expressions' | 'usage'>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCharacter((await api.character(id)).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الشخصية' : 'Unable to load character')
    } finally {
      setLoading(false)
    }
  }, [ar, id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !character) return <LoadingState label={ar ? 'جارٍ تحميل الشخصية...' : 'Loading character...'} />
  if (error && !character) return <ErrorState message={error} onRetry={() => void load()} />
  if (!character) return <EmptyState title={ar ? 'الشخصية غير موجودة' : 'Character not found'} description="" />

  const role = character.role ? roleLabels[locale][character.role] || character.role : '—'
  const refImages = character.reference_images || []
  const expressions = character.expressions || {}
  const outfits = character.outfits || []

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('characters')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'الشخصيات' : 'Characters'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {refImages[0] ? (
              <img
                src={refImages[0]}
                alt={character.name_ar}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
              />
            ) : (
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--primary-subtle, rgba(99, 102, 241, 0.15))',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {character.name_ar.slice(0, 1)}
              </span>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="admin-page-title" style={{ margin: 0 }}>
                  {character.name_ar}
                </h1>
                <span className={`status-badge ${character.status === 'archived' ? 'status-badge--archived' : 'status-badge--published'}`}>
                  {character.status === 'archived' ? (ar ? 'مؤرشفة' : 'Archived') : (ar ? 'نشطة' : 'Active')}
                </span>
              </div>
              <p className="admin-page-subtitle" style={{ margin: 0 }}>
                <Link to={adminPath(`series/${character.series_id}`)} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {character.series_title}
                </Link>{' '}
                · {role} {character.age != null ? `· ${character.age} ${ar ? 'سنوات' : 'years'}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link className="button button--secondary button--small" to={adminPath('characters')}>
            <Icon name="file-text" size={14} />
            <span>{ar ? 'تعديل الشخصية' : 'Edit Character'}</span>
          </Link>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'دور الشخصية' : 'Character Role'}</span>
            <div className="bento-glass-card__icon"><Icon name="star" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 20 }}>{role}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'تصنيف درامي' : 'Dramatic archetype'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الظهور والحوارات' : 'Dialogue Bubbles'}</span>
            <div className="bento-glass-card__icon"><Icon name="text" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{character.bubbles_count}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'فقاعة حوارية مسجلة' : 'Recorded speech bubbles'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'المراجع البصرية' : 'Visual Bible'}</span>
            <div className="bento-glass-card__icon"><Icon name="eye" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{refImages.length}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'صور نموذجية ورسم' : 'Model sheet assets'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'المؤدي الصوتي' : 'Voice Actor'}</span>
            <div className="bento-glass-card__icon"><Icon name="users" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 16 }}>
            {character.voice_actor || (ar ? 'غير محدد' : 'Unassigned')}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{character.languages?.join(', ') || 'AR'}</span>
          </div>
        </article>
      </section>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        <button
          className={`button ${tab === 'overview' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('overview')}
        >
          {ar ? 'الهوية والأداء' : 'Identity & Voice'}
        </button>
        <button
          className={`button ${tab === 'visual' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('visual')}
        >
          {ar ? 'الدليل البصري' : 'Visual Bible'} ({refImages.length})
        </button>
        <button
          className={`button ${tab === 'expressions' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('expressions')}
        >
          {ar ? 'التعبيرات والملابس' : 'Expressions & Outfits'}
        </button>
        <button
          className={`button ${tab === 'usage' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('usage')}
        >
          {ar ? 'إحصاءات الاستخدام' : 'Story Usage'}
        </button>
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'overview' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="file-text" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الهوية والأداء الصوتي' : 'Identity & Voice Acting'}</h3>
              </div>

              {character.description_ar && (
                <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--muted)' }}>{ar ? 'سيرة الشخصية' : 'Biography'}</h4>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{character.description_ar}</p>
                </div>
              )}

              <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                <div>
                  <dt>{ar ? 'السلسلة التابعة' : 'Series'}</dt>
                  <dd>
                    <Link to={adminPath(`series/${character.series_id}`)} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {character.series_title}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>{ar ? 'أسلوب الكلام' : 'Speech Style'}</dt>
                  <dd><strong>{character.speech_style || '—'}</strong></dd>
                </div>
                <div>
                  <dt>{ar ? 'المؤدي الصوتي' : 'Voice Actor'}</dt>
                  <dd><strong>{character.voice_actor || '—'}</strong></dd>
                </div>
                <div>
                  <dt>{ar ? 'اللغات المتاحة' : 'Languages'}</dt>
                  <dd>{character.languages?.join(' · ') || '—'}</dd>
                </div>
              </dl>

              <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>{ar ? 'سمات الشخصية وسلوكياتها' : 'Character Traits'}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {character.traits?.length ? (
                    character.traits.map((trait) => (
                      <span className="track-badge" key={trait} style={{ padding: '4px 10px' }}>
                        {trait}
                      </span>
                    ))
                  ) : (
                    <span className="table-secondary">{ar ? 'لا توجد سمات مسجلة بعد.' : 'No traits recorded yet.'}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'visual' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="eye" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الدليل البصري ونماذج الرسم (Visual Bible)' : 'Visual Reference Sheet'}</h3>
                </div>
                <span className="badge badge--pill">{refImages.length} {ar ? 'مراجع' : 'references'}</span>
              </div>

              {refImages.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                  {refImages.map((image, index) => (
                    <article
                      key={image}
                      style={{
                        background: 'var(--surface-sunken)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ width: '100%', height: 160, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={image} alt={`${character.name_ar} ${index + 1}`} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>
                        {ar ? `مرجع بصري ${index + 1}` : `Reference ${index + 1}`}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={ar ? 'لا توجد مراجع بصرية' : 'No visual references'}
                  description={ar ? 'لم تُسجّل صور مرجعية لهذه الشخصية بعد.' : 'No reference images have been recorded for this character.'}
                />
              )}
            </div>
          )}

          {tab === 'expressions' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="sparkles" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'التعبيرات والملابس' : 'Expressions & Outfits'}</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>{ar ? 'تعبيرات الوجه المعتمدة' : 'Approved Face Expressions'}</h4>
                  {Object.keys(expressions).length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                      {Object.entries(expressions).map(([name, value]) => (
                        <div key={name} style={{ padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <strong style={{ fontSize: 13 }}>{name}</strong>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{value as string}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="table-secondary">{ar ? 'لا توجد تعبيرات مسجلة بعد.' : 'No expressions recorded.'}</span>
                  )}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>{ar ? 'الملابس المعتمدة' : 'Wardrobe & Outfits'}</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {outfits.length ? (
                      outfits.map((outfit) => (
                        <span className="track-badge" key={outfit} style={{ padding: '4px 10px' }}>
                          {outfit}
                        </span>
                      ))
                    ) : (
                      <span className="table-secondary">{ar ? 'لا توجد ملابس مسجلة بعد.' : 'No outfits recorded.'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'usage' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="analytics" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'إحصاءات الاستخدام الدرامي' : 'Dramatic Lore Usage'}</h3>
              </div>
              <p style={{ margin: '0 0 12px' }}>
                {ar
                  ? `تظهر هذه الشخصية في ${character.bubbles_count} فقاعة قصصية مسجلة في محتوى القصص والحلقات.`
                  : `This character is featured across ${character.bubbles_count} dialogue bubbles.`}
              </p>
              <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
                {ar
                  ? 'يتم ربط كل ظهور بحسابات حقوق الشخصية وتناسق الأداء الصوتي عبر جميع الحلقات.'
                  : 'All appearances linked to character IP rights and voice acting consistency ledger.'}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Character Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Identity Blueprint */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="star" size={16} />
              <span>{ar ? 'ميثاق الشخصية' : 'Lore Blueprint'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'الدور:' : 'Role:'}</span>
                <strong>{role}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'العمر التقديري:' : 'Target Age:'}</span>
                <strong>{character.age ? `${character.age} ${ar ? 'سنوات' : 'years'}` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{ar ? 'فقاعات الحوار:' : 'Speech count:'}</span>
                <span className="badge badge--pill">{character.bubbles_count}</span>
              </div>
            </div>
          </div>

          {/* AI Lore Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار السرد وتناسق الشخصية' : 'Lore Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'حافظ على اتساق نبرة الصوت والمفردات مع ميثاق الشخصية وأسلوب كلامها في جميع الحلقات والقصص المصورة.'
                : 'Maintain consistent speech patterns and dialect nuances as defined in this visual bible.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
