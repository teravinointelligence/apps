import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Agenda from '@/pages/Agenda';

const Cargando = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500">
    <div className="text-center text-white">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      <p className="mt-3 text-sm font-semibold">Agenda Viva</p>
    </div>
  </div>
);

/**
 * Agenda Viva es privada: sin sesión no se ve la agenda.
 * Las rutas protegidas mandan al login antes de renderizar cualquier cosa.
 */
const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) return <Cargando />;

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={<ProtectedRoute fallback={<Cargando />} unauthenticatedElement={<Navigate to="/login" replace />} />}
      >
        <Route path="/" element={<Agenda />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/Agenda" element={<Agenda />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
