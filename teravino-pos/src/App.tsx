import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useTheme } from '@/store/theme'
import { useAuth } from '@/store/auth'
import { useDevice } from '@/store/device'
import { startAutoSync } from '@/lib/sync'
import { Shell } from '@/layout/Shell'
import { LoginScreen } from '@/screens/Login'
import { EventosScreen } from '@/screens/Eventos'
import { PrepararScreen } from '@/screens/Preparar'
import { AbrirCajaScreen } from '@/screens/AbrirCaja'
import { VentaScreen } from '@/screens/Venta'
import { CobroScreen } from '@/screens/Cobro'
import { ReciboScreen } from '@/screens/Recibo'
import { VentasScreen } from '@/screens/Ventas'
import { CorteScreen } from '@/screens/Corte'
import { CierreEventoScreen } from '@/screens/CierreEvento'

function RequireAuth({ children }: { children: ReactNode }) {
  const rep = useAuth((s) => s.rep)
  if (!rep) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireCaja({ children }: { children: ReactNode }) {
  const caja = useDevice((s) => s.caja)
  if (!caja) return <Navigate to="/eventos" replace />
  return <>{children}</>
}

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-serif text-[28px] tracking-[0.12em] text-wine dark:text-gold">TERAVINO</div>
    </div>
  )
}

export default function App() {
  const dark = useTheme((s) => s.dark)
  const { ready, init } = useAuth()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    void init()
    startAutoSync()
  }, [init])

  if (!ready) return <Splash />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/eventos" element={<RequireAuth><EventosScreen /></RequireAuth>} />
        <Route path="/eventos/:id/preparar" element={<RequireAuth><PrepararScreen /></RequireAuth>} />
        <Route path="/eventos/:id/abrir" element={<RequireAuth><AbrirCajaScreen /></RequireAuth>} />
        <Route path="/eventos/:id/cierre" element={<RequireAuth><CierreEventoScreen /></RequireAuth>} />
        <Route element={<RequireAuth><RequireCaja><Shell /></RequireCaja></RequireAuth>}>
          <Route path="/venta" element={<VentaScreen />} />
          <Route path="/cobro" element={<CobroScreen />} />
          <Route path="/recibo/:saleId" element={<ReciboScreen />} />
          <Route path="/ventas" element={<VentasScreen />} />
          <Route path="/corte" element={<CorteScreen />} />
        </Route>
        <Route path="*" element={<Navigate to={useDevice.getState().caja ? '/venta' : '/eventos'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
