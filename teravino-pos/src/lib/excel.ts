import * as XLSX from 'xlsx'
import { round2, sinIva } from '@/lib/money'
import type { CrmEvent, Method, PosConfig, PosItem, Sale, SaleLine, ServerClosing, ServerSale } from '@/types'

// Archivos para logística y CONTPAQi. Mismo formato de "Tickets" y "Partidas"
// que el POS de V612, para que facturación los procese igual.

export const CONCILIACION_EMAIL = 'pedidos@teravino.com'

type AnySale = Pick<
  Sale,
  'id' | 'folio' | 'caja' | 'at' | 'lines' | 'subtotal' | 'discount' | 'total' | 'iva' | 'method' | 'received' | 'change' | 'card_ref' | 'customer'
> & { sellerName: string; status?: string }

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' })
const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mazatlan' })

export const fromLocal = (s: Sale): AnySale => ({ ...s, sellerName: s.seller.name, status: s.synced ? 'En servidor' : 'PENDIENTE de subir' })
export const fromServer = (s: ServerSale): AnySale => ({
  ...s,
  sellerName: s.seller_name,
  status: s.voided_at ? 'ANULADA' : s.needs_review ? 'Revisar' : 'OK',
})

export function salesStats(sales: AnySale[]) {
  const byMethod: Record<Method, number> = { Efectivo: 0, Tarjeta: 0, SPEI: 0 }
  let total = 0
  let units = 0
  for (const s of sales) {
    byMethod[s.method] += s.total
    total += s.total
    units += s.lines.reduce((a, l) => a + l.qty, 0)
  }
  return { tickets: sales.length, units, total: round2(total), byMethod }
}

