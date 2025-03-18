
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
        await this.playBeep(0.01);
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
      // Basic interval check to prevent beep overlap
      const now = Date.now();
      if (now - this.lastBeepTime < this.config.minBeepInterval) {
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

      // Create oscillators for realistic heartbeat sound
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configure primary tone (higher volume for better audibility)
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.config.primaryFrequency,
        this.audioContext.currentTime
      );

      // Configure secondary tone (higher volume for better audibility)
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.config.secondaryFrequency,
        this.audioContext.currentTime
      );

      // Aumentar volumen general para mejor audibilidad
      const adjustedVolume = Math.min(volume * 1.2, 1.0);

      // Amplitude envelope for primary tone
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        adjustedVolume,
        this.audioContext.currentTime + 0.001 // Más rápido ataque
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.config.beepDuration / 1000
      );

      // Amplitude envelope for secondary tone
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        adjustedVolume * 0.5, // Secondary at higher relative volume
        this.audioContext.currentTime + 0.001 // Más rápido ataque
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
