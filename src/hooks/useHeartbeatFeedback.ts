
import { useEffect, useRef, useState } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia' | 'weak' | 'improved';

/**
 * Configuración opcional para personalizar el feedback
 */
export interface HeartbeatFeedbackOptions {
  normalVolume?: number;
  arrhythmiaVolume?: number;
  weakVolume?: number;
  improvedVolume?: number;
  vibrationIntensity?: number;
  enableVibration?: boolean;
  enableSound?: boolean;
  adaptToSignalQuality?: boolean;
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
  const signalQualityRef = useRef<number>(75); // Valor predeterminado
  
  // Configuración con valores por defecto mezclados con opciones del usuario
  const config = {
    normalVolume: options?.normalVolume ?? 0.07,
    arrhythmiaVolume: options?.arrhythmiaVolume ?? 0.1,
    weakVolume: options?.weakVolume ?? 0.05,
    improvedVolume: options?.improvedVolume ?? 0.09,
    vibrationIntensity: options?.vibrationIntensity ?? 1.0,
    enableVibration: options?.enableVibration ?? true,
    enableSound: options?.enableSound ?? true,
    adaptToSignalQuality: options?.adaptToSignalQuality ?? true,
    // Frecuencias optimizadas basadas en investigación
    normalFrequency: 880, // Hz - más agudo para normal
    arrhythmiaFrequency: 440, // Hz - más grave para arritmia
    weakFrequency: 330, // Hz - bajito para señal débil
    improvedFrequency: 1200, // Hz - más agudo para señal mejorada
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
   * Actualiza la referencia de calidad de señal
   * @param quality Nuevo valor de calidad (0-100)
   */
  const updateSignalQuality = (quality: number) => {
    signalQualityRef.current = Math.max(0, Math.min(100, quality));
  };

  /**
   * Activa la retroalimentación táctil y auditiva con mejor rendimiento
   * @param type Tipo de retroalimentación: normal, arritmia, señal débil o mejorada
   * @param quality Calidad de señal opcional para adaptación (0-100)
   */
  const trigger = (
    type: HeartbeatFeedbackType = 'normal',
    quality?: number
  ) => {
    if (!enabled || !isReady) return false;
    
    // Actualizar calidad si se proporciona
    if (quality !== undefined) {
      updateSignalQuality(quality);
    }
    
    const now = Date.now();
    // Limitar la frecuencia de activación para evitar sobrecarga
    if (now - lastTriggerTimeRef.current < config.minTriggerIntervalMs) {
      return false;
    }
    
    lastTriggerTimeRef.current = now;
    
    // Adaptar intensidad según calidad de señal
    let intensityMultiplier = 1.0;
    if (config.adaptToSignalQuality) {
      intensityMultiplier = signalQualityRef.current / 100;
    }
    
    // Patrones de vibración mejorados
    if (config.enableVibration && 'vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Vibración simple para latido normal
          navigator.vibrate(50 * config.vibrationIntensity * intensityMultiplier);
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia (pulso doble)
          navigator.vibrate([50, 100, 100].map(v => v * config.vibrationIntensity));
        } else if (type === 'weak') {
          // Patrón de vibración para señal débil (pulsos irregulares)
          navigator.vibrate([20, 30, 20, 80, 20].map(v => v * config.vibrationIntensity));
        } else if (type === 'improved') {
          // Patrón de vibración ascendente para señal mejorada
          navigator.vibrate([30, 20, 40, 20, 50].map(v => v * config.vibrationIntensity));
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
        
        let volume: number;
        let frequency: number;
        let duration: number;
        let waveType: OscillatorType;
        
        switch (type) {
          case 'normal':
            // Tono normal para latido regular - forma de onda cuadrada
            waveType = 'square';
            frequency = config.normalFrequency;
            volume = config.normalVolume * intensityMultiplier;
            duration = 0.08;
            break;
            
          case 'arrhythmia':
            // Tono más grave y duradero para arritmia - forma de onda triangular
            waveType = 'triangle';
            frequency = config.arrhythmiaFrequency;
            volume = config.arrhythmiaVolume;
            duration = 0.2;
            break;
            
          case 'weak':
            // Tono más suave y corto para señal débil - forma de onda sinusoidal
            waveType = 'sine';
            frequency = config.weakFrequency;
            volume = config.weakVolume;
            duration = 0.1;
            break;
            
          case 'improved':
            // Tono alegre para señal mejorada - forma de onda triangular brillante
            waveType = 'triangle';
            frequency = config.improvedFrequency;
            volume = config.improvedVolume;
            duration = 0.15;
            break;
        }
        
        osc.type = waveType;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        
        // Forma de la envolvente ADSR personalizada según tipo
        gain.gain.setValueAtTime(0.001, ctx.currentTime); // Inicio silencioso
        
        // Attack
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
        
        // Decay y Sustain
        if (type === 'arrhythmia') {
          gain.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + 0.1);
        }
        
        // Release
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        console.error('Error generando beep:', e);
      }
    }
    
    return true;
  };

  return { trigger, updateSignalQuality };
}
