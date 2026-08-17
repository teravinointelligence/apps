import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HeartPulse, Info, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import ConfirmDialog from '@/components/agenda/ConfirmDialog';
import DayCard from '@/components/agenda/DayCard';
import Legend from '@/components/agenda/Legend';
import MetasPanel from '@/components/agenda/MetasPanel';
import RegistroSemana from '@/components/agenda/RegistroSemana';
import ReviewModal from '@/components/agenda/ReviewModal';
import TopPanel from '@/components/agenda/TopPanel';
import WeekToolbar from '@/components/agenda/WeekToolbar';
import { normalizeCategory } from '@/lib/agenda/categories';
import {
  createEvent,
  deleteEvent,
  fetchWeek,
  hintFor,
  updateEvent,
  updateEventTasks,
} from '@/lib/agenda/calendarApi';
import { buildFallbackWeek } from '@/lib/agenda/fallbackWeek';
import { emptyDraft, interpretInstruction } from '@/lib/agenda/instruction';
import {
  baseLocationForDay,
  freeSlots,
  lodgingHint,
  roundTripContext,
  suggestedTransfers,
} from '@/lib/agenda/preferences';
import { criticalHoursInEvents, sittingAlerts, wellnessSuggestions } from '@/lib/agenda/bienestar';
import { isWeatherTitle, parseWeather } from '@/lib/agenda/weather';
import { useSpeechDictation } from '@/lib/agenda/useSpeech';
import { addDays, minutesOfDay, startOfWeek, todayStr, weekDates } from '@/lib/agenda/time';

/** Orden de los bloques dentro de un día: primero lo de todo el día, luego por hora. */
function ordenarBloques(a, b) {
  const aTodo = a.allDay || a.wholeDay;
  const bTodo = b.allDay || b.wholeDay;
  if (aTodo !== bTodo) return aTodo ? -1 : 1;
  return (minutesOfDay(a.startTime) ?? 0) - (minutesOfDay(b.startTime) ?? 0);
}

/** Reparte los eventos de Google por día y separa los eventos de clima. */
function repartirPorDia(lista, fechas) {
  const dias = {};
  const climas = {};
  fechas.forEach((fecha) => {
    dias[fecha] = [];
  });

  for (const evento of lista) {
    if (isWeatherTitle(evento.title)) {
      if (dias[evento.date] && !climas[evento.date]) climas[evento.date] = parseWeather(evento.title);
      continue;
    }
    if (!dias[evento.date]) continue;
    dias[evento.date].push({
      ...evento,
      category: normalizeCategory(evento.category, {
        title: evento.title,
        location: evento.location,
      }),
    });
  }

  Object.values(dias).forEach((lista2) => lista2.sort(ordenarBloques));
  return { dias, climas };
}

