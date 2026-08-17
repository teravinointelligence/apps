import { CalendarCheck, Check, Clock, ExternalLink, MapPin, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { getCategory } from '@/lib/agenda/categories';
import { tasksCounterLabel } from '@/lib/agenda/tasks';
import { durationLabel, formatRange } from '@/lib/agenda/time';

/**
 * Una actividad de la agenda.
 *
 * El origen decide el tratamiento visual:
 *  - `google`      → tarjeta sólida (compromiso confirmado)
 *  - `rutina`      → borde punteado (preferencia personal)
 *  - `sugerencia`  → borde discontinuo + botón para confirmarla
 *  - `libre`       → tarjeta fantasma (espacio disponible)
 */
export default function EventCard({
  event,
  onToggleTask,
  onEdit,
  onDelete,
  onConfirmSuggestion,
  busyTaskKey,
}) {
  const palette = getCategory(event.category);
  const esLibre = event.source === 'libre';
  const esSugerencia = event.source === 'sugerencia';
  const esRutina = event.source === 'rutina';
  const horario = event.allDay ? 'Todo el día' : formatRange(event.startTime, event.endTime);
  const duracion = event.allDay ? '' : durationLabel(event.startTime, event.endTime);
  const contador = tasksCounterLabel(event.tasks);

  if (esLibre) {
    return (
      <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 px-3 py-2.5 text-teal-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{event.title}</span>
        </div>
        {!event.wholeDay && (
          <p className="mt-0.5 text-xs text-teal-600/90">{formatRange(event.startTime, event.endTime)}</p>
        )}
      </div>
    );
  }

  return (
    <article
      className="rounded-2xl px-3 py-3 shadow-sm transition-shadow hover:shadow-md"
      style={{
        background: esSugerencia ? palette.bgSoft : palette.bg,
        border: `${esSugerencia || esRutina ? '2px' : '1px'} ${
          esSugerencia ? 'dashed' : esRutina ? 'dotted' : 'solid'
        } ${palette.border}`,
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
          style={{ background: palette.gradient }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-bold tabular-nums" style={{ color: palette.text }}>
              {horario}
            </span>
            {duracion && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {duracion}
              </span>
            )}
          </div>

          <h4 className="mt-0.5 break-words text-sm font-bold leading-snug text-slate-800">
            {palette.emoji} {event.title}
          </h4>

          {event.location && (
            <p className="mt-1 flex items-start gap-1 text-xs text-slate-600">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{event.location}</span>
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {esSugerencia && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                Sugerido · sin confirmar
              </span>
            )}
            {esRutina && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Rutina personal
              </span>
            )}
            {event.source === 'google' && !event.backup && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                Confirmado
              </span>
            )}
            {event.backup && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Copia de respaldo
              </span>
            )}
          </div>

          {event.tasks?.length > 0 && (
            <div className="mt-2 rounded-xl bg-white/70 p-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {contador}
              </p>
              <ul className="space-y-1">
                {event.tasks.map((task, index) => {
                  const key = `${event.id}:${index}`;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => onToggleTask?.(event, index)}
                        disabled={busyTaskKey === key}
                        className="flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-white disabled:opacity-60"
                      >
                        <span
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-white"
                          style={{
                            borderColor: task.done ? palette.accent : '#cbd5e1',
                            background: task.done ? palette.accent : 'transparent',
                          }}
                          aria-hidden="true"
                        >
                          {task.done && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span
                          className={`min-w-0 break-words text-xs leading-snug ${
                            task.done ? 'text-slate-400 line-through' : 'text-slate-700'
                          }`}
                        >
                          {task.text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {event.notes && (
            <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-white/60 px-2 py-1.5 text-[11px] leading-snug text-slate-600">
              {event.notes}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Abrir en Google Calendar
              </a>
            )}
            {esSugerencia && (
              <button
                type="button"
                onClick={() => onConfirmSuggestion?.(event)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
              >
                <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                Revisar y confirmar
              </button>
            )}
            {event.source === 'google' && !event.backup && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit?.(event)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(event)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-600 hover:underline"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
