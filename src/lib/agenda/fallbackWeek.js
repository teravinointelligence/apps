/**
 * Copia de respaldo visual de la semana de referencia (17–23 de agosto de 2026).
 *
 * Solo se usa cuando Google Calendar no responde. Se muestra COMPLETA (los
 * siete días con todos sus bloques), siempre rotulada como respaldo, y los
 * pendientes de esta copia no se pueden marcar: la app lo dice en pantalla en
 * lugar de fallar en silencio.
 */

export const SEMANA_RESPALDO_INICIO = '2026-08-17';

const evento = (id, data) => ({
  id,
  source: 'google',
  backup: true,
  allDay: false,
  tasks: [],
  notes: '',
  htmlLink: null,
  ...data,
});

export const RESPALDO_EVENTOS = {
  '2026-08-17': [
    evento('bk-lun-1', {
      title: 'HIIT Cardio',
      startTime: '07:00',
      endTime: '07:30',
      location: 'Casa, Miraflores',
      category: 'ejercicio',
    }),
    evento('bk-lun-2', {
      title: 'Home Office',
      startTime: '08:00',
      endTime: '14:00',
      location: 'Casa, Miraflores',
      category: 'trabajo',
      tasks: [
        { text: 'Descargar inventarios', done: false },
        { text: 'Mandar pedidos a proveedores', done: false },
        {
          text: 'Descargar ventas y subirlas al CRM, o programar la automatización de la subida de ventas al CRM',
          done: false,
        },
      ],
    }),
  ],
  '2026-08-18': [
    evento('bk-mar-1', {
      title: 'Traslado Miraflores → Oficina San José',
      startTime: '08:15',
      endTime: '09:00',
      location: 'Miraflores → San José del Cabo',
      category: 'traslado',
    }),
    evento('bk-mar-2', {
      title: 'Oficina',
      startTime: '09:00',
      endTime: '12:00',
      location: 'San José del Cabo',
      category: 'trabajo',
    }),
    evento('bk-mar-3', {
      title: 'Traslado San José → Todos Santos',
      startTime: '12:00',
      endTime: '13:15',
      location: 'San José del Cabo → Todos Santos',
      category: 'traslado',
    }),
  ],
  '2026-08-19': [
    evento('bk-mie-1', {
      title: 'Cita con el dentista',
      startTime: '10:00',
      endTime: '12:30',
      location: 'La Paz',
      category: 'salud',
      notes: 'Recorrido de contexto: Todos Santos ↔ La Paz. Los traslados son sugerencia hasta confirmarlos.',
    }),
  ],
  '2026-08-20': [],
  '2026-08-21': [],
  '2026-08-22': [
    evento('bk-sab-1', {
      title: 'Traslado Todos Santos → Misiones del Cabo',
      startTime: '07:00',
      endTime: '08:15',
      location: 'Todos Santos → Misiones del Cabo',
      category: 'traslado',
    }),
    evento('bk-sab-2', {
      title: 'Revisar avances de la remodelación del departamento',
      startTime: '08:15',
      endTime: '09:00',
      location: 'Misiones del Cabo',
      category: 'hogar',
    }),
    evento('bk-sab-3', {
      title: 'Traslado Misiones del Cabo → Costco Cabo San Lucas',
      startTime: '09:00',
      endTime: '09:15',
      location: 'Misiones del Cabo → Cabo San Lucas',
      category: 'traslado',
    }),
    evento('bk-sab-4', {
      title: 'Costco Cabo San Lucas',
      startTime: '09:15',
      endTime: '10:30',
      location: 'Cabo San Lucas',
      category: 'compras',
      notes: 'Considerar Membresía Ejecutiva.',
    }),
    evento('bk-sab-5', {
      title: 'Traslado Costco → Miraflores',
      startTime: '10:30',
      endTime: '11:45',
      location: 'Cabo San Lucas → Miraflores',
      category: 'traslado',
    }),
  ],
  '2026-08-23': [],
};

/** Clima de la semana de respaldo (se pinta en el encabezado de cada día). */
export const RESPALDO_CLIMA = {
  '2026-08-17': { icon: '☀️', temperature: '26° / 34°C' },
  '2026-08-18': { icon: '🌤️', temperature: '26° / 33°C' },
  '2026-08-19': { icon: '⛈️', temperature: '25° / 31°C' },
  '2026-08-20': { icon: '🌧️', temperature: '25° / 30°C' },
  '2026-08-21': { icon: '🌤️', temperature: '26° / 32°C' },
  '2026-08-22': { icon: '☀️', temperature: '27° / 34°C' },
  '2026-08-23': { icon: '☁️', temperature: '26° / 32°C' },
};

/**
 * Devuelve la copia de respaldo para la semana pedida.
 * Fuera de la semana de referencia entregamos los siete días vacíos, siempre
 * rotulados como respaldo: nunca fingimos datos de otra semana.
 */
export function buildFallbackWeek(weekDates) {
  const isReferenceWeek = weekDates[0] === SEMANA_RESPALDO_INICIO;
  const days = {};
  const weather = {};
  for (const date of weekDates) {
    const eventos = isReferenceWeek ? RESPALDO_EVENTOS[date] || [] : [];
    // Cada bloque lleva su propia fecha: el resto de la app la necesita para
    // agrupar, ordenar y saber a qué día pertenece.
    days[date] = eventos.map((evento) => ({ ...evento, date }));
    if (isReferenceWeek && RESPALDO_CLIMA[date]) weather[date] = RESPALDO_CLIMA[date];
  }
  return { days, weather, isReferenceWeek };
}
