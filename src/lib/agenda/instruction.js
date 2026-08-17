/**
 * Interpretación de instrucciones en español natural.
 *
 * Camino principal: `base44.integrations.Core.InvokeLLM` con respuesta
 * estructurada. Si el modelo no está disponible o devuelve algo inservible,
 * caemos a un intérprete local por expresiones regulares para que la app siga
 * siendo útil (y siempre se avisa que fue una lectura básica).
 *
 * En ningún caso se guarda nada: el resultado alimenta el modal
 * "Revisar antes de guardar".
 */

import { base44 } from '@/api/base44Client';
import { CATEGORY_KEYS, normalizeCategory } from './categories';
import { PREFERENCIAS, esPlanCancelado } from './preferences';
import { addDays, dayName, minutesOfDay, minutesToTime, todayStr, weekdayOf } from './time';

export const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Título corto del evento' },
    date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
    start_time: { type: 'string', description: 'Hora de inicio en formato HH:MM de 24 horas' },
    end_time: { type: 'string', description: 'Hora de finalización en formato HH:MM de 24 horas' },
    location: { type: 'string', description: 'Ubicación del evento' },
    category: { type: 'string', enum: CATEGORY_KEYS },
    tasks: { type: 'array', items: { type: 'string' }, description: 'Pendientes del evento' },
    notes: { type: 'string', description: 'Notas adicionales' },
    clarification: {
      type: 'string',
      description: 'Pregunta o aviso cuando falte información importante. Cadena vacía si todo quedó claro.',
    },
  },
  required: ['title', 'date', 'start_time', 'end_time'],
};

const DIAS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  'miercoles': 3,
  'miércoles': 3,
  jueves: 4,
  viernes: 5,
  'sabado': 6,
  'sábado': 6,
};

function buildPrompt(instruction, today) {
  const weekday = dayName(today);
  return [
    'Eres el asistente de una agenda personal llamada Agenda Viva.',
    `Hoy es ${weekday} ${today}. La zona horaria SIEMPRE es America/Mazatlan.`,
    '',
    'Convierte la instrucción del usuario en un solo evento de calendario.',
    '',
    'Reglas:',
    '- "date" siempre en formato YYYY-MM-DD. "mañana" es el día siguiente a hoy; "hoy" es hoy.',
    '- Si menciona un día de la semana sin fecha, usa la próxima ocurrencia a partir de hoy.',
    '- "start_time" y "end_time" en formato HH:MM de 24 horas.',
    '- En español "de 8 a 2" significa de 08:00 a 14:00: elige la interpretación que dé una duración positiva y razonable durante el día.',
    '- Si no se indica hora de fin, propón una duración razonable y anótalo en "clarification".',
    `- "category" debe ser una de: ${CATEGORY_KEYS.join(', ')}.`,
    '- "tasks" es la lista de pendientes mencionados, uno por elemento, sin viñetas.',
    '- "notes" para lo que no encaje en los otros campos. No inventes datos.',
    '- Si falta información importante (fecha, horario o ubicación), explícalo en "clarification". Si todo quedó claro, deja "clarification" vacío.',
    '',
    'Preferencias del usuario, útiles solo para sugerir ubicación o horario (nunca las conviertas en hechos):',
    ...PREFERENCIAS.map((pref) => `- ${pref}`),
    '',
    'Instrucción del usuario:',
    `"""${instruction}"""`,
  ].join('\n');
}

function normalizeTime(value, fallback = null) {
  if (value == null) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;

  const hhmm = /^(\d{1,2})[:.h](\d{2})$/.exec(text);
  if (hhmm) return minutesToTime(Number(hhmm[1]) * 60 + Number(hhmm[2]));

  const onlyHour = /^(\d{1,2})$/.exec(text);
  if (onlyHour) return minutesToTime(Number(onlyHour[1]) * 60);

  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i.exec(text);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (/p/i.test(ampm[3])) hour += 12;
    return minutesToTime(hour * 60 + Number(ampm[2] || 0));
  }
  return fallback;
}

/**
 * "de 8 a 2" en español casi siempre significa 08:00–14:00. Si el fin quedó
 * antes del inicio, probamos sumarle 12 horas antes de rendirnos.
 */
function fixAmPmSlip(startTime, endTime) {
  const start = minutesOfDay(startTime);
  let end = minutesOfDay(endTime);
  if (start == null || end == null) return endTime;
  if (end > start) return endTime;
  if (end + 12 * 60 > start && end + 12 * 60 <= 23 * 60 + 59) return minutesToTime(end + 12 * 60);
  return endTime;
}

function normalizeDate(value, today) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return today;
}

/** Da forma final al borrador venga de donde venga. */
function shapeDraft(raw, today, { source }) {
  const title = String(raw?.title || '').trim() || 'Nuevo evento';
  const date = normalizeDate(raw?.date, today);
  const startTime = normalizeTime(raw?.start_time, '09:00');
  let endTime = normalizeTime(raw?.end_time, null);
  if (!endTime) {
    endTime = minutesToTime(Math.min(minutesOfDay(startTime) + 60, 23 * 60 + 59));
  }
  endTime = fixAmPmSlip(startTime, endTime);

  const location = String(raw?.location || '').trim();
  const tasks = Array.isArray(raw?.tasks)
    ? raw.tasks.map((task) => String(task || '').trim()).filter(Boolean)
    : [];

  const avisos = [];
  if (raw?.clarification && String(raw.clarification).trim()) {
    avisos.push(String(raw.clarification).trim());
  }
  if (minutesOfDay(endTime) <= minutesOfDay(startTime)) {
    avisos.push('No pude deducir un horario válido: revisa la hora de inicio y de finalización.');
  }
  if (!location) {
    avisos.push('No mencionaste una ubicación. Puedes escribirla antes de guardar.');
  }
  const cancelado = esPlanCancelado(`${title} ${location} ${tasks.join(' ')}`);
  if (cancelado) avisos.push(`${cancelado.nota} Confírmalo solo si de verdad quieres revivirlo.`);

  return {
    title,
    date,
    start_time: startTime,
    end_time: endTime,
    location,
    category: normalizeCategory(raw?.category, { title, location }),
    tasks,
    notes: String(raw?.notes || '').trim(),
    clarification: avisos.join(' '),
    source,
  };
}

