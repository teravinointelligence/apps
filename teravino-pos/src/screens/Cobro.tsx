import { useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Banknote, ChevronLeft, CreditCard, UserRound } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Eyebrow, Field, Notice } from '@/ui/Field'
import { Keypad } from '@/ui/Keypad'
import { cn } from '@/ui/cn'
import { useCart, cartDiscount, cartSubtotal, cartUnits } from '@/store/cart'
import { useDevice } from '@/store/device'
import { useEvent } from '@/store/event'
import { useAuth } from '@/store/auth'
import { useSales } from '@/store/sales'
import { syncNow } from '@/lib/sync'
import { newId } from '@/lib/ids'
import { ivaIncluido, mxn, round2, toNumber } from '@/lib/money'
import type { Customer, Method, Sale } from '@/types'

const QUICK = [500, 1000, 2000, 5000]

function MethodCard({ active, icon, label, hint, onClick }: { active: boolean; icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-start gap-2 p-3 md:p-4 rounded-xl text-left border',
        active ? 'border-wine bg-wine text-white dark:border-gold dark:bg-gold dark:text-wine-deep' : 'border-ink-15 bg-paper dark:bg-dark-surface dark:border-dark-border',
      )}
    >
      {icon}
      <div>
        <div className="font-serif text-[18px] leading-tight">{label}</div>
        <div className={cn('text-[11px] hidden sm:block', active ? 'opacity-75' : 'text-ink-50')}>{hint}</div>
      </div>
    </button>
  )
}

