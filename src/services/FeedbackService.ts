
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
const weakSignalSoundUrl = '/sounds/weak-signal.mp3';
const improvedSignalSoundUrl = '/sounds/improved-signal.mp3';

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

  // Retroalimentación háptica avanzada basada en calidad de señal
  vibrateByQuality: (quality: number) => {
    if ('vibrate' in navigator) {
      try {
        if (quality < 30) {
          // Señal débil: vibración larga y fuerte
          navigator.vibrate([150, 50, 150]);
        } else if (quality < 60) {
          // Señal media: vibración moderada
          navigator.vibrate([80, 40, 80]);
        } else {
          // Señal buena: vibración suave
          navigator.vibrate(50);
        }
      } catch (error) {
        console.error('Error al activar vibración por calidad:', error);
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

  // Retroalimentación háptica sutil para mostrar mejoría en calidad
  vibrateImprovedQuality: () => {
    if ('vibrate' in navigator) {
      try {
        // Patrón ascendente que indica mejoría
        navigator.vibrate([30, 20, 40, 20, 50]);
      } catch (error) {
        console.error('Error al activar vibración de mejora:', error);
      }
    }
  },

  // Retroalimentación sonora
  playSound: (type: 'success' | 'error' | 'notification' | 'heartbeat' | 'weak-signal' | 'improved-signal' = 'notification') => {
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
      case 'weak-signal':
        soundUrl = weakSignalSoundUrl;
        break;
      case 'improved-signal':
        soundUrl = improvedSignalSoundUrl;
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

  // Retroalimentación para arritmia detectada con nivel de confianza
  signalArrhythmia: (count: number, confidence: number = 0.75) => {
    FeedbackService.vibrateArrhythmia();
    FeedbackService.playSound('heartbeat');
    
    const confidenceStr = confidence >= 0.9 ? "alta" : confidence >= 0.7 ? "media" : "baja";
    
    if (count === 1) {
      FeedbackService.showToast(
        '¡Atención!', 
        `Se ha detectado una posible arritmia (confianza ${confidenceStr})`, 
        'warning',
        6000
      );
    } else {
      FeedbackService.showToast(
        'Arritmia detectada', 
        `Se han detectado ${count} posibles arritmias (confianza ${confidenceStr})`, 
        'warning',
        6000
      );
    }
  },

  // Retroalimentación adaptativa para calidad de señal
  signalQualityFeedback: (quality: number, previousQuality: number) => {
    if (quality < 30) {
      // Señal débil
      FeedbackService.vibrateByQuality(quality);
      if (previousQuality >= 30) {
        // Solo notificar si hubo degradación
        FeedbackService.playSound('weak-signal');
        FeedbackService.showToast(
          'Calidad de señal baja', 
          'Intente ajustar su dedo sobre la cámara', 
          'warning',
          3000
        );
      }
    } else if (quality < 60) {
      // Señal media
      if (previousQuality < 30) {
        // Mejoró de baja a media
        FeedbackService.vibrateImprovedQuality();
        FeedbackService.playSound('improved-signal');
        FeedbackService.showToast(
          'Calidad mejorada', 
          'Señal aceptable, mantenga el dedo estable', 
          'default',
          2000
        );
      } else if (previousQuality >= 60) {
        // Degradó de alta a media
        FeedbackService.vibrateByQuality(quality);
        FeedbackService.showToast(
          'Señal degradada', 
          'Intente minimizar el movimiento', 
          'default',
          2000
        );
      }
    } else if (quality >= 60 && previousQuality < 60) {
      // Señal buena y mejoró
      FeedbackService.vibrateImprovedQuality();
      FeedbackService.playSound('improved-signal');
      FeedbackService.showToast(
        'Señal óptima', 
        'Excelente calidad de medición', 
        'success',
        2000
      );
    }
  },

  // Retroalimentación para medición completada
  signalMeasurementComplete: (hasGoodQuality: boolean, confidence: number) => {
    const confidenceStr = confidence >= 0.9 ? "alta" : confidence >= 0.7 ? "media" : "baja";
    
    if (hasGoodQuality) {
      FeedbackService.vibrate([100, 30, 100, 30, 100]);
      FeedbackService.playSound('success');
      FeedbackService.showToast(
        'Medición completada', 
        `Medición finalizada con éxito (confianza ${confidenceStr})`, 
        'success'
      );
    } else {
      FeedbackService.vibrate([100, 50, 100]);
      FeedbackService.playSound('notification');
      FeedbackService.showToast(
        'Medición completada', 
        `Calidad de señal baja (confianza ${confidenceStr}). Intente nuevamente para mayor precisión.`,
        'warning'
      );
    }
  }
};

export default FeedbackService;
