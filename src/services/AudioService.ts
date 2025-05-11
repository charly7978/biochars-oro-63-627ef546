/**
 * Servicio de audio para retroalimentación auditiva
 * Proporciona funciones para reproducir sonidos relacionados con latidos cardíacos
 */

// Caché para no cargar múltiples instancias del mismo sonido
const audioCache: Record<string, HTMLAudioElement> = {};

// Configuración de sonidos
const HEARTBEAT_SOUND_PATH = '/sounds/heartbeat.mp3';
const NOTIFICATION_SOUND_PATH = '/sounds/notification.mp3';
const SUCCESS_SOUND_PATH = '/sounds/success.mp3';
const ERROR_SOUND_PATH = '/sounds/error.mp3';

/**
 * Precarga un sonido para mejor rendimiento
 */
const preloadSound = (url: string): HTMLAudioElement => {
  if (!audioCache[url]) {
    const audio = new Audio(url);
    audio.load();
    audioCache[url] = audio;
    console.log(`AudioService: Preloaded sound ${url}`);
  }
  return audioCache[url];
};

// Precargar sonidos comunes
if (typeof window !== 'undefined') {
  setTimeout(() => {
    // Precargar con un pequeño retraso para asegurar que los recursos estén disponibles
    preloadSound(HEARTBEAT_SOUND_PATH);
    preloadSound(NOTIFICATION_SOUND_PATH);
    preloadSound(SUCCESS_SOUND_PATH);
    preloadSound(ERROR_SOUND_PATH);
    console.log("AudioService: All sounds preloaded");
    
    // Test sound at startup
    try {
      const testBeep = new Audio(NOTIFICATION_SOUND_PATH);
      testBeep.volume = 0.3;
      testBeep.play();
      console.log("AudioService: Test beep played");
    } catch (e) {
      console.error("AudioService: Error playing test beep", e);
    }
  }, 1000);
}

export const AudioService = {
  /**
   * Reproduce el sonido de latido cardíaco
   */
  playHeartbeatSound: (): boolean => {
    try {
      console.log("AudioService: Attempting to play heartbeat sound");
      const audio = preloadSound(HEARTBEAT_SOUND_PATH);
      audio.currentTime = 0;
      audio.volume = 0.7;
      
      // Create a separate audio instance for each playback to avoid conflicts
      const tempAudio = new Audio(HEARTBEAT_SOUND_PATH);
      tempAudio.volume = 0.7;
      
      const playPromise = tempAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error reproduciendo sonido de latido:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Error reproduciendo sonido de latido:', error);
      return false;
    }
  },

  /**
   * Reproduce un sonido de notificación general
   */
  playNotificationSound: (): boolean => {
    try {
      console.log("AudioService: Playing notification sound");
      const audio = preloadSound(NOTIFICATION_SOUND_PATH);
      audio.currentTime = 0;
      audio.volume = 0.5;
      
      const tempAudio = new Audio(NOTIFICATION_SOUND_PATH);
      tempAudio.volume = 0.5;
      
      const playPromise = tempAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error reproduciendo sonido de notificación:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Error reproduciendo sonido de notificación:', error);
      return false;
    }
  },

  /**
   * Reproduce un sonido de éxito
   */
  playSuccessSound: (): boolean => {
    try {
      const audio = preloadSound(SUCCESS_SOUND_PATH);
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error reproduciendo sonido de éxito:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Error reproduciendo sonido de éxito:', error);
      return false;
    }
  },

  /**
   * Reproduce un sonido de error
   */
  playErrorSound: (): boolean => {
    try {
      const audio = preloadSound(ERROR_SOUND_PATH);
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error reproduciendo sonido de error:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Error reproduciendo sonido de error:', error);
      return false;
    }
  },

  /**
   * Inicializa el contexto de audio y reproduce un sonido de prueba
   */
  initializeAudio: async (): Promise<boolean> => {
    try {
      console.log("AudioService: Initializing audio context");
      
      // Create audio context to unlock audio on iOS/Safari
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioContext = new AudioContext();
        
        // Create and play a silent buffer to unlock audio
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        // Play a test notification after a short delay
        setTimeout(() => {
          AudioService.playNotificationSound();
        }, 300);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing audio:', error);
      return false;
    }
  }
};

export default AudioService;
