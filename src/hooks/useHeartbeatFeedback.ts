
import { useEffect, useRef, useState } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * Optimizado para baja latencia y sincronización perfecta con la señal visual
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioInitializedRef = useRef<boolean>(false);
  const [audioReady, setAudioReady] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    
    const initAudio = async () => {
      try {
        if (!audioCtxRef.current) {
          console.log("Inicializando contexto de audio...");
          
          // Usar configuración de baja latencia para mejor sincronización
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'interactive'
          });
          
          // Crear nodo de ganancia maestro para control de volumen
          gainNodeRef.current = audioCtxRef.current.createGain();
          gainNodeRef.current.gain.value = 0.25; // Volumen inicial más alto
          gainNodeRef.current.connect(audioCtxRef.current.destination);
          
          // Asegurar que el contexto esté en estado "running"
          if (audioCtxRef.current.state !== 'running') {
            await audioCtxRef.current.resume();
            console.log("Audio context resumed:", audioCtxRef.current.state);
          }
          
          // Preparar el sistema de audio con un beep silencioso para reducir latencia en el primer beep real
          await playSilentSound();
          audioInitializedRef.current = true;
          setAudioReady(true);
          console.log("useHeartbeatFeedback: Audio Context inicializado con baja latencia");
          
          // Reproducir un beep de prueba para verificar el funcionamiento
          setTimeout(() => {
            playTestBeep();
          }, 500);
        }
      } catch (err) {
        console.error('Error inicializando el contexto de audio:', err);
      }
    };
    
    initAudio();
    
    // Force audio context to start on user interaction
    const handleUserInteraction = async () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        try {
          await audioCtxRef.current.resume();
          console.log("Audio context resumed after user interaction:", audioCtxRef.current.state);
          // Play a test beep
          playTestBeep();
        } catch (err) {
          console.error('Error resuming audio context:', err);
        }
      }
    };
    
    document.body.addEventListener('click', handleUserInteraction);
    document.body.addEventListener('touchstart', handleUserInteraction);
    
    // Cleanup al desmontar
    return () => {
      document.body.removeEventListener('click', handleUserInteraction);
      document.body.removeEventListener('touchstart', handleUserInteraction);
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
    };
  }, [enabled]);

  // Reproduce un sonido silencioso para inicializar el sistema de audio
  const playSilentSound = async () => {
    if (!audioCtxRef.current) return;
    
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      
      gain.gain.value = 0.001; // Prácticamente inaudible
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.001);
      
      console.log("Silent sound played to initialize audio system");
    } catch (err) {
      console.error('Error reproduciendo sonido silencioso:', err);
    }
  };
  
  // Reproduce un beep de prueba para verificar que el audio funciona
  const playTestBeep = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
    
    try {
      console.log("Playing test beep...");
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.1);
      console.log("Test beep played successfully");
    } catch (err) {
      console.error('Error playing test beep:', err);
    }
  };

  /**
   * Activa la retroalimentación táctil y auditiva con perfecta sincronización
   * Usa técnicas de baja latencia y pre-scheduling para mantener sincronía con la visualización
   * @param type Tipo de retroalimentación: normal o arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled) return;

    // Patrones de vibración
    if ('vibrate' in navigator) {
      if (type === 'normal') {
        // Vibración simple para latido normal
        navigator.vibrate(50);
      } else if (type === 'arrhythmia') {
        // Patrón de vibración distintivo para arritmia (pulso doble)
        navigator.vibrate([50, 100, 100]);
      }
    }

    // Generar un bip para sincronizar con el latido visual
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      try {
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        
        // Crear osciladores y configurar nodos de ganancia
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // Configurar tipo y frecuencia
        if (type === 'normal') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0.3, now); // Aumentado para mayor volumen
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.35, now); // Aumentado para mayor volumen
        }
        
        // Envolvente precisa para sincronización perfecta
        gain.gain.exponentialRampToValueAtTime(0.01, now + (type === 'arrhythmia' ? 0.2 : 0.1));
        
        // Conectar y programar reproducción inmediata
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + (type === 'arrhythmia' ? 0.2 : 0.1));
        
        console.log("Beep played:", type, "at time:", now);
        return true;
      } catch (e) {
        console.error('Error generando sonido de latido:', e);
        return false;
      }
    } else {
      console.warn('Audio context not ready or not running:', audioCtxRef.current?.state);
      
      // Intentar reanudar el contexto de audio si está suspendido
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          console.log("Audio context resumed after suspend");
          
          // Intentar reproducir el sonido después de reanudar
          setTimeout(() => trigger(type), 100);
        }).catch(err => {
          console.error("Failed to resume audio context:", err);
        });
      }
      return false;
    }
  };

  return trigger;
}
