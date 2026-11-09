import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchEventBundle, fetchServerSales } from '@/lib/api'
import { isNetworkError } from '@/lib/errors'
import type { CrmEvent, PosConfig, PosItem } from '@/types'

// Evento en el que está trabajando este dispositivo. Se guarda una copia para
// seguir cobrando si se cae el internet a media venta.

type EventState = {
  event: CrmEvent | null
  config: PosConfig | null
  items: PosItem[]
  /** Botellas ya vendidas por producto según el servidor (todas las cajas, sin anuladas). */
  soldServer: Record<string, number>
  /** Ids de ventas que ya cuentan en soldServer (para no contar doble las locales). */
  serverSaleIds: string[]
  loadedAt: string | null
  offline: boolean

  load: (eventId: string) => Promise<'ok' | 'offline' | 'missing'>
  refreshSold: () => Promise<void>
  clear: () => void
}

export const useEvent = create<EventState>()(
  persist(
    (set, get) => ({
      event: null,
      config: null,
      items: [],
      soldServer: {},
      serverSaleIds: [],
      loadedAt: null,
      offline: false,

      load: async (eventId) => {
        try {
          const b = await fetchEventBundle(eventId)
          if (!b.event || !b.config) return 'missing'
          set({
            event: b.event,
            config: b.config,
            items: b.items,
            loadedAt: new Date().toISOString(),
            offline: false,
            ...(get().event?.id !== eventId ? { soldServer: {}, serverSaleIds: [] } : {}),
          })
          void get().refreshSold()
          return 'ok'
        } catch (e) {
          if (isNetworkError(e as Error) && get().event?.id === eventId) {
            set({ offline: true })
            return 'offline'
          }
          throw e
        }
      },

      refreshSold: async () => {
        const ev = get().event
        if (!ev) return
        try {
          const sales = await fetchServerSales(ev.id)
          const sold: Record<string, number> = {}
          for (const s of sales) {
            if (s.voided_at) continue
            for (const l of s.lines) sold[l.product_id] = (sold[l.product_id] ?? 0) + l.qty
          }
          set({ soldServer: sold, serverSaleIds: sales.map((s) => s.id), offline: false })
        } catch (e) {
          if (isNetworkError(e as Error)) set({ offline: true })
        }
      },

      clear: () => set({ event: null, config: null, items: [], soldServer: {}, serverSaleIds: [], loadedAt: null }),
    }),
    {
      name: 'teravino-pos.event',
      partialize: (s) => ({
        event: s.event,
        config: s.config,
        items: s.items,
        soldServer: s.soldServer,
        serverSaleIds: s.serverSaleIds,
        loadedAt: s.loadedAt,
      }),
    },
  ),
)
