import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, HeartPulse, Lightbulb, Watch } from 'lucide-react';
import {
  AJUSTE_META,
  CONSEJOS,
  DESCARGO,
  HORAS,
  HORAS_CLAVE,
  METAS,
  PASO_CERO,
  REGLA_SEMANA,
  horaLegible,
} from '@/lib/agenda/bienestar';

const NIVELES = {
  buena: { fondo: '#E4F7EC', borde: '#A9E6C4', texto: '#166534', etiqueta: 'buena' },
  critica: { fondo: '#FDE9F3', borde: '#F9C2DD', texto: '#9D174D', etiqueta: 'crítica' },
  normal: { fondo: '#F7F6FB', borde: '#E4E1EF', texto: '#4C4470', etiqueta: '' },
};

/** Las 4 metas de la semana y el desglose hora por hora. */
export default function MetasPanel() {
  const [horasAbierto, setHorasAbierto] = useState(false);
  const [consejosAbierto, setConsejosAbierto] = useState(false);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-4 sm:px-6">
      <div className="rounded-3xl bg-white/85 p-4 shadow-sm ring-1 ring-violet-100">
        <header className="flex flex-wrap items-center gap-2">
          <HeartPulse className="h-5 w-5 shrink-0 text-fuchsia-500" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-violet-900">Las 4 metas de la semana</h2>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
            Sobre tus datos de Fitbit
          </span>
        </header>

        <p className="mt-2 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800">
          <Watch className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{PASO_CERO}</span>
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {METAS.map((meta) => (
            <article
              key={meta.id}
              className="min-w-0 rounded-2xl border bg-white/70 p-3"
              style={{ borderColor: `${meta.color}44` }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-lg" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                  style={{ background: meta.color }}
                >
                  {meta.numero}
                </span>
                <p className="min-w-0 break-words text-sm font-bold text-slate-800">{meta.titulo}</p>
              </div>
              <p className="mt-1 text-sm font-extrabold" style={{ color: meta.color }}>
                {meta.meta}
              </p>
              <p className="mt-1 break-words text-[11px] leading-snug text-slate-600">{meta.detalle}</p>
              <p className="mt-2 break-words text-[11px] leading-snug text-slate-400">
                <span className="font-semibold">De dónde vienes:</span> {meta.deDondeVienes}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-3 break-words rounded-2xl bg-violet-50/70 px-3 py-2 text-[11px] leading-snug text-slate-600">
          <span className="font-bold text-violet-700">Un ajuste a tu meta original.</span> {AJUSTE_META}
        </p>

        <div className="mt-3 flex flex-wrap gap-4">
          <button type="button" onClick={() => setHorasAbierto((v) => !v)} className={enlaceClase}>
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Tu día, hora por hora
            {horasAbierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setConsejosAbierto((v) => !v)} className={enlaceClase}>
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            Cómo hacer que aguante más de tres días
            {consejosAbierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {horasAbierto && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] leading-snug text-slate-500">
              Cada fila sale de tus 45 días con el reloj. En rosa, las horas en que históricamente no te
              mueves; en verde, las que ya funcionan y solo hay que proteger. Las tres que más rinden:{' '}
              {HORAS_CLAVE.map(horaLegible).join(', ')}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-y-1 text-left text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-1 font-bold">Hora</th>
                    <th className="px-2 py-1 font-bold">Días sin moverte</th>
                    <th className="px-2 py-1 font-bold">Pasos</th>
                    <th className="px-2 py-1 font-bold">Qué hacer</th>
                  </tr>
                </thead>
                <tbody>
                  {HORAS.map((h) => {
                    const nivel = NIVELES[h.nivel];
                    return (
                      <tr key={h.hora} style={{ background: nivel.fondo }}>
                        <td
                          className="whitespace-nowrap rounded-l-lg px-2 py-1.5 font-bold tabular-nums"
                          style={{ color: nivel.texto }}
                        >
                          {horaLegible(h.hora)}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: nivel.texto }}>
                          {h.sinMoverte} %{nivel.etiqueta && <span className="ml-1 opacity-70">({nivel.etiqueta})</span>}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-slate-600">{h.pasos}</td>
                        <td className="rounded-r-lg px-2 py-1.5 text-slate-600">{h.nota}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {consejosAbierto && (
          <div className="mt-3 rounded-2xl bg-violet-50/70 p-3">
            <ul className="list-disc space-y-1.5 pl-5 text-[11px] leading-snug text-slate-600">
              {CONSEJOS.map((consejo) => (
                <li key={consejo}>{consejo}</li>
              ))}
              <li className="font-semibold text-violet-700">{REGLA_SEMANA}</li>
            </ul>
          </div>
        )}

        <p className="mt-3 text-[10px] leading-snug text-slate-400">{DESCARGO}</p>
      </div>
    </section>
  );
}

const enlaceClase =
  'inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:underline';
