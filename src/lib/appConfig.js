/**
 * Identificador de la app en Base44.
 *
 * Por qué existe este archivo: en la compilación de producción `.env` está en
 * `.gitignore`, así que `VITE_BASE44_APP_ID` puede llegar vacío o como
 * `undefined`. Con el appId vacío el SDK no puede llamar a la función
 * `google-calendar` y la agenda termina mostrando datos de demostración en vez
 * del calendario real. Por eso el identificador real queda escrito aquí como
 * respaldo (es un dato público, no un secreto).
 */

export const BASE44_APP_ID = '6a822c0ac040ce1b15b50f1b';

function isUsable(value) {
  if (typeof value !== 'string') return false;
  const clean = value.trim();
  return clean !== '' && clean !== 'undefined' && clean !== 'null';
}

/** appId efectivo: primero la variable de entorno, si no el valor fijo. */
export function resolveAppId() {
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BASE44_APP_ID : null;
  return isUsable(fromEnv) ? fromEnv.trim() : BASE44_APP_ID;
}

/** Diagnóstico para la pantalla: de dónde salió el appId que se está usando. */
export function appIdDiagnostics() {
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BASE44_APP_ID : null;
  return {
    appId: resolveAppId(),
    origen: isUsable(fromEnv) ? 'variable de entorno VITE_BASE44_APP_ID' : 'valor fijo de la app',
    correcto: resolveAppId() === BASE44_APP_ID,
  };
}
