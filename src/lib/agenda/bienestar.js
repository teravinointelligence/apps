/**
 * Plan de hábitos de la semana, construido sobre datos reales de Fitbit
 * (14 de marzo – 30 de julio de 2026, 45 días con el reloj puesto).
 *
 * Es un plan de hábitos basado en datos propios, NO una indicación médica.
 *
 * Igual que las preferencias de planeación: esto SUGIERE. Ningún bloque de
 * bienestar se guarda en Google Calendar sin pasar por el modal
 * "Revisar antes de guardar".
 */

import { formatTime12, minutesOfDay } from './time';

export const PASO_CERO =
  'Paso cero: vuelve a ponerte el reloj. No registra nada desde el 31 de julio y sin eso la semana no se puede medir.';

export const AJUSTE_META =
  'La meta original era “no más de 4 h en la computadora”. Si esas horas son de trabajo, la meta te hace fallar por algo que no controlas. Aquí el total de horas de trabajo no se toca: lo que se corta son los bloques largos de corrido y el tiempo de pantalla negociable (redes y tele).';

export const REGLA_SEMANA = 'Cuenta la semana como buena con 5 de 7 días. Siete de siete no existe.';

export const METAS = [
  {
    id: 'pausas',
    numero: 1,
    titulo: 'Levantarte cada 45 minutos',
    meta: '8 pausas al día',
    campo: 'pausas',
    objetivo: 8,
    detalle:
      'Es la meta principal, la que reemplaza el “máximo 4 h”. No importa cuántas horas trabajes; importa que ninguna sea de corrido. Una pausa = ponerte de pie y caminar 2–3 minutos, aunque sea a la cocina.',
    deDondeVienes:
      '3.2 bloques de 1 h o más al día · el 46 % de tu tiempo sentada ocurre en esos bloques · el más largo del periodo fueron 5 horas seguidas.',
    emoji: '🧍',
    color: '#8B5CF6',
  },
  {
    id: 'horas_activas',
    numero: 2,
    titulo: '10 horas activas de 16',
    meta: '250+ pasos en cada hora entre 7 am y 11 pm',
    campo: 'horas_activas',
    objetivo: 10,
    detalle:
      'Es el mismo umbral del recordatorio horario del Fitbit, así que el reloj te lo cuenta solo. Tres o cuatro huecos rellenados al día bastan para llegar.',
    deDondeVienes: '6.7 horas activas de 16, promedio de 45 días.',
    emoji: '⏱️',
    color: '#14B8A6',
  },
  {
    id: 'pasos',
    numero: 3,
    titulo: '7,000 pasos al día',
    meta: '7,000 pasos',
    campo: 'pasos',
    objetivo: 7000,
    detalle:
      'Son unos 1,400 más que tu promedio de julio: entre 12 y 15 minutos de caminata. No hace falta una sesión de ejercicio: sale de las pausas de la meta 1 más una caminata después de cenar.',
    deDondeVienes:
      '5,643 pasos/día en julio (4,776 en todo el periodo) · llegaste a 7,000 solo el 16 % de los días.',
    emoji: '👟',
    color: '#FB923C',
  },
  {
    id: 'pantalla',
    numero: 4,
    titulo: 'Cero redes sociales, y tele con hora de corte',
    meta: '0 min de redes',
    campo: 'redes_min',
    objetivo: 0,
    invertida: true,
    detalle:
      'Esto es lo que de verdad sustituye a la meta de las 4 horas: es pantalla elegida, no impuesta. Anota los minutos de tele para verlos, no para castigarte.',
    deDondeVienes:
      'De 8 a 11 de la noche no te mueves prácticamente ningún día (84 %, 87 % y 98 % de los días). Ese es el hueco que ocupan las pantallas.',
    emoji: '📵',
    color: '#EC4899',
  },
];

/**
 * Tu día hora por hora, según 45 días con el reloj.
 * `nivel`: 'buena' (ya funciona, hay que protegerla), 'critica' (aquí se te va
 * el día quieta) o 'normal'.
 */
