/** Id aleatorio legible, generado en el dispositivo (sirve de llave idempotente). */
export function newId(prefix: string) {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

/** "Bruma con Lulu Martínez" → "BRUMA"; "Evento — Oystera" → "OYSTERA" (2–8 caracteres). */
export function suggestPrefix(name: string) {
  const stop = new Set(['EVENTO', 'CENA', 'MARIDAJE', 'LUNCH', 'TASTING', 'CAPACITACION', 'VISITA', 'DE', 'LA', 'EL', 'CON', 'Y', 'PARA', 'POSIBLE', 'LANZAMIENTO'])
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !stop.has(w))
  const w = words[0] ?? 'EV'
  return w.slice(0, 6).padEnd(2, 'X')
}
