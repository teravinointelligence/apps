export const CATEGORY_LABEL: Record<string, string> = {
  vino_tinto: 'Tinto',
  vino_blanco: 'Blanco',
  vino_rosado: 'Rosado',
  vino_naranja: 'Naranja',
  espumoso: 'Espumoso',
  destilado: 'Destilado',
  cerveza: 'Cerveza',
  sake: 'Sake',
  aceite: 'Aceite',
  otro: 'Otro',
}
export const categoryLabel = (c: string | null) => (c ? CATEGORY_LABEL[c] ?? c : '')
