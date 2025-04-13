
import { useEffect, useRef } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const vibrationPermissionRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    
    // Inicializar contexto de audio
    try {
      // Inicializar inmediatamente para permitir interacción del usuario
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("useHeartbeatFeedback: AudioContext inicializado correctamente");
      }
      
      // Intentar reanudar el contexto de audio (importante para navegadores móviles)
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().catch(err => {
          console.error('Error resumiendo el contexto de audio:', err);
        });
      }
      
      // Solicitar permiso de vibración en dispositivos móviles
      // Algunos navegadores solo permiten vibración después de interacción del usuario
      if ('vibrate' in navigator && !vibrationPermissionRequestedRef.current) {
        try {
          // Intento de prueba con duración mínima para solicitar permiso
          navigator.vibrate(1);
          vibrationPermissionRequestedRef.current = true;
          console.log('Permiso de vibración solicitado');
        } catch (err) {
          console.error('Error solicitando permiso de vibración:', err);
        }
      }
    } catch (err) {
      console.error('Error inicializando AudioContext:', err);
    }
    
    // Cleanup al desmontar
    return () => {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        } catch (err) {
          console.error('Error limpiando oscilador:', err);
        }
      }
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
    };
  }, [enabled]);

  /**
   * Activa la retroalimentación táctil y auditiva
   * @param type Tipo de retroalimentación: normal o arritmia
   * @param intensity Intensidad del latido (0-1)
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal', intensity: number = 0.7) => {
    if (!enabled) return;
    
    const now = Date.now();
    const MIN_TRIGGER_INTERVAL = 250; // 250ms entre vibraciones para evitar saturación
    
    // Evitar activaciones demasiado frecuentes
    if (now - lastTriggerTimeRef.current < MIN_TRIGGER_INTERVAL) {
      return; // Evitar vibraciones demasiado frecuentes
    }
    
    lastTriggerTimeRef.current = now;
    
    // Normalizar intensidad entre 0.3 y 1.0 para garantizar un mínimo audible
    const normalizedIntensity = Math.max(0.3, Math.min(1.0, intensity));
    
    // SOLO VIBRACIÓN - No generar audio aquí (se maneja en PPGSignalMeter)
    if ('vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Vibración más fuerte para latido normal (200ms para garantizar que se sienta)
          navigator.vibrate(200);
          console.log('Vibración normal activada con intensidad:', normalizedIntensity);
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia (pulso doble más fuerte y largo)
          navigator.vibrate([200, 100, 200]);
          console.log('Vibración de arritmia activada con intensidad:', normalizedIntensity);
        }
      } catch (error) {
        console.error('Error al activar vibración:', error);
        
        // Segundo intento con un patrón más simple y duración más larga
        try {
          navigator.vibrate(300);
          console.log('Segundo intento de vibración activado (más largo)');
        } catch (retryError) {
          console.error('Error en segundo intento de vibración:', retryError);
        }
      }
    } else {
      console.log('API de vibración no disponible en este dispositivo');
    }
  };

  return trigger;
}
