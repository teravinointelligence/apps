import type { ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold tracking-[0.04em] text-ink-70 dark:text-dark-ink-70 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-ink-50 dark:text-dark-ink-50 mt-1">{hint}</span>}
    </label>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[10px] tracking-[0.22em] uppercase text-gold-deep dark:text-gold font-semibold mb-1">{children}</div>
}

export function Notice({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'success' | 'info'; children: ReactNode }) {
  const cls = {
    warning: 'bg-warning-soft text-[#6d4a12] border-warning/30 dark:bg-warning/15 dark:text-gold-soft',
    danger: 'bg-danger-soft text-danger border-danger/30 dark:bg-danger/15 dark:text-[#f1a7a5]',
    success: 'bg-success-soft text-success border-success/30 dark:bg-success/15 dark:text-[#9fd3b1]',
    info: 'bg-ink-04 text-ink-70 border-ink-15 dark:bg-dark-surface-2 dark:text-dark-ink-70 dark:border-dark-border',
  }[tone]
  return <div className={`rounded-lg border px-3.5 py-2.5 text-[13px] leading-snug ${cls}`}>{children}</div>
}
