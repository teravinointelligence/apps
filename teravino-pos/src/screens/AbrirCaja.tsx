import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Unlock } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Eyebrow, Notice } from '@/ui/Field'
import { Keypad } from '@/ui/Keypad'
import { cn } from '@/ui/cn'
import { useAuth } from '@/store/auth'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { useCart } from '@/store/cart'
import { fetchOpenSessions, openSession } from '@/lib/api'
import { humanError } from '@/lib/errors'
import { mxn, toNumber } from '@/lib/money'

const CAJAS = ['CAJA-1', 'CAJA-2', 'CAJA-3', 'CAJA-4']

export function AbrirCajaScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const rep = useAuth((s) => s.rep)
  const { deviceId, caja: current, lastCaja, openCaja } = useDevice()
  const { event, config, items, load } = useEvent()
  const ensureEvent = useCart((s) => s.ensureEvent)
  const [caja, setCaja] = useState(lastCaja)
  const [fondo, setFondo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [occupied, setOccupied] = useState<Record<string, string>>({})
  const [askForce, setAskForce] = useState<string | null>(null)

  useEffect(() => {
    if (current) {
      navigate('/venta', { replace: true })
      return
    }
    load(id).catch((e) => setError(humanError(e)))
    fetchOpenSessions(id)
      .then((s) =>
        setOccupied(Object.fromEntries(s.filter((x) => x.device_id !== deviceId).map((x) => [x.caja, x.seller_name]))),
      )
      .catch(() => undefined)
  }, [id, current, navigate, load, deviceId])

  const ready = event?.id === id && config
  const notOpen = ready && config.status !== 'abierto'

  const open = async (force = false) => {
    if (!rep || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await openSession({ eventId: id, caja, deviceId, fondo: toNumber(fondo), force })
      ensureEvent(id)
      openCaja(
        {
          event_id: id,
          session_id: r.session_id,
          caja,
          fondo: Number(r.fondo),
          opened_at: new Date().toISOString(),
          seller: { id: rep.id, name: rep.full_name },
        },
        r.last_seq,
      )
      navigate('/venta', { replace: true })
    } catch (e) {
      const err = e as { message?: string; details?: string }
      if (err.message?.includes('caja_ocupada')) setAskForce(err.details ?? occupied[caja] ?? 'otra persona')
      else setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 md:px-8 h-16 flex items-center gap-3 border-b border-ink-08 dark:border-dark-border">
        <button type="button" onClick={() => navigate('/eventos')} aria-label="Volver" className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <Eyebrow>Abrir caja</Eyebrow>
          <div className="font-serif text-[22px] leading-none truncate text-ink dark:text-dark-ink">{ready ? event.name : 'Cargando…'}</div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {error && <Notice tone="danger">{error}</Notice>}
        {notOpen && <Notice>El punto de venta de este evento está “{config.status}”. Quien coordina debe abrirlo para vender.</Notice>}
        {ready && config.notas && <Notice tone="info">{config.notas}</Notice>}
        {ready && (
          <p className="text-[13px] text-ink-50 dark:text-dark-ink-50">
            {items.filter((i) => i.active).length} productos · las botellas salen de {config.warehouse}
          </p>
        )}

        <div>
          <div className="text-[12px] font-semibold text-ink-70 dark:text-dark-ink-70 mb-2">Caja de este dispositivo</div>
          <div className="grid grid-cols-4 gap-2">
            {CAJAS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCaja(c)}
                className={cn(
                  'rounded-xl border py-3 text-center',
                  caja === c
                    ? 'border-wine bg-wine text-white dark:border-gold dark:bg-gold dark:text-wine-deep'
                    : 'border-ink-15 bg-paper dark:bg-dark-surface dark:border-dark-border',
                )}
              >
                <div className="font-semibold">{c.replace('CAJA-', 'Caja ')}</div>
                <div className={cn('text-[10px] truncate px-1', caja === c ? 'opacity-80' : 'text-ink-50')}>{occupied[c] ? `En uso: ${occupied[c]}` : 'Libre'}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-ink-70 dark:text-dark-ink-70 mb-2">Fondo de caja (efectivo para dar cambio)</div>
          <div className="text-center font-serif text-[40px] tabular text-ink dark:text-dark-ink mb-3">{mxn(toNumber(fondo))}</div>
          <Keypad value={fondo} onChange={setFondo} allowDecimal={false} />
        </div>

        <Btn size="xl" fullWidth onClick={() => open(false)} disabled={!ready || !!notOpen || busy} icon={<Unlock size={20} />}>
          {busy ? 'Abriendo…' : `Abrir ${caja.replace('CAJA-', 'caja ')}`}
        </Btn>
        <p className="text-[12px] text-center text-ink-50 dark:text-dark-ink-50">Vende: {rep?.full_name}. Para abrir caja se necesita internet.</p>

        {askForce && (
          <Notice tone="danger">
            <div className="space-y-2">
              <div>
                {caja} ya está abierta por <b>{askForce}</b> en otro dispositivo. Si ese dispositivo ya no se usa (se apagó o se borró), puedes liberarla y abrirla aquí. Sus ventas no se pierden.
              </div>
              <div className="flex gap-2">
                <Btn size="sm" kind="danger" onClick={() => { setAskForce(null); void open(true) }}>Liberar y abrir aquí</Btn>
                <Btn size="sm" kind="ghost" onClick={() => setAskForce(null)}>Elegir otra caja</Btn>
              </div>
            </div>
          </Notice>
        )}
      </div>
    </div>
  )
}
