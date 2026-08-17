/**
 * Detección de los "eventos de clima" que algunos calendarios insertan como
 * eventos normales (títulos que empiezan con ☀️, 🌤️, 🌧️, ⛈️, ☁️ …).
 *
 * Estos eventos NO se dibujan como tarjetas: su icono y su temperatura se
 * muestran en el encabezado del día.
 */

const WEATHER_ICONS = [
  '☀️', '☀', '🌞', '🌤️', '🌤', '⛅', '⛅️', '🌥️', '🌥', '☁️', '☁', '🌦️', '🌦',
  '🌧️', '🌧', '⛈️', '⛈', '🌩️', '🌩', '🌨️', '🌨', '❄️', '❄', '🌪️', '🌪',
  '🌫️', '🌫', '💨', '🌡️', '🌡',
];

/** ¿El título corresponde a un evento de clima? */
export function isWeatherTitle(title) {
  const clean = String(title || '').trim();
  if (!clean) return false;
  return WEATHER_ICONS.some((icon) => clean.startsWith(icon));
}

/** Extrae `{ icon, temperature, raw }` del título de un evento de clima. */
export function parseWeather(title) {
  const clean = String(title || '').trim();
  const icon = WEATHER_ICONS.find((candidate) => clean.startsWith(candidate)) || '';
  const rest = clean.slice(icon.length).trim();

  // Rangos tipo "24°/31°" o temperaturas sueltas "31 °C".
  const range = /(-?\d{1,3})\s*°?\s*[CFcf]?\s*[/–—-]\s*(-?\d{1,3})\s*°?\s*([CFcf])?/.exec(rest);
  if (range) {
    const unit = range[3] ? range[3].toUpperCase() : '';
    return {
      icon,
      temperature: `${range[1]}° / ${range[2]}°${unit}`,
      raw: clean,
    };
  }

  const single = /(-?\d{1,3})\s*°\s*([CFcf])?/.exec(rest) || /(-?\d{1,3})\s*(?:grados)/i.exec(rest);
  if (single) {
    const unit = single[2] ? single[2].toUpperCase() : '';
    return { icon, temperature: `${single[1]}°${unit}`, raw: clean };
  }

  return { icon, temperature: rest || '', raw: clean };
}
