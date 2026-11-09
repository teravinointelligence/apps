export const IVA_RATE = 0.16

const fmt = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmt0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** $1,234.50 */
export const mxn = (n: number) => fmt.format(Number.isFinite(n) ? n : 0)

/** $1,235 (sin centavos si son cero) */
export const mxnShort = (n: number) =>
  Math.round(n * 100) % 100 === 0 ? fmt0.format(n) : fmt.format(n)

export const round2 = (n: number) => Math.round(n * 100) / 100

/** IVA contenido en un importe que ya lo incluye. */
export const ivaIncluido = (total: number) => round2(total - total / (1 + IVA_RATE))

/** Base sin IVA de un importe que ya lo incluye. */
export const sinIva = (total: number) => round2(total / (1 + IVA_RATE))

export const toNumber = (s: string | number | null | undefined) => {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0
  if (!s) return 0
  const n = Number(String(s).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
