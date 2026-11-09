import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Btn } from '@/ui/Btn'
import { Field, Notice } from '@/ui/Field'
import { Mark } from '@/ui/Mark'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { useAuth } from '@/store/auth'

export function LoginScreen() {
  const { rep, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (rep) return <Navigate to="/eventos" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await signIn(email, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/eventos', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Mark className="justify-center mb-2" sub="" />
          <p className="text-center font-serif text-[22px] text-ink-70 dark:text-dark-ink-70 mb-8">Punto de venta para eventos</p>
          <div className="space-y-4 bg-paper dark:bg-dark-surface rounded-2xl border border-ink-08 dark:border-dark-border p-5">
            <Field label="Correo del CRM">
              <input
                className="field"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Contraseña">
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <Btn type="submit" size="lg" fullWidth disabled={busy} icon={<LogIn size={18} />}>
              {busy ? 'Entrando…' : 'Entrar'}
            </Btn>
          </div>
          <p className="text-center text-[12px] text-ink-50 dark:text-dark-ink-50 mt-4">
            Usa el mismo acceso del CRM TeraVino. Para entrar se necesita internet; una vez abierta la caja puedes cobrar sin señal.
          </p>
        </form>
      </div>
    </div>
  )
}