export function CobroScreen() {
  const navigate = useNavigate()
  const cart = useCart()
  const config = useEvent((s) => s.config)
  const caja = useDevice((s) => s.caja)
  const nextFolio = useDevice((s) => s.nextFolio)
  const rep = useAuth((s) => s.rep)
  const addSale = useSales((s) => s.addSale)
  const spei = !!config?.spei_clabe
  const [method, setMethod] = useState<Method>('Efectivo')
  const [received, setReceived] = useState('')
  const [cardRef, setCardRef] = useState('')
  const [speiOk, setSpeiOk] = useState(false)
  const [showCustomer, setShowCustomer] = useState(!!cart.customer)
  const [customer, setCustomer] = useState<Customer>(cart.customer ?? {})
  const [processing, setProcessing] = useState(false)
  const lock = useRef(false)

  const sub = cartSubtotal(cart.lines)
  const disc = cartDiscount(cart.lines, cart.discountMode, cart.discountValue, config?.descuento_max_pct ?? 0)
  const total = round2(Math.max(0, sub - disc.applied))
  const rec = toNumber(received)
  const change = Math.max(0, round2(rec - total))

  const canFinish = useMemo(() => {
    if (processing || total <= 0) return false
    if (method === 'Efectivo') return rec >= total
    if (method === 'SPEI') return speiOk
    return true
  }, [processing, total, method, rec, speiOk])

  if (!cart.lines.length && !processing) return <Navigate to="/venta" replace />

  const finish = async () => {
    if (lock.current || !canFinish || !caja || !config || !rep) return
    lock.current = true
    setProcessing(true)
    const c: Customer = Object.fromEntries(
      Object.entries(customer).filter(([, v]) => v !== '' && v !== undefined && v !== false),
    )
    const sale: Sale = {
      id: newId('s'),
      event_id: caja.event_id,
      session_id: caja.session_id,
      folio: nextFolio(config.folio_prefix),
      caja: caja.caja,
      at: new Date().toISOString(),
      seller: { id: rep.id, name: rep.full_name },
      customer: Object.keys(c).length ? c : null,
      lines: cart.lines.map((l) => ({
        product_id: l.item.product_id,
        sku: l.item.sku,
        codigo_contpaqi: l.item.codigo_contpaqi,
        name: l.item.name,
        qty: l.qty,
        price: l.item.precio,
      })),
      subtotal: sub,
      discount: disc.applied,
      discount_pct: disc.applied > 0 ? disc.pct : null,
      iva: ivaIncluido(total),
      total,
      method,
      received: method === 'Efectivo' ? rec : null,
      change: method === 'Efectivo' ? change : null,
      card_ref: method === 'Tarjeta' ? cardRef.trim() || null : null,
      synced: false,
    }
    // Primero en el dispositivo; después al servidor (si no hay red, queda en cola).
    addSale(sale)
    cart.clear()
    void syncNow()
    navigate(`/recibo/${sale.id}`, { replace: true })
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <section className="flex-1 min-w-0 px-4 md:px-8 py-5 space-y-5 overflow-y-auto">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/venta')} aria-label="Regresar" className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center">
            <ChevronLeft size={18} />
          </button>
          <div>
            <Eyebrow>Cobro</Eyebrow>
            <div className="font-serif text-[36px] leading-none tabular text-ink dark:text-dark-ink">{mxn(total)}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <MethodCard active={method === 'Efectivo'} icon={<Banknote size={22} />} label="Efectivo" hint="Calcula el cambio" onClick={() => setMethod('Efectivo')} />
          <MethodCard active={method === 'Tarjeta'} icon={<CreditCard size={22} />} label="Tarjeta" hint="En la terminal" onClick={() => setMethod('Tarjeta')} />
          {spei && <MethodCard active={method === 'SPEI'} icon={<ArrowRightLeft size={22} />} label="SPEI" hint="Transferencia" onClick={() => setMethod('SPEI')} />}
        </div>

        {method === 'Efectivo' && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="rounded-xl bg-paper dark:bg-dark-surface border border-ink-08 dark:border-dark-border p-4">
                <div className="text-[12px] text-ink-50">Recibido</div>
                <div className="font-serif text-[34px] tabular">{mxn(rec)}</div>
                <div className={cn('text-[14px] mt-1', rec >= total ? 'text-success' : 'text-ink-50')}>
                  {rec >= total ? <>Cambio: <b className="text-[20px] tabular">{mxn(change)}</b></> : `Faltan ${mxn(total - rec)}`}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Btn kind="subtle" onClick={() => setReceived(String(total))}>Exacto</Btn>
                {QUICK.filter((q) => q >= total || q === 5000).slice(0, 2).map((q) => (
                  <Btn key={q} kind="subtle" onClick={() => setReceived(String(q))}>{mxn(q).replace('.00', '')}</Btn>
                ))}
              </div>
            </div>
            <Keypad value={received} onChange={setReceived} />
          </div>
        )}

        {method === 'Tarjeta' && (
          <div className="space-y-3 max-w-md">
            <Notice tone="info">
              Cobra <b>{mxn(total)}</b> en la terminal. Confirma aquí <b>solo cuando la terminal diga “aprobada”</b>.
            </Notice>
            <Field label="Últimos 4 dígitos o folio de autorización (opcional)" hint="Ayuda a conciliar contra el estado de cuenta de la terminal.">
              <input className="field font-mono" maxLength={20} value={cardRef} onChange={(e) => setCardRef(e.target.value)} />
            </Field>
          </div>
        )}

        {method === 'SPEI' && config && (
          <div className="space-y-3 max-w-md">
            <div className="rounded-xl bg-paper dark:bg-dark-surface border border-ink-08 dark:border-dark-border p-4 space-y-1">
              <div className="text-[12px] text-ink-50">CLABE</div>
              <div className="font-mono text-[20px] tracking-wider">{config.spei_clabe?.replace(/(\d{4})(?=\d)/g, '$1 ')}</div>
              <div className="text-[13px] text-ink-70 dark:text-dark-ink-70">{[config.spei_banco, config.spei_titular].filter(Boolean).join(' · ')}</div>
              <div className="text-[13px]">Monto exacto: <b className="tabular">{mxn(total)}</b></div>
            </div>
            <label className="flex items-start gap-3 text-[14px]">
              <input type="checkbox" className="mt-1 w-5 h-5" checked={speiOk} onChange={(e) => setSpeiOk(e.target.checked)} />
              <span>Ya vi la transferencia reflejada (en la app del banco o el comprobante del cliente con clave de rastreo).</span>
            </label>
          </div>
        )}

        <div>
          <button type="button" onClick={() => setShowCustomer((v) => !v)} className="inline-flex items-center gap-2 text-[14px] text-wine dark:text-gold">
            <UserRound size={16} /> {showCustomer ? 'Ocultar datos del cliente' : 'Datos del cliente (opcional: factura, WhatsApp, novedades)'}
          </button>
          {showCustomer && (
            <div className="mt-3 grid sm:grid-cols-2 gap-3 max-w-2xl">
              <Field label="Nombre">
                <input className="field" value={customer.name ?? ''} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <input className="field" inputMode="tel" value={customer.phone ?? ''} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </Field>
              <Field label="Correo">
                <input className="field" type="email" inputMode="email" value={customer.email ?? ''} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </Field>
              <Field label="RFC (si pide factura)">
                <input className="field font-mono uppercase" maxLength={13} value={customer.rfc ?? ''} onChange={(e) => setCustomer({ ...customer, rfc: e.target.value.toUpperCase(), factura: !!e.target.value })} />
              </Field>
              <label className="sm:col-span-2 flex items-start gap-3 text-[13px] text-ink-70 dark:text-dark-ink-70">
                <input type="checkbox" className="mt-0.5 w-5 h-5" checked={!!customer.marketing} onChange={(e) => setCustomer({ ...customer, marketing: e.target.checked })} />
                <span>El cliente acepta recibir novedades y eventos de TeraVino por WhatsApp o correo.</span>
              </label>
            </div>
          )}
        </div>
      </section>

      <aside className="lg:w-[340px] border-t lg:border-t-0 lg:border-l border-ink-08 dark:border-dark-border bg-paper/60 dark:bg-dark-surface/60 p-4 md:p-5 flex flex-col gap-3">
        <div className="font-serif text-[20px]">Resumen · {cartUnits(cart.lines)} bot.</div>
        <div className="space-y-1.5 text-[13px] max-h-[30vh] lg:max-h-none overflow-y-auto">
          {cart.lines.map((l) => (
            <div key={l.item.product_id} className="flex justify-between gap-2">
              <span className="text-ink-70 dark:text-dark-ink-70">{l.qty} × {l.item.name}</span>
              <span className="tabular">{mxn(l.qty * l.item.precio)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-ink-08 dark:border-dark-border pt-2 space-y-1 text-[14px]">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular">{mxn(sub)}</span></div>
          {disc.applied > 0 && <div className="flex justify-between text-wine dark:text-gold"><span>Descuento {disc.pct}%</span><span className="tabular">−{mxn(disc.applied)}</span></div>}
          <div className="flex justify-between text-ink-50 text-[12px]"><span>IVA incluido</span><span className="tabular">{mxn(ivaIncluido(total))}</span></div>
          <div className="flex justify-between font-serif text-[24px]"><span>Total</span><span className="tabular">{mxn(total)}</span></div>
        </div>
        <Btn size="xl" fullWidth disabled={!canFinish} onClick={finish}>
          {processing ? 'Guardando…' : method === 'Efectivo' ? 'Cobrar y dar cambio' : 'Confirmar pago'}
        </Btn>
      </aside>
    </div>
  )
}
