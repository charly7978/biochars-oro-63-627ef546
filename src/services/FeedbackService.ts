
/**
 * Servicio para proporcionar retroalimentación al usuario
 * Incluye retroalimentación háptica, sonora y visual
 */

import { toast } from "@/hooks/use-toast";
import { ArrhythmiaEvent } from "../modules/heart-beat/ArrhythmiaDetector";

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
        console.log(`🔆 Activando vibración con patrón:`, pattern);
        navigator.vibrate(pattern);
      } catch (error) {
        console.error('Error al activar vibración:', error);
      }
    } else {
      console.warn('API de vibración no disponible en este dispositivo');
    }
  },

  // Retroalimentación háptica específica para arritmias
  vibrateArrhythmia: () => {
    if ('vibrate' in navigator) {
      try {
        // Patrón más distintivo para arritmias (triple pulso con pausa)
        const pattern = [100, 50, 100, 50, 100, 300, 100];
        console.log(`⚠️ Activando vibración de arritmia con patrón:`, pattern);
        navigator.vibrate(pattern);
      } catch (error) {
        console.error('Error al activar vibración de arritmia:', error);
      }
    } else {
      console.warn('API de vibración no disponible en este dispositivo');
    }
  },

  // Retroalimentación háptica específica por tipo de arritmia
  vibrateSpecificArrhythmia: (type: ArrhythmiaEvent['type']) => {
    if ('vibrate' in navigator) {
      try {
        let pattern: number[];
        
        switch (type) {
          case 'bradycardia':
            // Patrón lento y fuerte para bradicardia
            pattern = [150, 100, 150];
            break;
          case 'tachycardia':
            // Patrón rápido para taquicardia
            pattern = [50, 30, 50, 30, 50, 30, 50];
            break;
          case 'extrasystole':
            // Patrón con un pulso extra para extrasístole
            pattern = [100, 50, 50, 150, 100];
            break;
          case 'irregular':
            // Patrón irregular para ritmo irregular
            pattern = [70, 120, 40, 90, 140, 60];
            break;
          default:
            pattern = [100, 50, 100, 50, 100];
        }
        
        console.log(`⚠️ Activando vibración de ${type} con patrón:`, pattern);
        navigator.vibrate(pattern);
      } catch (error) {
        console.error(`Error al activar vibración de ${type}:`, error);
      }
    } else {
      console.warn('API de vibración no disponible en este dispositivo');
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

  // Retroalimentación para tipos específicos de arritmia
  signalSpecificArrhythmia: (event: ArrhythmiaEvent) => {
    FeedbackService.vibrateSpecificArrhythmia(event.type);
    FeedbackService.playSound('heartbeat');
    
    let title = '¡Atención!';
    let message = '';
    
    switch (event.type) {
      case 'bradycardia':
        message = `Ritmo cardíaco lento detectado: ${Math.round(event.bpm)} BPM`;
        break;
      case 'tachycardia':
        message = `Ritmo cardíaco acelerado detectado: ${Math.round(event.bpm)} BPM`;
        break;
      case 'irregular':
        message = 'Se ha detectado un ritmo cardíaco irregular';
        break;
      case 'extrasystole':
        message = 'Se ha detectado un latido prematuro (extrasístole)';
        break;
    }
    
    FeedbackService.showToast(
      title, 
      message, 
      'warning',
      6000
    );
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
