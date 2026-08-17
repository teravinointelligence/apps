import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { weekRangeLabel } from '@/lib/agenda/time';

/** Controles de navegación de la semana. */
export default function WeekToolbar({ weekStart, cargando, onHoy, onAnterior, onSiguiente, onActualizar, onNuevo }) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 px-4 py-4 sm:px-6">
      <button type="button" onClick={onHoy} className={botonClase}>
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        Hoy
      </button>

      <div className="flex items-center gap-1">
        <button type="button" onClick={onAnterior} className={botonIcono} aria-label="Semana anterior" title="Semana anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={onSiguiente} className={botonIcono} aria-label="Semana siguiente" title="Semana siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="order-last w-full text-sm font-bold text-violet-900 sm:order-none sm:w-auto sm:flex-1">
        {weekRangeLabel(weekStart)}
      </p>

      <button type="button" onClick={onActualizar} disabled={cargando} className={botonClase}>
        {cargando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        )}
        Actualizar
      </button>

      <button
        type="button"
        onClick={onNuevo}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.03]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nuevo
      </button>
    </div>
  );
}

const botonClase =
  'inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm ring-1 ring-violet-100 transition-colors hover:bg-violet-50 disabled:opacity-60';

const botonIcono =
  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-violet-700 shadow-sm ring-1 ring-violet-100 transition-colors hover:bg-violet-50';
