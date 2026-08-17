import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Loader2 } from 'lucide-react';
import { METAS, evaluarDia } from '@/lib/agenda/bienestar';
import { fetchRegistros, guardarRegistro } from '@/lib/agenda/registroApi';
import { DIAS_LARGOS, dayNumber, weekdayOf } from '@/lib/agenda/time';

const CAMPOS = [
  { campo: 'pausas', etiqueta: 'Pausas', meta: 'meta 8', paso: 1 },
  { campo: 'horas_activas', etiqueta: 'Horas activas', meta: 'meta 10', paso: 1 },
  { campo: 'pasos', etiqueta: 'Pasos', meta: 'meta 7,000', paso: 100 },
  { campo: 'redes_min', etiqueta: 'Redes', meta: 'meta 0 min', paso: 5 },
  { campo: 'tele_min', etiqueta: 'Tele', meta: 'min', paso: 5 },
  { campo: 'bloque_min', etiqueta: 'Bloque más largo sentada', meta: 'min', paso: 15 },
];

/**
 * Registro de la semana: dos minutos al final del día.
 *
 * Se guarda al salir de cada campo, no en cada tecla, para no llenar el
 * backend de escrituras.
 */
export default function RegistroSemana({ fechas, onAviso }) {
  const [abierto, setAbierto] = useState(false);
  const [registros, setRegistros] = useState({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [guardandoFecha, setGuardandoFecha] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const respuesta = await fetchRegistros(fechas);
    setRegistros(respuesta.registros);
    setError(respuesta.ok ? null : respuesta.message);
    setCargando(false);
  }, [fechas]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  const guardar = async (fecha, cambios) => {
    const previo = registros[fecha];
    // Pintamos el cambio de inmediato y confirmamos contra el backend.
    setRegistros((prev) => ({ ...prev, [fecha]: { ...prev[fecha], fecha, ...cambios } }));
    setGuardandoFecha(fecha);
    const respuesta = await guardarRegistro(fecha, cambios, previo);
    setGuardandoFecha(null);

    if (!respuesta.ok) {
      setRegistros((prev) => ({ ...prev, [fecha]: previo }));
      onAviso?.('error', respuesta.message);
      return;
    }
    setRegistros((prev) => ({ ...prev, [fecha]: respuesta.registro }));
  };

  const resumen = useMemo(() => {
    const dias = fechas.map((fecha) => evaluarDia(registros[fecha]));
    return {
      buenos: dias.filter((d) => d.buena).length,
      conDatos: fechas.filter((fecha) => registros[fecha]).length,
    };
  }, [fechas, registros]);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-4 sm:px-6">
      <div className="rounded-3xl bg-white/85 p-4 shadow-sm ring-1 ring-violet-100">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex w-full flex-wrap items-center gap-2 text-left"
        >
          <ClipboardList className="h-5 w-5 shrink-0 text-violet-500" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-violet-900">Registro de la semana</h2>
          <span className="text-xs text-slate-500">
            {resumen.conDatos > 0
              ? `${resumen.buenos} de 7 días buenos · ${resumen.conDatos} con datos`
              : 'Llénalo al final del día — dos minutos'}
          </span>
          <span className="ml-auto text-violet-700">
            {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {abierto && (
          <div className="mt-3">
            {error && (
              <p className="mb-3 flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{error}</span>
              </p>
            )}

            <p className="mb-3 text-[11px] leading-snug text-slate-500">
              Los pasos y las horas activas los lees directo en la app del Fitbit; las pausas y los
              minutos de pantalla los pones tú. Una semana cuenta como buena con 5 de 7 días.
            </p>

            {cargando ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cargando tu registro…
              </p>
            ) : (
              <div className="space-y-2">
                {fechas.map((fecha) => (
                  <FilaDia
                    key={fecha}
                    fecha={fecha}
                    registro={registros[fecha]}
                    guardando={guardandoFecha === fecha}
                    onGuardar={guardar}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function FilaDia({ fecha, registro, guardando, onGuardar }) {
  const evaluacion = evaluarDia(registro);
  const nombre = DIAS_LARGOS[weekdayOf(fecha)];

  const alSalir = (campo) => (event) => {
    const bruto = event.target.value;
    const valor = bruto === '' ? null : Number(bruto);
    if (valor !== null && Number.isNaN(valor)) return;
    if ((registro?.[campo] ?? null) === valor) return;
    onGuardar(fecha, { [campo]: valor });
  };

  return (
    <div
      className={`min-w-0 rounded-2xl border p-3 ${
        evaluacion.buena ? 'border-emerald-200 bg-emerald-50/50' : 'border-violet-100 bg-white/70'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-extrabold text-violet-900">{nombre}</span>
        <span className="text-sm font-black text-fuchsia-500">{dayNumber(fecha)}</span>
        {registro && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              evaluacion.buena ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {evaluacion.cumplidas}/{evaluacion.total} metas
          </span>
        )}
        {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" aria-hidden="true" />}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {CAMPOS.map(({ campo, etiqueta, meta, paso }) => (
          <label key={campo} className="block min-w-0">
            <span className="mb-0.5 block truncate text-[10px] font-bold uppercase tracking-wide text-violet-700">
              {etiqueta}
              <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">{meta}</span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              step={paso}
              min={0}
              defaultValue={registro?.[campo] ?? ''}
              key={`${fecha}-${campo}-${registro?.[campo] ?? ''}`}
              onBlur={alSalir(campo)}
              className="w-full rounded-xl border border-violet-100 bg-violet-50/40 px-2 py-1.5 text-sm tabular-nums text-slate-800 outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-200"
            />
          </label>
        ))}

        <label className="block min-w-0">
          <span className="mb-0.5 block truncate text-[10px] font-bold uppercase tracking-wide text-violet-700">
            Caminata
            <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">sí / no</span>
          </span>
          <button
            type="button"
            onClick={() => onGuardar(fecha, { caminata: !registro?.caminata })}
            className={`w-full rounded-xl border px-2 py-1.5 text-sm font-bold transition-colors ${
              registro?.caminata
                ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                : 'border-violet-100 bg-violet-50/40 text-slate-400 hover:bg-violet-50'
            }`}
            aria-pressed={!!registro?.caminata}
          >
            {registro?.caminata ? 'Sí' : 'No'}
          </button>
        </label>
      </div>

      {registro && evaluacion.cumplidas > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
          {METAS.map((m) => {
            const valor = registro[m.campo];
            if (valor === null || valor === undefined || valor === '') return null;
            const cumple = m.invertida ? Number(valor) <= m.objetivo : Number(valor) >= m.objetivo;
            return (
              <span key={m.id} className={cumple ? 'font-semibold text-emerald-600' : ''}>
                {m.emoji} {cumple ? '✓' : '·'} {m.titulo.split(' ').slice(0, 3).join(' ')}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
