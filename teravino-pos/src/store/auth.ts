import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { humanError, isNetworkError } from '@/lib/errors'
import type { Rep } from '@/types'

// Acceso con el mismo usuario y contraseña del CRM. El perfil (sales_reps) se
// guarda en el dispositivo para poder seguir cobrando si se va el internet;
// la sesión de Supabase también persiste y se renueva sola al volver la red.

export const SELLER_ROLES = ['rep', 'admin']

type AuthState = {
  rep: Rep | null
  ready: boolean
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  isAdmin: () => boolean
}

async function loadRep(userId: string): Promise<Rep | 'no-rep' | 'offline'> {
  const { data, error } = await supabase
    .from('sales_reps')
    .select('id, full_name, email, role, active')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (error) return isNetworkError(error) ? 'offline' : 'no-rep'
  if (!data || !data.active || !SELLER_ROLES.includes(data.role)) return 'no-rep'
  return { id: data.id, full_name: data.full_name, email: data.email, role: data.role }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      rep: null,
      ready: false,

      init: async () => {
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user
        if (!user) {
          set({ rep: null, ready: true })
          return
        }
        const r = await loadRep(user.id)
        if (r === 'offline') set({ ready: true }) // conserva el perfil guardado
        else if (r === 'no-rep') {
          await supabase.auth.signOut()
          set({ rep: null, ready: true })
        } else set({ rep: r, ready: true })
      },

      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error || !data.user) return humanError(error, 'No se pudo iniciar sesión.')
        const r = await loadRep(data.user.id)
        if (r === 'offline') return 'Sin conexión. Revisa el internet e intenta de nuevo.'
        if (r === 'no-rep') {
          await supabase.auth.signOut()
          return 'Tu usuario no está activo como vendedor en el CRM.'
        }
        set({ rep: r })
        return null
      },

      signOut: async () => {
        await supabase.auth.signOut().catch(() => undefined)
        set({ rep: null })
      },

      isAdmin: () => get().rep?.role === 'admin',
    }),
    { name: 'teravino-pos.rep', partialize: (s) => ({ rep: s.rep }) },
  ),
)
