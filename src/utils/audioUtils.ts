
/**
 * Utilidades para el manejo de audio en la aplicación
 */

// Caché de archivos de audio para mejorar el rendimiento
const audioCache: Record<string, HTMLAudioElement> = {};

/**
 * Carga y prepara un archivo de audio para su reproducción
 * @param url URL del archivo de audio a cargar
 * @returns Elemento de audio precargado
 */
export const loadAudioFile = (url: string): HTMLAudioElement => {
  if (!audioCache[url]) {
    const audio = new Audio(url);
    audio.load();
    audioCache[url] = audio;
  }
  return audioCache[url];
};

/**
 * Reproduce un archivo de audio con el volumen especificado
 * @param url URL del archivo de audio a reproducir
 * @param volume Volumen de reproducción (0-1)
 * @returns Promise que se resuelve cuando comienza la reproducción
 */
export const playAudio = async (url: string, volume = 1.0): Promise<boolean> => {
  try {
    const audio = loadAudioFile(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    
    // Reiniciar el audio si ya está reproduciéndose
    audio.currentTime = 0;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      await playPromise;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error reproduciendo audio:', error);
    return false;
  }
};

/**
 * Crea y reproduce un sonido de latido cardíaco usando Web Audio API
 * para máximo control y baja latencia
 * @param context Contexto de audio
 * @param heartbeatUrl URL del archivo de sonido de latido cardíaco
 * @param volume Volumen (0-1)
 * @returns Promise que se resuelve cuando comienza la reproducción
 */
export const playHeartbeatSound = async (
  context: AudioContext,
  heartbeatUrl: string = '/sounds/heartbeat.mp3',
  volume = 0.9
): Promise<boolean> => {
  try {
    if (!context || context.state !== 'running') {
      console.warn('AudioContext no está listo o activo');
      return false;
    }
    
    // Cargar buffer desde caché si ya existe
    let audioBuffer: AudioBuffer;
    const cache = (window as any).__audioBufferCache || {};
    
    if (cache[heartbeatUrl]) {
      audioBuffer = cache[heartbeatUrl];
    } else {
      // Cargar y decodificar archivo de audio
      const response = await fetch(heartbeatUrl);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await context.decodeAudioData(arrayBuffer);
      
      // Guardar en caché para futuras reproducciones
      if (!(window as any).__audioBufferCache) {
        (window as any).__audioBufferCache = {};
      }
      (window as any).__audioBufferCache[heartbeatUrl] = audioBuffer;
    }
    
    // Crear nodo de fuente y ganancia
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    
    // Configurar nodos
    source.buffer = audioBuffer;
    gainNode.gain.value = volume;
    
    // Conectar nodos
    source.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Reproducir
    source.start(0);
    
    console.log('Reproduciendo latido cardíaco real:', {
      url: heartbeatUrl,
      volumen: volume,
      duracion: audioBuffer.duration,
      tiempo: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error reproduciendo sonido de latido cardíaco:', error);
    return false;
  }
};
