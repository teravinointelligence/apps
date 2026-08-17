import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Loader2, Save, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/agenda/categories';
import { parseTaskLines, tasksToLines } from '@/lib/agenda/tasks';
import { dayName, minutesOfDay } from '@/lib/agenda/time';

/**
 * Modal "Revisar antes de guardar".
 *
 * Nada llega a Google Calendar sin pasar por aquí: la interpretación de la
 * instrucción, el botón "Nuevo" y la confirmación de un traslado sugerido
 * desembocan todos en este formulario editable.
 */
export default function ReviewModal({ abierto, borrador, modo, guardando, error, onCancelar, onGuardar }) {
  const [form, setForm] = useState(null);
  const [tasksText, setTasksText] = useState('');

  useEffect(() => {
    if (!abierto || !borrador) return;
    setForm({
      title: borrador.title || '',
      date: borrador.date || '',
      start_time: borrador.start_time || '',
      end_time: borrador.end_time || '',
      location: borrador.location || '',
      category: borrador.category || 'otros',
      notes: borrador.notes || '',
    });
    setTasksText(
      Array.isArray(borrador.tasks)
        ? borrador.tasks.map((task) => (typeof task === 'string' ? task : task.text)).join('\n')
        : tasksToLines(borrador.tasks)
    );
  }, [abierto, borrador]);

  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !guardando) onCancelar?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierto, guardando, onCancelar]);

  const problemaHorario = useMemo(() => {
    if (!form) return null;
    const start = minutesOfDay(form.start_time);
    const end = minutesOfDay(form.end_time);
    if (start == null || end == null) return 'Indica hora de inicio y de finalización.';
    if (end <= start) return 'La hora de finalización debe ser posterior a la de inicio.';
    return null;
  }, [form]);

  if (!abierto || !form) return null;

  const set = (campo) => (event) => setForm((prev) => ({ ...prev, [campo]: event.target.value }));

  const enviar = (event) => {
    event.preventDefault();
    if (problemaHorario || guardando) return;
    const tasks = parseTaskLines(tasksText);
    // Conservamos el estado de los pendientes que ya estaban marcados.
    const previos = Array.isArray(borrador?.tasks) ? borrador.tasks : [];
    const conEstado = tasks.map((task) => {
      const previo = previos.find(
        (item) => typeof item !== 'string' && item.text?.trim() === task.text
      );
      return { text: task.text, done: task.done || !!previo?.done };
    });
    onGuardar?.({ ...form, tasks: conEstado });
  };

  const etiquetaDia = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? dayName(form.date) : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-violet-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-revisar"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !guardando) onCancelar?.();
      }}
    >
      <form
        onSubmit={enviar}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-3xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-5 py-4 text-white">
          <div className="min-w-0">
            <h2 id="titulo-revisar" className="text-lg font-extrabold">
              Revisar antes de guardar
            </h2>
            <p className="text-xs text-white/85">
              {modo === 'editar'
                ? 'Ajusta lo que necesites y confirma el cambio.'
                : 'Nada se guarda en Google hasta que confirmes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="rounded-full p-1 text-white/90 transition-colors hover:bg-white/20 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {borrador?.clarification && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{borrador.clarification}</span>
            </p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{error}</span>
            </p>
          )}

          <Campo etiqueta="Título">
            <input
              value={form.title}
              onChange={set('title')}
              required
              placeholder="Home Office"
              className={inputClase}
            />
          </Campo>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha" ayuda={etiquetaDia}>
              <input type="date" value={form.date} onChange={set('date')} required className={inputClase} />
            </Campo>
            <Campo etiqueta="Categoría">
              <select value={form.category} onChange={set('category')} className={inputClase}>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {CATEGORIES[key].emoji} {CATEGORIES[key].label} ({CATEGORIES[key].hue})
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Hora de inicio">
              <input
                type="time"
                value={form.start_time}
                onChange={set('start_time')}
                required
                className={inputClase}
              />
            </Campo>
            <Campo etiqueta="Hora de finalización">
              <input
                type="time"
                value={form.end_time}
                onChange={set('end_time')}
                required
                className={inputClase}
              />
            </Campo>
          </div>

          {problemaHorario && (
            <p className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{problemaHorario}</p>
          )}

          <Campo etiqueta="Ubicación">
            <input
              value={form.location}
              onChange={set('location')}
              placeholder="Casa, Miraflores"
              className={inputClase}
            />
          </Campo>

          <Campo etiqueta="Pendientes" ayuda="Uno por línea">
            <textarea
              value={tasksText}
              onChange={(event) => setTasksText(event.target.value)}
              rows={4}
              placeholder={'Descargar inventarios\nMandar pedidos a proveedores'}
              className={`${inputClase} resize-y`}
            />
          </Campo>

          <Campo etiqueta="Notas">
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Lo que quieras recordar"
              className={`${inputClase} resize-y`}
            />
          </Campo>

          <p className="text-[11px] leading-snug text-slate-400">
            Se guarda en tu calendario con la zona horaria America/Mazatlan. Los pendientes van dentro
            de la descripción del evento con el formato ☐ / ☑.
          </p>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!!problemaHorario || guardando}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : modo === 'editar' ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {modo === 'editar' ? 'Guardar cambios' : 'Agendar en Google'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClase =
  'w-full rounded-2xl border border-violet-100 bg-violet-50/40 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-200';

function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-2 text-xs font-bold uppercase tracking-wide text-violet-700">
        {etiqueta}
        {ayuda && <span className="font-normal normal-case tracking-normal text-slate-400">{ayuda}</span>}
      </span>
      {children}
    </label>
  );
}
