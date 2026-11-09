import { supabase } from '@/lib/supabase'
import type {
  Closing,
  CrmEvent,
  PosConfig,
  PosItem,
  PosStatus,
  Sale,
  ServerClosing,
  ServerSale,
} from '@/types'

// Todas las llamadas al CRM en un solo lugar.

const EVENT_FIELDS = 'id, name, event_type, event_date, start_date, venue_name, city, status, coordinator_id'
const CONFIG_FIELDS =
  'event_id, status, warehouse, folio_prefix, descuento_max_pct, spei_clabe, spei_banco, spei_titular, notas, closed_at'
const ITEM_FIELDS =
  'id, event_id, product_id, sku, codigo_contpaqi, name, category, vintage, volume_ml, precio, salida, regreso, degustacion, merma, sort_order, active'

const num = (v: unknown) => (v == null ? 0 : Number(v))
const numOrNull = (v: unknown) => (v == null ? null : Number(v))

function normConfig(r: Record<string, unknown>): PosConfig {
  return { ...(r as PosConfig), descuento_max_pct: num(r.descuento_max_pct) }
}

function normItem(r: Record<string, unknown>): PosItem {
  return {
    ...(r as PosItem),
    precio: num(r.precio),
    salida: num(r.salida),
    regreso: numOrNull(r.regreso),
    degustacion: numOrNull(r.degustacion),
    merma: numOrNull(r.merma),
  }
}

function normSale(r: Record<string, unknown>): ServerSale {
  return {
    ...(r as ServerSale),
    subtotal: num(r.subtotal),
    discount: num(r.discount),
    discount_pct: numOrNull(r.discount_pct),
    iva: num(r.iva),
    total: num(r.total),
    received: numOrNull(r.received),
    change: numOrNull(r.change),
    lines: ((r.lines as ServerSale['lines']) ?? []).map((l) => ({ ...l, qty: num(l.qty), price: num(l.price) })),
    review_notes: (r.review_notes as string[]) ?? [],
  }
}

export type EventWithPos = CrmEvent & { pos: PosConfig | null }

/** Eventos con POS (cualquier estado) + próximos eventos del CRM sin POS. */
export async function fetchEventList(): Promise<EventWithPos[]> {
  const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
  const [configs, upcoming] = await Promise.all([
    supabase.from('event_pos_config').select(CONFIG_FIELDS),
    supabase
      .from('events')
      .select(EVENT_FIELDS)
      .neq('status', 'cancelled')
      .or(`event_date.gte.${since},start_date.gte.${since}`)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(80),
  ])
  if (configs.error) throw configs.error
  if (upcoming.error) throw upcoming.error

  const byEvent = new Map<string, PosConfig>()
  for (const c of configs.data ?? []) byEvent.set(c.event_id, normConfig(c))

  const events = new Map<string, CrmEvent>()
  for (const e of upcoming.data ?? []) events.set(e.id, e as CrmEvent)

  const missing = [...byEvent.keys()].filter((id) => !events.has(id))
  if (missing.length) {
    const { data, error } = await supabase.from('events').select(EVENT_FIELDS).in('id', missing)
    if (error) throw error
    for (const e of data ?? []) events.set(e.id, e as CrmEvent)
  }

  return [...events.values()].map((e) => ({ ...e, pos: byEvent.get(e.id) ?? null }))
}

export async function fetchEventBundle(eventId: string) {
  const [ev, cfg, items] = await Promise.all([
    supabase.from('events').select(EVENT_FIELDS).eq('id', eventId).maybeSingle(),
    supabase.from('event_pos_config').select(CONFIG_FIELDS).eq('event_id', eventId).maybeSingle(),
    supabase.from('event_pos_items').select(ITEM_FIELDS).eq('event_id', eventId).order('sort_order').order('name'),
  ])
  if (ev.error) throw ev.error
  if (cfg.error) throw cfg.error
  if (items.error) throw items.error
  return {
    event: (ev.data as CrmEvent | null) ?? null,
    config: cfg.data ? normConfig(cfg.data) : null,
    items: (items.data ?? []).map(normItem),
  }
}

export async function canManageEvent(eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('event_pos_can_manage', { p_event: eventId })
  if (error) return false
  return data === true
}

