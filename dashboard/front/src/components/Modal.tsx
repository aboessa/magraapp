import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { usePreferences } from '../context/preferences'

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  maxWidth,
}: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  maxWidth?: number | string
}) {
  const { locale } = usePreferences()

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.body.classList.add('modal-open')
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const modalStyle: CSSProperties | undefined = maxWidth
    ? ({
        '--modal-max-width': typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
      } as CSSProperties)
    : undefined

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      style={{ zIndex: 99999 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={modalStyle}
      >
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>,
    document.body
  )
}
