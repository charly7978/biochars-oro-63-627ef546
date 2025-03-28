
/**
 * Procesador de sonido para latidos cardíacos
 */

// Clase para procesamiento de audio
export class BeepProcessor {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isBeeping: boolean = false;
  private beepTimeout: number | null = null;
  
  constructor(private readonly frequency: number = 667, private readonly duration: number = 70) {}
  
  /**
   * Inicializa el contexto de audio (debe ser llamado después de interacción del usuario)
   */
  public initialize(): void {
    if (!this.audioContext && typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("BeepProcessor: Audio context initialized");
      } catch (error) {
        console.error("BeepProcessor: Failed to initialize audio context", error);
      }
    }
  }
  
  /**
   * Reproduce un beep para representar un latido
   */
  public playBeep(intensity: number = 1.0): void {
    if (!this.audioContext || this.isBeeping) return;
    
    try {
      // Crear nodos de audio
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();
      
      // Configurar oscilador
      this.oscillator.type = 'sine';
      this.oscillator.frequency.value = this.frequency;
      
      // Configurar volumen
      const volume = Math.min(0.3, Math.max(0.05, intensity * 0.3));
      this.gainNode.gain.value = 0;
      
      // Conectar nodos
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      // Iniciar oscilador
      this.oscillator.start();
      
      // Aplicar envelope para suavizar inicio/fin
      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(
        volume, 
        this.audioContext.currentTime + 0.01
      );
      this.gainNode.gain.linearRampToValueAtTime(
        0, 
        this.audioContext.currentTime + (this.duration / 1000)
      );
      
      // Marcar como activo
      this.isBeeping = true;
      
      // Detener después de duración
      this.beepTimeout = window.setTimeout(() => {
        this.stopBeep();
      }, this.duration);
      
    } catch (error) {
      console.error("BeepProcessor: Error playing beep", error);
      this.stopBeep();
    }
  }
  
  /**
   * Detiene el beep en curso
   */
  public stopBeep(): void {
    if (this.beepTimeout) {
      clearTimeout(this.beepTimeout);
      this.beepTimeout = null;
    }
    
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      } catch (error) {
        console.error("BeepProcessor: Error stopping oscillator", error);
      }
    }
    
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
        this.gainNode = null;
      } catch (error) {
        console.error("BeepProcessor: Error disconnecting gain node", error);
      }
    }
    
    this.isBeeping = false;
  }
  
  /**
   * Cambia la frecuencia del beep
   */
  public setFrequency(frequency: number): void {
    this.stopBeep();
    this.frequency = frequency;
  }
  
  /**
   * Cambia la duración del beep
   */
  public setDuration(duration: number): void {
    this.stopBeep();
    this.duration = duration;
  }
  
  /**
   * Libera recursos
   */
  public dispose(): void {
    this.stopBeep();
    
    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
        this.audioContext = null;
      } catch (error) {
        console.error("BeepProcessor: Error closing audio context", error);
      }
    }
  }
}
