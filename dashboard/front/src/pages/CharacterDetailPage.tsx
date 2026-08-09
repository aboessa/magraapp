import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader, EntityThumbnail } from '../components/EntityHeader'
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
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setCharacter((await api.character(id)).data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الشخصية' : 'Unable to load character') }
    finally { setLoading(false) }
  }, [ar, id])
  useEffect(() => { void load() }, [load])
  if (loading && !character) return <LoadingState label={ar ? 'جارٍ تحميل الشخصية...' : 'Loading character...'} />
  if (error && !character) return <ErrorState message={error} onRetry={() => void load()} />
  if (!character) return <EmptyState title={ar ? 'الشخصية غير موجودة' : 'Character not found'} description="" />
  const role = character.role ? roleLabels[locale][character.role] : '—'
  return <div className="page-stack">
    <EntityHeader
      breadcrumbs={[{ label: ar ? 'الشخصيات' : 'Characters', to: adminPath('characters') }, { label: character.series_title, to: adminPath(`series/${character.series_id}`) }, { label: character.name_ar }]}
      thumbnail={<EntityThumbnail src={character.reference_images[0]} alt={character.name_ar} label={character.name_ar} icon="characters" size={64} />}
      title={character.name_ar}
      subtitle={character.description_ar || undefined}
      meta={<><span>{role}</span>{character.age != null && <span>{character.age} {ar ? 'سنوات' : 'years'}</span>}<span>{character.bubbles_count} {ar ? 'فقاعات قصص' : 'story bubbles'}</span></>}
      status={<span className={`status-badge ${character.status === 'archived' ? 'status-badge--archived' : 'status-badge--published'}`}>{character.status === 'archived' ? (ar ? 'مؤرشفة' : 'Archived') : (ar ? 'نشطة' : 'Active')}</span>}
      actions={<Link className="button button--secondary" to={adminPath('characters')}><Icon name="edit" size={16} />{ar ? 'تعديل' : 'Edit'}</Link>}
    />
    <DetailTabs tabs={[
      { key: 'overview', label: ar ? 'نظرة عامة' : 'Overview', content: <div className="dashboard-grid dashboard-grid--tracks"><article className="panel"><header className="panel__header"><h3>{ar ? 'الهوية والأداء' : 'Identity & voice'}</h3></header><div className="detail-fields"><div><span>{ar ? 'السلسلة' : 'Series'}</span><Link to={adminPath(`series/${character.series_id}`)}>{character.series_title}</Link></div><div><span>{ar ? 'أسلوب الكلام' : 'Speech style'}</span><strong>{character.speech_style || '—'}</strong></div><div><span>{ar ? 'المؤدي الصوتي' : 'Voice actor'}</span><strong>{character.voice_actor || '—'}</strong></div><div><span>{ar ? 'اللغات' : 'Languages'}</span><strong>{character.languages.join(' · ') || '—'}</strong></div></div></article><article className="panel"><header className="panel__header"><h3>{ar ? 'السمات' : 'Traits'}</h3></header><div className="badge-list detail-panel-pad">{character.traits.length ? character.traits.map((trait) => <span className="track-badge" key={trait}>{trait}</span>) : <span className="data-unavailable">{ar ? 'لا توجد سمات مسجلة بعد.' : 'No traits recorded yet.'}</span>}</div></article></div> },
      { key: 'visual', label: ar ? 'الدليل البصري' : 'Visual bible', badge: character.reference_images.length, content: character.reference_images.length ? <div className="entity-grid">{character.reference_images.map((image, index) => <article className="entity-card" key={image}><div className="entity-card__media"><img src={image} alt={`${character.name_ar} ${index + 1}`} loading="lazy" /></div><strong>{ar ? `مرجع ${index + 1}` : `Reference ${index + 1}`}</strong></article>)}</div> : <EmptyState title={ar ? 'لا توجد مراجع بصرية' : 'No visual references'} description={ar ? 'لم تُسجّل صور مرجعية لهذه الشخصية بعد.' : 'No reference images have been recorded for this character.'} /> },
      { key: 'expressions', label: ar ? 'التعبيرات والملابس' : 'Expressions & outfits', content: <div className="dashboard-grid dashboard-grid--tracks"><article className="panel"><header className="panel__header"><h3>{ar ? 'التعبيرات' : 'Expressions'}</h3></header><div className="detail-panel-pad detail-key-values">{Object.keys(character.expressions).length ? Object.entries(character.expressions).map(([name, value]) => <div key={name}><strong>{name}</strong><span>{value}</span></div>) : <span className="data-unavailable">{ar ? 'لا توجد تعبيرات مسجلة بعد.' : 'No expressions recorded yet.'}</span>}</div></article><article className="panel"><header className="panel__header"><h3>{ar ? 'الملابس' : 'Outfits'}</h3></header><div className="badge-list detail-panel-pad">{character.outfits.length ? character.outfits.map((outfit) => <span className="track-badge" key={outfit}>{outfit}</span>) : <span className="data-unavailable">{ar ? 'لا توجد ملابس مسجلة بعد.' : 'No outfits recorded yet.'}</span>}</div></article></div> },
      { key: 'usage', label: ar ? 'الاستخدام' : 'Usage', content: <div className="data-unavailable">{ar ? `تظهر هذه الشخصية في ${character.bubbles_count} فقاعات قصصية. لا يعيد الخادم قائمة الصفحات أو القصص المستخدمة بعد.` : `This character is used in ${character.bubbles_count} story bubbles. The server does not yet return the exact pages or stories using it.`}</div> },
    ]} />
  </div>
}
