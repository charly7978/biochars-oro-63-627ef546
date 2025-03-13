
export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private beepGainNode: GainNode | null = null;
  private audioInitialized = false;
  private humSoundFile: string;
  private oscillator: OscillatorNode | null = null;
  private isLoading = false;

  constructor(soundFile: string) {
    this.humSoundFile = soundFile;
    console.log("AudioHandler: Inicializado con archivo de sonido:", soundFile);
  }

  public async initialize(): Promise<boolean> {
    if (this.audioInitialized) {
      console.log("AudioHandler: Ya inicializado, omitiendo");
      return true;
    }

    if (this.isLoading) {
      console.log("AudioHandler: Ya está cargando, esperando...");
      // Esperar a que termine la carga actual
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.audioInitialized;
    }

    this.isLoading = true;
    console.log("AudioHandler: Comenzando inicialización");

    try {
      // Crear contexto de audio con manejo de excepciones mejorado
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("AudioContext no soportado en este navegador");
        }
        this.audioContext = new AudioContextClass();
        console.log("AudioHandler: AudioContext creado exitosamente");
      } catch (err) {
        console.error("Error crítico creando AudioContext:", err);
        // Fallback a null context pero seguir intentando
        this.audioContext = null;
      }

      // Si tenemos contexto de audio, continuar la inicialización
      if (this.audioContext) {
        // Asegurar que el contexto está resumido
        if (this.audioContext.state === 'suspended') {
          console.log("AudioHandler: Resumiendo contexto de audio suspendido");
          try {
            await this.audioContext.resume();
            console.log("AudioHandler: Contexto de audio resumido exitosamente");
          } catch (resumeErr) {
            console.warn("No se pudo resumir el contexto de audio:", resumeErr);
          }
        }

        // Crear nodo de ganancia para control de volumen
        this.beepGainNode = this.audioContext.createGain();
        this.beepGainNode.gain.value = 1.0; // Volumen máximo
        this.beepGainNode.connect(this.audioContext.destination);
        console.log("AudioHandler: Nodo de ganancia configurado");
      }

      // Configurar sonido de beep alternativo (siempre lo hacemos como respaldo)
      this.createFallbackBeepSound();
      console.log("AudioHandler: Sonido de respaldo configurado");

      // Intentar cargar el archivo de sonido real
      try {
        await this.loadSoundFile();
        console.log("AudioHandler: Archivo de sonido cargado exitosamente");
      } catch (loadErr) {
        console.warn("AudioHandler: Usando sonido de beep generado como respaldo:", loadErr);
      }

      this.audioInitialized = true;
      this.isLoading = false;
      return true;
    } catch (error) {
      console.error("Error crítico inicializando AudioHandler:", error);
      // Marcar como inicializado para no seguir intentando infinitamente
      this.audioInitialized = true;
      this.isLoading = false;
      return false;
    }
  }
  
  private async loadSoundFile(): Promise<void> {
    if (!this.audioContext) {
      throw new Error("No hay contexto de audio disponible");
    }

    try {
      // Probar primero con la importación directa
      console.log("AudioHandler: Intentando cargar archivo de sonido:", this.humSoundFile);
      
      // Intentar con ruta directa primero
      let response = await fetch(this.humSoundFile).catch(() => null);
      
      // Si falla, intentar con ruta relativa
      if (!response || !response.ok) {
        console.log("AudioHandler: Primer intento fallido, probando ruta relativa '/heartbeat-low.mp3'");
        response = await fetch('/heartbeat-low.mp3').catch(() => null);
      }
      
      // Si aún falla, intentar con URL absoluta
      if (!response || !response.ok) {
        console.log("AudioHandler: Segundo intento fallido, probando URL GitHub");
        response = await fetch('https://github.com/lovable-card/sound-assets/raw/main/heartbeat-low.mp3');
      }
      
      if (!response || !response.ok) {
        throw new Error(`No se pudo cargar el archivo de sonido: ${response?.status || 'fetch falló'}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log("AudioHandler: Archivo de audio obtenido, descodificando...", arrayBuffer.byteLength, "bytes");
      
      try {
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log("AudioHandler: Audio descodificado correctamente, duración:", this.audioBuffer.duration);
      } catch (decodeError) {
        console.error("Error descodificando audio:", decodeError);
        throw decodeError;
      }
    } catch (error) {
      console.error("Error cargando archivo de audio:", error);
      throw error;
    }
  }
  
  private createFallbackBeepSound(): void {
    console.log("AudioHandler: Configurando generador de sonido de respaldo");
    this.audioInitialized = true;
  }

  public playBeep(confidence: number, quality: number): void {
    // Siempre intentar inicializar si no está listo
    if (!this.audioInitialized) {
      console.log("AudioHandler: No inicializado, intentando inicializar antes de reproducir");
      this.initialize().catch(err => console.warn("Error inicializando audio en playBeep:", err));
      // Continuar de todos modos para intentar reproducir algo
    }
    
    try {
      // Intentar resumir el contexto si está suspendido
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log("AudioHandler: Resumiendo contexto suspendido en playBeep");
        this.audioContext.resume().catch(err => 
          console.warn("Error resumiendo contexto de audio:", err)
        );
      }
      
      // Calcular volumen con base mejorada
      // Siempre más alto para mejor audibilidad
      const volume = Math.min(1.0, 0.7 + (confidence * 0.3) * (quality / 100));
      
      // Primero intentar reproducir el archivo cargado
      if (this.audioBuffer && this.audioContext && this.beepGainNode) {
        console.log(`AudioHandler: Reproduciendo muestra de audio, volumen: ${volume.toFixed(2)}`);
        
        this.beepGainNode.gain.value = Math.max(0.7, volume);
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.beepGainNode);
        
        // Envolver start() en try-catch por si hay problemas
        try {
          source.start();
          console.log("AudioHandler: Sonido de latido reproducido correctamente");
          return; // Salir si se reprodujo correctamente
        } catch (startErr) {
          console.warn("Error iniciando reproducción de buffer:", startErr);
          // Continuar al fallback
        }
      }
      
      // Si llegamos aquí, usar el sonido de respaldo
      console.log("AudioHandler: Usando sonido de respaldo, volumen:", volume);
      this.playFallbackBeep(Math.max(0.8, volume));
    } catch (error) {
      console.error("Error reproduciendo sonido de latido:", error);
      // Intentar reproducir sonido de respaldo incluso después de error
      try {
        this.playFallbackBeep(0.9); // Volumen muy alto para fallback
      } catch (fallbackErr) {
        console.error("Error crítico reproduciendo sonido de respaldo:", fallbackErr);
      }
    }
  }
  
  private playFallbackBeep(volume: number): void {
    console.log("AudioHandler: Reproduciendo beep de respaldo, volumen:", volume);
    
    if (!this.audioContext) {
      console.warn("AudioHandler: No hay contexto de audio para sonido de respaldo");
      return;
    }
    
    try {
      // Asegurar que el contexto está activo
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Crear oscilador para tono simple
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Usar configuración de beep mejorada - más audible
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(550, this.audioContext.currentTime); // Frecuencia más alta
      
      // Envolvente ADSR simplificada
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(volume * 0.8, this.audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      console.log("AudioHandler: Beep de respaldo reproducido correctamente");
    } catch (error) {
      console.error("Error crítico reproduciendo beep de respaldo:", error);
    }
  }

  public get isInitialized(): boolean {
    return this.audioInitialized;
  }
}
