import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '@/lib/ids'
import type { CajaSession } from '@/types'

// Identidad del dispositivo, caja abierta y consecutivo de folios.
// El consecutivo vive aquí para poder cobrar sin internet; al abrir caja se
// alinea con el último folio que ya tiene el servidor.

type DeviceState = {
  deviceId: string
  caja: CajaSession | null
  /** Último consecutivo usado por evento+caja: "eventId|CAJA-1" → 12 */
  seq: Record<string, number>
  lastCaja: string

  openCaja: (c: CajaSession, serverLastSeq: number) => void
  closeCaja: () => void
  nextFolio: (prefix: string) => string
}

const pad = (n: number) => String(n).padStart(4, '0')

export const useDevice = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: newId('dev'),
      caja: null,
      seq: {},
      lastCaja: 'CAJA-1',

      openCaja: (c, serverLastSeq) => {
        const key = `${c.event_id}|${c.caja}`
        const local = get().seq[key] ?? 0
        set({
          caja: c,
          lastCaja: c.caja,
          seq: { ...get().seq, [key]: Math.max(local, serverLastSeq) },
        })
      },

      closeCaja: () => set({ caja: null }),

      nextFolio: (prefix) => {
        const c = get().caja
        if (!c) throw new Error('No hay caja abierta')
        const key = `${c.event_id}|${c.caja}`
        const n = (get().seq[key] ?? 0) + 1
        set({ seq: { ...get().seq, [key]: n } })
        return `${prefix}-${c.caja.replace('CAJA-', '')}-${pad(n)}`
      },
    }),
    { name: 'teravino-pos.device' },
  ),
)
