
/**
 * Servicio para proporcionar retroalimentación al usuario
 * Incluye retroalimentación háptica, sonora y visual
 */

import { toast } from "@/hooks/use-toast";

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

// Variable para controlar la disponibilidad de vibración
let vibrationAvailable = 'vibrate' in navigator;
let lastVibrationAttempt = 0;
const RETRY_VIBRATION_INTERVAL = 10000; // 10 segundos

export const FeedbackService = {
  // Retroalimentación háptica con manejo mejorado de errores
  vibrate: (pattern: number | number[] = 200) => {
    const now = Date.now();
    
    // Si la vibración no está disponible, intentar de nuevo después de un intervalo
    if (!vibrationAvailable && now - lastVibrationAttempt > RETRY_VIBRATION_INTERVAL) {
      vibrationAvailable = 'vibrate' in navigator;
      lastVibrationAttempt = now;
      console.log("Reintentando comprobar disponibilidad de vibración:", vibrationAvailable);
    }
    
    if (vibrationAvailable) {
      try {
        navigator.vibrate(pattern);
        console.log(`Vibración ejecutada: ${typeof pattern === 'number' ? pattern : pattern.join('-')}ms`);
        return true;
      } catch (error) {
        console.error('Error al activar vibración:', error);
        vibrationAvailable = false;
        lastVibrationAttempt = now;
        return false;
      }
    }
    return false;
  },

  // Retroalimentación háptica específica para arritmias con patrones más perceptibles
  vibrateArrhythmia: () => {
    // Patrón más distintivo para arritmias (triple pulso con pausa)
    return FeedbackService.vibrate([100, 30, 100, 30, 100, 200, 150]);
  },

  // Retroalimentación sonora con manejo mejorado
  playSound: (type: 'success' | 'error' | 'notification' | 'heartbeat' = 'notification') => {
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
      
      // Detener reproducción actual si existe
      audio.pause();
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error al reproducir audio:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Error al reproducir sonido:', error);
      return false;
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

  // Retroalimentación para arritmia detectada con patrón de vibración mejorado
  signalArrhythmia: (count: number) => {
    FeedbackService.vibrateArrhythmia();
    
    setTimeout(() => {
      FeedbackService.playSound('heartbeat');
    }, 100); // Pequeño retraso para no solapar con vibración
    
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
        `Se han detectado ${count} posibles arritmias`, 
        'warning',
        6000
      );
    }
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
  }
};

export default FeedbackService;
