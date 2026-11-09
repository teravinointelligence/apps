import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { round2 } from '@/lib/money'
import type { Customer, PosItem } from '@/types'

// Un solo ticket abierto a la vez. Precios con IVA incluido (lista del
// evento). El descuento es al ticket y nunca pasa del máximo del evento.

export type DiscountMode = 'percent' | 'amount'
export type CartLine = { item: PosItem; qty: number }

type CartState = {
  eventId: string | null
  lines: CartLine[]
  discountMode: DiscountMode
  discountValue: number
  customer: Customer | null

  ensureEvent: (eventId: string) => void
  add: (item: PosItem) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  setDiscount: (mode: DiscountMode, value: number) => void
  setCustomer: (c: Customer | null) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      eventId: null,
      lines: [],
      discountMode: 'percent',
      discountValue: 0,
      customer: null,

      ensureEvent: (eventId) => {
        if (get().eventId !== eventId)
          set({ eventId, lines: [], discountValue: 0, discountMode: 'percent', customer: null })
      },
      add: (item) => {
        const lines = get().lines
        const ex = lines.find((l) => l.item.product_id === item.product_id)
        set({
          lines: ex
            ? lines.map((l) => (l.item.product_id === item.product_id ? { ...l, qty: l.qty + 1 } : l))
            : [...lines, { item, qty: 1 }],
        })
      },
      setQty: (productId, qty) =>
        set({
          lines: get()
            .lines.map((l) => (l.item.product_id === productId ? { ...l, qty: Math.max(0, Math.floor(qty)) } : l))
            .filter((l) => l.qty > 0),
        }),
      remove: (productId) => set({ lines: get().lines.filter((l) => l.item.product_id !== productId) }),
      setDiscount: (mode, value) => set({ discountMode: mode, discountValue: Math.max(0, value) }),
      setCustomer: (c) => set({ customer: c }),
      clear: () => set({ lines: [], discountValue: 0, discountMode: 'percent', customer: null }),
    }),
    { name: 'teravino-pos.cart' },
  ),
)

export const cartSubtotal = (lines: CartLine[]) => round2(lines.reduce((s, l) => s + l.item.precio * l.qty, 0))
export const cartUnits = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty, 0)

/** Descuento aplicado (en pesos), recortado al máximo permitido por el evento. */
export function cartDiscount(
  lines: CartLine[],
  mode: DiscountMode,
  value: number,
  maxPct: number,
): { applied: number; capped: boolean; pct: number } {
  const sub = cartSubtotal(lines)
  if (sub <= 0 || value <= 0) return { applied: 0, capped: false, pct: 0 }
  const requested = mode === 'percent' ? (sub * value) / 100 : value
  const max = (sub * maxPct) / 100
  const applied = round2(Math.min(requested, max, sub))
  return { applied, capped: requested > max + 0.005, pct: round2((applied / sub) * 100) }
}
