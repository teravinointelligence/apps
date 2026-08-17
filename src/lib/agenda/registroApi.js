/**
 * Registro diario del plan de hábitos.
 *
 * Vive en la entidad `RegistroBienestar` de Base44, no en Google Calendar:
 * son notas personales, no compromisos. La entidad tiene RLS por
 * `created_by_id`, así que cada cuenta solo ve y edita lo suyo.
 */

import { base44 } from '@/api/base44Client';

const ENTIDAD = 'RegistroBienestar';

function entidad() {
  const target = base44?.entities?.[ENTIDAD];
  if (!target) {
    throw new Error(
      `La entidad ${ENTIDAD} no está disponible en esta versión de la app. Vuelve a publicarla desde Base44.`
    );
  }
  return target;
}

/** Trae los registros de la semana indexados por fecha. */
export async function fetchRegistros(fechas) {
  try {
    const target = entidad();
    // Pedimos los últimos registros y filtramos localmente: es una fila por
    // día, así que el volumen es mínimo y evitamos depender de la sintaxis de
    // filtros del backend.
    const todos = (await target.list('-fecha', 400)) || [];
    const porFecha = {};
    for (const registro of todos) {
      if (fechas.includes(registro.fecha) && !porFecha[registro.fecha]) {
        porFecha[registro.fecha] = registro;
      }
    }
    return { ok: true, registros: porFecha };
  } catch (error) {
    return {
      ok: false,
      registros: {},
      message: `No pude leer tu registro de la semana (${error?.message || 'sin detalle'}).`,
    };
  }
}

/** Crea o actualiza el registro de un día. Devuelve el registro guardado. */
export async function guardarRegistro(fecha, cambios, existente) {
  try {
    const target = entidad();
    const datos = { fecha, ...cambios };
    const guardado = existente?.id
      ? await target.update(existente.id, datos)
      : await target.create(datos);
    return { ok: true, registro: guardado || { ...existente, ...datos } };
  } catch (error) {
    return {
      ok: false,
      message: `No pude guardar el registro del ${fecha} (${error?.message || 'sin detalle'}).`,
    };
  }
}
