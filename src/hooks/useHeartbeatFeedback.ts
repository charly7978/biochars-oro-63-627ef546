
import { useEffect, useRef, useState } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Configuración opcional para personalizar el feedback
 */
export interface HeartbeatFeedbackOptions {
  normalVolume?: number;
  arrhythmiaVolume?: number;
  vibrationIntensity?: number;
  enableVibration?: boolean;
  enableSound?: boolean;
}

/**
 * Hook mejorado que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * con mejor eficiencia y personalización
 * 
 * @param enabled Activa o desactiva la retroalimentación
 * @param options Opciones adicionales para personalizar el feedback
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(
  enabled: boolean = true, 
  options?: HeartbeatFeedbackOptions
) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastTriggerTimeRef = useRef<number>(0);
  
  // Configuración con valores por defecto mezclados con opciones del usuario
  const config = {
    normalVolume: options?.normalVolume ?? 0.07,
    arrhythmiaVolume: options?.arrhythmiaVolume ?? 0.1,
    vibrationIntensity: options?.vibrationIntensity ?? 1.0,
    enableVibration: options?.enableVibration ?? true,
    enableSound: options?.enableSound ?? true,
    // Frecuencias optimizadas basadas en investigación
    normalFrequency: 880, // Hz - más agudo para normal
    arrhythmiaFrequency: 440, // Hz - más grave para arritmia
    // Tiempo mínimo entre triggers para evitar sobrecarga
    minTriggerIntervalMs: 250,
  };

  useEffect(() => {
    if (!enabled) return;
    
    const initAudio = async () => {
      try {
        if (!audioCtxRef.current) {
          // Inicializar el contexto de audio con latencia baja
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 44100
          });
          
          // Crear un nodo de ganancia reutilizable
          gainNodeRef.current = audioCtxRef.current.createGain();
          gainNodeRef.current.connect(audioCtxRef.current.destination);
          
          // Asegurar que el audio esté activo
          if (audioCtxRef.current.state !== 'running') {
            await audioCtxRef.current.resume();
          }
          
          // Precargar un sonido silencioso para evitar latencia en el primer beep
          const osc = audioCtxRef.current.createOscillator();
          osc.connect(gainNodeRef.current);
          gainNodeRef.current.gain.setValueAtTime(0.001, audioCtxRef.current.currentTime);
          osc.start();
          osc.stop(audioCtxRef.current.currentTime + 0.01);
          
          console.log("useHeartbeatFeedback: Audio context initialized successfully");
          setIsReady(true);
        }
      } catch (err) {
        console.error('Error inicializando el contexto de audio:', err);
      }
    };
    
    initAudio();
    
    // Cleanup al desmontar
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
    };
  }, [enabled]);

  /**
   * Activa la retroalimentación táctil y auditiva con mejor rendimiento
   * @param type Tipo de retroalimentación: normal o arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled || !isReady) return false;
    
    const now = Date.now();
    // Limitar la frecuencia de activación para evitar sobrecarga
    if (now - lastTriggerTimeRef.current < config.minTriggerIntervalMs) {
      return false;
    }
    
    lastTriggerTimeRef.current = now;
    
    // Patrones de vibración mejorados
    if (config.enableVibration && 'vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Vibración simple para latido normal
          navigator.vibrate(50 * config.vibrationIntensity);
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia (pulso doble)
          navigator.vibrate([50, 100, 100].map(v => v * config.vibrationIntensity));
        }
      } catch (e) {
        console.warn('Vibración no soportada:', e);
      }
    }

    // Generar un bip con características según el tipo
    if (config.enableSound && audioCtxRef.current && gainNodeRef.current) {
      try {
        const ctx = audioCtxRef.current;
        const gain = gainNodeRef.current;
        
        // Crear oscilador para este beep específico
        const osc = ctx.createOscillator();
        
        if (type === 'normal') {
          // Tono normal para latido regular - forma de onda cuadrada
          osc.type = 'square';
          osc.frequency.setValueAtTime(config.normalFrequency, ctx.currentTime);
          gain.gain.setValueAtTime(config.normalVolume, ctx.currentTime);
          
          // Forma de la envolvente ADSR para sonido de latido normal
          gain.gain.linearRampToValueAtTime(config.normalVolume, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        } else if (type === 'arrhythmia') {
          // Tono más grave y duradero para arritmia - forma de onda triangular
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(config.arrhythmiaFrequency, ctx.currentTime);
          gain.gain.setValueAtTime(config.arrhythmiaVolume, ctx.currentTime);
          
          // Envolvente ADSR para arritmia - más distintiva
          gain.gain.linearRampToValueAtTime(config.arrhythmiaVolume, ctx.currentTime + 0.02);
          gain.gain.linearRampToValueAtTime(config.arrhythmiaVolume * 0.7, ctx.currentTime + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        }

        osc.connect(gain);
        osc.start();
        // Mayor duración para arritmias
        osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.2 : 0.1));
      } catch (e) {
        console.error('Error generando beep:', e);
      }
    }
    
    return true;
  };

  return trigger;
}
