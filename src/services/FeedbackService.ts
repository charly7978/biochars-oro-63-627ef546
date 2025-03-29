
/**
 * Servicio para proporcionar retroalimentación al usuario
 * Incluye retroalimentación háptica, sonora y visual
 */

import { toast } from "@/hooks/use-toast";
import { playAudio, playHeartbeatSound } from "../utils/audioUtils";

// Configuración de sonidos
const successSoundUrl = '/sounds/success.mp3';
const errorSoundUrl = '/sounds/error.mp3';
const notificationSoundUrl = '/sounds/notification.mp3';
const heartbeatSoundUrl = '/sounds/heartbeat.mp3';

// Caché de sonidos para mejor rendimiento
const soundCache: Record<string, HTMLAudioElement> = {};
// Contexto de audio para la reproducción de alta calidad
let audioContext: AudioContext | null = null;

const loadSound = (url: string): HTMLAudioElement => {
  if (!soundCache[url]) {
    const audio = new Audio(url);
    audio.load();
    soundCache[url] = audio;
  }
  return soundCache[url];
};

// Inicializar contexto de audio bajo demanda
const getAudioContext = async (): Promise<AudioContext | null> => {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    try {
      audioContext = new AudioContext({ latencyHint: 'interactive' });
      if (audioContext.state !== 'running') {
        await audioContext.resume();
        console.log("AudioContext resumed successfully:", audioContext.state);
      }
      return audioContext;
    } catch (error) {
      console.error('Error al inicializar AudioContext:', error);
      return null;
    }
  }
  return audioContext;
};

export const FeedbackService = {
  // Retroalimentación háptica
  vibrate: (pattern: number | number[] = 200) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        console.error('Error al activar vibración:', error);
      }
    }
  },

  // Retroalimentación sonora
  playSound: async (type: 'success' | 'error' | 'notification' | 'heartbeat' = 'notification', volume = 1.0) => {
    let soundUrl;
    
    switch (type) {
      case 'success':
        soundUrl = successSoundUrl;
        break;
      case 'error':
        soundUrl = errorSoundUrl;
        break;
      case 'heartbeat':
        // Para latidos cardíacos, usar Web Audio API para mejor calidad
        try {
          const context = await getAudioContext();
          if (context) {
            await playHeartbeatSound(context, heartbeatSoundUrl, volume);
            return;
          }
        } catch (err) {
          console.error('Error reproduciendo latido cardíaco de alta calidad:', err);
          console.log("Usando fallback a Audio API estándar para heartbeat");
          // Fallback a Audio API estándar
        }
        
        soundUrl = heartbeatSoundUrl;
        break;
      default:
        soundUrl = notificationSoundUrl;
    }
    
    try {
      await playAudio(soundUrl, volume);
    } catch (error) {
      console.error('Error al reproducir sonido:', error);
    }
  },

  // Retroalimentación visual mediante notificaciones toast
  showToast: (
    title: string, 
    message: string, 
    type: 'default' | 'success' | 'error' | 'warning' = 'default',
    duration: number = 5000
  ) => {
    toast({
      title,
      description: message,
      variant: type === 'error' ? 'destructive' : 'default',
      duration
    });
  },

  // Retroalimentación combinada para acciones exitosas
  signalSuccess: (message: string) => {
    FeedbackService.vibrate([100, 50, 100]);
    FeedbackService.playSound('success');
    FeedbackService.showToast('¡Éxito!', message, 'success');
  },

  // Retroalimentación combinada para errores
  signalError: (message: string) => {
    FeedbackService.vibrate(500);
    FeedbackService.playSound('error');
    FeedbackService.showToast('Error', message, 'error');
  },

  // Retroalimentación para medición completada
  signalMeasurementComplete: (hasGoodQuality: boolean) => {
    if (hasGoodQuality) {
      FeedbackService.vibrate([100, 30, 100, 30, 100]);
      FeedbackService.playSound('success');
      FeedbackService.showToast(
        'Medición completada', 
        'Medición finalizada con éxito', 
        'success'
      );
    } else {
      FeedbackService.vibrate([100, 50, 100]);
      FeedbackService.playSound('notification');
      FeedbackService.showToast(
        'Medición completada', 
        'Calidad de señal baja. Intente nuevamente para mayor precisión.',
        'warning'
      );
    }
  },

  // Método específico para reproducir sonido de latido cardíaco
  playHeartbeat: async (volume = 0.9) => {
    try {
      // Activar vibración sutil para simular latido
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
      
      // Reproducir sonido de latido de alta calidad
      const context = await getAudioContext();
      if (context) {
        // Asegurarse de que el contexto está activo
        if (context.state !== 'running') {
          await context.resume();
          console.log("AudioContext resumed for heartbeat:", context.state);
        }
        
        const result = await playHeartbeatSound(context, heartbeatSoundUrl, volume);
        console.log("Resultado de playHeartbeatSound:", result);
        return result;
      } else {
        // Fallback a HTML Audio API
        console.log("Sin AudioContext, usando playSound para heartbeat");
        FeedbackService.playSound('heartbeat', volume);
        return true;
      }
    } catch (error) {
      console.error('Error reproduciendo latido cardíaco:', error);
      // Último recurso: Audio estándar
      try {
        await playAudio(heartbeatSoundUrl, volume);
        return true;
      } catch (e) {
        console.error('Error en fallback final de audio:', e);
        return false;
      }
    }
  },
  
  // Test de audio para verificar que funciona
  testAudio: async () => {
    console.log("Prueba de audio iniciada");
    try {
      const context = await getAudioContext();
      if (!context) {
        console.error("No se pudo obtener AudioContext");
        return false;
      }
      
      // Verificar y resumir el contexto si es necesario
      if (context.state !== 'running') {
        console.log("Resumiendo AudioContext desde estado:", context.state);
        await context.resume();
        console.log("AudioContext ahora está:", context.state);
      }
      
      // Generar un beep de prueba
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, context.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        console.log("Prueba de audio completada");
      }, 500);
      
      return true;
    } catch (error) {
      console.error("Error en prueba de audio:", error);
      return false;
    }
  }
};

export default FeedbackService;
