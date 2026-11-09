# TeraVino — Punto de venta para eventos

POS exclusivo de TeraVino para cobrar en eventos (cenas maridaje, festivales,
tastings, lanzamientos). Hermano del POS de V612 (`teravinointelligence/v612-pos`):
mismo stack, misma lógica de cobro, corte y Excel para CONTPAQi, pero conectado
al **CRM TeraVino** (Supabase `teravino-crm`) y organizado **por evento**.

Pensado para iPad horizontal y también funciona en teléfono.

## Decisiones de diseño

| Tema | Decisión |
| --- | --- |
| Base de datos | La del CRM. Los eventos, productos, almacenes y vendedores ya viven ahí. |
| Acceso | Mismo correo y contraseña del CRM (sin PINs ni usuarios nuevos). Vende `rep` y `admin` activos; lee también `contador` y `jefe_logistica`. |
| Precios | **Lista propia por evento**, precio al público con IVA. El POS nunca usa el precio de mayoreo; avisa si un precio queda abajo del mayoreo + IVA. |
| Inventario | **Salida a evento**: se registra cuántas botellas salen y de qué almacén; al cerrar se cuentan degustación, merma y regreso. **No descuenta** `product_warehouse_stock` (lo sobrescribe la carga de CONTPAQi). El Excel del cierre es lo que se captura en CONTPAQi. |
| Tarjeta | Terminal física aparte. El POS registra el cobro como “Tarjeta” y, opcionalmente, los últimos 4 dígitos / folio de autorización. |
| SPEI | Solo aparece si el evento tiene CLABE capturada. Pide confirmar que la transferencia ya se vio. |
| Sin internet | Para entrar y abrir caja se necesita señal. Después se cobra sin internet: cada venta se guarda primero en el dispositivo y se sube sola (idempotente). Un service worker deja la app guardada para que abra aunque no haya señal. |
| Descuentos | Al ticket, en % o pesos, con tope por evento (10 % por defecto). |

## Flujo

1. **Preparar** (dirección o quien coordina el evento en el CRM) — *Eventos → Preparar punto de venta*:
   almacén de origen, prefijo de folio, descuento máximo, CLABE opcional; agregar
   vinos con precio al público y botellas de salida. Muestra existencias del almacén
   (CONTPAQi) y avisa si salen más de las que hay. *Hoja de salida* (Excel) para logística.
   *Abrir para vender*.
2. **Abrir caja** (cada vendedor/dispositivo): caja 1–4 y fondo. Una caja no puede
   estar abierta en dos dispositivos; si uno se perdió se puede liberar.
3. **Vender**: catálogo del evento con “quedan N” (salida − vendidas en todas las
   cajas), ticket, descuento, cobro en efectivo (cambio), tarjeta o SPEI, datos del
   cliente opcionales (factura/RFC, WhatsApp, permiso para novedades).
4. **Ticket**: imprimir (58 mm) o mandar por WhatsApp. No fiscal; indica cómo pedir factura.
5. **Ventas**: “Mi caja” y “Todo el evento”. Dirección/coordinación puede **anular** con motivo
   (no se borra; deja de contar).
6. **Corte de caja**: arqueo (efectivo esperado vs. contado; nota obligatoria si hay
   diferencia) y Excel del corte (Resumen, Tickets, Partidas).
7. **Conciliación y cierre** (dirección/coordinación): por producto
   `salida − vendidas − degustación − merma − regreso` debe dar 0. Excel para CONTPAQi
   con Resumen, Conciliación, Tickets, Partidas (con código CONTPAQi y descuento
   prorrateado), Por vendedor y Cortes de caja. *Cerrar evento*.

Una venta que llega con algo raro (precio distinto a la lista, descuento arriba del
tope, total que no cuadra, folio repetido, subida después del cierre) **no se
rechaza** —el dinero ya se cobró— pero queda marcada **Revisar** con el motivo.

## Base de datos

`supabase/migrations/001_event_pos.sql` (solo agrega; no modifica tablas del CRM):

- `event_pos_config`, `event_pos_items`, `event_pos_sessions`, `event_pos_sales`, `event_pos_closings`.
- RLS en todas. Ventas, cajas y cortes **solo se escriben por RPC** (`event_pos_open_session`,
  `event_pos_record_sale`, `event_pos_record_closing`, `event_pos_void_sale`), con
  permisos revisados en el servidor.
- Reutiliza `is_admin()`, `is_active_rep()` y `current_rep_id()` del CRM.

Probada en Postgres 16 con réplica de esas funciones: permisos por rol, idempotencia
de ventas y cortes, caja ocupada, anulación, ventas tardías y re-aplicación de la migración.

## Puesta en marcha

1. Aplicar `supabase/migrations/001_event_pos.sql` en el proyecto `teravino-crm`.
2. Vercel → nuevo proyecto desde `teravinointelligence/apps`, **Root Directory:
   `teravino-pos`**, framework Vite. Variables:
   - `VITE_SUPABASE_URL` = URL del proyecto `teravino-crm`
   - `VITE_SUPABASE_KEY` = llave pública (publishable/anon) del CRM
3. Dominio sugerido: `pos.teravino.com` (o el que prefieras).
4. En cada iPad: abrir la URL en Safari → Compartir → *Agregar a pantalla de inicio*.

## Desarrollo

```bash
cd teravino-pos
cp .env.example .env.local   # y rellenar
npm install
npm run dev
npm run lint
npm run build
```

## Pendientes / por confirmar

- Correo para pedir factura que aparece en el ticket (`src/lib/emisor.ts`, hoy `pedidos@teravino.com`).
- CLABE de cobro por SPEI (se captura por evento).
- Logotipo oficial en SVG (hoy la marca es texto, `src/ui/Mark.tsx`) y paleta en `src/index.css`.
- Envío automático del corte por correo (en V612 existe con Resend; aquí el corte se comparte desde el iPad).
