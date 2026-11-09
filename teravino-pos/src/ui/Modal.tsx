import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full bg-paper dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-ink-08 dark:border-dark-border">
          <h2 className="font-serif text-[22px] text-ink dark:text-dark-ink leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-50 hover:bg-ink-04 dark:hover:bg-dark-surface-2">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto pretty-scroll">{children}</div>
        {footer && <div className="px-5 pb-5 pt-2 flex gap-2 justify-end flex-wrap">{footer}</div>}
      </div>
    </div>
  )
}
