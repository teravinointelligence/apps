import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Closing, Sale } from '@/types'

// Copia local de las ventas y cortes de este dispositivo. Regla de negocio:
// el dinero ya se cobró, así que la venta SIEMPRE se guarda primero aquí y
// después se sube (lib/sync). Nada se borra hasta que el servidor la tiene.

const MAX_KEEP = 3000

type SalesState = {
  sales: Sale[]
  closings: Closing[]
  addSale: (s: Sale) => void
  patchSale: (id: string, patch: Partial<Sale>) => void
  addClosing: (c: Closing) => void
  patchClosing: (clientId: string, patch: Partial<Closing>) => void
}

export const useSales = create<SalesState>()(
  persist(
    (set, get) => ({
      sales: [],
      closings: [],
      addSale: (s) => {
        const all = [s, ...get().sales]
        // Solo se recortan ventas viejas que ya están en el servidor.
        const keep = all.length > MAX_KEEP ? all.filter((x, i) => i < MAX_KEEP || !x.synced) : all
        set({ sales: keep })
      },
      patchSale: (id, patch) => set({ sales: get().sales.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      addClosing: (c) => set({ closings: [c, ...get().closings].slice(0, 300) }),
      patchClosing: (clientId, patch) =>
        set({ closings: get().closings.map((c) => (c.client_id === clientId ? { ...c, ...patch } : c)) }),
    }),
    { name: 'teravino-pos.sales' },
  ),
)

export const pendingSales = (sales: Sale[]) => sales.filter((s) => !s.synced)
export const pendingClosings = (closings: Closing[]) => closings.filter((c) => !c.synced)
