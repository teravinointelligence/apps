import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileSpreadsheet, LogOut } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Notice } from '@/ui/Field'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { useCart } from '@/store/cart'
import { useSales } from '@/store/sales'
import { buildCorteWorkbook, fileSlug, shareOrDownloadWorkbook } from '@/lib/excel'
import { mxn } from '@/lib/money'

/**
 * La caja de este dispositivo pertenece a un evento cuyo punto de venta ya no
 * existe en el servidor (se borró). Sin esto el dispositivo queda atorado: no
 * puede cobrar, el corte no se registra y no deja salir con la caja abierta.
 *
 * Si la caja no tiene ventas, se libera sin más. Si tiene, primero se descarga
 * el Excel con esas ventas (el dinero ya se cobró) y siguen guardadas aquí.
 */
export function EventoSinPos() {
  const navigate = useNavigate()
  const caja = useDevice((s) => s.caja)
  const closeCaja = useDevice((s) => s.closeCaja)
  const event = useEvent((s) => s.event)
  const config = useEvent((s) => s.config)
  const allSales = useSales((s) => s.sales)
  const [downloaded, setDownloaded] = useState(false)

  const ventas = useMemo(
    () => allSales.filter((s) => caja && s.event_id === caja.event_id && s.session_id === caja.session_id),
    [allSales, caja],
  )
  const total = ventas.reduce((a, s) => a + s.total, 0)

  if (!caja) return null

  const descargar = async () => {
    await shareOrDownloadWorkbook(
      buildCorteWorkbook({
        event,
        config,
        caja: caja.caja,
        seller: caja.seller.name,
        fondo: caja.fondo,
        contado: 0,
        notas: 'Evento eliminado del punto de venta; caja liberada sin arqueo',
        sales: ventas,
      }),
      `TeraVino-ventas-${fileSlug(event?.name ?? 'evento')}-${caja.caja}.xlsx`,
      `Ventas de ${caja.caja} · ${event?.name ?? ''}`,
    ).catch(() => undefined)
    setDownloaded(true)
  }

  const liberar = () => {
    useCart.getState().clear()
    closeCaja()
    useEvent.getState().clear()
    navigate('/eventos', { replace: true })
  }

  return (
    <div className="max-w-lg w-full mx-auto px-4 py-10 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-warning-soft text-warning flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <div>
          <div className="font-serif text-[28px] leading-none">Este evento ya no tiene punto de venta</div>
          <div className="text-[13px] text-ink-50 dark:text-dark-ink-50 mt-1">
            {event?.name ?? 'Evento'} · {caja.caja}
          </div>
        </div>
      </div>

      <p className="text-[14px] text-ink-70 dark:text-dark-ink-70">
        Quien coordina el evento lo eliminó del punto de venta. Esta caja ya no puede cobrar ni registrar su corte.
      </p>

      {ventas.length === 0 ? (
        <Notice tone="info">Esta caja no tiene ventas, así que se puede liberar sin perder nada.</Notice>
      ) : (
        <Notice>
          Esta caja tiene <b>{ventas.length}</b> {ventas.length === 1 ? 'venta' : 'ventas'} por <b>{mxn(total)}</b>. Descarga el
          Excel y entrégalo a dirección junto con el efectivo. Las ventas siguen guardadas en este dispositivo.
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        {ventas.length > 0 && (
          <Btn kind="ghost" onClick={descargar} icon={<FileSpreadsheet size={16} />}>
            Descargar Excel de las ventas
          </Btn>
        )}
        <Btn onClick={liberar} disabled={ventas.length > 0 && !downloaded} icon={<LogOut size={16} />}>
          Liberar caja e ir a eventos
        </Btn>
      </div>
    </div>
  )
}
