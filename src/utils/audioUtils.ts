
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
      await context.resume();
    }
    
    // Cargar buffer desde caché si ya existe
    let audioBuffer: AudioBuffer;
    const cache = (window as any).__audioBufferCache || {};
    
    if (cache[heartbeatUrl]) {
      audioBuffer = cache[heartbeatUrl];
    } else {
      try {
        // Cargar y decodificar archivo de audio
        const response = await fetch(heartbeatUrl);
        if (!response.ok) {
          throw new Error(`Error al cargar archivo de audio: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await context.decodeAudioData(arrayBuffer);
        
        // Guardar en caché para futuras reproducciones
        if (!(window as any).__audioBufferCache) {
          (window as any).__audioBufferCache = {};
        }
        (window as any).__audioBufferCache[heartbeatUrl] = audioBuffer;
      } catch (fetchError) {
        console.error('Error cargando archivo de audio:', fetchError);
        // Alternativa: Reproducir un sonido sintetizado si no se puede cargar el archivo
        return playFallbackHeartbeatSound(context, volume);
      }
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
    // Intentar reproducir un sonido sintetizado como fallback
    return playFallbackHeartbeatSound(context, volume);
  }
};

/**
 * Genera y reproduce un latido cardíaco sintetizado como fallback
 * cuando no se puede cargar o reproducir el archivo de audio real
 */
const playFallbackHeartbeatSound = (context: AudioContext, volume = 0.9): boolean => {
  try {
    // Crear oscilador para el "lub" (primer sonido del latido)
    const osc1 = context.createOscillator();
    osc1.frequency.value = 80;
    osc1.type = 'sine';
    
    // Crear oscilador para el "dub" (segundo sonido del latido)
    const osc2 = context.createOscillator();
    osc2.frequency.value = 60;
    osc2.type = 'sine';
    
    // Nodos de ganancia para controlar la amplitud
    const gainNode1 = context.createGain();
    const gainNode2 = context.createGain();
    
    // Conectar
    osc1.connect(gainNode1);
    osc2.connect(gainNode2);
    gainNode1.connect(context.destination);
    gainNode2.connect(context.destination);
    
    // Configurar la envolvente de amplitud
    const now = context.currentTime;
    
    // Configuración para el primer sonido (lub)
    gainNode1.gain.setValueAtTime(0, now);
    gainNode1.gain.linearRampToValueAtTime(volume, now + 0.03);
    gainNode1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    // Configuración para el segundo sonido (dub)
    gainNode2.gain.setValueAtTime(0, now + 0.15);
    gainNode2.gain.linearRampToValueAtTime(volume * 0.7, now + 0.18);
    gainNode2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    // Reproducir
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.35);
    
    console.log('Reproduciendo latido cardíaco sintetizado (fallback)');
    
    return true;
  } catch (error) {
    console.error('Error reproduciendo latido sintetizado:', error);
    return false;
  }
};
