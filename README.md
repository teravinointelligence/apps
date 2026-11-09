# Agenda Viva — *Tu tiempo, a tu manera*

> Este repositorio también contiene **[`teravino-pos/`](teravino-pos/README.md)**: el punto de venta de TeraVino para eventos (Vite + Supabase del CRM), independiente de Agenda Viva.

Agenda personal semanal, privada, muy visual y editable, conectada con Google
Calendar. Construida sobre Base44 (app `6a822c0ac040ce1b15b50f1b`).

Este repositorio contiene el código que escribí para la app: la función backend
y todo el frontend propio de la agenda. El andamiaje que Base44 genera
(componentes `src/components/ui/`, páginas de autenticación, cliente del SDK)
vive en la app y no se duplica aquí.

## Cómo funciona

```
Instrucción en español  ─┐
(escrita o dictada)      │   InvokeLLM        Modal "Revisar antes de guardar"
                         ├──────────────►  borrador editable  ──► confirmación
Botón "Nuevo"           ─┘                                          │
                                                                    ▼
                              base44.functions.invoke("google-calendar", …)
                                                                    │
                                      (solo en backend) getConnection("googlecalendar")
                                                                    ▼
                                                           Google Calendar API
```

**Nada se guarda sin confirmación.** La interpretación de la instrucción solo
produce un borrador; el evento se crea cuando pulsas *Agendar en Google*.

## Estructura

| Ruta | Qué hace |
| --- | --- |
| `base44/functions/google-calendar/entry.ts` | Único punto de contacto con Google. Valida sesión + rol admin, obtiene el token del conector y expone `status`, `list_week`, `create_event`, `update_event`, `delete_event`, `update_tasks`. |
| `src/lib/agenda/time.js` | Fechas y horas ancladas a `America/Mazatlan`. |
| `src/lib/agenda/tasks.js` | Lectura/escritura de los pendientes `☐`/`☑` dentro de la descripción del evento. Copia gemela dentro de `entry.ts`. |
| `src/lib/agenda/categories.js` | Categorías y paleta (ejercicio naranja, trabajo violeta, salud rosa, traslados azul, compras verde, hogar amarillo, descanso turquesa, otros gris lavanda). |
| `src/lib/agenda/preferences.js` | Preferencias de planeación: ubicación base por día, traslados sugeridos, espacios libres, hospedaje. Solo sugiere; nunca guarda. |
| `src/lib/agenda/fallbackWeek.js` | Copia de respaldo visual de la semana 17–23 de agosto de 2026. |
| `src/lib/agenda/weather.js` | Detecta eventos de clima (☀️, 🌤️, 🌧️, ⛈️, ☁️…) y los manda al encabezado del día. |
| `src/lib/agenda/instruction.js` | `InvokeLLM` con respuesta estructurada + intérprete local de respaldo. |
| `src/lib/agenda/calendarApi.js` | Puente con la función backend; normaliza todos los errores. |
| `src/lib/appConfig.js` | Identificador real de la app, con respaldo si `VITE_BASE44_APP_ID` llega vacío en producción. |
| `src/pages/Agenda.jsx` | Orquesta la vista semanal. |
| `src/components/agenda/` | Panel superior, barra de semana, tarjeta de día, tarjeta de evento, modal de revisión, confirmaciones y leyenda. |

## Seguridad

- La app es privada: iniciar sesión es obligatorio (`ProtectedRoute`).
- El token de Google **nunca** llega al frontend; solo se usa dentro de
  `entry.ts` mediante `base44.asServiceRole.connectors.getConnection`.
- La función rechaza a cualquier usuario sin sesión (`unauthenticated`) y a
  cualquier cuenta que no sea administradora (`not_admin`).
- Crear, editar y borrar exigen confirmación explícita en la interfaz.
- Antes de crear se compara título + fecha + horario para no duplicar; si ya
  existe, la app lo dice y pregunta antes de insistir.
- Los errores se distinguen por código (`connector_not_connected`,
  `google_auth`, `google_forbidden`, `google_unavailable`, `not_admin`, …) para
  no decir "falta autorizar" cuando la causa es otra.

## Pendientes dentro de los eventos

Se guardan en la descripción del evento de Google:

```
Notas que no son lista

PENDIENTES
☐ Descargar inventarios
☑ Mandar pedidos a proveedores
☐ Descargar ventas y subirlas al CRM
```

El lector es tolerante: acepta HTML, `<br>` en vez de saltos de línea y varios
pendientes pegados en un solo renglón, porque parte el texto por los propios
símbolos de casilla. Las notas ajenas a la lista se conservan al reescribir.

## Zona horaria

Todo se interpreta en `America/Mazatlan`. Las fechas viajan como `YYYY-MM-DD` y
las horas como `HH:MM`; el desfase se calcula con `Intl.DateTimeFormat` en el
instante exacto, así que la app sigue siendo correcta si algún día vuelve el
horario de verano.

## Desarrollo

```bash
npm install
base44 dev      # backend local + frontend
npm run dev     # solo frontend contra el backend hospedado
npm run lint
npm run build
base44 deploy   # publica entidades, funciones, conectores y sitio
```
