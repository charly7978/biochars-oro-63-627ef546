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
  // vibrate: (pattern: number | number[] = 200) => {},
  // vibrateArrhythmia: () => {},

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
      
      // Volumen completo para garantizar que se escuche
      audio.volume = 1.0;
      
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

  // Retroalimentación para arritmia detectada
  // signalArrhythmia: (count: number) => {
  //   FeedbackService.playSound('heartbeat');
  //   if (count === 1) {
  //     FeedbackService.showToast(
  //       '¡Atención!', 
  //       'Se ha detectado una posible arritmia', 
  //       'warning',
  //       6000
  //     );
  //   } else {
  //     FeedbackService.showToast(
  //       'Arritmia detectada', 
  //       `Se han detectado ${count} posibles arritmias`, 
  //       'warning',
  //       6000
  //     );
  //   }
  // },

  // Retroalimentación para medición completada
  // signalMeasurementComplete: (hasGoodQuality: boolean) => {
  //   FeedbackService.playSound(hasGoodQuality ? 'success' : 'notification');
  //   FeedbackService.showToast(
  //     'Medición completada', 
  //     hasGoodQuality ? 'Medición finalizada con éxito' : 'Calidad de señal baja. Intente nuevamente para mayor precisión.',
  //     hasGoodQuality ? 'success' : 'warning'
  //   );
  // },

  // signalSuccess: (message: string) => {
  //   FeedbackService.playSound('success');
  //   FeedbackService.showToast('¡Éxito!', message, 'success');
  // },

  // signalError: (message: string) => {
  //   FeedbackService.playSound('error');
  //   FeedbackService.showToast('Error', message, 'error');
  // },
};

export default FeedbackService;