function ticketsSheet(sales: AnySale[]) {
  const rows = sales.map((s) => ({
    Folio: s.folio,
    Fecha: fmtFecha(s.at),
    Hora: fmtHora(s.at),
    Caja: s.caja,
    Vendedor: s.sellerName,
    Cliente: s.customer?.name || 'Público en general',
    'Requiere factura': s.customer?.factura ? `Sí ${s.customer.rfc ?? ''}`.trim() : '',
    'Método de pago': s.method,
    'Ref. terminal': s.card_ref ?? '',
    'Subtotal (precio lista)': round2(s.subtotal),
    Descuento: round2(s.discount),
    'Total (IVA incl.)': round2(s.total),
    'Base sin IVA': sinIva(s.total),
    IVA: round2(s.iva),
    Recibido: s.received ?? '',
    Cambio: s.change ?? '',
    Estado: s.status ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [18, 11, 7, 8, 16, 22, 16, 10, 12, 12, 10, 12, 12, 10, 10, 9, 16].map((wch) => ({ wch }))
  return ws
}

function partidasRows(sales: AnySale[]) {
  // El descuento del ticket se prorratea entre sus renglones según su importe,
  // para que la suma de partidas cuadre con lo cobrado.
  const out: Record<string, string | number>[] = []
  for (const s of sales) {
    const gross = s.lines.reduce((a, l) => a + l.price * l.qty, 0)
    s.lines.forEach((l: SaleLine) => {
      const g = l.price * l.qty
      const share = gross > 0 ? (s.discount * g) / gross : 0
      const importe = Math.max(0, g - share)
      out.push({
        Folio: s.folio,
        Fecha: fmtFecha(s.at),
        Caja: s.caja,
        Vendedor: s.sellerName,
        SKU: l.sku,
        'Código CONTPAQi': l.codigo_contpaqi ?? '',
        Producto: l.name,
        Cantidad: l.qty,
        'Precio unitario (IVA incl.)': round2(l.price),
        'Descuento prorrateado': round2(share),
        'Importe (IVA incl.)': round2(importe),
        'Base sin IVA': sinIva(importe),
        IVA: round2(importe - importe / 1.16),
        'Método de pago': s.method,
      })
    })
  }
  return out
}

function partidasSheet(sales: AnySale[]) {
  const ws = XLSX.utils.json_to_sheet(partidasRows(sales))
  ws['!cols'] = [18, 11, 8, 16, 18, 14, 36, 9, 14, 12, 14, 12, 10, 10].map((wch) => ({ wch }))
  return ws
}

const kv = (rows: Array<[string, string | number]>) => {
  const ws = XLSX.utils.aoa_to_sheet([['Concepto', 'Valor'], ...rows])
  ws['!cols'] = [{ wch: 44 }, { wch: 34 }]
  return ws
}

const eventLabel = (e: CrmEvent | null) =>
  e ? [e.name, e.venue_name, e.city].filter(Boolean).join(' · ') : '—'

/** Corte de una caja: lo que cobró este dispositivo en su turno. */
export function buildCorteWorkbook(p: {
  event: CrmEvent | null
  config: PosConfig | null
  caja: string
  seller: string
  fondo: number
  contado: number
  notas: string
  sales: Sale[]
}) {
  const sales = [...p.sales].sort((a, b) => a.at.localeCompare(b.at)).map(fromLocal)
  const st = salesStats(sales)
  const esperado = p.fondo + st.byMethod.Efectivo
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    kv([
      ['Evento', eventLabel(p.event)],
      ['Almacén de origen', p.config?.warehouse ?? '—'],
      ['Caja', p.caja],
      ['Vendedor', p.seller],
      ['Fondo de apertura', round2(p.fondo)],
      ['Tickets', st.tickets],
      ['Botellas vendidas', st.units],
      ['Ventas en efectivo', round2(st.byMethod.Efectivo)],
      ['Ventas con tarjeta (terminal)', round2(st.byMethod.Tarjeta)],
      ['Ventas por SPEI', round2(st.byMethod.SPEI)],
      ['Total cobrado (IVA incluido)', st.total],
      ['Efectivo esperado (fondo + efectivo)', round2(esperado)],
      ['Efectivo contado (arqueo)', round2(p.contado)],
      ['Diferencia (contado − esperado)', round2(p.contado - esperado)],
      ['Nota del arqueo', p.notas || '—'],
      ['Ventas sin subir al servidor', p.sales.filter((s) => !s.synced).length],
      ['Generado', new Date().toLocaleString('es-MX', { timeZone: 'America/Mazatlan' })],
    ]),
    'Resumen',
  )
  XLSX.utils.book_append_sheet(wb, ticketsSheet(sales), 'Tickets')
  XLSX.utils.book_append_sheet(wb, partidasSheet(sales), 'Partidas')
  return wb
}

export type ConciliacionRow = {
  item: PosItem
  vendidas: number
  diferencia: number | null
}

export function conciliacion(items: PosItem[], sales: ServerSale[]): ConciliacionRow[] {
  const sold: Record<string, number> = {}
  for (const s of sales) {
    if (s.voided_at) continue
    for (const l of s.lines) sold[l.product_id] = (sold[l.product_id] ?? 0) + l.qty
  }
  return items.map((item) => {
    const vendidas = sold[item.product_id] ?? 0
    const contado = item.regreso != null && item.degustacion != null && item.merma != null
    return {
      item,
      vendidas,
      diferencia: contado ? item.salida - vendidas - item.degustacion! - item.merma! - item.regreso! : null,
    }
  })
}

/** Cierre completo del evento para CONTPAQi. */
export function buildEventWorkbook(p: {
  event: CrmEvent | null
  config: PosConfig
  items: PosItem[]
  sales: ServerSale[]
  closings: ServerClosing[]
}) {
  const valid = p.sales.filter((s) => !s.voided_at).map(fromServer)
  const st = salesStats(valid)
  const conc = conciliacion(p.items, p.sales)
  const wb = XLSX.utils.book_new()

  const sellers = new Map<string, { tickets: number; units: number; total: number }>()
  for (const s of valid) {
    const v = sellers.get(s.sellerName) ?? { tickets: 0, units: 0, total: 0 }
    v.tickets += 1
    v.units += s.lines.reduce((a, l) => a + l.qty, 0)
    v.total += s.total
    sellers.set(s.sellerName, v)
  }

  XLSX.utils.book_append_sheet(
    wb,
    kv([
      ['Evento', eventLabel(p.event)],
      ['Fecha del evento', p.event?.event_date ?? p.event?.start_date?.slice(0, 10) ?? '—'],
      ['Almacén de origen', p.config.warehouse],
      ['Estado del POS', p.config.status],
      ['Tickets válidos', st.tickets],
      ['Tickets anulados', p.sales.length - valid.length],
      ['Tickets por revisar', p.sales.filter((s) => s.needs_review && !s.voided_at).length],
      ['Botellas vendidas', st.units],
      ['Efectivo', round2(st.byMethod.Efectivo)],
      ['Tarjeta (terminal)', round2(st.byMethod.Tarjeta)],
      ['SPEI', round2(st.byMethod.SPEI)],
      ['Total cobrado (IVA incluido)', st.total],
      ['Base sin IVA', sinIva(st.total)],
      ['IVA', round2(st.total - sinIva(st.total))],
      ['Diferencias de arqueo (suma)', round2(p.closings.reduce((a, c) => a + Number(c.diferencia), 0))],
      ['Botellas con diferencia en conciliación', conc.filter((r) => r.diferencia != null && r.diferencia !== 0).length],
      ['Generado', new Date().toLocaleString('es-MX', { timeZone: 'America/Mazatlan' })],
      ['Enviar a', CONCILIACION_EMAIL],
    ]),
    'Resumen',
  )

  const wsConc = XLSX.utils.json_to_sheet(
    conc.map((r) => ({
      SKU: r.item.sku,
      'Código CONTPAQi': r.item.codigo_contpaqi ?? '',
      Producto: r.item.name,
      'Precio público (IVA incl.)': r.item.precio,
      Salida: r.item.salida,
      Vendidas: r.vendidas,
      'Degustación / cortesía': r.item.degustacion ?? '',
      Merma: r.item.merma ?? '',
      Regreso: r.item.regreso ?? '',
      'Diferencia (faltante + / sobrante −)': r.diferencia ?? 'Sin contar',
    })),
  )
  wsConc['!cols'] = [18, 14, 36, 14, 8, 9, 12, 8, 9, 18].map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(wb, wsConc, 'Conciliación')

  XLSX.utils.book_append_sheet(wb, ticketsSheet(p.sales.map(fromServer)), 'Tickets')
  XLSX.utils.book_append_sheet(wb, partidasSheet(valid), 'Partidas')

  const wsSellers = XLSX.utils.json_to_sheet(
    [...sellers.entries()].map(([name, v]) => ({
      Vendedor: name,
      Tickets: v.tickets,
      Botellas: v.units,
      'Total (IVA incl.)': round2(v.total),
      'Base sin IVA': sinIva(v.total),
    })),
  )
  wsSellers['!cols'] = [22, 9, 9, 14, 14].map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(wb, wsSellers, 'Por vendedor')

  const wsCortes = XLSX.utils.json_to_sheet(
    p.closings.map((c) => ({
      Caja: c.caja,
      Vendedor: c.seller_name,
      Hora: fmtFecha(c.at) + ' ' + fmtHora(c.at),
      Fondo: Number(c.fondo),
      Tickets: c.tickets,
      Efectivo: Number(c.efectivo),
      Tarjeta: Number(c.tarjeta),
      SPEI: Number(c.spei),
      'Efectivo esperado': Number(c.efectivo_esperado),
      'Efectivo contado': Number(c.efectivo_contado),
      Diferencia: Number(c.diferencia),
      Nota: c.notas ?? '',
    })),
  )
  XLSX.utils.book_append_sheet(wb, wsCortes, 'Cortes de caja')
  return wb
}

/** Hoja de salida para logística (qué botellas salen del almacén). */
export function buildSalidaWorkbook(event: CrmEvent | null, config: PosConfig, items: PosItem[]) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Salida a evento', eventLabel(event)],
    ['Almacén de origen', config.warehouse],
    ['Fecha', event?.event_date ?? event?.start_date?.slice(0, 10) ?? ''],
    [],
    ['SKU', 'Código CONTPAQi', 'Producto', 'Añada', 'Cantidad', 'Precio público (IVA incl.)', 'Revisó'],
    ...items.filter((i) => i.active).map((i) => [i.sku, i.codigo_contpaqi ?? '', i.name, i.vintage ?? '', i.salida, i.precio, '']),
    [],
    ['Total botellas', '', '', '', items.filter((i) => i.active).reduce((a, i) => a + i.salida, 0)],
    [],
    ['Entregó (almacén):', '', '', 'Recibió (evento):'],
  ])
  ws['!cols'] = [18, 14, 36, 8, 10, 14, 12].map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(wb, ws, 'Salida')
  return wb
}

export async function shareOrDownloadWorkbook(wb: XLSX.WorkBook, fileName: string, text: string) {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const file = new File([blob], fileName, { type: blob.type })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName, text })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

export const fileSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
