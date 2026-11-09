import { useMemo } from 'react'
import { useEvent } from '@/store/event'
import { useSales } from '@/store/sales'

/**
 * Botellas que deberían quedar por producto: salida − vendidas en todas las
 * cajas (servidor) − vendidas en este dispositivo que aún no suben.
 */
export function useRemaining(): Record<string, number> {
  const event = useEvent((s) => s.event)
  const items = useEvent((s) => s.items)
  const soldServer = useEvent((s) => s.soldServer)
  const serverSaleIds = useEvent((s) => s.serverSaleIds)
  const sales = useSales((s) => s.sales)

  return useMemo(() => {
    const ids = new Set(serverSaleIds)
    const local: Record<string, number> = {}
    for (const s of sales) {
      if (s.event_id !== event?.id || ids.has(s.id)) continue
      for (const l of s.lines) local[l.product_id] = (local[l.product_id] ?? 0) + l.qty
    }
    const out: Record<string, number> = {}
    for (const i of items) out[i.product_id] = i.salida - (soldServer[i.product_id] ?? 0) - (local[i.product_id] ?? 0)
    return out
  }, [event?.id, items, soldServer, serverSaleIds, sales])
}
