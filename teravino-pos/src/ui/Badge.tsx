import type { ReactNode } from 'react'
import { cn } from './cn'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'wine'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-04 text-ink-70 dark:bg-dark-surface-2 dark:text-dark-ink-70',
  success: 'bg-success-soft text-success dark:bg-success/20 dark:text-[#9fd3b1]',
  warning: 'bg-warning-soft text-warning dark:bg-warning/20 dark:text-gold-soft',
  danger: 'bg-danger-soft text-danger dark:bg-danger/20 dark:text-[#f1a7a5]',
  wine: 'bg-wine/10 text-wine dark:bg-gold/15 dark:text-gold',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-[0.02em] whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
