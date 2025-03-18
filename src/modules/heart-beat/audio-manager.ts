
/**
 * Audio management for heartbeat sounds
 * Optimized for reliable real-time beep response
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
   * Initialize audio context with high priority
   */
  public async initAudio(): Promise<boolean> {
    try {
      // Close previous context if exists
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close().catch(err => {
          console.error("Error closing audio context:", err);
        });
      }
      
      // Create new context with interactive latency hint for better responsiveness
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
   * Ensure audio is initialized
   */
  private async ensureAudioInitialized(): Promise<boolean> {
    if (!this.audioInitialized || !this.audioContext || this.audioContext.state !== 'running') {
      return await this.initAudio();
    }
    return true;
  }
  
  /**
   * Play heartbeat sound with optimized performance
   */
  public async playBeep(volume: number = this.config.beepVolume): Promise<boolean> {
    // Basic interval check (less strict)
    const now = Date.now();
    if (now - this.lastBeepTime < this.config.minBeepInterval * 0.8) {
      return false;
    }

    try {
      // Make sure audio is ready
      await this.ensureAudioInitialized();
      if (!this.audioContext || this.audioContext.state !== 'running') {
        return false;
      }

      // Create oscillators for realistic heartbeat sound
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configure primary tone
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.config.primaryFrequency,
        this.audioContext.currentTime
      );

      // Configure secondary tone
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.config.secondaryFrequency,
        this.audioContext.currentTime
      );

      // Amplitude envelope for primary tone (faster attack for better responsiveness)
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.005 // Faster attack
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.config.beepDuration / 1000
      );

      // Amplitude envelope for secondary tone
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.5, // Slightly higher secondary volume for better audibility
        this.audioContext.currentTime + 0.005
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
      return true;
    } catch (err) {
      console.error("HeartbeatAudioManager: Error playing beep", err);
      return false;
    }
  }
}
