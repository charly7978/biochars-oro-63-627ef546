
/**
 * Audio management for heartbeat sounds
 */

export class HeartbeatAudioManager {
  private audioContext: AudioContext | null = null;
  private lastBeepTime: number = 0;
  private audioInitialized: boolean = false;
  
  constructor(private config: {
    primaryFrequency: number,
    secondaryFrequency: number,
    beepDuration: number,
    beepVolume: number,
    minBeepInterval: number
  }) {}
  
  /**
   * Initialize audio context
   */
  public async initAudio(): Promise<boolean> {
    try {
      // Close previous context if exists
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close().catch(err => {
          console.error("Error closing audio context:", err);
        });
      }
      
      // Create new context with low latency settings
      if (typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        // Ensure it's running
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        // Prepare system with silent beep
        await this.playBeep(0.1); // Aumentado para mejor inicialización
        console.log("HeartbeatAudioManager: Audio Context Initialized with low latency");
        this.audioInitialized = true;
        return true;
      } else {
        console.warn("HeartbeatAudioManager: AudioContext not available in this environment");
        return false;
      }
    } catch (err) {
      console.error("HeartbeatAudioManager: Error initializing audio", err);
      return false;
    }
  }
  
  /**
   * Play heartbeat sound with immediate execution
   */
  public async playBeep(volume: number = this.config.beepVolume): Promise<boolean> {
    try {
      // Intervalo mínimo reducido para permitir beeps más frecuentes
      const now = Date.now();
      if (now - this.lastBeepTime < 200) { // Reducido de this.config.minBeepInterval
        return false;
      }

      // Ensure audio context is available and active
      if (!this.audioContext || this.audioContext.state !== 'running') {
        if (!this.audioInitialized) {
          await this.initAudio();
        } else if (this.audioContext) {
          await this.audioContext.resume();
        }
        
        if (!this.audioContext || this.audioContext.state !== 'running') {
          console.warn("HeartbeatAudioManager: No se pudo activar el contexto de audio");
          return false;
        }
      }

      console.log("HeartbeatAudioManager: Reproduciendo beep con volumen", volume);

      // Create oscillators for realistic heartbeat sound - with increased volume
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configure primary tone with higher volume
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.config.primaryFrequency,
        this.audioContext.currentTime
      );

      // Configure secondary tone with higher volume
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.config.secondaryFrequency,
        this.audioContext.currentTime
      );

      // Aumentar volumen general significativamente para garantizar audibilidad
      const adjustedVolume = Math.min(volume * 2.0, 1.0); // Duplicado para mayor volumen

      // Amplitude envelope for primary tone - faster attack
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        adjustedVolume,
        this.audioContext.currentTime + 0.0005 // Ataque más rápido
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.config.beepDuration / 1000
      );

      // Amplitude envelope for secondary tone - faster attack
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        adjustedVolume * 0.8, // Secondary at higher relative volume
        this.audioContext.currentTime + 0.0005 // Ataque más rápido
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.config.beepDuration / 1000
      );

      // Connect audio nodes
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      // Start and stop oscillators with precise timing
      primaryOscillator.start(this.audioContext.currentTime);
      secondaryOscillator.start(this.audioContext.currentTime);
      primaryOscillator.stop(this.audioContext.currentTime + this.config.beepDuration / 1000 + 0.02);
      secondaryOscillator.stop(this.audioContext.currentTime + this.config.beepDuration / 1000 + 0.02);

      // Update last beep time
      this.lastBeepTime = now;
      console.log("HeartbeatAudioManager: Beep reproducido exitosamente");
      return true;
    } catch (err) {
      console.error("HeartbeatAudioManager: Error playing beep", err);
      return false;
    }
  }
}
