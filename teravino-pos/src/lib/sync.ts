import { recordClosing, recordSale } from '@/lib/api'
import { humanError, isAuthError, isNetworkError } from '@/lib/errors'
import { useSales } from '@/store/sales'
import { useEvent } from '@/store/event'

// Sube ventas y cortes pendientes. Idempotente: el servidor reconoce cada
// venta por su id (generado en el dispositivo) y cada corte por client_id;
// reintentar algo que ya llegó no lo duplica.

let running = false
let timer: ReturnType<typeof setInterval> | null = null

export type SyncOutcome = 'ok' | 'offline' | 'error'

export async function syncNow(): Promise<SyncOutcome> {
  if (running) return 'ok'
  running = true
  let outcome: SyncOutcome = 'ok'
  try {
    const { sales, closings, patchSale, patchClosing } = useSales.getState()
    // Más viejas primero, para que los folios lleguen en orden.
    const pend = sales.filter((s) => !s.synced).reverse()
    for (const s of pend) {
      try {
        const r = await recordSale(s)
        patchSale(s.id, { synced: true, syncError: undefined, serverNotes: r.notes ?? [] })
      } catch (e) {
        const err = e as Error
        if (isNetworkError(err)) return (outcome = 'offline')
        patchSale(s.id, { syncError: humanError(err) })
        outcome = 'error'
        if (isAuthError(err)) break // no tiene caso seguir sin sesión
      }
    }
    for (const c of closings.filter((x) => !x.synced).reverse()) {
      try {
        await recordClosing(c)
        patchClosing(c.client_id, { synced: true, syncError: undefined })
      } catch (e) {
        const err = e as Error
        if (isNetworkError(err)) return (outcome = 'offline')
        patchClosing(c.client_id, { syncError: humanError(err) })
        outcome = 'error'
      }
    }
    if (pend.length) void useEvent.getState().refreshSold()
    return outcome
  } finally {
    running = false
  }
}

/** Reintenta cada 20 s y en cuanto vuelve el internet. */
export function startAutoSync() {
  if (timer) return
  timer = setInterval(() => void syncNow(), 20_000)
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  void syncNow()
}
