import { Footprints, Home, Info, Plus, Route } from 'lucide-react';
import EventCard from './EventCard';
import { horaLegible } from '@/lib/agenda/bienestar';
import { DIAS_LARGOS, dayAndMonth, dayNumber, durationLabel, minutesToTime, weekdayOf } from '@/lib/agenda/time';

/** Tarjeta de un día de la semana. */
export default function DayCard({
  date,
  esHoy,
  clima,
  ubicacionBase,
  bloques,
  contexto,
  hospedaje,
  horasCriticas,
  bloquesLargos,
  onToggleTask,
  onEdit,
  onDelete,
  onConfirmSuggestion,
  onNuevoEnDia,
  busyTaskKey,
}) {
  const nombre = DIAS_LARGOS[weekdayOf(date)];

  return (
    <section
      className={`flex min-w-0 flex-col rounded-3xl bg-white/85 p-3 shadow-[0_10px_30px_-18px_rgba(88,28,135,0.55)] ring-1 backdrop-blur ${
        esHoy ? 'ring-2 ring-fuchsia-400' : 'ring-violet-100'
      }`}
    >
      <header className="mb-2 border-b border-violet-100 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-extrabold text-violet-900">{nombre}</span>
              <span className="text-2xl font-black leading-none text-fuchsia-500">{dayNumber(date)}</span>
              {esHoy && (
                <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-700">
                  Hoy
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500">{dayAndMonth(date)}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {clima?.icon && (
              <span
                className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700"
                title={clima.raw || 'Clima del día'}
              >
                <span aria-hidden="true">{clima.icon}</span>
                {clima.temperature && <span className="tabular-nums">{clima.temperature}</span>}
              </span>
            )}
            <button
              type="button"
              onClick={() => onNuevoEnDia?.(date)}
              className="rounded-full bg-violet-100 p-1.5 text-violet-700 transition-colors hover:bg-violet-200"
              title={`Nuevo evento el ${dayAndMonth(date)}`}
              aria-label={`Nuevo evento el ${dayAndMonth(date)}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {ubicacionBase?.location && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-violet-700">
            <Home className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              Base: {ubicacionBase.location}
              {!ubicacionBase.inferred && (
                <span className="ml-1 font-normal text-slate-400">(por tus preferencias)</span>
              )}
            </span>
          </p>
        )}
      </header>

      {contexto && (
        <p className="mb-2 flex items-start gap-1 rounded-xl bg-blue-50 px-2 py-1.5 text-[11px] leading-snug text-blue-700">
          <Route className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            <strong>{contexto.label}</strong> · {contexto.detail}
          </span>
        </p>
      )}

      {bloquesLargos?.length > 0 && (
        <div className="mb-2 rounded-xl bg-rose-50 px-2 py-1.5 text-[11px] leading-snug text-rose-700">
          <p className="flex items-start gap-1 font-semibold">
            <Footprints className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">De corrido, sin levantarte</span>
          </p>
          <ul className="mt-0.5 space-y-0.5 pl-4">
            {bloquesLargos.map((b) => (
              <li key={b.id} className="break-words text-rose-600/90">
                <strong>{b.titulo}</strong> · {durationLabel('00:00', minutesToTime(b.minutos))} →{' '}
                {b.pausas} {b.pausas === 1 ? 'pausa' : 'pausas'} dentro
                {b.conduciendo && ' (manejar también cuenta como sentada)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {horasCriticas?.length > 0 && (
        <div className="mb-2 rounded-xl bg-rose-50 px-2 py-1.5 text-[11px] leading-snug text-rose-700">
          <p className="flex items-start gap-1 font-semibold">
            <Footprints className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {horasCriticas.map((h) => horaLegible(h.hora)).join(' y ')} caen dentro de{' '}
              {[...new Set(horasCriticas.map((h) => h.evento))].join(' / ')}
            </span>
          </p>
          <p className="mt-0.5 break-words pl-4 text-rose-600/90">
            {horasCriticas[0].nota} Son tus horas de menos movimiento.
          </p>
        </div>
      )}

      {hospedaje && (
        <p className="mb-2 flex items-start gap-1 rounded-xl bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{hospedaje}</span>
        </p>
      )}

      <div className="flex flex-1 flex-col gap-2">
        {bloques.map((bloque) => (
          <EventCard
            key={bloque.id}
            event={bloque}
            onToggleTask={onToggleTask}
            onEdit={onEdit}
            onDelete={onDelete}
            onConfirmSuggestion={onConfirmSuggestion}
            busyTaskKey={busyTaskKey}
          />
        ))}
      </div>
    </section>
  );
}
