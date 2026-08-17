/**
 * Lectura y escritura de los pendientes que viven dentro de la descripción
 * de un evento de Google Calendar.
 *
 * Formato canónico que escribimos:
 *
 *   Notas libres (opcionales)
 *
 *   PENDIENTES
 *   ☐ Primer pendiente
 *   ☑ Segundo pendiente (completado)
 *
 * Al leer somos deliberadamente tolerantes: Google puede devolver la
 * descripción como HTML, con `<br>` en vez de saltos de línea, o incluso con
 * todos los pendientes pegados en un solo renglón. Por eso el parser NO se
 * apoya en los saltos de línea: parte el texto por los propios símbolos de
 * casilla.
 *
 * IMPORTANTE: este archivo tiene una copia gemela dentro de
 * `base44/functions/google-calendar/entry.ts`. Si cambias la lógica, cámbiala
 * en ambos lados.
 */

export const BOX_OPEN = '☐';
export const BOX_DONE = '☑';
export const TASKS_HEADER = 'PENDIENTES';

const OPEN_BOXES = '☐□◻❏○';
const DONE_BOXES = '☑☒✅✔■◼🗹';
const ANY_BOX = new RegExp(`[${OPEN_BOXES}${DONE_BOXES}]️?`, 'gu');
const HEADER_RE = /PENDIENTES\s*:?/i;

/** Convierte una descripción que puede venir en HTML a texto plano. */
export function htmlToPlain(input) {
  if (!input) return '';
  let text = String(input);
  if (!/[<&]/.test(text)) return text.replace(/\r\n?/g, '\n');

  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  text = text.replace(/&[a-z]+;|&#\d+;/gi, (match) => {
    const lower = match.toLowerCase();
    if (entities[lower]) return entities[lower];
    const numeric = /^&#(\d+);$/.exec(match);
    if (numeric) return String.fromCodePoint(Number(numeric[1]));
    return match;
  });

  return text.replace(/\n{3,}/g, '\n\n');
}

function cleanTaskText(raw) {
  return String(raw)
    .replace(/^[\s\-–—*•·:.]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Separa la descripción de un evento en `{ notes, tasks }`.
 * `tasks` es `[{ text, done }]` y `notes` conserva TODO lo que no es lista.
 */
export function parseDescription(description) {
  const text = htmlToPlain(description);
  if (!text.trim()) return { notes: '', tasks: [] };

  const headerMatch = HEADER_RE.exec(text);
  ANY_BOX.lastIndex = 0;
  const firstBox = ANY_BOX.exec(text);
  ANY_BOX.lastIndex = 0;

  let notesHead = '';
  let body = '';

  if (headerMatch) {
    notesHead = text.slice(0, headerMatch.index);
    body = text.slice(headerMatch.index + headerMatch[0].length);
  } else if (firstBox) {
    notesHead = text.slice(0, firstBox.index);
    body = text.slice(firstBox.index);
  } else {
    return { notes: text.trim(), tasks: [] };
  }

  // Ubicamos cada símbolo de casilla y cortamos el texto entre uno y el siguiente.
  const marks = [];
  ANY_BOX.lastIndex = 0;
  let match;
  while ((match = ANY_BOX.exec(body)) !== null) {
    marks.push({
      index: match.index,
      length: match[0].length,
      done: DONE_BOXES.includes(match[0][0]),
    });
  }

  const tasks = [];
  const notesTail = [];

  if (marks.length === 0) {
    // Encabezado PENDIENTES sin casillas: cada renglón cuenta como pendiente.
    for (const line of body.split('\n')) {
      const clean = cleanTaskText(line);
      if (clean) tasks.push({ text: clean, done: false });
    }
  } else {
    if (marks[0].index > 0) {
      const lead = body.slice(0, marks[0].index).trim();
      if (lead) notesTail.push(lead);
    }
    marks.forEach((mark, i) => {
      const from = mark.index + mark.length;
      const to = i + 1 < marks.length ? marks[i + 1].index : body.length;
      let chunk = body.slice(from, to);

      // Un renglón en blanco dentro del bloque significa "aquí se acabó la
      // lista y empiezan las notas de nuevo".
      const blankLine = chunk.search(/\n[ \t]*\n/);
      if (blankLine !== -1) {
        const trailing = chunk.slice(blankLine).trim();
        if (trailing) notesTail.push(trailing);
        chunk = chunk.slice(0, blankLine);
      }

      const clean = cleanTaskText(chunk);
      if (clean) tasks.push({ text: clean, done: mark.done });
    });
  }

  const notes = [notesHead.trim(), ...notesTail].filter(Boolean).join('\n\n').trim();
  return { notes, tasks };
}

/** Arma la descripción final que se guarda en Google Calendar. */
export function buildDescription(notes, tasks) {
  const blocks = [];
  const cleanNotes = String(notes || '').trim();
  if (cleanNotes) blocks.push(cleanNotes);

  const cleanTasks = (tasks || [])
    .map((task) => ({ text: cleanTaskText(task.text || ''), done: !!task.done }))
    .filter((task) => task.text);

  if (cleanTasks.length) {
    blocks.push(
      [
        TASKS_HEADER,
        ...cleanTasks.map((task) => `${task.done ? BOX_DONE : BOX_OPEN} ${task.text}`),
      ].join('\n')
    );
  }

  return blocks.join('\n\n');
}

/** Texto multilínea del modal -> `[{ text, done }]`. Un pendiente por renglón. */
export function parseTaskLines(text) {
  const marker = new RegExp(`^(?:[${OPEN_BOXES}${DONE_BOXES}]️?|\\[\\s*[xX ]?\\s*\\])`, 'u');
  const doneMarker = new RegExp(`^(?:[${DONE_BOXES}]|\\[\\s*[xX]\\s*\\])`, 'u');

  return String(text || '')
    .split('\n')
    .map((line) => {
      // Quitamos primero viñetas y espacios para que "- [x] Tarea" también funcione.
      const bare = line.replace(/^[\s\-–—*•·]+/, '');
      const done = doneMarker.test(bare);
      return { text: cleanTaskText(bare.replace(marker, '')), done };
    })
    .filter((task) => task.text);
}

/** `[{ text, done }]` -> texto multilínea para el modal. */
export function tasksToLines(tasks) {
  return (tasks || []).map((task) => task.text).join('\n');
}

/** `1/3 pendientes` — o cadena vacía si no hay pendientes. */
export function tasksCounterLabel(tasks) {
  if (!tasks || tasks.length === 0) return '';
  const done = tasks.filter((task) => task.done).length;
  return `${done}/${tasks.length} pendientes`;
}
