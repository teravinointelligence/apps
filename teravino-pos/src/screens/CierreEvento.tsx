import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Lock, RefreshCw, Unlock } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Badge } from '@/ui/Badge'
import { Eyebrow, Notice } from '@/ui/Field'
import { cn } from '@/ui/cn'
import {
  canManageEvent,
  fetchClosings,
  fetchEventBundle,
  fetchOpenSessions,
  fetchServerSales,
  saveConteo,
  setPosStatus,
} from '@/lib/api'
import { humanError } from '@/lib/errors'
import { mxn } from '@/lib/money'
import { buildEventWorkbook, conciliacion, CONCILIACION_EMAIL, fileSlug, salesStats, fromServer, shareOrDownloadWorkbook } from '@/lib/excel'
import type { CrmEvent, PosConfig, PosItem, ServerClosing, ServerSale } from '@/types'

type Conteo = Record<string, { regreso: string; degustacion: string; merma: string }>
type OpenSession = Awaited<ReturnType<typeof fetchOpenSessions>>[number]

const toInt = (s: string) => (s === '' ? null : Math.max(0, Math.floor(Number(s) || 0)))

export function CierreEventoScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [event, setEvent] = useState<CrmEvent | null>(null)
  const [config, setConfig] = useState<PosConfig | null>(null)
  const [items, setItems] = useState<PosItem[]>([])
  const [sales, setSales] = useState<ServerSale[]>([])
  const [closings, setClosings] = useState<ServerClosing[]>([])
  const [open, setOpen] = useState<OpenSession[]>([])
  const [conteo, setConteo] = useState<Conteo>({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(
    () =>
      Promise.all([canManageEvent(id), fetchEventBundle(id), fetchServerSales(id), fetchClosings(id), fetchOpenSessions(id)])
        .then(([ok, b, s, c, o]) => {
          setError(null)
          setAllowed(ok)
          setEvent(b.event)
          setConfig(b.config)
          setItems(b.items)
          setSales(s)
          setClosings(c)
          setOpen(o)
          setConteo(
            Object.fromEntries(
              b.items.map((i) => [i.id, { regreso: i.regreso?.toString() ?? '', degustacion: i.degustacion?.toString() ?? '', merma: i.merma?.toString() ?? '' }]),
            ),
          )
          setDirty(false)
        })
        .catch((e) => setError(humanError(e as Error))),
    [id],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Conciliación con lo capturado en pantalla (aunque no se haya guardado).
  const itemsWithConteo = useMemo(
    () =>
      items.map((i) => ({
        ...i,
        regreso: toInt(conteo[i.id]?.regreso ?? ''),
        degustacion: toInt(conteo[i.id]?.degustacion ?? ''),
        merma: toInt(conteo[i.id]?.merma ?? ''),
      })),
    [items, conteo],
  )
  const conc = useMemo(() => conciliacion(itemsWithConteo, sales), [itemsWithConteo, sales])
  const valid = useMemo(() => sales.filter((s) => !s.voided_at), [sales])
  const st = useMemo(() => salesStats(valid.map(fromServer)), [valid])
  const review = sales.filter((s) => s.needs_review && !s.voided_at)
  const faltan = conc.filter((r) => r.diferencia == null).length
  const conDif = conc.filter((r) => r.diferencia != null && r.diferencia !== 0)
  const difArqueo = closings.reduce((a, c) => a + Number(c.diferencia), 0)

  const set = (itemId: string, k: 'regreso' | 'degustacion' | 'merma', v: string) => {
    setConteo((c) => ({ ...c, [itemId]: { ...c[itemId], [k]: v.replace(/\D/g, '') } }))
    setDirty(true)
  }

  const guardar = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveConteo(itemsWithConteo.map((i) => ({ id: i.id, regreso: i.regreso, degustacion: i.degustacion, merma: i.merma })))
      await load()
      setMsg('Conteo guardado.')
    } catch (e) {
      setError(humanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  const cerrar = async () => {
    if (faltan) return setError(`Faltan ${faltan} productos por contar (regreso, degustación y merma; pon 0 si no hubo).`)
    if (open.length && !confirm(`Hay ${open.length} caja(s) sin corte (${open.map((o) => `${o.caja} de ${o.seller_name}`).join(', ')}). Sus ventas cuentan igual, pero falta su arqueo. ¿Cerrar de todos modos?`)) return
    if (conDif.length && !confirm(`${conDif.length} productos tienen diferencia entre salida y lo contado. ¿Cerrar así?`)) return
    setBusy(true)
    try {
      if (dirty) await saveConteo(itemsWithConteo.map((i) => ({ id: i.id, regreso: i.regreso, degustacion: i.degustacion, merma: i.merma })))
      await setPosStatus(id, 'cerrado')
      await load()
      setMsg('Evento cerrado. Descarga el Excel para CONTPAQi.')
    } catch (e) {
      setError(humanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  const reabrir = async () => {
    if (!confirm('¿Reabrir el punto de venta? Los vendedores podrán volver a cobrar.')) return
    setBusy(true)
    try {
      await setPosStatus(id, 'abierto')
      await load()
    } catch (e) {
      setError(humanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  const excel = async () => {
    if (!config) return
    await shareOrDownloadWorkbook(
      buildEventWorkbook({ event, config, items: itemsWithConteo, sales, closings }),
      `TeraVino-cierre-${fileSlug(event?.name ?? 'evento')}.xlsx`,
      `Cierre de evento ${event?.name ?? ''} para CONTPAQi`,
    )
  }

  if (allowed === false)
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <Notice tone="danger">Solo dirección o quien coordina este evento puede conciliar y cerrarlo.</Notice>
        <Btn kind="ghost" onClick={() => navigate('/eventos')} icon={<ArrowLeft size={16} />}>Volver</Btn>
      </div>
    )

  const closed = config?.status === 'cerrado'

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 bg-cream/95 dark:bg-dark-bg/95 backdrop-blur border-b border-ink-08 dark:border-dark-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center gap-3">
          <button type="button" onClick={() => (!dirty || confirm('Hay conteo sin guardar. ¿Salir?')) && navigate('/eventos')} aria-label="Volver" className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <Eyebrow>Conciliación y cierre</Eyebrow>
            <div className="font-serif text-[22px] leading-none truncate">{event?.name ?? 'Evento'}</div>
          </div>
          <Btn kind="subtle" size="sm" onClick={load} icon={<RefreshCw size={14} />}>Actualizar</Btn>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {error && <Notice tone="danger">{error}</Notice>}
        {msg && <Notice tone="success">{msg}</Notice>}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Total cobrado', mxn(st.total)],
            ['Tickets', `${st.tickets}${sales.length - valid.length ? ` (+${sales.length - valid.length} anulados)` : ''}`],
            ['Botellas vendidas', String(st.units)],
            ['Dif. de arqueo', mxn(difArqueo)],
            ['Efectivo', mxn(st.byMethod.Efectivo)],
            ['Tarjeta', mxn(st.byMethod.Tarjeta)],
            ['SPEI', mxn(st.byMethod.SPEI)],
            ['Cortes de caja', `${closings.length}${open.length ? ` · ${open.length} abierta(s)` : ''}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-paper dark:bg-dark-surface border border-ink-08 dark:border-dark-border p-3">
              <div className="text-[11px] text-ink-50">{k}</div>
              <div className="font-serif text-[22px] tabular leading-tight">{v}</div>
            </div>
          ))}
        </section>

        {open.length > 0 && <Notice>Cajas sin corte: {open.map((o) => `${o.caja} (${o.seller_name})`).join(', ')}.</Notice>}
        {review.length > 0 && (
          <Notice>
            {review.length} ticket(s) por revisar: {review.slice(0, 4).map((s) => `${s.folio} — ${s.review_notes.join('; ')}`).join(' · ')}
            {review.length > 4 ? '…' : ''}
          </Notice>
        )}

        <section className="space-y-2">
          <Eyebrow>Conteo de botellas</Eyebrow>
          <p className="text-[13px] text-ink-50 dark:text-dark-ink-50">
            Diferencia = salida − vendidas − degustación/cortesía − merma − regreso. Debe dar 0; positiva es faltante.
          </p>
          <div className="overflow-x-auto pretty-scroll rounded-xl border border-ink-08 dark:border-dark-border bg-paper dark:bg-dark-surface">
            <table className="w-full text-[13px] min-w-[720px]">
              <thead className="text-[11px] text-ink-50 text-left">
                <tr className="border-b border-ink-08 dark:border-dark-border">
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-2 py-2 font-semibold text-right">Salida</th>
                  <th className="px-2 py-2 font-semibold text-right">Vendidas</th>
                  <th className="px-2 py-2 font-semibold text-right">Degustación</th>
                  <th className="px-2 py-2 font-semibold text-right">Merma</th>
                  <th className="px-2 py-2 font-semibold text-right">Regreso</th>
                  <th className="px-3 py-2 font-semibold text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {conc.map((r) => (
                  <tr key={r.item.id} className="border-b last:border-0 border-ink-08 dark:border-dark-border">
                    <td className="px-3 py-2">
                      <div className="text-ink dark:text-dark-ink">{r.item.name}</div>
                      <div className="text-[11px] text-ink-50 font-mono">{r.item.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">{r.item.salida}</td>
                    <td className="px-2 py-2 text-right tabular">{r.vendidas}</td>
                    {(['degustacion', 'merma', 'regreso'] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5 text-right">
                        <input
                          className="field tabular text-right !min-h-[38px] !py-1.5 w-[76px]"
                          inputMode="numeric"
                          disabled={closed}
                          value={conteo[r.item.id]?.[k] ?? ''}
                          onChange={(e) => set(r.item.id, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className={cn('px-3 py-2 text-right tabular font-semibold', r.diferencia == null ? 'text-ink-30' : r.diferencia === 0 ? 'text-success' : 'text-danger')}>
                      {r.diferencia == null ? '—' : r.diferencia > 0 ? `Faltan ${r.diferencia}` : r.diferencia < 0 ? `Sobran ${-r.diferencia}` : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {closings.length > 0 && (
          <section className="space-y-2">
            <Eyebrow>Cortes de caja</Eyebrow>
            <div className="space-y-2">
              {closings.map((c) => (
                <div key={c.id} className="rounded-xl bg-paper dark:bg-dark-surface border border-ink-08 dark:border-dark-border px-4 py-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] items-center">
                  <b>{c.caja}</b>
                  <span>{c.seller_name}</span>
                  <span className="tabular">Total {mxn(Number(c.total))}</span>
                  <span className="tabular">Efectivo esperado {mxn(Number(c.efectivo_esperado))} · contado {mxn(Number(c.efectivo_contado))}</span>
                  <Badge tone={Number(c.diferencia) === 0 ? 'success' : 'danger'}>Dif. {mxn(Number(c.diferencia))}</Badge>
                  {c.notas && <span className="text-ink-50">“{c.notas}”</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="fixed bottom-0 inset-x-0 bg-paper/95 dark:bg-dark-surface/95 backdrop-blur border-t border-ink-08 dark:border-dark-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex gap-2 flex-wrap justify-end items-center">
          <span className="text-[12px] text-ink-50 mr-auto hidden md:block">El Excel va a {CONCILIACION_EMAIL} para capturar en CONTPAQi.</span>
          <Btn kind="ghost" onClick={excel} disabled={!config} icon={<FileSpreadsheet size={16} />}>Excel para CONTPAQi</Btn>
          {!closed && <Btn kind="ghost" onClick={guardar} disabled={busy || !dirty}>Guardar conteo</Btn>}
          {!closed ? (
            <Btn onClick={cerrar} disabled={busy || !config} icon={<Lock size={16} />}>Cerrar evento</Btn>
          ) : (
            <Btn kind="ghost" onClick={reabrir} disabled={busy} icon={<Unlock size={16} />}>Reabrir</Btn>
          )}
        </div>
      </footer>
    </div>
  )
}
