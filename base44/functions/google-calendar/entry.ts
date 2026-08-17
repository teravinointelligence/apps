/**
 * Agenda Viva — función backend `google-calendar`.
 *
 * Es el ÚNICO punto por el que la app toca Google Calendar. El token del
 * conector se obtiene aquí con `base44.asServiceRole.connectors.getConnection`
 * y jamás sale de este archivo: al frontend solo viajan eventos ya normalizados.
 *
 * Toda petición pasa por dos filtros antes de llegar a Google:
 *   1. debe existir un usuario autenticado;
 *   2. ese usuario debe ser administrador de la app.
 *
 * Sobre los códigos HTTP: las respuestas de negocio (incluidos los rechazos por
 * permisos o por conector desconectado) salen con 200 y un cuerpo
 * `{ ok:false, code, message }`. Es deliberado: así el frontend siempre recibe
 * el motivo exacto y puede decir "el conector no está autorizado" o "tu cuenta
 * no es administradora" en vez de un genérico "falta autorizar". El 500 queda
 * reservado para fallas realmente inesperadas.
 *
 * Acciones: status | list_week | create_event | update_event | delete_event |
 *           update_tasks
 */

import { createClientFromRequest } from 'npm:@base44/sdk';

const TZ = 'America/Mazatlan';
const CALENDAR_ID = 'primary';
const GOOGLE_BASE = 'https://www.googleapis.com/calendar/v3';
const CONNECTOR = 'googlecalendar';

/* ------------------------------------------------------------------ *
 * Fecha y hora en America/Mazatlan
 * ------------------------------------------------------------------ */

function offsetMinutesAt(instant: Date): number {
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
  const parts: Record<string, string> = {};
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

function zonedToUtc(dateStr: string, timeStr = '00:00'): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const wallClock = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0);
  let ts = wallClock - offsetMinutesAt(new Date(wallClock)) * 60000;
  ts = wallClock - offsetMinutesAt(new Date(ts)) * 60000;
  return new Date(ts);
}

function offsetLabel(dateStr: string, timeStr = '00:00'): string {
  const offset = offsetMinutesAt(zonedToUtc(dateStr, timeStr));
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function toRfc3339(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00${offsetLabel(dateStr, timeStr)}`;
}

function partsInTz(instant: Date): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) parts[part.type] = part.value;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}` };
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/* ------------------------------------------------------------------ *
 * Pendientes dentro de la descripción
 * (copia gemela de src/lib/agenda/tasks.js — mantener sincronizadas)
 * ------------------------------------------------------------------ */

const BOX_OPEN = '☐';
const BOX_DONE = '☑';
const TASKS_HEADER = 'PENDIENTES';
const OPEN_BOXES = '☐□◻❏○';
const DONE_BOXES = '☑☒✅✔■◼🗹';
const ANY_BOX = new RegExp(`[${OPEN_BOXES}${DONE_BOXES}]️?`, 'gu');
const HEADER_RE = /PENDIENTES\s*:?/i;

interface AgendaTask {
  text: string;
  done: boolean;
}

function htmlToPlain(input: string | null | undefined): string {
  if (!input) return '';
  let text = String(input);
  if (!/[<&]/.test(text)) return text.replace(/\r\n?/g, '\n');

  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const entities: Record<string, string> = {
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
    return numeric ? String.fromCodePoint(Number(numeric[1])) : match;
  });

  return text.replace(/\n{3,}/g, '\n\n');
}

function cleanTaskText(raw: string): string {
  return String(raw)
    .replace(/^[\s\-–—*•·:.]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDescription(description: string | null | undefined): {
  notes: string;
  tasks: AgendaTask[];
} {
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

  const marks: Array<{ index: number; length: number; done: boolean }> = [];
  ANY_BOX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANY_BOX.exec(body)) !== null) {
    marks.push({ index: match.index, length: match[0].length, done: DONE_BOXES.includes(match[0][0]) });
  }

  const tasks: AgendaTask[] = [];
  const notesTail: string[] = [];

  if (marks.length === 0) {
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

  return {
    notes: [notesHead.trim(), ...notesTail].filter(Boolean).join('\n\n').trim(),
    tasks,
  };
}

function buildDescription(notes: string, tasks: AgendaTask[]): string {
  const blocks: string[] = [];
  const cleanNotes = String(notes || '').trim();
  if (cleanNotes) blocks.push(cleanNotes);

  const cleanTasks = (tasks || [])
    .map((task) => ({ text: cleanTaskText(task?.text || ''), done: !!task?.done }))
    .filter((task) => task.text);

  if (cleanTasks.length) {
    blocks.push(
      [TASKS_HEADER, ...cleanTasks.map((t) => `${t.done ? BOX_DONE : BOX_OPEN} ${t.text}`)].join('\n')
    );
  }
  return blocks.join('\n\n');
}

/* ------------------------------------------------------------------ *
 * Respuestas
 * ------------------------------------------------------------------ */

function ok(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

function fail(code: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, code, message, ...extra });
}

