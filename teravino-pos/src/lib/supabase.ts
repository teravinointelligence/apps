import { createClient } from '@supabase/supabase-js'

// Mismo proyecto Supabase que el CRM (teravino-crm). En desarrollo las
// variables viven en .env.local; en Vercel, en la configuración del proyecto.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY. Copia .env.example a .env.local y rellena los valores.',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Clave propia: no choca con la sesión del CRM si se abren en el mismo
    // navegador y dominio.
    storageKey: 'teravino-pos.auth',
  },
})
