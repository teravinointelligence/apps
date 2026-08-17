/**
 * Utilidades de fecha y hora ancladas a la zona horaria de la agenda.
 *
 * Regla del proyecto: TODA fecha/hora que el usuario ve o escribe se interpreta
 * en `America/Mazatlan`. Las fechas de calendario se manejan como cadenas
 * `YYYY-MM-DD` (sin zona) y las horas como `HH:mm`, para que nunca se corran
 * de día por culpa de la zona local del navegador.
 */

export const TZ = 'America/Mazatlan';

export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DIAS_LARGOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Desfase (en minutos) de la zona de la agenda para un instante dado. */
function offsetMinutesAt(instant) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of dtf.formatToParts(instant)) parts[part.type] = part.value;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUTC - instant.getTime()) / 60000;
}

/** Convierte una hora local de la agenda (`2026-08-17`, `08:00`) a un Date real. */
export function zonedToUtc(dateStr, timeStr = '00:00') {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr).split(':').map(Number);
  const wallClock = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0);
  // Dos pasadas: la primera estima el desfase, la segunda lo confirma en el
  // instante correcto (importa si alguna vez vuelve el horario de verano).
  let ts = wallClock - offsetMinutesAt(new Date(wallClock)) * 60000;
  ts = wallClock - offsetMinutesAt(new Date(ts)) * 60000;
  return new Date(ts);
}

/** Desfase con formato RFC3339 (`-07:00`) para una fecha/hora local. */
export function offsetLabel(dateStr, timeStr = '00:00') {
  const offset = offsetMinutesAt(zonedToUtc(dateStr, timeStr));
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** `2026-08-17` + `08:00` -> `2026-08-17T08:00:00-07:00` */
export function toRfc3339(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00${offsetLabel(dateStr, timeStr)}`;
}

/** Descompone un instante en sus partes locales de la agenda. */
export function partsInTz(instant) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = {};
  for (const part of dtf.formatToParts(instant)) parts[part.type] = part.value;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

/** Fecha `YYYY-MM-DD` de hoy en la zona de la agenda. */
export function todayStr() {
  return partsInTz(new Date()).date;
}

/** Hora `HH:mm` actual en la zona de la agenda. */
export function nowTimeStr() {
  return partsInTz(new Date()).time;
}

/** Suma días a una fecha `YYYY-MM-DD` sin tocar zonas horarias. */
export function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return next.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha `YYYY-MM-DD`. */
export function weekdayOf(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Lunes de la semana que contiene a `dateStr`. */
export function startOfWeek(dateStr) {
  const dow = weekdayOf(dateStr);
  return addDays(dateStr, -((dow + 6) % 7));
}

/** Las siete fechas (lunes a domingo) de la semana que arranca en `mondayStr`. */
export function weekDates(mondayStr) {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

/** `2026-08-17` -> `17` */
export function dayNumber(dateStr) {
  return Number(String(dateStr).slice(8, 10));
}

/** `2026-08-17` -> `Lunes` */
export function dayName(dateStr) {
  return DIAS_LARGOS[weekdayOf(dateStr)];
}

/** `2026-08-17` -> `17 de agosto` */
export function dayAndMonth(dateStr) {
  const [, m, d] = String(dateStr).split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

/** Rótulo del rango semanal, p. ej. `17 – 23 de agosto de 2026`. */
export function weekRangeLabel(mondayStr) {
  const sunday = addDays(mondayStr, 6);
  const [y1, m1, d1] = mondayStr.split('-').map(Number);
  const [y2, m2, d2] = sunday.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${d1} – ${d2} de ${MESES[m1 - 1]} de ${y1}`;
  if (y1 === y2) return `${d1} de ${MESES[m1 - 1]} – ${d2} de ${MESES[m2 - 1]} de ${y1}`;
  return `${d1} de ${MESES[m1 - 1]} de ${y1} – ${d2} de ${MESES[m2 - 1]} de ${y2}`;
}

/** `08:30` -> 510 */
export function minutesOfDay(timeStr) {
  if (!timeStr) return null;
  const [hh, mm] = String(timeStr).split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

/** 510 -> `08:30` */
export function minutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const hh = String(Math.floor(clamped / 60) % 24).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** `13:05` -> `1:05 p.m.` */
export function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [hh, mm] = String(timeStr).split(':').map(Number);
  const suffix = hh >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm || 0).padStart(2, '0')} ${suffix}`;
}

/** `07:00`–`07:30` -> `7:00 – 7:30 a.m.` (une el sufijo cuando coincide). */
export function formatRange(startTime, endTime) {
  if (!startTime) return '';
  if (!endTime) return formatTime12(startTime);
  const a = formatTime12(startTime);
  const b = formatTime12(endTime);
  const suffixA = a.slice(-4);
  const suffixB = b.slice(-4);
  if (suffixA === suffixB) return `${a.slice(0, -5)} – ${b}`;
  return `${a} – ${b}`;
}

/** Duración legible; devuelve `''` cuando no aporta nada. */
export function durationLabel(startTime, endTime) {
  const start = minutesOfDay(startTime);
  const end = minutesOfDay(endTime);
  if (start == null || end == null) return '';
  const total = end - start;
  if (total <= 0) return '';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
