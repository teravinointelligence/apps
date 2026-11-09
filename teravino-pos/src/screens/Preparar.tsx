import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileSpreadsheet, Lock, Plus, Search, Trash2, Unlock, EyeOff, Eye } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Badge } from '@/ui/Badge'
import { Eyebrow, Field, Notice } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { cn } from '@/ui/cn'
import {
  canManageEvent,
  deleteItem,
  fetchCatalog,
  fetchEventBundle,
  fetchEventWines,
  fetchWarehouses,
  saveConfig,
  saveItems,
  setPosStatus,
  type CatalogProduct,
  type ItemDraft,
} from '@/lib/api'
import { humanError } from '@/lib/errors'
import { suggestPrefix } from '@/lib/ids'
import { mxn, toNumber } from '@/lib/money'
import { buildSalidaWorkbook, fileSlug, shareOrDownloadWorkbook } from '@/lib/excel'
import { categoryLabel } from '@/lib/labels'
import type { CrmEvent, PosConfig, PosItem } from '@/types'

type Row = {
  id?: string
  product_id: string
  sku: string
  codigo_contpaqi: string | null
  name: string
  category: string | null
  vintage: string | null
  volume_ml: number | null
  precio: string
  salida: string
  active: boolean
  sort_order: number
  // conteo de cierre: se conserva tal cual al guardar
  regreso: number | null
  degustacion: number | null
  merma: number | null
}


const guessWarehouse = (city: string | null, list: string[]) => {
  const c = (city ?? '').toLowerCase()
  const pick = c.includes('paz')
    ? 'La Paz'
    : c.includes('tijuana') || c.includes('ensenada') || c.includes('valle de guadalupe')
      ? 'Tijuana'
      : c.includes('vallarta') || c.includes('nayarit') || c.includes('sayulita') || c.includes('punta mita')
        ? 'Vallarta'
        : 'Los Cabos'
  return list.includes(pick) ? pick : (list[0] ?? pick)
}

const toRow = (i: PosItem): Row => ({
  id: i.id,
  product_id: i.product_id,
  sku: i.sku,
  codigo_contpaqi: i.codigo_contpaqi,
  name: i.name,
  category: i.category,
  vintage: i.vintage,
  volume_ml: i.volume_ml,
  precio: String(i.precio),
  salida: String(i.salida),
  active: i.active,
  sort_order: i.sort_order,
  regreso: i.regreso,
  degustacion: i.degustacion,
  merma: i.merma,
})

