import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado con `SpeechRecognition` / `webkitSpeechRecognition` en es-MX.
 *
 * El micrófono es un extra: escribir a mano siempre funciona. Si el navegador
 * no lo soporta o el usuario niega el permiso, lo decimos con claridad en vez
 * de dejar el botón muerto.
 */
export function useSpeechDictation({ lang = 'es-MX', onTranscript } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const supported = !!SpeechRecognition;

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* el navegador ya lo había detenido */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError(null);

    if (!SpeechRecognition) {
      setError(
        'Este navegador no permite dictado por voz. Puedes escribir la instrucción a mano (en iPhone usa el micrófono del teclado).'
      );
      return;
    }

    if (recognitionRef.current) {
      stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      setInterim(pending);
      if (finalText.trim()) transcriptRef.current?.(finalText.trim());
    };

    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'El navegador bloqueó el micrófono. Permite el acceso y vuelve a intentarlo.',
        'service-not-allowed': 'El navegador bloqueó el micrófono. Permite el acceso y vuelve a intentarlo.',
        'no-speech': 'No escuché nada. Toca el micrófono y habla de nuevo.',
        'audio-capture': 'No encontré un micrófono disponible en este dispositivo.',
        network: 'El dictado necesita conexión y no pude alcanzar el servicio de voz.',
        aborted: null,
      };
      const message = messages[event.error];
      if (message !== null) {
        setError(message || `No pude usar el dictado (${event.error}).`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      setError(`No pude iniciar el dictado (${err?.message || 'error desconocido'}).`);
      recognitionRef.current = null;
      setListening(false);
    }
  }, [SpeechRecognition, lang, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* nada que limpiar */
      }
    },
    []
  );

  return { supported, listening, interim, error, start, stop, toggle, clearError: () => setError(null) };
}
