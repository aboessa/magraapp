import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: { loading: 'جارٍ تحميل البيانات...', error: 'تعذر تحميل البيانات', retry: 'إعادة المحاولة' },
  en: { loading: 'Loading data...', error: 'Unable to load data', retry: 'Try again' },
}

export function LoadingState({ label }: { label?: string }) {
  const { locale } = usePreferences()
  return <div className="page-state page-state--loading"><span className="spinner" aria-hidden="true" /><p>{label ?? copy[locale].loading}</p></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { locale } = usePreferences()
  return (
    <div className="page-state page-state--error">
      <span className="page-state__symbol">!</span>
      <h3>{copy[locale].error}</h3>
      <p>{message}</p>
      {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}><Icon name="refresh" size={17} />{copy[locale].retry}</button>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-state page-state--empty">
      <span className="page-state__symbol">◇</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
