
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * Con sistema de audio mejorado y múltiples opciones de fallback
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  // Referencias para mantener estados entre renders
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const lastPlayTimeRef = useRef<number>(0);
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);

  // Función para inicializar el sistema de audio
  const initializeAudio = useCallback(async () => {
    if (!enabled || isInitializedRef.current) return;

    try {
      console.log("useHeartbeatFeedback: Inicializando sistema de audio");
      
      // Crear elemento de audio y precargar el sonido
      const audioElement = new Audio('/sounds/heartbeat.mp3');
      audioElement.preload = 'auto';
      audioElement.volume = 0.8;
      
      // Manejar carga del audio
      const handleCanPlayThrough = () => {
        console.log("useHeartbeatFeedback: Audio precargado correctamente");
        setIsAudioReady(true);
      };
      
      audioElement.addEventListener('canplaythrough', handleCanPlayThrough);
      
      // Iniciar carga
      audioElement.load();
      audioElementRef.current = audioElement;
      
      // Inicializar Web Audio API como sistema de respaldo
      if (window.AudioContext || (window as any).webkitAudioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass({ latencyHint: 'interactive' });
        
        // Asegurar que esté en modo "running"
        if (audioCtxRef.current.state !== 'running') {
          await audioCtxRef.current.resume();
        }
        
        // Reproducir un sonido silencioso para "despertar" el sistema de audio
        const silentOsc = audioCtxRef.current.createOscillator();
        const silentGain = audioCtxRef.current.createGain();
        silentGain.gain.value = 0.001;
        silentOsc.connect(silentGain);
        silentGain.connect(audioCtxRef.current.destination);
        silentOsc.start();
        silentOsc.stop(audioCtxRef.current.currentTime + 0.001);
        
        console.log("useHeartbeatFeedback: Web Audio API inicializado");
      }
      
      isInitializedRef.current = true;
      
      return () => {
        if (audioElement) {
          audioElement.removeEventListener('canplaythrough', handleCanPlayThrough);
        }
      };
    } catch (err) {
      console.error("useHeartbeatFeedback: Error inicializando audio", err);
    }
  }, [enabled]);

  // Inicializar al montar el componente
  useEffect(() => {
    // Iniciar sistema de audio al montar
    initializeAudio();
    
    // Añadir event listeners para interacción del usuario (requisito en algunos navegadores)
    const handleUserInteraction = () => {
      if (!isInitializedRef.current) {
        initializeAudio();
      } else if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().catch(console.error);
      }
    };
    
    // Eventos que pueden "despertar" el audio
    const interactionEvents = ['click', 'touchstart', 'keydown'];
    interactionEvents.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });
    
    // Limpieza al desmontar
    return () => {
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
      
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, [enabled, initializeAudio]);

  /**
   * Activa la retroalimentación táctil y auditiva con capacidad de fallback
   * @param type Tipo de retroalimentación: normal o arritmia
   * @param volume Volumen del sonido (0.0 a 1.0)
   */
  const trigger = useCallback((type: HeartbeatFeedbackType = 'normal', volume: number = 0.8) => {
    if (!enabled || !isInitializedRef.current) {
      // Intentar inicializar bajo demanda
      initializeAudio();
      return false;
    }

    // Control de frecuencia de reproducción para prevenir solapamiento
    const now = Date.now();
    const MIN_INTERVAL = 250; // ms mínimos entre reproducciones
    if (now - lastPlayTimeRef.current < MIN_INTERVAL) {
      return false;
    }
    lastPlayTimeRef.current = now;

    try {
      // Patrones de vibración si están disponibles
      if ('vibrate' in navigator) {
        if (type === 'normal') {
          navigator.vibrate(50);
        } else if (type === 'arrhythmia') {
          navigator.vibrate([50, 100, 100]);
        }
      }

      // Estrategia 1: Usar elemento de audio (más compatible)
      if (audioElementRef.current && isAudioReady) {
        const audio = audioElementRef.current;
        audio.volume = Math.min(1.0, Math.max(0.1, volume)); // Asegurar volumen razonable
        audio.currentTime = 0; // Reiniciar para permitir reproducción rápida
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Error reproduciendo audio con HTMLAudioElement:", error);
            // Si falla, intentar con Web Audio API
            playBeepWithWebAudio(type, volume);
          });
        }
        return true;
      }
      
      // Estrategia 2: Usar Web Audio API
      return playBeepWithWebAudio(type, volume);
      
    } catch (err) {
      console.error("useHeartbeatFeedback: Error al reproducir feedback:", err);
      return false;
    }
  }, [enabled, isAudioReady, initializeAudio]);

  /**
   * Método alternativo usando Web Audio API
   */
  const playBeepWithWebAudio = useCallback((type: HeartbeatFeedbackType, volume: number): boolean => {
    try {
      if (!audioCtxRef.current) return false;
      
      const ctx = audioCtxRef.current;
      if (ctx.state !== 'running') {
        ctx.resume().catch(console.error);
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Configuración según tipo
      if (type === 'normal') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(Math.min(1.0, volume), ctx.currentTime);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(Math.min(1.0, volume * 1.2), ctx.currentTime);
      }
      
      // Conectar nodos
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Envolvente de sonido
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      // Reproducir
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      
      console.log("useHeartbeatFeedback: Beep reproducido con Web Audio API", {
        tipo: type,
        volumen: volume,
        tiempo: new Date().toISOString(),
        audioContextState: ctx.state
      });
      
      return true;
    } catch (err) {
      console.error("Error reproduciendo con Web Audio API:", err);
      
      // Último recurso: crear un beep de emergencia
      try {
        const emergencyBeep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
        emergencyBeep.volume = volume;
        emergencyBeep.play().catch(console.error);
        return true;
      } catch (e) {
        console.error("Todos los métodos de audio han fallado:", e);
        return false;
      }
    }
  }, []);

  return trigger;
}
