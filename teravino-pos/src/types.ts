// Tipos compartidos. Los nombres de campo siguen a las tablas del CRM
// (snake_case) para no traducir de ida y vuelta.

export type PosStatus = 'preparando' | 'abierto' | 'cerrado'
export type Method = 'Efectivo' | 'Tarjeta' | 'SPEI'
export const METHODS: Method[] = ['Efectivo', 'Tarjeta', 'SPEI']

export type Rep = {
  id: string
  full_name: string
  email: string | null
  role: string
}

/** Evento del CRM (tabla events). Solo los campos que usa el POS. */
export type CrmEvent = {
  id: string
  name: string
  event_type: string | null
  event_date: string | null
  start_date: string | null
  venue_name: string | null
  city: string | null
  status: string | null
  coordinator_id: string | null
}

export type PosConfig = {
  event_id: string
  status: PosStatus
  warehouse: string
  folio_prefix: string
  descuento_max_pct: number
  spei_clabe: string | null
  spei_banco: string | null
  spei_titular: string | null
  notas: string | null
  closed_at: string | null
}

export type PosItem = {
  id: string
  event_id: string
  product_id: string
  sku: string
  codigo_contpaqi: string | null
  name: string
  category: string | null
  vintage: string | null
  volume_ml: number | null
  /** Precio al público con IVA. */
  precio: number
  salida: number
  regreso: number | null
  degustacion: number | null
  merma: number | null
  sort_order: number
  active: boolean
}

export type SaleLine = {
  product_id: string
  sku: string
  codigo_contpaqi: string | null
  name: string
  qty: number
  /** Precio unitario con IVA. */
  price: number
}

export type Customer = {
  name?: string
  phone?: string
  email?: string
  rfc?: string
  factura?: boolean
  marketing?: boolean
}

/** Venta tal como se guarda en el dispositivo (y se sube con la RPC). */
export type Sale = {
  id: string
  event_id: string
  session_id: string | null
  folio: string
  caja: string
  at: string
  seller: { id: string; name: string }
  customer: Customer | null
  lines: SaleLine[]
  subtotal: number
  discount: number
  discount_pct: number | null
  iva: number
  total: number
  method: Method
  received: number | null
  change: number | null
  card_ref: string | null
  // Solo en el dispositivo:
  synced: boolean
  syncError?: string
  serverNotes?: string[]
}

/** Venta leída del servidor (tabla event_pos_sales). */
export type ServerSale = {
  id: string
  event_id: string
  session_id: string | null
  folio: string
  caja: string
  at: string
  seller_id: string
  seller_name: string
  customer: Customer | null
  lines: SaleLine[]
  subtotal: number
  discount: number
  discount_pct: number | null
  iva: number
  total: number
  method: Method
  received: number | null
  change: number | null
  card_ref: string | null
  needs_review: boolean
  review_notes: string[]
  voided_at: string | null
  void_reason: string | null
}

export type Closing = {
  client_id: string
  event_id: string
  session_id: string | null
  caja: string
  seller: { id: string; name: string }
  fondo: number
  tickets: number
  total: number
  efectivo: number
  tarjeta: number
  spei: number
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  notas: string
  at: string
  synced: boolean
  syncError?: string
}

export type ServerClosing = Omit<Closing, 'seller' | 'synced' | 'syncError' | 'notas'> & {
  id: string
  seller_id: string
  seller_name: string
  notas: string | null
}

/** Caja abierta en este dispositivo. */
export type CajaSession = {
  event_id: string
  session_id: string
  caja: string
  fondo: number
  opened_at: string
  seller: { id: string; name: string }
}