export async function fetchServerSales(eventId: string): Promise<ServerSale[]> {
  const out: ServerSale[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('event_pos_sales')
      .select('*')
      .eq('event_id', eventId)
      .order('at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map(normSale))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function fetchClosings(eventId: string): Promise<ServerClosing[]> {
  const { data, error } = await supabase
    .from('event_pos_closings')
    .select('*')
    .eq('event_id', eventId)
    .order('at')
  if (error) throw error
  return (data ?? []) as ServerClosing[]
}

export async function fetchOpenSessions(eventId: string) {
  const { data, error } = await supabase
    .from('event_pos_sessions')
    .select('id, caja, seller_name, opened_at, device_id')
    .eq('event_id', eventId)
    .is('closed_at', null)
  if (error) throw error
  return data ?? []
}

// --- Preparación (admin / coordinador) -------------------------------------

export async function saveConfig(cfg: Omit<PosConfig, 'closed_at'>) {
  const { error } = await supabase.from('event_pos_config').upsert(cfg, { onConflict: 'event_id' })
  if (error) throw error
}

export async function setPosStatus(eventId: string, status: PosStatus) {
  const { error } = await supabase.from('event_pos_config').update({ status }).eq('event_id', eventId)
  if (error) throw error
}

export type ItemDraft = Omit<PosItem, 'id'> & { id?: string }

export async function saveItems(items: ItemDraft[]) {
  if (!items.length) return
  // Sin id: en un upsert por lote PostgREST manda null en las columnas que
  // faltan en algún renglón, y un id null rompería los productos nuevos. La
  // llave natural (evento, producto) identifica el renglón.
  const rows = items.map(({ id: _id, ...rest }) => {
    void _id
    return rest
  })
  const { error } = await supabase.from('event_pos_items').upsert(rows, { onConflict: 'event_id,product_id' })
  if (error) throw error
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('event_pos_items').delete().eq('id', id)
  if (error) throw error
}

export async function saveConteo(
  rows: { id: string; regreso: number | null; degustacion: number | null; merma: number | null }[],
) {
  // Un update por renglón: RLS valida cada uno y no se pisan otros campos.
  for (const r of rows) {
    const { error } = await supabase
      .from('event_pos_items')
      .update({ regreso: r.regreso, degustacion: r.degustacion, merma: r.merma })
      .eq('id', r.id)
    if (error) throw error
  }
}

export type CatalogProduct = {
  id: string
  sku: string
  name: string
  category: string | null
  vintage: string | null
  volume_ml: number | null
  base_price: number
  codigo_contpaqi: string | null
  stock: Record<string, number>
}

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const products: CatalogProduct[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, category, vintage, volume_ml, base_price, codigo_contpaqi')
      .eq('active', true)
      .order('name')
      .range(from, from + 999)
    if (error) throw error
    for (const p of data ?? []) products.push({ ...p, base_price: num(p.base_price), stock: {} } as CatalogProduct)
    if (!data || data.length < 1000) break
  }
  const byId = new Map(products.map((p) => [p.id, p]))
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('product_warehouse_stock')
      .select('product_id, warehouse, stock_quantity')
      .range(from, from + 999)
    if (error) throw error
    for (const s of data ?? []) {
      const p = byId.get(s.product_id)
      if (p) p.stock[s.warehouse] = num(s.stock_quantity)
    }
    if (!data || data.length < 1000) break
  }
  return products
}

export async function fetchWarehouses(): Promise<string[]> {
  // product_warehouse_stock tiene un renglón por producto y almacén; con los
  // primeros miles basta para conocer los almacenes.
  const { data, error } = await supabase.from('product_warehouse_stock').select('warehouse').limit(3000)
  if (error) throw error
  const set = new Set((data ?? []).map((r) => r.warehouse as string))
  const order = ['Los Cabos', 'La Paz', 'Tijuana', 'Vallarta', 'V612']
  const rank = (w: string) => (order.includes(w) ? order.indexOf(w) : 99)
  return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export async function fetchEventWines(eventId: string) {
  const { data, error } = await supabase
    .from('event_wines')
    .select('product_id, bottle_count')
    .eq('event_id', eventId)
    .not('product_id', 'is', null)
  if (error) return []
  return data ?? []
}

// --- RPCs de caja ----------------------------------------------------------

export async function openSession(p: {
  eventId: string
  caja: string
  deviceId: string
  fondo: number
  force?: boolean
}) {
  const { data, error } = await supabase.rpc('event_pos_open_session', {
    p_event: p.eventId,
    p_caja: p.caja,
    p_device: p.deviceId,
    p_fondo: p.fondo,
    p_force: p.force ?? false,
  })
  if (error) throw error
  return data as { session_id: string; resumed: boolean; fondo: number; last_seq: number }
}

export async function recordSale(sale: Sale) {
  const payload = {
    id: sale.id,
    event_id: sale.event_id,
    session_id: sale.session_id,
    folio: sale.folio,
    caja: sale.caja,
    at: sale.at,
    seller: sale.seller,
    customer: sale.customer,
    lines: sale.lines,
    discount: sale.discount,
    discount_pct: sale.discount_pct,
    total: sale.total,
    method: sale.method,
    received: sale.received,
    change: sale.change,
    card_ref: sale.card_ref,
  }
  const { data, error } = await supabase.rpc('event_pos_record_sale', { p_sale: payload })
  if (error) throw error
  return data as { status: 'ok' | 'duplicada'; notes?: string[] }
}

export async function recordClosing(c: Closing) {
  const { synced: _s, syncError: _e, ...payload } = c
  void _s
  void _e
  const { data, error } = await supabase.rpc('event_pos_record_closing', { p: payload })
  if (error) throw error
  return data as { status: string; id: string }
}

export async function voidSale(id: string, reason: string) {
  const { error } = await supabase.rpc('event_pos_void_sale', { p_id: id, p_reason: reason })
  if (error) throw error
}
