
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

// Audio context para reproducción de sonidos cuando falla HTML Audio
let audioContext: AudioContext | null = null;

const loadSound = (url: string): HTMLAudioElement => {
  if (!soundCache[url]) {
    const audio = new Audio(url);
    audio.load();
    soundCache[url] = audio;
  }
  return soundCache[url];
};

// Inicializar audio context una vez
const getAudioContext = (): AudioContext | null => {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    try {
      audioContext = new AudioContext({ latencyHint: 'interactive' });
      if (audioContext.state !== 'running') {
        audioContext.resume().catch(err => {
          console.error('Error resumiendo contexto de audio:', err);
        });
      }
    } catch (err) {
      console.error('Error creando contexto de audio:', err);
    }
  }
  return audioContext;
};

// Reproducir sonido como fallback usando Web Audio API
const playFallbackSound = (frequency: number = 440, duration: number = 200, type: OscillatorType = 'sine'): void => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (duration / 1000));
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start();
    oscillator.stop(ctx.currentTime + (duration / 1000) + 0.05);
    
    console.log("FeedbackService: Reproducción fallback exitosa:", { frequency, duration });
  } catch (err) {
    console.error('Error en reproducción fallback:', err);
  }
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

  // Retroalimentación sonora mejorada con fallback
  playSound: (type: 'success' | 'error' | 'notification' | 'heartbeat' = 'notification') => {
    let soundUrl;
    let fallbackFrequency = 440;
    let fallbackType: OscillatorType = 'sine';
    
    switch (type) {
      case 'success':
        soundUrl = successSoundUrl;
        fallbackFrequency = 880;
        fallbackType = 'sine';
        break;
      case 'error':
        soundUrl = errorSoundUrl;
        fallbackFrequency = 220;
        fallbackType = 'triangle';
        break;
      case 'heartbeat':
        soundUrl = heartbeatSoundUrl;
        fallbackFrequency = 660;
        fallbackType = 'sine';
        break;
      default:
        soundUrl = notificationSoundUrl;
        fallbackFrequency = 440;
        fallbackType = 'sine';
    }
    
    try {
      const audio = loadSound(soundUrl);
      // Reiniciar el audio si ya está reproduciéndose
      audio.currentTime = 0;
      audio.volume = 0.95;
      
      console.log("FeedbackService: Intentando reproducir:", type);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error al reproducir audio, usando fallback:', error);
          // Fallback a Audio Web API
          playFallbackSound(
            fallbackFrequency, 
            type === 'heartbeat' ? 80 : 200, 
            fallbackType
          );
        });
      }
    } catch (error) {
      console.error('Error al reproducir sonido, usando fallback:', error);
      // Fallback a Audio Web API
      playFallbackSound(
        fallbackFrequency, 
        type === 'heartbeat' ? 80 : 200, 
        fallbackType
      );
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

// Inicializar contexto de audio al cargar el servicio
(() => {
  try {
    // Precargar todos los sonidos
    loadSound(successSoundUrl);
    loadSound(errorSoundUrl);
    loadSound(notificationSoundUrl);
    loadSound(heartbeatSoundUrl);
    
    // Inicializar audio context
    getAudioContext();
    
    // Reproducir un sonido silencioso para activar el contexto
    if (audioContext && audioContext.state === 'running') {
      const silentOsc = audioContext.createOscillator();
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0.01;
      silentOsc.connect(silentGain);
      silentGain.connect(audioContext.destination);
      silentOsc.start();
      silentOsc.stop(audioContext.currentTime + 0.01);
    }
    
    console.log("FeedbackService: Inicializado correctamente");
  } catch (err) {
    console.error("Error inicializando FeedbackService:", err);
  }
})();

export default FeedbackService;
