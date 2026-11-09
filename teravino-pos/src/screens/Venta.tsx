import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Percent, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Badge } from '@/ui/Badge'
import { Modal } from '@/ui/Modal'
import { Keypad } from '@/ui/Keypad'
import { Notice } from '@/ui/Field'
import { cn } from '@/ui/cn'
import { useEvent } from '@/store/event'
import { cartDiscount, cartSubtotal, cartUnits, useCart, type DiscountMode } from '@/store/cart'
import { useRemaining } from '@/lib/remaining'
import { categoryLabel } from '@/lib/labels'
import { mxn, mxnShort, toNumber } from '@/lib/money'
import type { PosItem } from '@/types'

const TINT: Record<string, string> = {
  vino_tinto: '#5B1426',
  vino_blanco: '#D9C27E',
  vino_rosado: '#E0A0AC',
  vino_naranja: '#C77434',
  espumoso: '#E6CB73',
  destilado: '#A97C3B',
  cerveza: '#D49A3E',
}

function DiscountModal({ open, onClose, maxPct }: { open: boolean; onClose: () => void; maxPct: number }) {
  const { lines, discountMode, discountValue, setDiscount } = useCart()
  const [mode, setMode] = useState<DiscountMode>(discountMode)
  const [value, setValue] = useState(discountValue ? String(discountValue) : '')
  const preview = cartDiscount(lines, mode, toNumber(value), maxPct)
  return (
    <Modal
      open={open}
      title="Descuento al ticket"
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={() => { setDiscount('percent', 0); onClose() }}>Quitar descuento</Btn>
          <Btn onClick={() => { setDiscount(mode, toNumber(value)); onClose() }}>Aplicar</Btn>
        </>
      }
    >
      <div className="flex gap-2 mb-3">
        {(['percent', 'amount'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn('flex-1 rounded-lg border py-2 text-[14px]', mode === m ? 'border-wine bg-wine text-white dark:bg-gold dark:text-wine-deep dark:border-gold' : 'border-ink-15 dark:border-dark-border')}>
            {m === 'percent' ? 'Porcentaje' : 'Monto en pesos'}
          </button>
        ))}
      </div>
      <div className="text-center font-serif text-[38px] tabular mb-1">{mode === 'percent' ? `${value || 0}%` : mxn(toNumber(value))}</div>
      <div className="text-center text-[13px] text-ink-50 mb-3">
        Descuento real: <b>{mxn(preview.applied)}</b> ({preview.pct}%) · máximo del evento {maxPct}%
      </div>
      {preview.capped && <div className="mb-3"><Notice>Se recortó al máximo permitido del evento ({maxPct}%).</Notice></div>}
      <Keypad value={value} onChange={setValue} allowDecimal />
    </Modal>
  )
}

