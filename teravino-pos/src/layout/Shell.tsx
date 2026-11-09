import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CloudOff, RefreshCw, ShoppingBag, ReceiptText, Calculator, CheckCircle2 } from 'lucide-react'
import { Mark } from '@/ui/Mark'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { cn } from '@/ui/cn'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { useCart } from '@/store/cart'
import { pendingClosings, pendingSales, useSales } from '@/store/sales'
import { useOnline } from '@/lib/useOnline'
import { syncNow } from '@/lib/sync'

function SyncBadge() {
  const online = useOnline()
  const sales = useSales((s) => s.sales)
  const closings = useSales((s) => s.closings)
  const [busy, setBusy] = useState(false)
  const pend = pendingSales(sales).length + pendingClosings(closings).length
  const errors = sales.some((s) => !s.synced && s.syncError)

  const run = async () => {
    setBusy(true)
    await syncNow()
    setBusy(false)
  }

  if (!online)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning-soft text-warning text-[12px] font-semibold dark:bg-warning/20 dark:text-gold-soft">
        <CloudOff size={14} /> Sin internet{pend ? ` · ${pend} por subir` : ''}
      </span>
    )
  if (pend)
    return (
      <button
        type="button"
        onClick={run}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold',
          errors ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
        )}
        title="Subir ahora"
      >
        <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> {pend} por subir
      </button>
    )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-success text-[12px] font-semibold">
      <CheckCircle2 size={14} /> Al día
    </span>
  )
}

const tabs = [
  { to: '/venta', label: 'Venta', icon: ShoppingBag },
  { to: '/ventas', label: 'Ventas', icon: ReceiptText },
  { to: '/corte', label: 'Corte', icon: Calculator },
]

export function Shell() {
  const caja = useDevice((s) => s.caja)
  const event = useEvent((s) => s.event)
  const load = useEvent((s) => s.load)
  const refreshSold = useEvent((s) => s.refreshSold)
  const ensureEvent = useCart((s) => s.ensureEvent)
  const loc = useLocation()
  const hideNav = loc.pathname.startsWith('/cobro') || loc.pathname.startsWith('/recibo')

  // El carrito pertenece a un evento; precios y stock se refrescan seguido.
  useEffect(() => {
    if (!caja) return
    ensureEvent(caja.event_id)
    if (event?.id !== caja.event_id) void load(caja.event_id).catch(() => undefined)
    const t = setInterval(() => {
      void load(caja.event_id).catch(() => undefined)
      void refreshSold()
    }, 60_000)
    return () => clearInterval(t)
  }, [caja, event?.id, load, refreshSold, ensureEvent])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-cream/95 dark:bg-dark-bg/95 backdrop-blur border-b border-ink-08 dark:border-dark-border">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3">
          <Mark sub="" className="hidden sm:flex" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink dark:text-dark-ink truncate">{event?.name ?? 'Evento'}</div>
            <div className="text-[11px] text-ink-50 dark:text-dark-ink-50 truncate">
              {caja?.caja} · {caja?.seller.name}
            </div>
          </div>
          <SyncBadge />
          <ThemeToggle />
        </div>
        {!hideNav && (
          <nav className="px-2 md:px-5 flex gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px',
                    isActive
                      ? 'border-wine text-wine dark:border-gold dark:text-gold'
                      : 'border-transparent text-ink-50 dark:text-dark-ink-50 hover:text-ink dark:hover:text-dark-ink',
                  )
                }
              >
                <t.icon size={16} strokeWidth={1.7} /> {t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
