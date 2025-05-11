
/**
 * Servicio para proporcionar retroalimentación al usuario
 * Incluye retroalimentación háptica, sonora y visual
 */

import { toast } from "@/hooks/use-toast";
import AudioService from "./AudioService";

// Configuración de sonidos
const successSoundUrl = '/sounds/success.mp3';
const errorSoundUrl = '/sounds/error.mp3';
const notificationSoundUrl = '/sounds/notification.mp3';
const heartbeatSoundUrl = '/sounds/heartbeat.mp3';

// Caché de sonidos para mejor rendimiento
const soundCache: Record<string, HTMLAudioElement> = {};

const loadSound = (url: string): HTMLAudioElement => {
  if (!soundCache[url]) {
    const audio = new Audio(url);
    audio.load();
    soundCache[url] = audio;
  }
  return soundCache[url];
};

// Asegurar que la vibración esté disponible
const isVibrationSupported = (): boolean => {
  return 'vibrate' in navigator;
};

// Verificar si estamos en un entorno de desarrollo o producción
const isDevelopmentMode = (): boolean => {
  return process.env.NODE_ENV === 'development' || window.location.hostname.includes('localhost');
};

// Instancia de servicio para evitar duplicidad
let instance: typeof FeedbackService | null = null;

export const FeedbackService = {
  // Retroalimentación háptica
  vibrate: (pattern: number | number[] = 200): boolean => {
    if (!isVibrationSupported()) {
      console.warn('Vibración no soportada en este dispositivo');
      return false;
    }
    
    try {
      // En desarrollo, solo simulamos la vibración
      if (isDevelopmentMode()) {
        console.log('Simulando vibración:', pattern);
        return true;
      }
      
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.error('Error al activar vibración:', error);
      return false;
    }
  },

  // Retroalimentación háptica específica para latidos
  vibrateHeartbeat: (isArrhythmia: boolean = false): boolean => {
    if (isArrhythmia) {
      return FeedbackService.vibrate([50, 100, 50, 100]);
    } else {
      return FeedbackService.vibrate(50);
    }
  },

  // Retroalimentación háptica específica para arritmias (NO USAR para latido, solo para alertas globales)
  vibrateArrhythmia: (): boolean => {
    return FeedbackService.vibrate([100, 50, 100, 50, 100, 300, 100]);
  },

  // Retroalimentación sonora
  playSound: (type: 'success' | 'error' | 'notification' | 'heartbeat' = 'notification'): void => {
    let soundUrl;
    
    switch (type) {
      case 'success':
        soundUrl = successSoundUrl;
        break;
      case 'error':
        soundUrl = errorSoundUrl;
        break;
      case 'heartbeat':
        soundUrl = heartbeatSoundUrl;
        break;
      default:
        soundUrl = notificationSoundUrl;
    }
    
    try {
      const audio = loadSound(soundUrl);
      // Reiniciar el audio si ya está reproduciéndose
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error al reproducir audio:', error);
        });
      }
    } catch (error) {
      console.error('Error al reproducir sonido:', error);
    }
  },

  // Métodos específicos para reproducir cada tipo de sonido
  playNotificationSound: (): void => {
    AudioService.playNotificationSound();
  },
  
  playHeartbeatSound: (): void => {
    AudioService.playHeartbeatSound();
  },
  
  playSuccessSound: (): void => {
    AudioService.playSuccessSound();
  },
  
  playErrorSound: (): void => {
    AudioService.playErrorSound();
  },

  // Retroalimentación visual mediante notificaciones toast
  showToast: (
    title: string, 
    message: string, 
    type: 'default' | 'success' | 'error' | 'warning' = 'default',
    duration: number = 5000
  ): void => {
    toast({
      title,
      description: message,
      variant: type === 'error' ? 'destructive' : 'default',
      duration
    });
  },

  // Retroalimentación combinada para acciones exitosas
  signalSuccess: (message: string): void => {
    FeedbackService.vibrate([100, 50, 100]);
    FeedbackService.playSound('success');
    FeedbackService.showToast('¡Éxito!', message, 'success');
  },

  // Retroalimentación combinada para errores
  signalError: (message: string): void => {
    FeedbackService.vibrate(500);
    FeedbackService.playSound('error');
    FeedbackService.showToast('Error', message, 'error');
  },

  // Retroalimentación para arritmia detectada (NO para latido normal)
  signalArrhythmia: (count: number): void => {
    FeedbackService.vibrateArrhythmia();
    FeedbackService.playSound('heartbeat');
    if (count === 1) {
      FeedbackService.showToast(
        '¡Atención!', 
        'Se ha detectado una posible arritmia', 
        'warning',
        6000
      );
    } else {
      FeedbackService.showToast(
        'Arritmia detectada', 
        `Se ha detectado ${count} posibles arritmias`, 
        'warning',
        6000
      );
    }
  },

  // Retroalimentación para medición completada
  signalMeasurementComplete: (hasGoodQuality: boolean): void => {
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

  // Obtener una instancia única del servicio
  getInstance: () => {
    if (!instance) {
      instance = FeedbackService;
    }
    return instance;
  }
};

export default FeedbackService;