function CartPanel({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const config = useEvent((s) => s.config)
  const { lines, setQty, remove, discountMode, discountValue, clear } = useCart()
  const [discOpen, setDiscOpen] = useState(false)
  const maxPct = config?.descuento_max_pct ?? 0
  const sub = cartSubtotal(lines)
  const disc = cartDiscount(lines, discountMode, discountValue, maxPct)
  const total = Math.max(0, sub - disc.applied)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="font-serif text-[22px] text-ink dark:text-dark-ink">Ticket</div>
        <div className="flex items-center gap-1">
          {lines.length > 0 && (
            <button type="button" onClick={() => confirm('¿Vaciar el ticket?') && clear()} className="text-[12px] text-danger px-2 py-1">Vaciar</button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center rounded-lg">
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pretty-scroll px-4 space-y-2">
        {lines.length === 0 && <p className="text-[14px] text-ink-50 dark:text-dark-ink-50 py-6 text-center">Toca un vino para agregarlo.</p>}
        {lines.map((l) => (
          <div key={l.item.product_id} className="rounded-xl border border-ink-08 dark:border-dark-border p-3">
            <div className="flex justify-between gap-2">
              <div className="text-[14px] leading-snug text-ink dark:text-dark-ink">{l.item.name}</div>
              <button type="button" onClick={() => remove(l.item.product_id)} aria-label="Quitar" className="text-ink-30 hover:text-danger">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Menos" onClick={() => setQty(l.item.product_id, l.qty - 1)} className="w-9 h-9 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center"><Minus size={15} /></button>
                <span className="w-9 text-center tabular font-semibold">{l.qty}</span>
                <button type="button" aria-label="Más" onClick={() => setQty(l.item.product_id, l.qty + 1)} className="w-9 h-9 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center"><Plus size={15} /></button>
              </div>
              <div className="text-right">
                <div className="tabular font-semibold">{mxn(l.item.precio * l.qty)}</div>
                {l.qty > 1 && <div className="text-[11px] text-ink-50 tabular">{mxn(l.item.precio)} c/u</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-4 border-t border-ink-08 dark:border-dark-border space-y-1.5">
        <div className="flex justify-between text-[14px] text-ink-70 dark:text-dark-ink-70"><span>Subtotal · {cartUnits(lines)} bot.</span><span className="tabular">{mxn(sub)}</span></div>
        <button type="button" disabled={!lines.length || maxPct <= 0} onClick={() => setDiscOpen(true)} className="w-full flex justify-between text-[14px] text-wine dark:text-gold disabled:opacity-40">
          <span className="inline-flex items-center gap-1"><Percent size={14} /> {disc.applied > 0 ? `Descuento ${disc.pct}%` : 'Agregar descuento'}</span>
          <span className="tabular">{disc.applied > 0 ? `−${mxn(disc.applied)}` : ''}</span>
        </button>
        <div className="flex justify-between items-baseline pt-1">
          <span className="font-serif text-[22px]">Total</span>
          <span className="font-serif text-[30px] tabular text-ink dark:text-dark-ink">{mxn(total)}</span>
        </div>
        <div className="text-[11px] text-ink-50 text-right">IVA incluido</div>
        <Btn size="xl" fullWidth disabled={!lines.length} onClick={() => navigate('/cobro')}>
          Cobrar {lines.length ? mxnShort(total) : ''}
        </Btn>
      </div>
      {discOpen && <DiscountModal open onClose={() => setDiscOpen(false)} maxPct={maxPct} />}
    </div>
  )
}

export function VentaScreen() {
  const items = useEvent((s) => s.items)
  const offline = useEvent((s) => s.offline)
  const { lines, add, discountMode, discountValue } = useCart()
  const config = useEvent((s) => s.config)
  const remaining = useRemaining()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [mobileCart, setMobileCart] = useState(false)

  const active = useMemo(() => items.filter((i) => i.active), [items])
  const cats = useMemo(() => [...new Set(active.map((i) => i.category ?? 'otro'))], [active])
  const shown = useMemo(() => {
    const t = q
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
    return active.filter(
      (i) =>
        (cat === 'all' || (i.category ?? 'otro') === cat) &&
        (!t || `${i.name} ${i.sku} ${i.vintage ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t)),
    )
  }, [active, q, cat])

  const inCart = (pid: string) => lines.find((l) => l.item.product_id === pid)?.qty ?? 0
  const tap = (i: PosItem) => {
    const left = (remaining[i.product_id] ?? 0) - inCart(i.product_id)
    if (left <= 0 && !confirm(`Según la salida ya no quedan botellas de ${i.name}. ¿Agregar de todos modos?`)) return
    add(i)
  }

  const sub = cartSubtotal(lines)
  const total = Math.max(0, sub - cartDiscount(lines, discountMode, discountValue, config?.descuento_max_pct ?? 0).applied)

  return (
    <div className="flex-1 flex min-h-0">
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 md:px-6 pt-4 pb-3 space-y-3">
          {offline && <Notice>Sin conexión: se usa la última lista guardada. Las ventas se guardan aquí y suben solas.</Notice>}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-30" />
            <input className="field pl-9" placeholder="Buscar vino" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {cats.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pretty-scroll pb-1">
              {['all', ...cats].map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} className={cn('px-3.5 py-1.5 rounded-full text-[13px] border whitespace-nowrap', cat === c ? 'bg-wine text-white border-wine dark:bg-gold dark:text-wine-deep dark:border-gold' : 'border-ink-15 dark:border-dark-border text-ink-70 dark:text-dark-ink-70')}>
                  {c === 'all' ? 'Todos' : categoryLabel(c)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto pretty-scroll px-4 md:px-6 pb-28 lg:pb-6">
          {active.length === 0 && <Notice tone="info">Este evento aún no tiene productos activos.</Notice>}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {shown.map((i) => {
              const left = (remaining[i.product_id] ?? 0) - inCart(i.product_id)
              const qty = inCart(i.product_id)
              return (
                <button
                  key={i.product_id}
                  type="button"
                  onClick={() => tap(i)}
                  className={cn('relative text-left rounded-xl border bg-paper dark:bg-dark-surface p-3 flex flex-col gap-2 min-h-[132px] active:scale-[0.99] transition', qty ? 'border-wine dark:border-gold' : 'border-ink-08 dark:border-dark-border')}
                >
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r" style={{ background: TINT[i.category ?? ''] ?? '#4A1424' }} />
                  <div className="pl-2 flex-1">
                    <div className="text-[14px] leading-snug font-medium text-ink dark:text-dark-ink line-clamp-3">{i.name}</div>
                    <div className="text-[11px] text-ink-50 dark:text-dark-ink-50 mt-0.5">{[i.vintage, categoryLabel(i.category)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="pl-2 flex items-end justify-between gap-2">
                    <span className="font-serif text-[22px] tabular leading-none text-wine dark:text-gold">{mxnShort(i.precio)}</span>
                    {left <= 0 ? <Badge tone="danger">Sin salida</Badge> : left <= 3 ? <Badge tone="warning">Quedan {left}</Badge> : <span className="text-[11px] text-ink-50 tabular">Quedan {left}</span>}
                  </div>
                  {qty > 0 && <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-wine text-white dark:bg-gold dark:text-wine-deep text-[12px] font-bold flex items-center justify-center">{qty}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <aside className="hidden lg:flex w-[360px] border-l border-ink-08 dark:border-dark-border bg-paper/60 dark:bg-dark-surface/60">
        <div className="w-full"><CartPanel /></div>
      </aside>

      {/* Teléfono / tablet vertical: ticket como hoja inferior */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 bg-cream/95 dark:bg-dark-bg/95 border-t border-ink-08 dark:border-dark-border">
        <Btn size="lg" fullWidth onClick={() => setMobileCart(true)} icon={<ShoppingBag size={18} />}>
          {lines.length ? `Ver ticket · ${cartUnits(lines)} bot. · ${mxnShort(total)}` : 'Ticket vacío'}
        </Btn>
      </div>
      {mobileCart && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileCart(false)}>
          <div className="absolute inset-x-0 bottom-0 top-16 bg-paper dark:bg-dark-surface rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <CartPanel onClose={() => setMobileCart(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