/* ------------------------------------------------------------------ *
 * Intérprete local de respaldo
 * ------------------------------------------------------------------ */

function localParse(instruction, today) {
  const text = String(instruction || '');
  const lower = text.toLowerCase();

  // Fecha
  let date = today;
  if (/\bpasado ma[ñn]ana\b/.test(lower)) date = addDays(today, 2);
  else if (/\bma[ñn]ana\b/.test(lower)) date = addDays(today, 1);
  else if (/\bhoy\b/.test(lower)) date = today;
  else {
    const diaMatch = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/.exec(lower);
    if (diaMatch) {
      const target = DIAS[diaMatch[1]];
      const current = weekdayOf(today);
      let delta = (target - current + 7) % 7;
      if (delta === 0) delta = 7;
      date = addDays(today, delta);
    }
    const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
    if (isoMatch) date = isoMatch[1];
  }

  // Horario: "de 8 a 2", "de 8:30 a 14:00", "a las 10"
  let startTime = null;
  let endTime = null;
  const rango = /\bde\s+(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)?\s+a\s+(?:las\s+)?(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)?/i.exec(text);
  if (rango) {
    startTime = normalizeTime(`${rango[1]}${rango[2] ? ' ' + rango[2] : ''}`);
    endTime = normalizeTime(`${rango[3]}${rango[4] ? ' ' + rango[4] : ''}`);
  } else {
    const alas = /\ba\s+las\s+(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)?/i.exec(text);
    if (alas) startTime = normalizeTime(`${alas[1]}${alas[2] ? ' ' + alas[2] : ''}`);
  }

  // Pendientes
  let tasks = [];
  const pendientes = /\b(?:con\s+(?:los\s+)?pendientes?|pendientes?:|con\s+las\s+tareas?)\s+(.+)$/i.exec(text);
  if (pendientes) {
    tasks = pendientes[1]
      .split(/,| y (?!al |el |la )|;|\n/i)
      .map((item) => item.replace(/[.\s]+$/, '').trim())
      .filter(Boolean);
  }

  // Ubicación
  const ubicacion = /\ben\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ .]{2,40})/.exec(text);

  // Título: lo que va después del verbo inicial y antes del horario o pendientes.
  let title = text
    .replace(/^\s*(agrega|agregar|añade|añadir|programa|programar|pon|poner|crea|crear|apunta|apuntar|agéndame|agendame|agenda)\s+/i, '')
    .replace(/\b(hoy|ma[ñn]ana|pasado ma[ñn]ana)\b/gi, ' ')
    .replace(/\bde\s+\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?\s+a\s+(?:las\s+)?\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/gi, ' ')
    .replace(/\ba\s+las\s+\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/gi, ' ')
    .replace(/\b(?:con\s+(?:los\s+)?pendientes?|pendientes?:|con\s+las\s+tareas?)\s+.*$/i, ' ')
    .replace(/\b(el|los|la|las)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) title = 'Nuevo evento';
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    title,
    date,
    start_time: startTime,
    end_time: endTime,
    location: ubicacion ? ubicacion[1].trim() : '',
    category: null,
    tasks,
    notes: '',
    clarification: '',
  };
}

/* ------------------------------------------------------------------ *
 * API pública
 * ------------------------------------------------------------------ */

/**
 * Interpreta una instrucción y devuelve un borrador listo para revisar.
 * Nunca guarda nada en Google Calendar.
 */
export async function interpretInstruction(instruction, { today = todayStr() } = {}) {
  const clean = String(instruction || '').trim();
  if (!clean) {
    throw new Error('Escribe o dicta una instrucción antes de preparar el evento.');
  }

  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(clean, today),
      response_json_schema: DRAFT_SCHEMA,
    });

    // Según la versión del SDK la respuesta llega directa o envuelta.
    const raw = response?.data ?? response?.result ?? response;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object' && (parsed.title || parsed.date)) {
      return shapeDraft(parsed, today, { source: 'llm' });
    }
    throw new Error('La respuesta del modelo llegó vacía.');
  } catch (error) {
    const local = localParse(clean, today);
    const draft = shapeDraft(local, today, { source: 'local' });
    draft.clarification = [
      'No pude usar la interpretación con inteligencia artificial en este momento',
      `(${error?.message || 'error desconocido'}), así que hice una lectura básica de tu instrucción.`,
      'Revisa bien los campos antes de guardar.',
      draft.clarification,
    ]
      .filter(Boolean)
      .join(' ');
    return draft;
  }
}

/** Borrador vacío para el botón "Nuevo". */
export function emptyDraft(date = todayStr()) {
  return {
    title: '',
    date,
    start_time: '09:00',
    end_time: '10:00',
    location: '',
    category: 'otros',
    tasks: [],
    notes: '',
    clarification: '',
    source: 'manual',
  };
}