export const HORAS = [
  { hora: '07:00', sinMoverte: 36, pasos: 394, nivel: 'buena', nota: 'Ya te mueves. Solo protégela: si sales, que sea a pie el último tramo.' },
  { hora: '08:00', sinMoverte: 47, pasos: 274, nivel: 'normal', nota: 'Arranque de jornada. Primera pausa antes de sentarte del todo.' },
  { hora: '09:00', sinMoverte: 56, pasos: 295, nivel: 'normal', nota: 'Pausa. Es de las horas que más se te van quieta.' },
  { hora: '10:00', sinMoverte: 44, pasos: 301, nivel: 'normal', nota: 'Pausa de media mañana. Llena el vaso de agua caminando.' },
  { hora: '11:00', sinMoverte: 49, pasos: 296, nivel: 'normal', nota: 'Pausa.' },
  { hora: '12:00', sinMoverte: 53, pasos: 285, nivel: 'normal', nota: 'Comida: come lejos del escritorio. Es la pausa más fácil del día.' },
  { hora: '13:00', sinMoverte: 49, pasos: 333, nivel: 'normal', nota: 'Buen momento para la caminata larga si la haces de día.' },
  { hora: '14:00', sinMoverte: 60, pasos: 223, nivel: 'critica', nota: 'Tu peor hora de la jornada y la de menos pasos. Pon aquí la alarma.' },
  { hora: '15:00', sinMoverte: 51, pasos: 302, nivel: 'normal', nota: 'Pausa.' },
  { hora: '16:00', sinMoverte: 62, pasos: 244, nivel: 'critica', nota: 'La peor de todas. Levántate sí o sí.' },
  { hora: '17:00', sinMoverte: 38, pasos: 460, nivel: 'buena', nota: 'Tu mejor hora del día. Ya funciona: no la ocupes con pantalla.' },
  { hora: '18:00', sinMoverte: 49, pasos: 392, nivel: 'buena', nota: 'Sigue siendo buena. Protégela.' },
  { hora: '19:00', sinMoverte: 64, pasos: 276, nivel: 'critica', nota: 'Aquí es donde la tele suele empezar a ganar.' },
  { hora: '20:00', sinMoverte: 84, pasos: 145, nivel: 'critica', nota: 'Caminata después de cenar: 10 minutos ≈ 1,000 pasos.' },
  { hora: '21:00', sinMoverte: 87, pasos: 91, nivel: 'critica', nota: 'Cero redes. Corte de pantalla.' },
  { hora: '22:00', sinMoverte: 98, pasos: 52, nivel: 'critica', nota: 'A dormir. Tu hora habitual son las 22:06 — mantenla.' },
];

/** Las tres horas que más rinden si solo puedes cambiar una cosa. */
export const HORAS_CLAVE = ['14:00', '16:00', '20:00'];

export const CONSEJOS = [
  'Engancha las pausas a algo que ya pasa, no a un horario: “me levanto al terminar cada llamada”. Los recordatorios por hora se ignoran a la semana; los disparadores que ya existen en tu día, no.',
  'La caminata después de cenar es la jugada con mejor relación esfuerzo/resultado: de 8 a 11 de la noche casi no te mueves el 90 % de los días. Diez minutos ahí son ~1,000 pasos.',
  'El coche no se puede romper, pero sí no encadenar. Manejas alrededor de 1 hora al día y eso cuenta como sentada: al bajarte, cinco minutos de pie antes de sentarte otra vez.',
  'Para las redes, quita el disparador en vez de usar fuerza de voluntad: borrar la app del teléfono durante la semana funciona mucho mejor que proponérselo.',
  'Recordatorios en el reloj: el intervalo de Fitbit y del Apple Watch es fijo cada hora. La mejor opción es Ajustes > Accesibilidad > Carrillón en el Apple Watch, cada 30 minutos, con Modo Sueño de 21:45 a 07:00 para que se calle de noche.',
  'Duermes 6 h 52 min de media y 20 de 41 noches quedaron bajo 7 horas. Si la caminata nocturna te empuja la hora de dormir, muévela a la tarde: no vale la pena cambiar pasos por sueño.',
];

export const DESCARGO =
  'Los números de “de dónde vienes” salen de 45 días con el reloj puesto. Esto es un plan de hábitos basado en tus propios datos, no una indicación médica.';

/* ------------------------------------------------------------------ *
 * Cruce con la agenda
 * ------------------------------------------------------------------ */

/** Duración mínima (minutos) a partir de la cual un bloque cuenta como "de corrido". */
const BLOQUE_LARGO = 90;
/** Cada cuántos minutos deberías levantarte (meta 1). */
export const CADA_MINUTOS = 45;

/**
 * Bloques confirmados que se van de corrido.
 *
 * Es el aviso que corresponde a la meta principal: no importa cuántas horas
 * trabajes, importa que ninguna sea seguida. También cuentan los traslados:
 * manejar es tiempo sentada.
 */
export function sittingAlerts(events = []) {
  return events
    .filter(
      (event) =>
        event.source === 'google' && !event.allDay && event.startTime && event.endTime
    )
    .map((event) => {
      const minutos = minutesOfDay(event.endTime) - minutesOfDay(event.startTime);
      if (minutos < BLOQUE_LARGO) return null;
      return {
        id: event.id,
        titulo: event.title,
        minutos,
        pausas: Math.floor(minutos / CADA_MINUTOS),
        conduciendo: event.category === 'traslado',
      };
    })
    .filter(Boolean);
}

