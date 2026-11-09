import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Kind = 'primary' | 'gold' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'xl'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind
  size?: Size
  icon?: ReactNode
  fullWidth?: boolean
  children?: ReactNode
}

const sizeMap: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-[13px] rounded-md min-h-[36px] gap-1.5',
  md: 'px-[18px] py-[11px] text-sm rounded-lg min-h-[44px] gap-2',
  lg: 'px-[22px] py-3.5 text-[15px] rounded-[10px] min-h-[52px] gap-2.5',
  xl: 'px-7 py-[18px] text-[17px] rounded-xl min-h-[64px] gap-3',
}

const kindMap: Record<Kind, string> = {
  primary: 'bg-wine text-white border-wine hover:bg-wine-deep dark:bg-gold dark:text-wine-deep dark:border-gold dark:hover:bg-gold-soft',
  gold: 'bg-gold text-wine-deep border-gold font-semibold hover:bg-gold-soft',
  ghost:
    'bg-transparent text-wine border-ink-15 hover:bg-ink-04 dark:text-dark-ink dark:border-dark-border dark:hover:bg-dark-surface-2',
  danger: 'bg-paper text-danger border-ink-15 hover:bg-danger-soft dark:bg-dark-surface dark:border-dark-border',
  subtle: 'bg-ink-04 text-ink-70 border-transparent hover:bg-ink-08 dark:bg-dark-surface-2 dark:text-dark-ink-70',
}

export function Btn({ kind = 'primary', size = 'md', icon, fullWidth, className, children, type, ...rest }: Props) {
  return (
    <button
      type={type ?? 'button'}
      {...rest}
      className={cn(
        'inline-flex items-center justify-center border font-medium tracking-[0.01em] whitespace-nowrap transition-colors select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeMap[size],
        kindMap[kind],
        fullWidth && 'w-full',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
