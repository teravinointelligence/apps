// Traduce errores de Supabase / red a mensajes claros para quien cobra.

type AnyError = { message?: string; details?: string; code?: string; name?: string } | null | undefined

const MESSAGES: Record<string, string> = {
  no_autorizado: 'Tu usuario no tiene permiso para esta acción.',
  evento_sin_pos: 'Este evento no tiene punto de venta preparado.',
  evento_no_abierto: 'El punto de venta de este evento no está abierto. Pide a quien coordina que lo abra.',
  caja_ocupada: 'Esa caja ya está abierta en otro dispositivo.',
  caja_invalida: 'Caja no válida.',
  dispositivo_invalido: 'No se pudo identificar este dispositivo. Recarga la app.',
  fondo_invalido: 'El fondo de caja no es válido.',
  motivo_requerido: 'Escribe el motivo (mínimo 3 letras).',
  venta_ya_anulada: 'Esa venta ya estaba anulada.',
  venta_no_encontrada: 'La venta todavía no llega al servidor.',
  corte_invalido: 'El corte no es válido.',
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Tu correo no está confirmado en el CRM.',
}

export function isNetworkError(e: AnyError): boolean {
  if (!e) return false
  const m = `${e.message ?? ''} ${e.name ?? ''}`
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_INTERNET|AuthRetryableFetchError|timeout/i.test(m)
  )
}

export function isAuthError(e: AnyError): boolean {
  if (!e) return false
  return /JWT|jwt expired|invalid claim|refresh token|not authenticated|PGRST301/i.test(
    `${e.message ?? ''} ${e.code ?? ''}`,
  )
}

export function humanError(e: AnyError, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  if (!e) return fallback
  if (isNetworkError(e)) return 'Sin conexión. Revisa el internet e intenta de nuevo.'
  if (isAuthError(e)) return 'Tu sesión venció. Vuelve a iniciar sesión.'
  const msg = e.message ?? ''
  for (const [k, v] of Object.entries(MESSAGES)) {
    if (msg.includes(k)) {
      if (k === 'caja_ocupada' && e.details) return `Esa caja ya está abierta por ${e.details} en otro dispositivo.`
      return v
    }
  }
  if (msg.startsWith('venta_invalida')) return 'La venta tiene datos incompletos: ' + msg.replace('venta_invalida:', '').trim()
  return msg || fallback
}
