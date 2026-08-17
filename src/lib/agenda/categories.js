/**
 * Categorías de la agenda y su paleta.
 *
 * Los colores viven aquí como valores CSS (no como clases de Tailwind) para
 * que ningún proceso de purga pueda dejar una tarjeta sin color.
 */

export const CATEGORIES = {
  ejercicio: {
    key: 'ejercicio',
    label: 'Ejercicio',
    emoji: '🏃',
    hue: 'naranja',
    bg: '#FFF2E4',
    bgSoft: '#FFF8F0',
    border: '#FFD3A6',
    text: '#9A4B0B',
    accent: '#FB923C',
    gradient: 'linear-gradient(135deg, #FDBA74 0%, #FB923C 100%)',
  },
  trabajo: {
    key: 'trabajo',
    label: 'Trabajo',
    emoji: '💼',
    hue: 'violeta',
    bg: '#F1EBFE',
    bgSoft: '#F8F5FF',
    border: '#D6C4FB',
    text: '#5B21B6',
    accent: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 100%)',
  },
  salud: {
    key: 'salud',
    label: 'Salud',
    emoji: '💗',
    hue: 'rosa',
    bg: '#FDE9F3',
    bgSoft: '#FEF4F9',
    border: '#F9C2DD',
    text: '#9D174D',
    accent: '#EC4899',
    gradient: 'linear-gradient(135deg, #F9A8D4 0%, #EC4899 100%)',
  },
  traslado: {
    key: 'traslado',
    label: 'Traslados',
    emoji: '🚗',
    hue: 'azul',
    bg: '#E5F1FE',
    bgSoft: '#F1F7FF',
    border: '#B6D8FA',
    text: '#1D4ED8',
    accent: '#3B82F6',
    gradient: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 100%)',
  },
  compras: {
    key: 'compras',
    label: 'Compras',
    emoji: '🛒',
    hue: 'verde',
    bg: '#E4F7EC',
    bgSoft: '#F1FBF5',
    border: '#A9E6C4',
    text: '#166534',
    accent: '#22C55E',
    gradient: 'linear-gradient(135deg, #86EFAC 0%, #22C55E 100%)',
  },
  hogar: {
    key: 'hogar',
    label: 'Hogar y proyectos',
    emoji: '🏡',
    hue: 'amarillo',
    bg: '#FEF6DC',
    bgSoft: '#FFFBEC',
    border: '#FADF9A',
    text: '#92610A',
    accent: '#F59E0B',
    gradient: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)',
  },
  descanso: {
    key: 'descanso',
    label: 'Descanso',
    emoji: '🌿',
    hue: 'turquesa',
    bg: '#E0F7F5',
    bgSoft: '#EFFBFA',
    border: '#A5E8E2',
    text: '#0F766E',
    accent: '#14B8A6',
    gradient: 'linear-gradient(135deg, #99F6E4 0%, #14B8A6 100%)',
  },
  otros: {
    key: 'otros',
    label: 'Otros',
    emoji: '✨',
    hue: 'gris lavanda',
    bg: '#F0EEF7',
    bgSoft: '#F7F6FB',
    border: '#D4CFE4',
    text: '#4C4470',
    accent: '#9A93BF',
    gradient: 'linear-gradient(135deg, #CFC9E6 0%, #9A93BF 100%)',
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export function getCategory(key) {
  return CATEGORIES[key] || CATEGORIES.otros;
}

const KEYWORDS = [
  ['traslado', /\b(traslado|traslad|camino|manejar|manejo|carretera|viaje a|rumbo a|salida hacia|regreso a|→|->)\b/i],
  ['ejercicio', /\b(hiit|cardio|gym|gimnasio|correr|caminata|entrenar|entrenamiento|yoga|pesas|bici|nataci)/i],
  ['salud', /\b(dentista|doctor|doctora|médic|medic|cita m[eé]dica|consulta|laboratorio|an[aá]lisis|terapia|dental|hospital|cl[ií]nica|vacun)/i],
  ['compras', /\b(costco|super|supermercado|compras|mandado|walmart|city club|sam'?s|despensa|membres[ií]a)/i],
  ['trabajo', /\b(oficina|home office|homeoffice|junta|reuni[oó]n|trabajo|cliente|proveedor|pedidos|inventario|crm|ventas|correo|reporte|llamada)/i],
  ['hogar', /\b(remodelaci|obra|casa|departamento|hogar|jard[ií]n|mantenimiento|albañil|proyecto|construcci|avances)/i],
  ['descanso', /\b(descanso|libre|siesta|dormir|vacaci|relax|desayuno|comida|cena|airbnb|hotel|noche en)\b/i],
];

/** Adivina la categoría a partir del título y la ubicación de un evento. */
export function guessCategory(title = '', location = '') {
  const haystack = `${title} ${location}`;
  for (const [key, regex] of KEYWORDS) {
    if (regex.test(haystack)) return key;
  }
  return 'otros';
}

export function normalizeCategory(value, { title = '', location = '' } = {}) {
  if (value && CATEGORIES[value]) return value;
  if (value) {
    const lower = String(value).toLowerCase().trim();
    const direct = CATEGORY_KEYS.find(
      (key) => key === lower || CATEGORIES[key].label.toLowerCase() === lower
    );
    if (direct) return direct;
    if (lower.startsWith('traslad')) return 'traslado';
    if (lower.startsWith('proyect') || lower.startsWith('hogar')) return 'hogar';
  }
  return guessCategory(title, location);
}

/**
 * Origen de un bloque en la agenda. Determina el tratamiento visual:
 * `google` (confirmado), `rutina` (preferencia personal), `sugerencia`
 * (traslado propuesto) y `libre` (hueco).
 */
export const SOURCES = {
  google: {
    key: 'google',
    label: 'Confirmado en Google',
    badge: 'Confirmado',
    style: 'solid',
  },
  rutina: {
    key: 'rutina',
    label: 'Rutina personal',
    badge: 'Rutina',
    style: 'dotted',
  },
  sugerencia: {
    key: 'sugerencia',
    label: 'Traslado sugerido (sin confirmar)',
    badge: 'Sugerido',
    style: 'dashed',
  },
  libre: {
    key: 'libre',
    label: 'Espacio libre',
    badge: 'Libre',
    style: 'ghost',
  },
};
