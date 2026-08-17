import { AlertTriangle, Loader2 } from 'lucide-react';

/** Confirmación explícita antes de cualquier acción destructiva o duplicada. */
export default function ConfirmDialog({ abierto, titulo, mensaje, textoConfirmar, tono = 'peligro', ocupado, onCancelar, onConfirmar }) {
  if (!abierto) return null;

  const clases =
    tono === 'peligro'
      ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25'
      : 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/25';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-violet-950/50 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !ocupado) onCancelar?.();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-800">{titulo}</h3>
            <p className="mt-1 break-words text-sm leading-snug text-slate-600">{mensaje}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors disabled:opacity-50 ${clases}`}
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
