/**
 * Puente con la función backend `google-calendar`.
 *
 * Todo pasa por `base44.functions.invoke("google-calendar", datos)`. El
 * frontend nunca ve un token de Google.
 */

import { base44 } from '@/api/base44Client';

/**
 * Pista de qué hacer para cada tipo de error. El texto exacto viene del
 * backend; aquí solo decidimos el tono y si conviene ofrecer el respaldo.
 */
export const ERROR_HINTS = {
  unauthenticated: { titulo: 'Sesión requerida', accion: 'iniciar_sesion', respaldo: false },
  not_admin: { titulo: 'Cuenta sin acceso al calendario', accion: 'ninguna', respaldo: false },
  connector_not_connected: { titulo: 'Google Calendar sin autorizar', accion: 'conectar', respaldo: true },
  google_auth: { titulo: 'Autorización de Google vencida', accion: 'conectar', respaldo: true },
  google_forbidden: { titulo: 'Permisos insuficientes en Google', accion: 'conectar', respaldo: true },
  google_unavailable: { titulo: 'Google Calendar no responde', accion: 'reintentar', respaldo: true },
  google_error: { titulo: 'Google rechazó la operación', accion: 'reintentar', respaldo: true },
  event_not_found: { titulo: 'El evento ya no existe', accion: 'actualizar', respaldo: false },
  bad_request: { titulo: 'Faltan datos', accion: 'corregir', respaldo: false },
  network_error: { titulo: 'Sin conexión con la agenda', accion: 'reintentar', respaldo: true },
  unexpected_error: { titulo: 'Error inesperado', accion: 'reintentar', respaldo: true },
  unexpected_response: { titulo: 'Respuesta no reconocida', accion: 'reintentar', respaldo: true },
};

export function hintFor(code) {
  return ERROR_HINTS[code] || { titulo: 'No se pudo completar', accion: 'reintentar', respaldo: true };
}

/**
 * Llama a la función y siempre devuelve `{ ok, code?, message?, ... }`,
 * sin importar si el SDK resolvió o lanzó.
 */
export async function invokeCalendar(payload) {
  try {
    const response = await base44.functions.invoke('google-calendar', payload);
    const body = response?.data ?? response;
    if (body && typeof body === 'object' && 'ok' in body) return body;
    return {
      ok: false,
      code: 'unexpected_response',
      message: 'La función google-calendar respondió en un formato que no reconozco.',
    };
  } catch (error) {
    const body = error?.data ?? error?.response?.data;
    if (body && typeof body === 'object' && body.code) {
      return { ok: false, ...body };
    }
    const status = error?.status ?? error?.response?.status;
    if (status === 404) {
      return {
        ok: false,
        code: 'network_error',
        message:
          'No encontré la función "google-calendar" publicada en esta app. Publica el backend desde Base44 y vuelve a intentar.',
      };
    }
    return {
      ok: false,
      code: 'network_error',
      message: `No pude comunicarme con la función google-calendar (${error?.message || 'sin detalle'}).`,
    };
  }
}

export const fetchStatus = () => invokeCalendar({ action: 'status' });

export const fetchWeek = (weekStart) => invokeCalendar({ action: 'list_week', week_start: weekStart });

export const createEvent = (draft, { force = false } = {}) =>
  invokeCalendar({ action: 'create_event', draft, force });

export const updateEvent = (eventId, draft) =>
  invokeCalendar({ action: 'update_event', event_id: eventId, draft });

export const deleteEvent = (eventId) => invokeCalendar({ action: 'delete_event', event_id: eventId });

export const updateEventTasks = (eventId, tasks) =>
  invokeCalendar({ action: 'update_tasks', event_id: eventId, tasks });
