/**
 * Preferencias personales de planeación.
 *
 * Regla de oro: esto SUGIERE y ORGANIZA. Nada de aquí se convierte solo en un
 * evento de Google — las rutinas y los traslados sugeridos se dibujan con un
 * estilo distinto y solo se guardan si tú los confirmas.
 */

import { minutesOfDay, minutesToTime, weekdayOf } from './time';

export const PREFERENCIAS = [
  'Los sábados y domingos prefiero estar en Miraflores.',
  'Normalmente permanezco en Miraflores hasta el lunes.',
  'Generalmente viajo a Todos Santos el martes.',
  'Si tengo un compromiso fuera de Miraflores el lunes, puedo salir desde el lunes.',
  'Los sábados suelo salir temprano, alrededor de las 7:00 a.m.',
  'Cuando corresponda, desayuno entre 8:00 y 9:00 a.m.',
  'La oficina de San José normalmente puede ocupar de 9:00 a.m. a 12:00 p.m.',
  'Para una cita en La Paz, incluir los traslados desde la ubicación anterior.',
  'Si hay más trabajo en La Paz, sugerir pasar la noche en un Airbnb.',
  'Si no hay más trabajo, considerar el regreso ese mismo día a Todos Santos.',
];

/**
 * Planes retirados. Nunca deben reaparecer como sugerencia ni como rutina.
 * (Si tú lo escribes a mano y confirmas, la app te avisa pero no te lo bloquea.)
 */
export const PLANES_CANCELADOS = [
  {
    id: 'elizabeth',
    match: /elizabeth/i,
    nota: 'El plan de recoger o llevar a Elizabeth está cancelado.',
  },
];

export function esPlanCancelado(texto) {
  const value = String(texto || '');
  return PLANES_CANCELADOS.find((plan) => plan.match.test(value)) || null;
}

/** Ubicación base por día de la semana según las preferencias. */
const BASE_POR_DIA = {
  0: 'Miraflores', // domingo
  1: 'Miraflores', // lunes
  2: 'Todos Santos', // martes: viaje a Todos Santos
  3: 'Todos Santos',
  4: 'Todos Santos',
  5: 'Todos Santos',
  6: 'Miraflores', // sábado: regreso a Miraflores
};

const DIA_INICIO = { 0: '08:00', 1: '07:00', 2: '08:00', 3: '08:00', 4: '08:00', 5: '08:00', 6: '07:00' };
const DIA_FIN = '21:00';
const HUECO_MINIMO = 45;

