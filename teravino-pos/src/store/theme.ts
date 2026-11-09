import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeState = { dark: boolean; toggle: () => void }

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,
      toggle: () => set({ dark: !get().dark }),
    }),
    { name: 'teravino-pos.theme' },
  ),
)