export function PrepararScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<CrmEvent | null>(null)
  const [config, setConfig] = useState<PosConfig | null>(null)
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [catalog, setCatalog] = useState<CatalogProduct[] | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [form, setForm] = useState({ warehouse: '', folio_prefix: '', descuento_max_pct: '10', spei_clabe: '', spei_banco: '', spei_titular: '', notas: '' })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [q, setQ] = useState('')
  const [suggested, setSuggested] = useState<Record<string, number>>({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [b, wh, ok, wines] = await Promise.all([fetchEventBundle(id), fetchWarehouses(), canManageEvent(id), fetchEventWines(id)])
        if (!alive) return
        setAllowed(ok)
        setEvent(b.event)
        setWarehouses(wh)
        setConfig(b.config)
        setRows(b.items.map(toRow))
        setSuggested(Object.fromEntries(wines.map((w) => [w.product_id as string, Number(w.bottle_count ?? 0)])))
        const c = b.config
        setForm({
          warehouse: c?.warehouse ?? guessWarehouse(b.event?.city ?? null, wh),
          folio_prefix: c?.folio_prefix ?? suggestPrefix(b.event?.name ?? 'EV'),
          descuento_max_pct: String(c?.descuento_max_pct ?? 10),
          spei_clabe: c?.spei_clabe ?? '',
          spei_banco: c?.spei_banco ?? '',
          spei_titular: c?.spei_titular ?? 'TERAVINO S.A. de C.V.',
          notas: c?.notas ?? '',
        })
        if (!c) setDirty(true)
        fetchCatalog().then((p) => alive && setCatalog(p)).catch((e) => alive && setError(humanError(e)))
      } catch (e) {
        if (alive) setError(humanError(e as Error))
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const catalogById = useMemo(() => new Map((catalog ?? []).map((p) => [p.id, p])), [catalog])
  const status = config?.status ?? 'preparando'
  const locked = status !== 'preparando'

  const patchForm = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
  }
  const patchRow = (pid: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.product_id === pid ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  const addProduct = (p: CatalogProduct) => {
    if (rows.some((r) => r.product_id === p.id)) return
    const stock = p.stock[form.warehouse] ?? 0
    const sug = suggested[p.id]
    setRows((rs) => [
      ...rs,
      {
        product_id: p.id,
        sku: p.sku,
        codigo_contpaqi: p.codigo_contpaqi,
        name: p.name,
        category: p.category,
        vintage: p.vintage,
        volume_ml: p.volume_ml,
        precio: '',
        salida: String(sug ?? Math.min(12, Math.max(0, stock))),
        active: true,
        sort_order: rs.length,
        regreso: null,
        degustacion: null,
        merma: null,
      },
    ])
    setDirty(true)
  }

  const removeRow = (r: Row) => {
    if (locked) return
    setRows((rs) => rs.filter((x) => x.product_id !== r.product_id))
    if (r.id) setRemoved((x) => [...x, r.id!])
    setDirty(true)
  }

  const results = useMemo(() => {
    if (!catalog) return []
    const terms = q
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const list = terms.length
      ? catalog.filter((p) => {
          const hay = norm(`${p.name} ${p.sku} ${p.codigo_contpaqi ?? ''} ${p.vintage ?? ''}`)
          return terms.every((t) => hay.includes(t))
        })
      : catalog.filter((p) => suggested[p.id] != null || (p.stock[form.warehouse] ?? 0) > 0)
    return list.slice(0, 60)
  }, [catalog, q, form.warehouse, suggested])

  const issues = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const r of rows) {
      const list: string[] = []
      const precio = toNumber(r.precio)
      const p = catalogById.get(r.product_id)
      if (!(precio > 0)) list.push('Falta precio al público')
      else if (p && p.base_price > 0 && precio < p.base_price * 1.16 - 0.5)
        list.push(`Precio abajo del mayoreo con IVA (${mxn(p.base_price * 1.16)})`)
      const salida = toNumber(r.salida)
      if (!Number.isInteger(salida) || salida < 0) list.push('Salida no válida')
      else if (p && salida > (p.stock[form.warehouse] ?? 0))
        list.push(`Salen ${salida} y ${form.warehouse} tiene ${p.stock[form.warehouse] ?? 0} según CONTPAQi`)
      if (list.length) out[r.product_id] = list
    }
    return out
  }, [rows, catalogById, form.warehouse])

  const blocking = rows.some((r) => !(toNumber(r.precio) > 0) || !Number.isInteger(toNumber(r.salida)) || toNumber(r.salida) < 0)

  const validateForm = (): string | null => {
    if (!form.warehouse) return 'Elige el almacén de origen.'
    if (!/^[A-Z0-9]{2,8}$/.test(form.folio_prefix)) return 'El prefijo de folio debe tener de 2 a 8 letras o números, sin espacios.'
    const d = toNumber(form.descuento_max_pct)
    if (d < 0 || d > 100) return 'El descuento máximo debe estar entre 0 y 100.'
    if (form.spei_clabe && !/^[0-9]{18}$/.test(form.spei_clabe)) return 'La CLABE debe tener 18 dígitos.'
    return null
  }

  const save = async (): Promise<boolean> => {
    const v = validateForm()
    if (v) {
      setError(v)
      return false
    }
    if (blocking) {
      setError('Revisa los renglones marcados: todos necesitan precio y una salida válida.')
      return false
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await saveConfig({
        event_id: id,
        status,
        warehouse: form.warehouse,
        folio_prefix: form.folio_prefix,
        descuento_max_pct: toNumber(form.descuento_max_pct),
        spei_clabe: form.spei_clabe || null,
        spei_banco: form.spei_banco || null,
        spei_titular: form.spei_titular || null,
        notas: form.notas || null,
      })
      for (const rid of removed) await deleteItem(rid)
      const drafts: ItemDraft[] = rows.map((r, i) => ({
        id: r.id,
        event_id: id,
        product_id: r.product_id,
        sku: r.sku,
        codigo_contpaqi: r.codigo_contpaqi,
        name: r.name,
        category: r.category,
        vintage: r.vintage,
        volume_ml: r.volume_ml,
        precio: toNumber(r.precio),
        salida: toNumber(r.salida),
        regreso: r.regreso,
        degustacion: r.degustacion,
        merma: r.merma,
        sort_order: i,
        active: r.active,
      }))
      await saveItems(drafts)
      const b = await fetchEventBundle(id)
      setConfig(b.config)
      setRows(b.items.map(toRow))
      setRemoved([])
      setDirty(false)
      setMsg('Guardado.')
      return true
    } catch (e) {
      setError(humanError(e as Error))
      return false
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (next: PosConfig['status']) => {
    if (next === 'abierto') {
      if (!rows.filter((r) => r.active).length) {
        setError('Agrega al menos un producto antes de abrir.')
        return
      }
      if (dirty && !(await save())) return
      if (!confirm('¿Abrir el punto de venta? Los vendedores ya podrán abrir caja y cobrar. La lista de productos queda fija (los precios se pueden ajustar).')) return
    }
    setBusy(true)
    try {
      await setPosStatus(id, next)
      const b = await fetchEventBundle(id)
      setConfig(b.config)
      setMsg(next === 'abierto' ? 'Punto de venta abierto.' : 'De vuelta en preparación.')
    } catch (e) {
      setError(humanError(e as Error))
    } finally {
      setBusy(false)
    }
  }

  const exportSalida = async () => {
    if (!config) return
    const b = await fetchEventBundle(id)
    if (!b.config) return
    await shareOrDownloadWorkbook(
      buildSalidaWorkbook(b.event, b.config, b.items),
      `TeraVino-salida-${fileSlug(b.event?.name ?? 'evento')}.xlsx`,
      `Salida a evento: ${b.event?.name ?? ''}`,
    )
  }

  if (allowed === false)
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <Notice tone="danger">Solo dirección o quien coordina este evento en el CRM puede preparar su punto de venta.</Notice>
        <Btn kind="ghost" onClick={() => navigate('/eventos')} icon={<ArrowLeft size={16} />}>Volver</Btn>
      </div>
    )

  const totalBotellas = rows.filter((r) => r.active).reduce((a, r) => a + Math.max(0, toNumber(r.salida)), 0)
  const valorSalida = rows.filter((r) => r.active).reduce((a, r) => a + Math.max(0, toNumber(r.salida)) * toNumber(r.precio), 0)

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 bg-cream/95 dark:bg-dark-bg/95 backdrop-blur border-b border-ink-08 dark:border-dark-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center gap-3">
          <button type="button" onClick={() => (!dirty || confirm('Hay cambios sin guardar. ¿Salir?')) && navigate('/eventos')} aria-label="Volver" className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <Eyebrow>Lista y precios</Eyebrow>
            <div className="font-serif text-[22px] leading-none truncate text-ink dark:text-dark-ink">{event?.name ?? 'Evento'}</div>
          </div>
          {config && (
            <Badge tone={status === 'abierto' ? 'success' : status === 'preparando' ? 'warning' : 'neutral'}>
              {status === 'abierto' ? 'Abierto' : status === 'preparando' ? 'En preparación' : 'Cerrado'}
            </Badge>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {error && <Notice tone="danger">{error}</Notice>}
        {msg && <Notice tone="success">{msg}</Notice>}

        <section className="bg-paper dark:bg-dark-surface rounded-2xl border border-ink-08 dark:border-dark-border p-5 grid gap-4 md:grid-cols-3">
          <Field label="Almacén de origen" hint="De aquí salen las botellas. El POS no descuenta inventario: se concilia al cerrar.">
            <select className="field" value={form.warehouse} disabled={locked} onChange={(e) => patchForm('warehouse', e.target.value)}>
              {warehouses.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </Field>
          <Field label="Prefijo de folio" hint={`Tickets: ${form.folio_prefix || 'XX'}-1-0001`}>
            <input
              className="field font-mono uppercase"
              value={form.folio_prefix}
              maxLength={8}
              disabled={locked}
              onChange={(e) => patchForm('folio_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
          </Field>
          <Field label="Descuento máximo por ticket (%)" hint="Ningún vendedor puede dar más que esto.">
            <input className="field tabular" inputMode="decimal" value={form.descuento_max_pct} onChange={(e) => patchForm('descuento_max_pct', e.target.value)} />
          </Field>
          <Field label="CLABE para SPEI (opcional)" hint="Sin CLABE, el cobro por SPEI no aparece.">
            <input className="field font-mono" inputMode="numeric" maxLength={18} value={form.spei_clabe} onChange={(e) => patchForm('spei_clabe', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Banco">
            <input className="field" value={form.spei_banco} onChange={(e) => patchForm('spei_banco', e.target.value)} />
          </Field>
          <Field label="Titular de la cuenta">
            <input className="field" value={form.spei_titular} onChange={(e) => patchForm('spei_titular', e.target.value)} />
          </Field>
          <div className="md:col-span-3">
            <Field label="Notas para el equipo (opcional)">
              <input className="field" value={form.notas} onChange={(e) => patchForm('notas', e.target.value)} placeholder="Ej. Cobrar cortesías solo con autorización de Sabrina" />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <Eyebrow>Productos del evento</Eyebrow>
              <div className="text-[13px] text-ink-50 dark:text-dark-ink-50">
                {rows.length} productos · {totalBotellas} botellas · valor al público {mxn(valorSalida)}
              </div>
            </div>
            <div className="flex gap-2">
              {!locked && (
                <Btn onClick={() => setPicker(true)} icon={<Plus size={16} />} disabled={!catalog}>
                  {catalog ? 'Agregar producto' : 'Cargando catálogo…'}
                </Btn>
              )}
            </div>
          </div>

          {locked && (
            <Notice tone="info">
              El punto de venta está {status}. Puedes ajustar precios y ocultar productos; para agregar o quitar productos, regrésalo a preparación.
            </Notice>
          )}

          {rows.length === 0 && <Notice tone="info">Aún no hay productos. Agrega los vinos que se llevan al evento, con su precio al público (IVA incluido) y cuántas botellas salen.</Notice>}

          <div className="space-y-2">
            {rows.map((r) => {
              const p = catalogById.get(r.product_id)
              const stock = p?.stock[form.warehouse]
              const iss = issues[r.product_id]
              return (
                <div key={r.product_id} className={cn('bg-paper dark:bg-dark-surface rounded-xl border p-3 md:p-4', iss ? 'border-warning/50' : 'border-ink-08 dark:border-dark-border', !r.active && 'opacity-60')}>
                  <div className="flex gap-3 items-start flex-wrap md:flex-nowrap">
                    <div className="min-w-0 flex-1 basis-full md:basis-auto">
                      <div className="font-medium text-[15px] text-ink dark:text-dark-ink leading-snug">{r.name}</div>
                      <div className="text-[12px] text-ink-50 dark:text-dark-ink-50 flex flex-wrap gap-x-3">
                        <span className="font-mono">{r.sku}</span>
                        {r.vintage && <span>{r.vintage}</span>}
                        {r.category && <span>{categoryLabel(r.category)}</span>}
                        {p && <span>Mayoreo s/IVA {mxn(p.base_price)}</span>}
                        {stock != null && <span>{form.warehouse}: {stock}</span>}
                      </div>
                    </div>
                    <label className="w-[132px]">
                      <span className="block text-[11px] text-ink-50 mb-1">Precio público c/IVA</span>
                      <input className="field tabular text-right" inputMode="decimal" value={r.precio} placeholder="0.00" onChange={(e) => patchRow(r.product_id, { precio: e.target.value })} />
                    </label>
                    <label className="w-[92px]">
                      <span className="block text-[11px] text-ink-50 mb-1">Salida (bot.)</span>
                      <input className="field tabular text-right" inputMode="numeric" value={r.salida} onChange={(e) => patchRow(r.product_id, { salida: e.target.value.replace(/\D/g, '') })} />
                    </label>
                    <div className="flex gap-1 pt-5">
                      <button type="button" onClick={() => patchRow(r.product_id, { active: !r.active })} title={r.active ? 'Ocultar en el POS' : 'Mostrar en el POS'} className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center text-ink-50">
                        {r.active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      {!locked && (
                        <button type="button" onClick={() => removeRow(r)} title="Quitar" className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center text-danger">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  {iss && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-warning">
                      {iss.map((m) => (
                        <span key={m} className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {m}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <footer className="fixed bottom-0 inset-x-0 bg-paper/95 dark:bg-dark-surface/95 backdrop-blur border-t border-ink-08 dark:border-dark-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex gap-2 flex-wrap justify-end">
          {config && (
            <Btn kind="ghost" onClick={exportSalida} icon={<FileSpreadsheet size={16} />}>Hoja de salida</Btn>
          )}
          {config && status === 'abierto' && (
            <Btn kind="ghost" onClick={() => changeStatus('preparando')} disabled={busy} icon={<Lock size={16} />}>Pasar a preparación</Btn>
          )}
          <Btn kind={status === 'preparando' && config ? 'ghost' : 'primary'} onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Guardando…' : config ? 'Guardar cambios' : 'Crear punto de venta'}
          </Btn>
          {config && status === 'preparando' && (
            <Btn onClick={() => changeStatus('abierto')} disabled={busy} icon={<Unlock size={16} />}>Abrir para vender</Btn>
          )}
        </div>
      </footer>

      <Modal open={picker} title="Agregar producto" onClose={() => setPicker(false)} wide>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-30" />
          <input className="field pl-9" autoFocus placeholder="Busca por nombre, SKU o código CONTPAQi" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!q && (
          <p className="text-[12px] text-ink-50 mb-2">
            {Object.keys(suggested).length ? 'Vinos del evento en el CRM y ' : ''}productos con existencia en {form.warehouse}:
          </p>
        )}
        <div className="divide-y divide-ink-08 dark:divide-dark-border">
          {results.map((p) => {
            const added = rows.some((r) => r.product_id === p.id)
            return (
              <button
                key={p.id}
                type="button"
                disabled={added}
                onClick={() => addProduct(p)}
                className="w-full text-left py-2.5 flex items-center gap-3 disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-ink dark:text-dark-ink truncate">{p.name}</div>
                  <div className="text-[11px] text-ink-50 font-mono truncate">
                    {p.sku} · {categoryLabel(p.category)} · mayoreo {mxn(p.base_price)}
                    {suggested[p.id] != null ? ' · en vinos del evento' : ''}
                  </div>
                </div>
                <div className="text-right text-[12px] tabular">
                  <div className={cn((p.stock[form.warehouse] ?? 0) > 0 ? 'text-success' : 'text-ink-30')}>{p.stock[form.warehouse] ?? 0} en {form.warehouse}</div>
                </div>
                {added ? <Badge tone="success">Agregado</Badge> : <Plus size={18} className="text-wine dark:text-gold" />}
              </button>
            )
          })}
          {!results.length && <p className="py-6 text-center text-ink-50 text-[14px]">Sin resultados.</p>}
        </div>
      </Modal>
    </div>
  )
}
