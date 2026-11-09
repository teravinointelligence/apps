import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { Check, MessageCircle, Plus, Printer, CloudOff } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Notice } from '@/ui/Field'
import { useSales } from '@/store/sales'
import { useEvent } from '@/store/event'
import { EMISOR } from '@/lib/emisor'
import { mxn } from '@/lib/money'
import type { Sale } from '@/types'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mazatlan' })

function waText(s: Sale, eventName: string) {
  const lines = s.lines.map((l) => `• ${l.qty} × ${l.name} — ${mxn(l.qty * l.price)}`).join('\n')
  return [
    `¡Gracias por tu compra en ${eventName}! 🍷`,
    `TeraVino · Ticket ${s.folio}`,
    '',
    lines,
    s.discount > 0 ? `Descuento: −${mxn(s.discount)}` : '',
    `Total: ${mxn(s.total)} (IVA incluido) · ${s.method}`,
    '',
    `¿Necesitas factura? Escribe a ${EMISOR.facturacion} con tu folio ${s.folio} y tus datos fiscales.`,
  ]
    .filter((x, i, a) => x !== '' || a[i - 1] !== '')
    .join('\n')
}

export function Ticket({ sale, eventName, venue }: { sale: Sale; eventName: string; venue?: string | null }) {
  return (
    <div className="ticket ticket-print rounded-lg border border-ink-08 shadow-sm p-4 mx-auto">
      <div className="text-center">
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, letterSpacing: 3, fontWeight: 600 }}>TERAVINO</div>
        <div>{EMISOR.razonSocial}</div>
        <div>RFC {EMISOR.rfc}</div>
        <div>{eventName}</div>
        {venue && <div>{venue}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>Folio</span><span>{sale.folio}</span></div>
      <div className="flex justify-between"><span>Fecha</span><span>{fmt(sale.at)}</span></div>
      <div className="flex justify-between"><span>Atendió</span><span>{sale.seller.name}</span></div>
      <div className="my-2 border-t border-dashed border-black" />
      {sale.lines.map((l) => (
        <div key={l.product_id} className="mb-1">
          <div>{l.name}</div>
          <div className="flex justify-between"><span>{l.qty} × {mxn(l.price)}</span><span>{mxn(l.qty * l.price)}</span></div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>Subtotal</span><span>{mxn(sale.subtotal)}</span></div>
      {sale.discount > 0 && <div className="flex justify-between"><span>Descuento</span><span>−{mxn(sale.discount)}</span></div>}
      <div className="flex justify-between" style={{ fontWeight: 700, fontSize: 14 }}><span>TOTAL</span><span>{mxn(sale.total)}</span></div>
      <div className="flex justify-between"><span>IVA incluido</span><span>{mxn(sale.iva)}</span></div>
      <div className="flex justify-between"><span>{sale.method}</span><span>{sale.method === 'Efectivo' ? mxn(sale.received ?? sale.total) : sale.card_ref ?? ''}</span></div>
      {sale.method === 'Efectivo' && <div className="flex justify-between"><span>Cambio</span><span>{mxn(sale.change ?? 0)}</span></div>}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center" style={{ fontSize: 10 }}>
        Ticket de venta, no es comprobante fiscal.
        <br />
        Factura: {EMISOR.facturacion} con este folio, dentro del mes de compra.
        <br />
        ¡Gracias! · Disfruta con responsabilidad.
      </div>
    </div>
  )
}

export function ReciboScreen() {
  const { saleId } = useParams()
  const navigate = useNavigate()
  const sale = useSales((s) => s.sales.find((x) => x.id === saleId))
  const event = useEvent((s) => s.event)
  if (!sale) return <Navigate to="/venta" replace />

  const eventName = event?.name ?? 'Evento TeraVino'
  const phone = (sale.customer?.phone ?? '').replace(/\D/g, '')
  const waPhone = phone.length === 10 ? `52${phone}` : phone
  const wa = `https://wa.me/${waPhone}?text=${encodeURIComponent(waText(sale, eventName))}`

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 md:px-8 py-6">
      <section className="flex-1 space-y-4 max-w-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-success-soft text-success flex items-center justify-center"><Check size={26} /></div>
          <div>
            <div className="font-serif text-[30px] leading-none">Venta registrada</div>
            <div className="text-[13px] text-ink-50 dark:text-dark-ink-50 mt-1">Folio {sale.folio} · {sale.method}</div>
          </div>
        </div>
        {sale.method === 'Efectivo' && (
          <div className="rounded-2xl bg-wine text-white dark:bg-gold dark:text-wine-deep p-5">
            <div className="text-[13px] opacity-80">Cambio a entregar</div>
            <div className="font-serif text-[52px] leading-none tabular">{mxn(sale.change ?? 0)}</div>
            <div className="text-[13px] opacity-80 mt-1">Recibido {mxn(sale.received ?? 0)} · Total {mxn(sale.total)}</div>
          </div>
        )}
        {!sale.synced && (
          <Notice>
            <span className="inline-flex items-center gap-1.5"><CloudOff size={14} /> Guardada en este dispositivo; sube sola en cuanto haya internet.</span>
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          <Btn size="lg" onClick={() => navigate('/venta', { replace: true })} icon={<Plus size={18} />}>Nueva venta</Btn>
          <Btn size="lg" kind="ghost" onClick={() => window.print()} icon={<Printer size={18} />}>Imprimir</Btn>
          <Btn size="lg" kind="ghost" onClick={() => window.open(wa, '_blank', 'noopener')} icon={<MessageCircle size={18} />}>
            {phone ? 'Enviar por WhatsApp' : 'Compartir por WhatsApp'}
          </Btn>
        </div>
      </section>
      <section className="lg:w-[340px]">
        <Ticket sale={sale} eventName={eventName} venue={[event?.venue_name, event?.city].filter(Boolean).join(' · ')} />
      </section>
    </div>
  )
}
