import { AlertTriangle, Loader2, LogOut, Mic, MicOff, Sparkles, Wand2 } from 'lucide-react';

const ESTADOS = {
  conectado: {
    texto: 'Google conectado',
    clase: 'bg-emerald-400/25 text-emerald-50 ring-emerald-200/60',
    punto: 'bg-emerald-300',
  },
  conectando: {
    texto: 'Conectando',
    clase: 'bg-amber-300/25 text-amber-50 ring-amber-200/60',
    punto: 'bg-amber-300 animate-pulse',
  },
  preview: {
    texto: 'Vista previa',
    clase: 'bg-white/20 text-white ring-white/50',
    punto: 'bg-white/80',
  },
};

/**
 * Panel superior: identidad de la app, estado de la conexión con Google y la
 * caja para escribir o dictar instrucciones.
 */
export default function TopPanel({
  estado,
  instruccion,
  onInstruccionChange,
  onPreparar,
  preparando,
  dictado,
  usuario,
  onSalir,
}) {
  const info = ESTADOS[estado] || ESTADOS.preview;

  const enviarConEnter = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onPreparar?.();
    }
  };

  return (
    <header className="bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500 px-4 pb-6 pt-5 text-white shadow-xl sm:px-6 sm:pb-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight sm:text-4xl">
              <Sparkles className="h-7 w-7 shrink-0 text-yellow-200" aria-hidden="true" />
              Agenda Viva
            </h1>
            <p className="mt-0.5 text-sm font-medium text-white/85">Tu tiempo, a tu manera</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${info.clase}`}
            >
              <span className={`h-2 w-2 rounded-full ${info.punto}`} aria-hidden="true" />
              {info.texto}
            </span>
            {usuario?.email && (
              <button
                type="button"
                onClick={onSalir}
                className="inline-flex items-center gap-1 text-[11px] text-white/70 transition-colors hover:text-white"
              >
                <LogOut className="h-3 w-3" aria-hidden="true" />
                <span className="max-w-[180px] truncate">{usuario.email}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-white/15 p-2 ring-1 ring-white/25 backdrop-blur-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <textarea
              value={instruccion}
              onChange={(event) => onInstruccionChange?.(event.target.value)}
              onKeyDown={enviarConEnter}
              rows={2}
              placeholder="Escribe o dicta: “Agrega Home Office mañana de 8 a 2 con los pendientes descargar inventarios y mandar pedidos.”"
              className="min-h-[84px] w-full flex-1 resize-none sm:min-h-[64px] rounded-2xl border-0 bg-white/95 px-4 py-3 text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:ring-2 focus:ring-white"
              aria-label="Instrucción para la agenda"
            />

            <div className="flex shrink-0 items-stretch gap-2">
              <button
                type="button"
                onClick={dictado?.toggle}
                className={`flex w-14 items-center justify-center rounded-2xl transition-colors sm:w-16 ${
                  dictado?.listening
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-900/30'
                    : 'bg-white/90 text-violet-700 hover:bg-white'
                }`}
                title={
                  dictado?.supported
                    ? dictado?.listening
                      ? 'Detener dictado'
                      : 'Dictar en español de México'
                    : 'Este navegador no permite dictado por voz'
                }
                aria-label="Dictar instrucción"
                aria-pressed={!!dictado?.listening}
              >
                {dictado?.supported === false ? (
                  <MicOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Mic className={`h-5 w-5 ${dictado?.listening ? 'animate-pulse' : ''}`} aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={onPreparar}
                disabled={preparando}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-violet-700 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 sm:flex-none"
              >
                {preparando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                )}
                Preparar
              </button>
            </div>
          </div>

          {dictado?.listening && (
            <p className="px-3 pb-1 pt-2 text-xs text-white/90">
              Escuchando en español de México… {dictado.interim && <em>“{dictado.interim}”</em>}
            </p>
          )}
          {dictado?.error && (
            <p className="flex items-start gap-1.5 px-3 pb-1 pt-2 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{dictado.error}</span>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
