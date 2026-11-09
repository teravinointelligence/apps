import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, LogOut, MapPin, RefreshCw, Settings2, ClipboardCheck, Store } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Badge } from '@/ui/Badge'
import { Eyebrow, Notice } from '@/ui/Field'
import { Mark } from '@/ui/Mark'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { useAuth } from '@/store/auth'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { pendingSales, useSales } from '@/store/sales'
import { fetchEventList, type EventWithPos } from '@/lib/api'
import { humanError } from '@/lib/errors'

const fmtDate = (e: EventWithPos) => {
  const d = e.event_date ?? e.start_date?.slice(0, 10)
  if (!d) return 'Sin fecha'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const statusBadge = (e: EventWithPos) => {
  if (!e.pos) return <Badge>Sin punto de venta</Badge>
  if (e.pos.status === 'abierto') return <Badge tone="success">Abierto para vender</Badge>
  if (e.pos.status === 'preparando') return <Badge tone="warning">En preparación</Badge>
  return <Badge tone="neutral">Cerrado</Badge>
}

export function EventosScreen() {
  const navigate = useNavigate()
  const { rep, signOut, isAdmin } = useAuth()
  const caja = useDevice((s) => s.caja)
  const cachedEvent = useEvent((s) => s.event)
  const sales = useSales((s) => s.sales)
  const [list, setList] = useState<EventWithPos[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await fetchEventList())
    } catch (e) {
      setError(humanError(e as Error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const canManage = useCallback(
    (e: EventWithPos) => isAdmin() || (!!rep && e.coordinator_id === rep.id),
    [isAdmin, rep],
  )

  const groups = useMemo(() => {
    const l = list ?? []
    const byDate = (a: EventWithPos, b: EventWithPos) =>
      (a.event_date ?? a.start_date ?? '').localeCompare(b.event_date ?? b.start_date ?? '')
    return {
      abiertos: l.filter((e) => e.pos?.status === 'abierto').sort(byDate),
      preparando: l.filter((e) => e.pos?.status === 'preparando' && canManage(e)).sort(byDate),
      sinPos: l.filter((e) => !e.pos && canManage(e)).sort(byDate),
      cerrados: l.filter((e) => e.pos?.status === 'cerrado').sort(byDate).reverse(),
    }
  }, [list, canManage])

  const pend = pendingSales(sales).length

  const logout = async () => {
    if (caja) {
      alert('Primero haz el corte de la caja abierta.')
      return
    }
    if (pend && !confirm(`Hay ${pend} ventas sin subir. Se quedan guardadas en este dispositivo y se subirán cuando vuelvas a entrar. ¿Salir?`)) return
    await signOut()
    navigate('/login', { replace: true })
  }

  const card = (e: EventWithPos) => {
    const manage = canManage(e)
    return (
      <div key={e.id} className="bg-paper dark:bg-dark-surface rounded-xl border border-ink-08 dark:border-dark-border p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[20px] leading-tight text-ink dark:text-dark-ink">{e.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-50 dark:text-dark-ink-50">
              <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {fmtDate(e)}</span>
              {(e.venue_name || e.city) && (
                <span className="inline-flex items-center gap-1"><MapPin size={13} /> {[e.venue_name, e.city].filter(Boolean).join(' · ')}</span>
              )}
              {e.pos && <span className="inline-flex items-center gap-1"><Store size={13} /> Sale de {e.pos.warehouse}</span>}
            </div>
          </div>
          {statusBadge(e)}
        </div>
        {(e.pos?.status === 'abierto' || manage) && (
        <div className="flex flex-wrap gap-2">
          {e.pos?.status === 'abierto' && (
            <Btn size="md" onClick={() => navigate(`/eventos/${e.id}/abrir`)} icon={<ChevronRight size={16} />}>
              Abrir caja
            </Btn>
          )}
          {manage && (
            <Btn kind="ghost" size="md" onClick={() => navigate(`/eventos/${e.id}/preparar`)} icon={<Settings2 size={16} />}>
              {e.pos ? 'Lista y precios' : 'Preparar punto de venta'}
            </Btn>
          )}
          {manage && e.pos && e.pos.status !== 'preparando' && (
            <Btn kind="ghost" size="md" onClick={() => navigate(`/eventos/${e.id}/cierre`)} icon={<ClipboardCheck size={16} />}>
              Conciliación y cierre
            </Btn>
          )}
        </div>
        )}
      </div>
    )
  }

  const section = (title: string, items: EventWithPos[], empty?: string) =>
    items.length || empty ? (
      <section className="space-y-3">
        <Eyebrow>{title}</Eyebrow>
        {items.length ? items.map(card) : <p className="text-[14px] text-ink-50 dark:text-dark-ink-50">{empty}</p>}
      </section>
    ) : null

  return (
    <div className="min-h-screen">
      <header className="px-4 md:px-8 h-16 flex items-center gap-3 border-b border-ink-08 dark:border-dark-border">
        <Mark className="flex-1" />
        <span className="hidden sm:block text-[13px] text-ink-50 dark:text-dark-ink-50">{rep?.full_name}</span>
        <ThemeToggle />
        <button type="button" onClick={logout} aria-label="Salir" title="Salir" className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center text-ink-70 dark:text-dark-ink-70">
          <LogOut size={17} strokeWidth={1.6} />
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Eyebrow>Eventos</Eyebrow>
            <h1 className="font-serif text-[32px] leading-none text-ink dark:text-dark-ink">¿Dónde vendemos hoy?</h1>
          </div>
          <Btn kind="subtle" size="sm" onClick={refresh} disabled={loading} icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
            Actualizar
          </Btn>
        </div>

        {caja && (
          <Notice tone="success">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>
                Tienes <b>{caja.caja}</b> abierta{cachedEvent?.id === caja.event_id ? ` en ${cachedEvent.name}` : ''}.
              </span>
              <Btn size="sm" onClick={() => navigate('/venta')}>Continuar vendiendo</Btn>
            </div>
          </Notice>
        )}
        {pend > 0 && !caja && <Notice>Hay {pend} ventas guardadas en este dispositivo que aún no suben. Se suben solas cuando hay internet.</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        {!list && !error && <p className="text-ink-50">Cargando eventos…</p>}

        {list && (
          <>
            {section('Abiertos para vender', groups.abiertos, 'No hay eventos abiertos para vender. Quien coordina el evento lo abre desde “Lista y precios”.')}
            {section('En preparación', groups.preparando)}
            {section('Próximos eventos del CRM', groups.sinPos)}
            {section('Cerrados', groups.cerrados.slice(0, 10))}
          </>
        )}
      </div>
    </div>
  )
}
