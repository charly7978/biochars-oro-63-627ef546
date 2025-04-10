
/**
 * Servicio para proporcionar retroalimentación al usuario
 * Incluye retroalimentación háptica, sonora y visual sincronizada
 */

import { toast } from "@/hooks/use-toast";

// Configuración de sonidos
const successSoundUrl = '/sounds/success.mp3';
const errorSoundUrl = '/sounds/error.mp3';
const notificationSoundUrl = '/sounds/notification.mp3';
const heartbeatSoundUrl = '/sounds/heartbeat.mp3';

// Caché de sonidos para mejor rendimiento
const soundCache: Record<string, HTMLAudioElement> = {};

// Control de tiempos para evitar sobrecarga de retroalimentación
const lastFeedbackTime: Record<string, number> = {
  vibration: 0,
  sound: 0,
  toast: 0,
  arrhythmia: 0
};

const MIN_INTERVALS = {
  vibration: 300,  // ms entre vibraciones
  sound: 300,      // ms entre sonidos
  toast: 5000,     // ms entre notificaciones toast
  arrhythmia: 15000 // ms entre notificaciones de arritmia
};

const loadSound = (url: string): HTMLAudioElement => {
  if (!soundCache[url]) {
    const audio = new Audio(url);
    audio.load();
    soundCache[url] = audio;
  }
  return soundCache[url];
};

export const FeedbackService = {
  // Retroalimentación háptica sincronizada
  vibrate: (pattern: number | number[] = 200) => {
    const now = Date.now();
    if (now - lastFeedbackTime.vibration < MIN_INTERVALS.vibration) return false;
    
    lastFeedbackTime.vibration = now;
    
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
        return true;
      } catch (error) {
        console.error('Error al activar vibración:', error);
        return false;
      }
    }
    return false;
  },

  // Retroalimentación háptica específica para arritmias
  vibrateArrhythmia: () => {
    const now = Date.now();
    if (now - lastFeedbackTime.vibration < MIN_INTERVALS.vibration) return false;
    
    lastFeedbackTime.vibration = now;
    
    if ('vibrate' in navigator) {
      try {
        // Patrón más distintivo para arritmias (triple pulso con pausa)
        navigator.vibrate([100, 50, 100, 50, 100, 300, 100]);
        return true;
      } catch (error) {
        console.error('Error al activar vibración de arritmia:', error);
        return false;
      }
    }
    return false;
  },

  // Retroalimentación sonora con control de frecuencia
  playSound: (type: 'success' | 'error' | 'notification' | 'heartbeat' = 'notification') => {
    const now = Date.now();
    if (now - lastFeedbackTime.sound < MIN_INTERVALS.sound) return false;
    
    lastFeedbackTime.sound = now;
    
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
    const now = Date.now();
    if (now - lastFeedbackTime.toast < MIN_INTERVALS.toast) return false;
    
    lastFeedbackTime.toast = now;
    
    toast({
      title,
      description: message,
      variant: type === 'error' ? 'destructive' : 'default',
      duration
    });
    
    return true;
  },

  // Retroalimentación combinada para acciones exitosas
  signalSuccess: (message: string) => {
    const vibrateSuccess = FeedbackService.vibrate([100, 50, 100]);
    const soundSuccess = FeedbackService.playSound('success');
    const toastSuccess = FeedbackService.showToast('¡Éxito!', message, 'success');
    
    return vibrateSuccess || soundSuccess || toastSuccess;
  },

  // Retroalimentación combinada para errores
  signalError: (message: string) => {
    const vibrateSuccess = FeedbackService.vibrate(500);
    const soundSuccess = FeedbackService.playSound('error');
    const toastSuccess = FeedbackService.showToast('Error', message, 'error');
    
    return vibrateSuccess || soundSuccess || toastSuccess;
  },

  // Retroalimentación para arritmia detectada con control de frecuencia
  signalArrhythmia: (count: number) => {
    const now = Date.now();
    if (now - lastFeedbackTime.arrhythmia < MIN_INTERVALS.arrhythmia) return false;
    
    lastFeedbackTime.arrhythmia = now;
    
    const vibrateSuccess = FeedbackService.vibrateArrhythmia();
    const soundSuccess = FeedbackService.playSound('heartbeat');
    
    let toastSuccess = false;
    if (count === 1) {
      toastSuccess = FeedbackService.showToast(
        '¡Atención!', 
        'Se ha detectado una posible arritmia', 
        'warning',
        6000
      );
    } else {
      toastSuccess = FeedbackService.showToast(
        'Arritmia detectada', 
        `Se ha detectado ${count} posibles arritmias`, 
        'warning',
        6000
      );
    }
    
    console.log("FeedbackService: Retroalimentación de arritmia", {
      count,
      vibración: vibrateSuccess,
      sonido: soundSuccess,
      notificación: toastSuccess,
      timestamp: new Date(now).toISOString()
    });
    
    return vibrateSuccess || soundSuccess || toastSuccess;
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
    
    return true;
  }
};

export default FeedbackService;