export default function Agenda() {
  const { user, logout } = useAuth();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayStr()));
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState('conectando');
  const [eventos, setEventos] = useState({});
  const [clima, setClima] = useState({});
  const [aviso, setAviso] = useState(null);
  const [esRespaldo, setEsRespaldo] = useState(false);

  const [instruccion, setInstruccion] = useState('');
  const [preparando, setPreparando] = useState(false);

  const [modal, setModal] = useState({ abierto: false, borrador: null, modo: 'crear', eventId: null });
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);

  const [confirmacion, setConfirmacion] = useState(null);
  const [ocupadoConfirm, setOcupadoConfirm] = useState(false);
  const [busyTaskKey, setBusyTaskKey] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [bienestar, setBienestar] = useState(true);

  const hoy = todayStr();
  const fechas = useMemo(() => weekDates(weekStart), [weekStart]);
  const peticionRef = useRef(0);

  const avisar = useCallback((tipo, texto) => setMensaje({ tipo, texto, id: Date.now() }), []);

  useEffect(() => {
    if (!mensaje) return undefined;
    const timer = setTimeout(() => setMensaje(null), 7000);
    return () => clearTimeout(timer);
  }, [mensaje]);

  /* ---------------- carga de la semana ---------------- */

  const cargarSemana = useCallback(
    async (inicio) => {
      const ticket = ++peticionRef.current;
      setCargando(true);
      setEstado('conectando');

      const respuesta = await fetchWeek(inicio);
      if (ticket !== peticionRef.current) return; // llegó tarde, ya hay otra semana en pantalla

      const fechasSemana = weekDates(inicio);

      if (respuesta.ok) {
        const { dias, climas } = repartirPorDia(respuesta.events || [], fechasSemana);
        setEventos(dias);
        setClima(climas);
        setEsRespaldo(false);
        setAviso(null);
        setEstado('conectado');
      } else {
        const pista = hintFor(respuesta.code);
        setAviso({ ...pista, code: respuesta.code, message: respuesta.message });
        if (pista.respaldo) {
          const respaldo = buildFallbackWeek(fechasSemana);
          setEventos(respaldo.days);
          setClima(respaldo.weather);
          setEsRespaldo(true);
        } else {
          const vacios = {};
          fechasSemana.forEach((fecha) => {
            vacios[fecha] = [];
          });
          setEventos(vacios);
          setClima({});
          setEsRespaldo(false);
        }
        setEstado('preview');
      }
      setCargando(false);
    },
    []
  );

  useEffect(() => {
    cargarSemana(weekStart);
  }, [weekStart, cargarSemana]);

  /* ---------------- días listos para pintar ---------------- */

  const dias = useMemo(
    () =>
      fechas.map((fecha, indice) => {
        const confirmados = eventos[fecha] || [];
        const sugerencias = [
          ...suggestedTransfers(confirmados),
          ...(bienestar ? wellnessSuggestions(fecha, confirmados) : []),
        ];
        const conSugerencias = [...confirmados, ...sugerencias];
        // Las sugerencias no ocupan el día: si no hay nada confirmado, el día
        // sigue estando "Libre" aunque propongamos caminata o corte de pantalla.
        const libres = freeSlots(fecha, confirmados.length ? conSugerencias : []);
        return {
          date: fecha,
          esHoy: fecha === hoy,
          clima: clima[fecha],
          ubicacionBase: baseLocationForDay(fecha, confirmados),
          bloques: [...conSugerencias, ...libres].sort(ordenarBloques),
          contexto: roundTripContext(fecha, confirmados),
          hospedaje: lodgingHint(fecha, confirmados, eventos[fechas[indice + 1]] || []),
          horasCriticas: bienestar ? criticalHoursInEvents(confirmados) : [],
          bloquesLargos: bienestar ? sittingAlerts(confirmados) : [],
        };
      }),
    [fechas, eventos, clima, hoy, bienestar]
  );

  /* ---------------- dictado ---------------- */

  const dictado = useSpeechDictation({
    lang: 'es-MX',
    onTranscript: (texto) => setInstruccion((prev) => (prev ? `${prev} ${texto}` : texto)),
  });

  /* ---------------- preparar borrador ---------------- */

  const preparar = async () => {
    if (preparando) return;
    setPreparando(true);
    try {
      const borrador = await interpretInstruction(instruccion, { today: hoy });
      setErrorModal(null);
      setModal({ abierto: true, borrador, modo: 'crear', eventId: null });
    } catch (error) {
      avisar('error', error?.message || 'No pude interpretar la instrucción.');
    } finally {
      setPreparando(false);
    }
  };

  const abrirNuevo = (fecha = hoy) => {
    setErrorModal(null);
    setModal({ abierto: true, borrador: emptyDraft(fecha), modo: 'crear', eventId: null });
  };

  const abrirEdicion = (evento) => {
    setErrorModal(null);
    setModal({
      abierto: true,
      modo: 'editar',
      eventId: evento.id,
      borrador: {
        title: evento.title,
        date: evento.date,
        start_time: evento.startTime || '09:00',
        end_time: evento.endTime || '10:00',
        location: evento.location || '',
        category: evento.category,
        tasks: evento.tasks || [],
        notes: evento.notes || '',
        clarification: '',
      },
    });
  };

  const confirmarSugerencia = (sugerencia) => {
    setErrorModal(null);
    setModal({
      abierto: true,
      modo: 'crear',
      eventId: null,
      borrador: {
        title: sugerencia.title,
        date: sugerencia.date || hoy,
        start_time: sugerencia.startTime,
        end_time: sugerencia.endTime,
        location: sugerencia.location,
        category: sugerencia.category,
        tasks: [],
        notes: '',
        clarification: sugerencia.bienestar
          ? 'Este bloque viene de tu plan de hábitos de la semana, no de Google. Ajústalo si quieres y confírmalo para que quede agendado.'
          : 'Este traslado era solo una sugerencia. Verifica el horario real antes de agendarlo en Google.',
      },
    });
  };

  /* ---------------- guardar ---------------- */

  const guardar = async (form, { forzar = false } = {}) => {
    setGuardando(true);
    setErrorModal(null);

    const draft = {
      title: form.title,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location,
      category: form.category,
      tasks: form.tasks,
      notes: form.notes,
    };

    const respuesta =
      modal.modo === 'editar'
        ? await updateEvent(modal.eventId, draft)
        : await createEvent(draft, { force: forzar });

    setGuardando(false);

    if (!respuesta.ok) {
      setErrorModal(respuesta.message);
      return;
    }

    if (respuesta.duplicate) {
      setConfirmacion({
        titulo: 'Ese evento ya existe',
        mensaje: `${respuesta.message} ¿Quieres crearlo de todas formas?`,
        textoConfirmar: 'Crear de todas formas',
        tono: 'normal',
        accion: async () => {
          await guardar(form, { forzar: true });
        },
      });
      return;
    }

    setModal({ abierto: false, borrador: null, modo: 'crear', eventId: null });
    setInstruccion('');
    avisar(
      'ok',
      modal.modo === 'editar' ? 'Evento actualizado en Google Calendar.' : 'Evento agendado en Google Calendar.'
    );
    cargarSemana(weekStart);
  };

  /* ---------------- pendientes ---------------- */

  const alternarPendiente = async (evento, indice) => {
    if (evento.backup) {
      avisar(
        'aviso',
        'Estás viendo la copia de respaldo, no tu calendario real: por eso este pendiente no se puede marcar. Usa “Actualizar” cuando Google vuelva a responder.'
      );
      return;
    }
    if (evento.source !== 'google') {
      avisar('aviso', 'Este bloque es una sugerencia de la agenda. Confírmalo primero para poder marcar sus pendientes.');
      return;
    }

    const clave = `${evento.id}:${indice}`;
    const nuevos = evento.tasks.map((task, i) => (i === indice ? { ...task, done: !task.done } : task));

    // Actualización optimista para que la casilla responda de inmediato.
    setEventos((prev) => {
      const copia = { ...prev };
      copia[evento.date] = (copia[evento.date] || []).map((item) =>
        item.id === evento.id ? { ...item, tasks: nuevos } : item
      );
      return copia;
    });
    setBusyTaskKey(clave);

    const respuesta = await updateEventTasks(evento.id, nuevos);
    setBusyTaskKey(null);

    if (!respuesta.ok) {
      setEventos((prev) => {
        const copia = { ...prev };
        copia[evento.date] = (copia[evento.date] || []).map((item) =>
          item.id === evento.id ? { ...item, tasks: evento.tasks } : item
        );
        return copia;
      });
      avisar('error', respuesta.message);
    }
  };

  /* ---------------- eliminar ---------------- */

  const pedirEliminar = (evento) => {
    setConfirmacion({
      titulo: 'Eliminar evento',
      mensaje: `Se eliminará "${evento.title}" de tu Google Calendar. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      tono: 'peligro',
      accion: async () => {
        const respuesta = await deleteEvent(evento.id);
        if (!respuesta.ok) {
          avisar('error', respuesta.message);
          return;
        }
        avisar('ok', 'Evento eliminado de Google Calendar.');
        cargarSemana(weekStart);
      },
    });
  };

  const ejecutarConfirmacion = async () => {
    if (!confirmacion) return;
    setOcupadoConfirm(true);
    try {
      await confirmacion.accion?.();
    } finally {
      setOcupadoConfirm(false);
      setConfirmacion(null);
    }
  };

  /* ---------------- render ---------------- */

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-violet-50 via-fuchsia-50 to-amber-50">
      <TopPanel
        estado={estado}
        instruccion={instruccion}
        onInstruccionChange={setInstruccion}
        onPreparar={preparar}
        preparando={preparando}
        dictado={dictado}
        usuario={user}
        onSalir={() => logout(true)}
      />

      <WeekToolbar
        weekStart={weekStart}
        cargando={cargando}
        onHoy={() => setWeekStart(startOfWeek(todayStr()))}
        onAnterior={() => setWeekStart((prev) => addDays(prev, -7))}
        onSiguiente={() => setWeekStart((prev) => addDays(prev, 7))}
        onActualizar={() => cargarSemana(weekStart)}
        onNuevo={() => abrirNuevo()}
      />

      <div className="mx-auto -mt-2 mb-2 w-full max-w-[1600px] px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setBienestar((v) => !v)}
          aria-pressed={bienestar}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            bienestar
              ? 'bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200'
              : 'bg-white text-slate-500 ring-1 ring-violet-100 hover:bg-violet-50'
          }`}
        >
          <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
          Plan de hábitos {bienestar ? 'activo' : 'oculto'}
        </button>
      </div>

      {aviso && (
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-2 sm:px-6">
          <div
            className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
              esRespaldo ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
            }`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">{aviso.titulo}</p>
              <p className="break-words leading-snug">{aviso.message}</p>
              {esRespaldo && (
                <p className="mt-1 font-semibold">
                  Mientras tanto estás viendo una copia de respaldo de la semana, no tu calendario real. Al
                  reconectar, “Actualizar” la reemplaza con los eventos verdaderos.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {dias.map((dia) => (
            <DayCard
              key={dia.date}
              date={dia.date}
              esHoy={dia.esHoy}
              clima={dia.clima}
              ubicacionBase={dia.ubicacionBase}
              bloques={dia.bloques}
              contexto={dia.contexto}
              hospedaje={dia.hospedaje}
              horasCriticas={dia.horasCriticas}
              bloquesLargos={dia.bloquesLargos}
              onToggleTask={alternarPendiente}
              onEdit={abrirEdicion}
              onDelete={pedirEliminar}
              onConfirmSuggestion={confirmarSugerencia}
              onNuevoEnDia={abrirNuevo}
              busyTaskKey={busyTaskKey}
            />
          ))}
        </div>
      </main>

      {bienestar && (
        <>
          <MetasPanel />
          <RegistroSemana fechas={fechas} onAviso={avisar} />
        </>
      )}

      <Legend />

      <ReviewModal
        abierto={modal.abierto}
        borrador={modal.borrador}
        modo={modal.modo}
        guardando={guardando}
        error={errorModal}
        onCancelar={() => setModal({ abierto: false, borrador: null, modo: 'crear', eventId: null })}
        onGuardar={guardar}
      />

      <ConfirmDialog
        abierto={!!confirmacion}
        titulo={confirmacion?.titulo}
        mensaje={confirmacion?.mensaje}
        textoConfirmar={confirmacion?.textoConfirmar}
        tono={confirmacion?.tono}
        ocupado={ocupadoConfirm}
        onCancelar={() => setConfirmacion(null)}
        onConfirmar={ejecutarConfirmacion}
      />

      {mensaje && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
          <div
            className={`pointer-events-auto flex max-w-lg items-start gap-2 rounded-2xl px-4 py-3 text-sm shadow-xl ${
              mensaje.tipo === 'ok'
                ? 'bg-emerald-600 text-white'
                : mensaje.tipo === 'error'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-white'
            }`}
          >
            {mensaje.tipo === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : mensaje.tipo === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 break-words">{mensaje.texto}</span>
            <button
              type="button"
              onClick={() => setMensaje(null)}
              className="ml-1 shrink-0 rounded-full p-0.5 opacity-70 hover:opacity-100"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
