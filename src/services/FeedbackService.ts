
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

  // Retroalimentación háptica específica para arritmias
  vibrateArrhythmia: () => {
    if ('vibrate' in navigator) {
      try {
        // Patrón más distintivo para arritmias (triple pulso con pausa)
        navigator.vibrate([100, 50, 100, 50, 100, 300, 100]);
      } catch (error) {
        console.error('Error al activar vibración de arritmia:', error);
      }
    }
  },

  // Retroalimentación sonora
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

  // Retroalimentación para arritmia detectada
  signalArrhythmia: (count: number) => {
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
