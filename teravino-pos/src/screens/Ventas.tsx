import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, ChevronDown, ChevronUp, Printer, RefreshCw } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Badge } from '@/ui/Badge'
import { Eyebrow, Field, Notice } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { cn } from '@/ui/cn'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { useSales } from '@/store/sales'
import { canManageEvent, fetchServerSales, voidSale } from '@/lib/api'
import { humanError } from '@/lib/errors'
import { mxn } from '@/lib/money'
import { syncNow } from '@/lib/sync'
import type { Method, SaleLine, ServerSale } from '@/types'

type Row = {
  id: string
  folio: string
  at: string
  caja: string
  seller: string
  method: Method
  total: number
  lines: SaleLine[]
  customer: string | null
  local: boolean
  synced: boolean
  syncError?: string
  review: string[]
  voided: string | null
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mazatlan' })

export function VentasScreen() {
  const navigate = useNavigate()
  const caja = useDevice((s) => s.caja)
  const event = useEvent((s) => s.event)
  const refreshSold = useEvent((s) => s.refreshSold)
  const localSales = useSales((s) => s.sales)
  const [tab, setTab] = useState<'caja' | 'evento'>('caja')
  const [server, setServer] = useState<ServerSale[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [manage, setManage] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<Row | null>(null)
  const [reason, setReason] = useState('')
  const [voidErr, setVoidErr] = useState<string | null>(null)

  const eventId = caja?.event_id ?? ''

  const refresh = useCallback(
    () =>
      syncNow()
        .then(() => (eventId ? fetchServerSales(eventId) : null))
        .then((s) => {
          if (s) setServer(s)
          setError(null)
          void refreshSold()
        })
        .catch((e) => setError(humanError(e as Error)))
        .finally(() => setLoading(false)),
    [eventId, refreshSold],
  )

  useEffect(() => {
    void refresh()
    if (eventId) canManageEvent(eventId).then(setManage)
  }, [refresh, eventId])

  const serverById = useMemo(() => new Map((server ?? []).map((s) => [s.id, s])), [server])

  const rows: Row[] = useMemo(() => {
    if (tab === 'caja') {
      return localSales
        .filter((s) => s.event_id === eventId && s.session_id === caja?.session_id)
        .map((s) => {
          const sv = serverById.get(s.id)
          return {
            id: s.id,
            folio: s.folio,
            at: s.at,
            caja: s.caja,
            seller: s.seller.name,
            method: s.method,
            total: s.total,
            lines: s.lines,
            customer: s.customer?.name ?? null,
            local: true,
            synced: s.synced,
            syncError: s.syncError,
            review: sv?.review_notes ?? s.serverNotes ?? [],
            voided: sv?.voided_at ? sv.void_reason ?? 'Anulada' : null,
          }
        })
    }
    return [...(server ?? [])].reverse().map((s) => ({
      id: s.id,
      folio: s.folio,
      at: s.at,
      caja: s.caja,
      seller: s.seller_name,
      method: s.method,
      total: s.total,
      lines: s.lines,
      customer: s.customer?.name ?? null,
      local: localSales.some((l) => l.id === s.id),
      synced: true,
      review: s.review_notes,
      voided: s.voided_at ? s.void_reason ?? 'Anulada' : null,
    }))
  }, [tab, localSales, eventId, caja?.session_id, server, serverById])

  const valid = rows.filter((r) => !r.voided)
  const totalValid = valid.reduce((a, r) => a + r.total, 0)
  const pendingInEvent = localSales.filter((s) => s.event_id === eventId && !s.synced).length

  const doVoid = async () => {
    if (!voiding) return
    setVoidErr(null)
    try {
      await voidSale(voiding.id, reason)
      setVoiding(null)
      setReason('')
      setLoading(true)
      await refresh()
    } catch (e) {
      setVoidErr(humanError(e as Error))
    }
  }

  return (
    <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-5 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Eyebrow>Ventas</Eyebrow>
          <div className="font-serif text-[30px] leading-none">{mxn(totalValid)}</div>
          <div className="text-[13px] text-ink-50 dark:text-dark-ink-50 mt-1">{valid.length} tickets · {tab === 'caja' ? `${caja?.caja} (este turno)` : event?.name}</div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-lg border border-ink-15 dark:border-dark-border overflow-hidden">
            {(['caja', 'evento'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cn('px-3.5 py-2 text-[13px]', tab === t ? 'bg-wine text-white dark:bg-gold dark:text-wine-deep' : '')}>
                {t === 'caja' ? 'Mi caja' : 'Todo el evento'}
              </button>
            ))}
          </div>
          <Btn kind="subtle" size="sm" onClick={() => { setLoading(true); void refresh() }} disabled={loading} icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>Actualizar</Btn>
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      {tab === 'evento' && pendingInEvent > 0 && <Notice>{pendingInEvent} ventas de este dispositivo aún no suben y no aparecen en “Todo el evento”.</Notice>}

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-ink-50 text-[14px] py-6 text-center">Sin ventas todavía.</p>}
        {rows.map((r) => (
          <div key={r.id} className={cn('rounded-xl border bg-paper dark:bg-dark-surface', r.voided ? 'border-danger/30 opacity-70' : 'border-ink-08 dark:border-dark-border')}>
            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
              <div className="w-14 text-[13px] tabular text-ink-50">{hora(r.at)}</div>
              <div className="min-w-0 flex-1">
                <div className={cn('font-mono text-[13px]', r.voided && 'line-through')}>{r.folio}</div>
                <div className="text-[12px] text-ink-50 truncate">
                  {r.seller} · {r.method} · {r.lines.reduce((a, l) => a + l.qty, 0)} bot.{r.customer ? ` · ${r.customer}` : ''}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn('tabular font-semibold', r.voided && 'line-through')}>{mxn(r.total)}</span>
                {r.voided ? (
                  <Badge tone="danger">Anulada</Badge>
                ) : !r.synced ? (
                  <Badge tone={r.syncError ? 'danger' : 'warning'}>{r.syncError ? 'Error al subir' : 'Por subir'}</Badge>
                ) : r.review.length ? (
                  <Badge tone="warning">Revisar</Badge>
                ) : (
                  <Badge tone="success">En servidor</Badge>
                )}
              </div>
              {open === r.id ? <ChevronUp size={16} className="text-ink-30" /> : <ChevronDown size={16} className="text-ink-30" />}
            </button>
            {open === r.id && (
              <div className="px-4 pb-4 space-y-2 text-[13px]">
                {r.lines.map((l) => (
                  <div key={l.product_id} className="flex justify-between gap-3"><span>{l.qty} × {l.name}</span><span className="tabular">{mxn(l.qty * l.price)}</span></div>
                ))}
                {r.syncError && <Notice tone="danger">{r.syncError}</Notice>}
                {r.review.length > 0 && <Notice>{r.review.join(' · ')}</Notice>}
                {r.voided && <Notice tone="danger">Motivo: {r.voided}</Notice>}
                <div className="flex gap-2 pt-1">
                  {r.local && <Btn size="sm" kind="ghost" onClick={() => navigate(`/recibo/${r.id}`)} icon={<Printer size={14} />}>Ver ticket</Btn>}
                  {manage && r.synced && !r.voided && serverById.has(r.id) && (
                    <Btn size="sm" kind="danger" onClick={() => { setVoiding(r); setReason(''); setVoidErr(null) }} icon={<Ban size={14} />}>Anular</Btn>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={!!voiding}
        title={`Anular ${voiding?.folio ?? ''}`}
        onClose={() => setVoiding(null)}
        footer={
          <>
            <Btn kind="ghost" onClick={() => setVoiding(null)}>Cancelar</Btn>
            <Btn kind="danger" onClick={doVoid} disabled={reason.trim().length < 3}>Anular venta</Btn>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px]">
            La venta queda registrada como anulada (no se borra) y deja de contar en el corte del evento y en la conciliación. Si fue en efectivo, devuelve {mxn(voiding?.total ?? 0)} al cliente; si fue con tarjeta, cancela también en la terminal.
          </p>
          <Field label="Motivo">
            <input className="field" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. se cobró dos veces" />
          </Field>
          {voidErr && <Notice tone="danger">{voidErr}</Notice>}
        </div>
      </Modal>
    </div>
  )
}
