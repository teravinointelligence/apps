import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, FileSpreadsheet } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Eyebrow, Field, Notice } from '@/ui/Field'
import { Keypad } from '@/ui/Keypad'
import { cn } from '@/ui/cn'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { useAuth } from '@/store/auth'
import { useCart } from '@/store/cart'
import { useSales } from '@/store/sales'
import { fetchServerSales } from '@/lib/api'
import { buildCorteWorkbook, fileSlug, shareOrDownloadWorkbook } from '@/lib/excel'
import { newId } from '@/lib/ids'
import { mxn, round2, toNumber } from '@/lib/money'
import { syncNow } from '@/lib/sync'
import type { Closing } from '@/types'

export function CorteScreen() {
  const navigate = useNavigate()
  const caja = useDevice((s) => s.caja)
  const closeCaja = useDevice((s) => s.closeCaja)
  const { event, config } = useEvent()
  const rep = useAuth((s) => s.rep)
  const cartLines = useCart((s) => s.lines)
  const allSales = useSales((s) => s.sales)
  const addClosing = useSales((s) => s.addClosing)
  const [voided, setVoided] = useState<Set<string>>(new Set())
  const [contado, setContado] = useState('')
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!caja) return
    fetchServerSales(caja.event_id)
      .then((s) => setVoided(new Set(s.filter((x) => x.voided_at).map((x) => x.id))))
      .catch(() => undefined)
  }, [caja])

  const sales = useMemo(
    () => allSales.filter((s) => caja && s.event_id === caja.event_id && s.session_id === caja.session_id && !voided.has(s.id)),
    [allSales, caja, voided],
  )
  const st = useMemo(() => {
    const by = { Efectivo: 0, Tarjeta: 0, SPEI: 0 }
    for (const s of sales) by[s.method] += s.total
    return { by, total: sales.reduce((a, s) => a + s.total, 0), units: sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0) }
  }, [sales])

  if (!caja) return null
  const esperado = round2(caja.fondo + st.by.Efectivo)
  const contadoN = toNumber(contado)
  const dif = round2(contadoN - esperado)
  const pend = sales.filter((s) => !s.synced).length
  const needsNote = contado !== '' && Math.abs(dif) >= 1

  const confirmar = async () => {
    if (busy || !rep) return
    if (contado === '') return alert('Captura el efectivo contado (aunque sea $0).')
    if (needsNote && notas.trim().length < 3) return alert('Hay diferencia en el arqueo: escribe una nota.')
    if (cartLines.length && !confirm('Hay un ticket abierto sin cobrar. Se descartará. ¿Continuar?')) return
    if (!confirm(`¿Cerrar ${caja.caja}? Después ya no se puede cobrar en esta caja hasta abrirla de nuevo.`)) return
    setBusy(true)
    const closing: Closing = {
      client_id: newId('cl'),
      event_id: caja.event_id,
      session_id: caja.session_id,
      caja: caja.caja,
      seller: { id: caja.seller.id, name: caja.seller.name },
      fondo: caja.fondo,
      tickets: sales.length,
      total: round2(st.total),
      efectivo: round2(st.by.Efectivo),
      tarjeta: round2(st.by.Tarjeta),
      spei: round2(st.by.SPEI),
      efectivo_esperado: esperado,
      efectivo_contado: contadoN,
      diferencia: dif,
      notas: notas.trim(),
      at: new Date().toISOString(),
      synced: false,
    }
    addClosing(closing)
    void syncNow()
    try {
      await shareOrDownloadWorkbook(
        buildCorteWorkbook({ event, config, caja: caja.caja, seller: caja.seller.name, fondo: caja.fondo, contado: contadoN, notas, sales }),
        `TeraVino-corte-${fileSlug(event?.name ?? 'evento')}-${caja.caja}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.xlsx`,
        `Corte ${caja.caja} · ${event?.name ?? ''}`,
      )
    } catch {
      // El corte ya quedó guardado; el Excel es solo una copia.
    }
    useCart.getState().clear()
    closeCaja()
    navigate('/eventos', { replace: true })
  }

  const row = (label: string, value: string, strong?: boolean) => (
    <div className={cn('flex justify-between py-1.5', strong && 'font-semibold')}>
      <span className="text-ink-70 dark:text-dark-ink-70">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )

  return (
    <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-5 grid lg:grid-cols-2 gap-6">
      <section className="space-y-4">
        <div>
          <Eyebrow>Corte de caja · {caja.caja}</Eyebrow>
          <div className="font-serif text-[30px] leading-none">{mxn(st.total)}</div>
          <div className="text-[13px] text-ink-50 mt-1">{sales.length} tickets · {st.units} botellas · {caja.seller.name}</div>
        </div>
        <div className="rounded-xl bg-paper dark:bg-dark-surface border border-ink-08 dark:border-dark-border px-4 py-2 text-[14px] divide-y divide-ink-08 dark:divide-dark-border">
          {row('Fondo de apertura', mxn(caja.fondo))}
          {row('Ventas en efectivo', mxn(st.by.Efectivo))}
          {row('Ventas con tarjeta (terminal)', mxn(st.by.Tarjeta))}
          {config?.spei_clabe ? row('Ventas por SPEI', mxn(st.by.SPEI)) : null}
          {row('Efectivo esperado en caja', mxn(esperado), true)}
        </div>
        <Notice tone="info">Compara también el total de tarjeta ({mxn(st.by.Tarjeta)}) contra el cierre de lote de la terminal.</Notice>
        {pend > 0 && <Notice>{pend} ventas de esta caja aún no suben al servidor. El corte se guarda igual y todo se sube solo al volver el internet.</Notice>}
      </section>

      <section className="space-y-4">
        <div className="rounded-xl bg-paper dark:bg-dark-surface border border-ink-08 dark:border-dark-border p-4">
          <div className="text-[12px] text-ink-50">Efectivo contado</div>
          <div className="font-serif text-[34px] tabular">{mxn(contadoN)}</div>
          {contado !== '' && (
            <div className={cn('text-[14px] font-semibold', dif === 0 ? 'text-success' : 'text-danger')}>
              {dif === 0 ? 'Cuadra exacto' : dif > 0 ? `Sobran ${mxn(dif)}` : `Faltan ${mxn(-dif)}`}
            </div>
          )}
        </div>
        <Keypad value={contado} onChange={setContado} />
        <Field label={needsNote ? 'Nota del arqueo (obligatoria)' : 'Nota del arqueo (opcional)'}>
          <input className="field" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. se dio cambio de más en un ticket" />
        </Field>
        <Btn size="xl" fullWidth onClick={confirmar} disabled={busy} icon={<Calculator size={20} />}>
          Cerrar caja y descargar corte
        </Btn>
        <p className="text-[12px] text-ink-50 flex items-center gap-1.5"><FileSpreadsheet size={13} /> Se genera el Excel del corte (resumen, tickets y partidas).</p>
      </section>
    </div>
  )
}