/**
 * Horas críticas que caen DENTRO de un compromiso confirmado del día.
 * Sirve para avisar "las 2 y las 4 caen dentro de Home Office: levántate".
 */
export function criticalHoursInEvents(events = []) {
  const ocupadas = events.filter(
    (event) => event.source === 'google' && !event.allDay && event.startTime && event.endTime
  );
  if (!ocupadas.length) return [];

  return HORAS.filter((h) => h.nivel === 'critica')
    .map((h) => {
      const minuto = minutesOfDay(h.hora);
      const dentro = ocupadas.find(
        (event) => minuto >= minutesOfDay(event.startTime) && minuto < minutesOfDay(event.endTime)
      );
      return dentro ? { ...h, evento: dentro.title } : null;
    })
    .filter(Boolean);
}

/** Los bloques de bienestar que proponemos, siempre como sugerencia. */
const BLOQUES = [
  {
    id: 'caminata',
    title: 'Caminata después de cenar',
    startTime: '20:00',
    endTime: '20:15',
    category: 'ejercicio',
    notes: '10 minutos ≈ 1,000 pasos.',
    siempre: true,
  },
  {
    id: 'corte-pantalla',
    title: 'Corte de pantalla · cero redes',
    startTime: '21:00',
    endTime: '21:15',
    category: 'descanso',
    notes: 'A las 21:00 llevas 87 % de los días sin moverte. Dormir 22:06.',
    siempre: true,
  },
  {
    id: 'pausa-14',
    title: 'Pausa activa',
    startTime: '14:00',
    endTime: '14:05',
    category: 'ejercicio',
    notes: 'Tu peor hora de la jornada. De pie, camina 2–3 minutos.',
    soloSiOcupada: '14:00',
  },
  {
    id: 'pausa-16',
    title: 'Pausa activa',
    startTime: '16:00',
    endTime: '16:05',
    category: 'ejercicio',
    notes: 'La peor hora de todas. Levántate sí o sí.',
    soloSiOcupada: '16:00',
  },
];

/**
 * Sugerencias de bienestar para un día.
 *
 * Las pausas solo aparecen cuando esa hora crítica cae dentro de un
 * compromiso confirmado; la caminata y el corte de pantalla aparecen siempre,
 * salvo que ya tengas algo confirmado encima.
 */
export function wellnessSuggestions(dateStr, events = []) {
  const ocupadas = events.filter(
    (event) => event.source === 'google' && !event.allDay && event.startTime && event.endTime
  );
  const chocaCon = (inicio, fin) =>
    ocupadas.find(
      (event) =>
        minutesOfDay(inicio) < minutesOfDay(event.endTime) &&
        minutesOfDay(fin) > minutesOfDay(event.startTime)
    );
  const horaOcupada = (hora) => {
    const minuto = minutesOfDay(hora);
    // Dentro de un compromiso, o justo cuando termina un bloque largo: el
    // mejor momento para levantarse es al cerrar algo que ya venía de corrido.
    return ocupadas.some((event) => {
      const inicio = minutesOfDay(event.startTime);
      const fin = minutesOfDay(event.endTime);
      if (minuto >= inicio && minuto < fin) return true;
      return fin - inicio >= BLOQUE_LARGO && fin >= minuto && fin < minuto + 60;
    });
  };

  return BLOQUES.filter((bloque) => {
    if (bloque.soloSiOcupada) return horaOcupada(bloque.soloSiOcupada);
    return !chocaCon(bloque.startTime, bloque.endTime);
  }).map((bloque) => ({
    id: `bienestar-${dateStr}-${bloque.id}`,
    date: dateStr,
    source: 'sugerencia',
    bienestar: true,
    category: bloque.category,
    title: bloque.title,
    location: '',
    startTime: bloque.startTime,
    endTime: bloque.endTime,
    allDay: false,
    tasks: [],
    notes: bloque.notes,
    htmlLink: null,
  }));
}

/** Resumen de un día del registro frente a las metas. */
export function evaluarDia(registro) {
  if (!registro) return { cumplidas: 0, total: METAS.length, buena: false };
  const cumplidas = METAS.filter((meta) => {
    const valor = registro[meta.campo];
    if (valor === null || valor === undefined || valor === '') return false;
    return meta.invertida ? Number(valor) <= meta.objetivo : Number(valor) >= meta.objetivo;
  }).length;
  return { cumplidas, total: METAS.length, buena: cumplidas >= 3 };
}

/** Etiqueta legible de una hora del plan (`14:00` -> `2:00 p.m.`). */
export const horaLegible = (hora) => formatTime12(hora);