/** Normaliza una ubicación para poder compararlas ("Casa, Miraflores" ≈ "Miraflores"). */
export function locationKey(location) {
  return String(location || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(casa|oficina|depa|departamento|el|la|los|las|de|del)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameLocation(a, b) {
  const ka = locationKey(a);
  const kb = locationKey(b);
  if (!ka || !kb) return false;
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

/**
 * Ubicación base sugerida para un día: la del último compromiso confirmado
 * que no sea un traslado y, si no hay ninguno, la preferencia del día.
 */
export function baseLocationForDay(dateStr, events = []) {
  const withLocation = events
    .filter((event) => event.source === 'google' && event.location && event.category !== 'traslado')
    .sort((a, b) => (minutesOfDay(a.startTime) ?? 0) - (minutesOfDay(b.startTime) ?? 0));

  if (withLocation.length) {
    const last = withLocation[withLocation.length - 1];
    return { location: last.location, inferred: true };
  }

  // Un traslado nombrado "A → B" también revela dónde termina el día.
  const traslados = events.filter((event) => event.category === 'traslado');
  if (traslados.length) {
    const last = traslados[traslados.length - 1];
    const destino = /(?:→|->|hacia|a)\s+([^→>]+)$/.exec(last.title || '');
    if (destino && destino[1].trim()) {
      return { location: destino[1].trim(), inferred: true };
    }
  }

  return { location: BASE_POR_DIA[weekdayOf(dateStr)] || '', inferred: false };
}

/**
 * Traslados sugeridos entre dos compromisos en ubicaciones distintas.
 * No inventamos duraciones "reales": ocupamos exactamente el hueco disponible
 * y el bloque queda marcado como sugerencia hasta que tú lo confirmes.
 */
export function suggestedTransfers(events = []) {
  const timed = events
    .filter((event) => event.source === 'google' && !event.allDay && event.startTime && event.endTime)
    .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));

  const suggestions = [];
  for (let i = 0; i < timed.length - 1; i += 1) {
    const current = timed[i];
    const next = timed[i + 1];
    if (current.category === 'traslado' || next.category === 'traslado') continue;
    if (!current.location || !next.location) continue;
    if (sameLocation(current.location, next.location)) continue;

    const gapStart = minutesOfDay(current.endTime);
    const gapEnd = minutesOfDay(next.startTime);
    if (gapEnd - gapStart < 10) continue;

    const titulo = `Traslado ${current.location} → ${next.location}`;
    if (esPlanCancelado(titulo)) continue;

    suggestions.push({
      id: `sug-${current.id}-${next.id}`,
      date: current.date,
      source: 'sugerencia',
      category: 'traslado',
      title: titulo,
      location: `${current.location} → ${next.location}`,
      startTime: minutesToTime(gapStart),
      endTime: minutesToTime(gapEnd),
      allDay: false,
      tasks: [],
      notes: 'Sugerencia: confirma el horario real antes de agendarlo.',
      htmlLink: null,
    });
  }
  return suggestions;
}

/**
 * Contexto de ida y vuelta cuando el día tiene un compromiso fuera de la
 * ubicación base (por ejemplo Todos Santos ↔ La Paz).
 */
export function roundTripContext(dateStr, events = []) {
  const base = baseLocationForDay(dateStr, []).location;
  const fuera = events.find(
    (event) =>
      event.source === 'google' &&
      event.location &&
      event.category !== 'traslado' &&
      !sameLocation(event.location, base)
  );
  if (!base || !fuera) return null;
  return {
    label: `${base} ↔ ${fuera.location}`,
    detail: 'Recorrido de contexto. Los horarios de traslado son sugerencia hasta que los confirmes.',
  };
}

/** Sugerencia de hospedaje cuando hay trabajo en la misma plaza lejana dos días seguidos. */
export function lodgingHint(dateStr, events = [], nextDayEvents = []) {
  const fuera = events.find(
    (event) => event.source === 'google' && /la paz/i.test(event.location || '')
  );
  if (!fuera) return null;
  const sigueFuera = nextDayEvents.some(
    (event) => event.source === 'google' && /la paz/i.test(event.location || '')
  );
  return sigueFuera
    ? 'Hay más trabajo en La Paz mañana: considera pasar la noche en un Airbnb.'
    : 'Sin más trabajo en La Paz: puedes considerar el regreso el mismo día a Todos Santos.';
}

/**
 * Espacios libres del día. Si no hay ningún compromiso confirmado, devuelve un
 * único bloque "Libre".
 */
export function freeSlots(dateStr, events = []) {
  const dayStart = minutesOfDay(DIA_INICIO[weekdayOf(dateStr)] || '08:00');
  const dayEnd = minutesOfDay(DIA_FIN);

  const busy = events
    .filter((event) => !event.allDay && event.startTime && event.endTime && event.source !== 'libre')
    .map((event) => ({
      start: minutesOfDay(event.startTime),
      end: minutesOfDay(event.endTime),
    }))
    .filter((slot) => slot.end > slot.start)
    .sort((a, b) => a.start - b.start);

  if (busy.length === 0) {
    return [
      {
        id: `libre-${dateStr}-todo`,
        date: dateStr,
        source: 'libre',
        category: 'descanso',
        title: 'Libre',
        startTime: null,
        endTime: null,
        allDay: true,
        wholeDay: true,
        tasks: [],
      },
    ];
  }

  // Unimos los bloques traslapados antes de buscar huecos.
  const merged = [busy[0]];
  for (const slot of busy.slice(1)) {
    const last = merged[merged.length - 1];
    if (slot.start <= last.end) last.end = Math.max(last.end, slot.end);
    else merged.push({ ...slot });
  }

  const gaps = [];
  let cursor = dayStart;
  for (const slot of merged) {
    if (slot.start - cursor >= HUECO_MINIMO) {
      gaps.push({ start: cursor, end: slot.start });
    }
    cursor = Math.max(cursor, slot.end);
  }
  if (dayEnd - cursor >= HUECO_MINIMO) gaps.push({ start: cursor, end: dayEnd });

  return gaps.map((gap) => ({
    id: `libre-${dateStr}-${gap.start}`,
    date: dateStr,
    source: 'libre',
    category: 'descanso',
    title: 'Espacio libre',
    startTime: minutesToTime(gap.start),
    endTime: minutesToTime(gap.end),
    allDay: false,
    wholeDay: false,
    tasks: [],
  }));
}
