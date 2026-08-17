import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/agenda/categories';
import { PREFERENCIAS } from '@/lib/agenda/preferences';
import { appIdDiagnostics } from '@/lib/appConfig';
import { TZ } from '@/lib/agenda/time';

/** Leyenda de colores, tipos de bloque y preferencias de planeación. */
export default function Legend() {
  const [abierto, setAbierto] = useState(false);
  const diagnostico = appIdDiagnostics();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6">
      <div className="rounded-3xl bg-white/80 p-4 shadow-sm ring-1 ring-violet-100">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((key) => {
            const cat = CATEGORIES[key];
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.accent }} aria-hidden="true" />
                {cat.label}
                <span className="font-normal opacity-70">({cat.hue})</span>
              </span>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-solid border-violet-400 bg-violet-100" aria-hidden="true" />
            Confirmado en Google
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border-2 border-dotted border-slate-400 bg-white" aria-hidden="true" />
            Rutina personal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border-2 border-dashed border-blue-400 bg-blue-50" aria-hidden="true" />
            Traslado sugerido
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded border border-dashed border-teal-300 bg-teal-50" aria-hidden="true" />
            Espacio libre
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((prev) => !prev)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:underline"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Cómo planeo mi semana
          {abierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {abierto && (
          <div className="mt-2 rounded-2xl bg-violet-50/70 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              Preferencias (sirven para sugerir, nunca se guardan solas)
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs leading-snug text-slate-600">
              {PREFERENCIAS.map((pref) => (
                <li key={pref}>{pref}</li>
              ))}
              <li className="text-slate-400">
                El plan de recoger o llevar a Elizabeth está cancelado y no reaparece como sugerencia.
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-400">
              Zona horaria: {TZ} · appId: {diagnostico.appId} ({diagnostico.origen})
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
