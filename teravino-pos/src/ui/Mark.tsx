import { cn } from './cn'

/** Marca TeraVino (texto). Sustituible por el logotipo oficial en SVG. */
export function Mark({ className, sub = 'Eventos' }: { className?: string; sub?: string }) {
  return (
    <div className={cn('flex items-baseline gap-2 select-none', className)}>
      <span className="font-serif text-[22px] font-semibold tracking-[0.12em] text-wine dark:text-gold leading-none">
        TERAVINO
      </span>
      {sub && (
        <span className="text-[10px] tracking-[0.22em] uppercase text-gold-deep dark:text-dark-ink-50 font-semibold">
          {sub}
        </span>
      )}
    </div>
  )
}
