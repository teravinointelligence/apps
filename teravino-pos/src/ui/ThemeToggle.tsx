import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/store/theme'

export function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      className="w-10 h-10 rounded-lg border border-ink-15 dark:border-dark-border flex items-center justify-center text-ink-70 dark:text-dark-ink-70 hover:bg-ink-04 dark:hover:bg-dark-surface-2"
    >
      {dark ? <Sun size={18} strokeWidth={1.6} /> : <Moon size={18} strokeWidth={1.6} />}
    </button>
  )
}
