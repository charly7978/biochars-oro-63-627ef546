
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
  }
  return audioCache[url];
};

// Precargar sonidos comunes
if (typeof window !== 'undefined') {
  preloadSound(HEARTBEAT_SOUND_PATH);
  preloadSound(NOTIFICATION_SOUND_PATH);
}

export const AudioService = {
  /**
   * Reproduce el sonido de latido cardíaco
   */
  playHeartbeatSound: (): boolean => {
    try {
      const audio = preloadSound(HEARTBEAT_SOUND_PATH);
      audio.currentTime = 0;
      const playPromise = audio.play();
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
      const audio = preloadSound(NOTIFICATION_SOUND_PATH);
      audio.currentTime = 0;
      const playPromise = audio.play();
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
  }
};

export default AudioService;
