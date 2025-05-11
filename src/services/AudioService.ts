
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Servicio de audio optimizado para feedback PPG
 */
export class AudioService {
  private static instance: AudioService;
  private audioContext: AudioContext | null = null;
  private audioEnabled: boolean = true;
  private lastPlayTime: number = 0;
  private MIN_PLAY_INTERVAL_MS: number = 350; // Intervalo mínimo entre reproducciones
  
  private soundCache: {[key: string]: AudioBuffer} = {};
  
  private constructor() {
    this.initAudioContext();
  }
  
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }
  
  private async initAudioContext(): Promise<void> {
    try {
      if (typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext();
        
        // Pre-compilar sonidos comunes para mejor rendimiento
        await this.preloadSounds();
        
        console.log("AudioService: AudioContext inicializado correctamente");
      } else {
        console.warn("AudioService: AudioContext no disponible en este dispositivo");
        this.audioEnabled = false;
      }
    } catch (error) {
      console.error("AudioService: Error al inicializar AudioContext", error);
      this.audioEnabled = false;
    }
  }
  
  private async preloadSounds(): Promise<void> {
    try {
      // Precargar sonidos comunes
      if (this.audioContext) {
        this.soundCache['heartbeat'] = await this.createHeartbeatSound();
        this.soundCache['arrhythmia'] = await this.createArrhythmiaSound();
        console.log("AudioService: Sonidos precargados correctamente");
      }
    } catch (error) {
      console.error("AudioService: Error al precargar sonidos", error);
    }
  }
  
  public enableAudio(): void {
    this.audioEnabled = true;
    this.resumeAudioContext();
  }
  
  public disableAudio(): void {
    this.audioEnabled = false;
  }
  
  public isAudioEnabled(): boolean {
    return this.audioEnabled;
  }
  
  private async resumeAudioContext(): Promise<void> {
    try {
      if (this.audioContext && this.audioContext.state !== 'running') {
        await this.audioContext.resume();
        console.log("AudioService: AudioContext resumido correctamente");
      }
    } catch (error) {
      console.error("AudioService: Error al resumir AudioContext", error);
    }
  }
  
  /**
   * Reproduce un beep para el latido cardíaco
   * @param isArrhythmia Indica si se trata de una arritmia
   * @returns true si el beep se reprodujo correctamente
   */
  public async playHeartbeatBeep(isArrhythmia: boolean = false): Promise<boolean> {
    const now = Date.now();
    
    // Evitar reproducciones demasiado frecuentes
    if (now - this.lastPlayTime < this.MIN_PLAY_INTERVAL_MS) {
      return false;
    }
    
    if (!this.audioEnabled || !this.audioContext) {
      return false;
    }
    
    try {
      await this.resumeAudioContext();
      
      // Usar sonidos precargados
      const soundType = isArrhythmia ? 'arrhythmia' : 'heartbeat';
      
      if (this.soundCache[soundType]) {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundCache[soundType];
        source.connect(this.audioContext.destination);
        source.start();
        this.lastPlayTime = now;
        return true;
      } else {
        // Fallback si el sonido no está precargado
        return await this.playSimpleTone(
          isArrhythmia ? 440 : 880,
          isArrhythmia ? 120 : 80,
          isArrhythmia ? 0.7 : 0.5
        );
      }
    } catch (error) {
      console.error("AudioService: Error al reproducir beep", error);
      return false;
    }
  }
  
  /**
   * Reproduce un sonido de notificación
   * @param type Tipo de notificación
   * @returns true si el sonido se reprodujo correctamente
   */
  public async playNotificationSound(type: 'success' | 'error' | 'warning' = 'success'): Promise<boolean> {
    if (!this.audioEnabled || !this.audioContext) {
      return false;
    }
    
    try {
      await this.resumeAudioContext();
      
      let frequency: number;
      let duration: number;
      let volume: number;
      
      switch (type) {
        case 'success':
          frequency = 1200;
          duration = 150;
          volume = 0.3;
          break;
        case 'error':
          frequency = 300;
          duration = 300;
          volume = 0.4;
          break;
        case 'warning':
          frequency = 600;
          duration = 200;
          volume = 0.35;
          break;
      }
      
      return await this.playSimpleTone(frequency, duration, volume);
    } catch (error) {
      console.error("AudioService: Error al reproducir notificación", error);
      return false;
    }
  }
  
  /**
   * Reproduce un tono simple
   */
  private async playSimpleTone(frequency: number, duration: number, volume: number): Promise<boolean> {
    if (!this.audioContext) return false;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      
      gainNode.gain.value = volume;
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      
      gainNode.gain.exponentialRampToValueAtTime(
        0.01, 
        this.audioContext.currentTime + duration / 1000
      );
      
      setTimeout(() => {
        oscillator.stop();
      }, duration);
      
      this.lastPlayTime = Date.now();
      return true;
    } catch (error) {
      console.error("AudioService: Error al reproducir tono simple", error);
      return false;
    }
  }
  
  /**
   * Crea un sonido de latido cardíaco
   */
  private async createHeartbeatSound(): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error("AudioContext no disponible");
    }
    
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.08; // 80ms
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Crear forma de onda de latido más realista
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const normalizedT = t / duration;
      
      // Envolvente con ataque rápido y caída más lenta
      let envelope;
      if (normalizedT < 0.1) {
        envelope = normalizedT * 10; // Ataque rápido
      } else {
        envelope = Math.pow(1 - (normalizedT - 0.1) / 0.9, 1.5); // Caída gradual
      }
      
      // Frecuencia base más alta para sonido de latido
      const frequency = 880;
      const value = Math.sin(2 * Math.PI * frequency * t) * envelope;
      
      data[i] = value * 0.5; // Volumen moderado
    }
    
    return buffer;
  }
  
  /**
   * Crea un sonido de arritmia
   */
  private async createArrhythmiaSound(): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error("AudioContext no disponible");
    }
    
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.12; // 120ms
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Sonido distintivo para arritmias
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const normalizedT = t / duration;
      
      // Envolvente con modulación
      const envelope = Math.sin(normalizedT * Math.PI) * (1 - Math.pow(normalizedT, 2));
      
      // Frecuencia más baja y modulada para arritmia
      const baseFreq = 440;
      const modFreq = 30;
      const freqModulation = 50 * Math.sin(2 * Math.PI * modFreq * t);
      const value = Math.sin(2 * Math.PI * (baseFreq + freqModulation) * t) * envelope;
      
      data[i] = value * 0.6; // Volumen ligeramente más alto para alertar
    }
    
    return buffer;
  }
}

export default AudioService;