/* ------------------------------------------------------------------ *
 * Google Calendar
 * ------------------------------------------------------------------ */

class GoogleError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function googleFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${GOOGLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const raw = await response.text();
  let body: any = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = { error: { message: raw.slice(0, 400) } };
    }
  }

  if (!response.ok) {
    const detail = body?.error?.message || `Google respondió ${response.status}.`;
    if (response.status === 401) {
      throw new GoogleError(
        'google_auth',
        `Google rechazó el token de la app (${detail}). Vuelve a autorizar el conector de Google Calendar.`,
        response.status
      );
    }
    if (response.status === 403) {
      throw new GoogleError(
        'google_forbidden',
        `Google negó el permiso: ${detail}. Revisa que el conector tenga los permisos calendar.readonly y calendar.events.`,
        response.status
      );
    }
    if (response.status === 404) {
      throw new GoogleError('event_not_found', `El evento ya no existe en Google Calendar (${detail}).`, 404);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new GoogleError(
        'google_unavailable',
        `Google Calendar no está respondiendo en este momento (${detail}). Vuelve a intentar en un minuto.`,
        response.status
      );
    }
    throw new GoogleError('google_error', detail, response.status);
  }

  return body;
}

/** Evento de Google -> forma normalizada que consume la agenda. */
function normalizeEvent(raw: any) {
  const allDay = !!raw?.start?.date && !raw?.start?.dateTime;
  let date: string;
  let startTime: string | null = null;
  let endTime: string | null = null;
  let endDate: string;

  if (allDay) {
    date = raw.start.date;
    // En Google el `end.date` de un evento de día completo es exclusivo.
    endDate = raw.end?.date ? addDays(raw.end.date, -1) : date;
  } else {
    const start = partsInTz(new Date(raw.start.dateTime));
    const end = raw.end?.dateTime ? partsInTz(new Date(raw.end.dateTime)) : null;
    date = start.date;
    startTime = start.time;
    endTime = end ? end.time : null;
    endDate = end ? end.date : date;
    // Si el bloque cruza la medianoche, lo cerramos a las 23:59 del día que se pinta.
    if (end && end.date !== start.date) endTime = '23:59';
  }

  const { notes, tasks } = parseDescription(raw?.description);

  return {
    id: raw.id,
    title: raw.summary || '(Sin título)',
    date,
    endDate,
    startTime,
    endTime,
    allDay,
    location: raw.location || '',
    notes,
    tasks,
    category: raw?.extendedProperties?.private?.agendaVivaCategory || null,
    htmlLink: raw.htmlLink || null,
    status: raw.status || 'confirmed',
    recurringEventId: raw.recurringEventId || null,
    source: 'google',
  };
}

function eventBody(draft: any) {
  const category = draft.category || 'otros';
  return {
    summary: draft.title,
    location: draft.location || '',
    description: buildDescription(draft.notes || '', draft.tasks || []),
    start: { dateTime: toRfc3339(draft.date, draft.start_time), timeZone: TZ },
    end: { dateTime: toRfc3339(draft.date, draft.end_time), timeZone: TZ },
    extendedProperties: { private: { agendaVivaCategory: category } },
  };
}

function normalizeTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Valida el borrador que llega del modal "Revisar antes de guardar". */
function validateDraft(draft: any): string | null {
  if (!draft || typeof draft !== 'object') return 'No recibí el borrador del evento.';
  if (!String(draft.title || '').trim()) return 'El evento necesita un título.';
  if (!DATE_RE.test(String(draft.date || ''))) return 'La fecha debe tener el formato AAAA-MM-DD.';
  if (!TIME_RE.test(String(draft.start_time || ''))) return 'La hora de inicio debe tener el formato HH:MM.';
  if (!TIME_RE.test(String(draft.end_time || ''))) return 'La hora de finalización debe tener el formato HH:MM.';
  const [sh, sm] = String(draft.start_time).split(':').map(Number);
  const [eh, em] = String(draft.end_time).split(':').map(Number);
  if (eh * 60 + em <= sh * 60 + sm) {
    return 'La hora de finalización debe ser posterior a la de inicio.';
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

export default async function (req: Request): Promise<Response> {
  let payload: any = {};
  try {
    payload = (await req.json()) || {};
  } catch {
    payload = {};
  }
  const action = String(payload.action || '');

  try {
    const base44 = createClientFromRequest(req);

    // ---- 1. Sesión ------------------------------------------------
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) {
      return fail(
        'unauthenticated',
        'No hay una sesión activa. Inicia sesión en Agenda Viva para ver tu calendario.'
      );
    }

    // ---- 2. Solo administradores ---------------------------------
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      return fail(
        'not_admin',
        `La cuenta ${user.email || ''} inició sesión correctamente, pero el calendario conectado es exclusivo de la cuenta administradora.`.trim()
      );
    }

    if (action === 'status' && payload.probe === false) {
      return ok({ admin: true, email: user.email, connected: null });
    }

    // ---- 3. Conector de Google -----------------------------------
    let accessToken = '';
    try {
      const connection = await base44.asServiceRole.connectors.getConnection(CONNECTOR);
      accessToken = connection?.accessToken || '';
    } catch (error: any) {
      return fail(
        'connector_not_connected',
        `El conector de Google Calendar no está autorizado para esta app (${error?.message || 'sin detalle'}). Conéctalo desde el panel de Base44 con los permisos calendar.readonly y calendar.events.`
      );
    }
    if (!accessToken) {
      return fail(
        'connector_not_connected',
        'El conector de Google Calendar existe pero no entregó un token válido. Vuelve a autorizarlo desde el panel de Base44.'
      );
    }

    // ---- 4. Acciones ---------------------------------------------
    switch (action) {
      case 'status': {
        const calendar = await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}`
        );
        return ok({
          connected: true,
          admin: true,
          email: user.email,
          calendar: { id: calendar?.id, summary: calendar?.summary, timeZone: calendar?.timeZone },
        });
      }

      case 'list_week': {
        const weekStart = String(payload.week_start || '');
        if (!DATE_RE.test(weekStart)) {
          return fail('bad_request', 'Necesito la fecha de inicio de semana en formato AAAA-MM-DD.');
        }
        const timeMin = toRfc3339(weekStart, '00:00');
        const timeMax = toRfc3339(addDays(weekStart, 7), '00:00');
        const query = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
          timeZone: TZ,
        });
        const data = await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${query.toString()}`
        );
        const events = (data?.items || [])
          .filter((item: any) => item.status !== 'cancelled')
          .map(normalizeEvent);
        return ok({ week_start: weekStart, timeZone: TZ, events });
      }

      case 'create_event': {
        const draft = payload.draft;
        const invalid = validateDraft(draft);
        if (invalid) return fail('bad_request', invalid);

        // Antidoble: mismo título, misma fecha y mismo horario.
        if (!payload.force) {
          const query = new URLSearchParams({
            timeMin: toRfc3339(draft.date, '00:00'),
            timeMax: toRfc3339(addDays(draft.date, 1), '00:00'),
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
            timeZone: TZ,
          });
          const dayData = await googleFetch(
            accessToken,
            `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${query.toString()}`
          );
          const wanted = normalizeTitle(draft.title);
          const existing = (dayData?.items || [])
            .filter((item: any) => item.status !== 'cancelled')
            .map(normalizeEvent)
            .find(
              (event: any) =>
                normalizeTitle(event.title) === wanted &&
                event.date === draft.date &&
                event.startTime === draft.start_time &&
                event.endTime === draft.end_time
            );
          if (existing) {
            return ok({
              duplicate: true,
              created: false,
              event: existing,
              message: `Ya existe "${existing.title}" el ${existing.date} de ${existing.startTime} a ${existing.endTime}. No lo dupliqué.`,
            });
          }
        }

        const created = await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
          { method: 'POST', body: JSON.stringify(eventBody(draft)) }
        );
        return ok({ created: true, duplicate: false, event: normalizeEvent(created) });
      }

      case 'update_event': {
        const eventId = String(payload.event_id || '');
        if (!eventId) return fail('bad_request', 'Necesito el identificador del evento a actualizar.');
        const draft = payload.draft;
        const invalid = validateDraft(draft);
        if (invalid) return fail('bad_request', invalid);

        const updated = await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
          { method: 'PATCH', body: JSON.stringify(eventBody(draft)) }
        );
        return ok({ updated: true, event: normalizeEvent(updated) });
      }

      case 'delete_event': {
        const eventId = String(payload.event_id || '');
        if (!eventId) return fail('bad_request', 'Necesito el identificador del evento a eliminar.');
        await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
          { method: 'DELETE' }
        );
        return ok({ deleted: true, event_id: eventId });
      }

      case 'update_tasks': {
        const eventId = String(payload.event_id || '');
        if (!eventId) return fail('bad_request', 'Necesito el identificador del evento.');
        if (!Array.isArray(payload.tasks)) {
          return fail('bad_request', 'Necesito la lista completa de pendientes del evento.');
        }

        // Releemos el evento para conservar las notas que no son lista.
        const current = await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`
        );
        const { notes } = parseDescription(current?.description);
        const tasks: AgendaTask[] = payload.tasks.map((task: any) => ({
          text: String(task?.text || ''),
          done: !!task?.done,
        }));

        const updated = await googleFetch(
          accessToken,
          `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
          { method: 'PATCH', body: JSON.stringify({ description: buildDescription(notes, tasks) }) }
        );
        return ok({ updated: true, event: normalizeEvent(updated) });
      }

      default:
        return fail(
          'bad_request',
          `No reconozco la acción "${action}". Usa status, list_week, create_event, update_event, delete_event o update_tasks.`
        );
    }
  } catch (error: any) {
    if (error instanceof GoogleError) {
      return fail(error.code, error.message);
    }
    console.error('google-calendar function error', error);
    return Response.json(
      {
        ok: false,
        code: 'unexpected_error',
        message: `Ocurrió un error inesperado al hablar con Google Calendar: ${error?.message || error}`,
      },
      { status: 500 }
    );
  }
}
