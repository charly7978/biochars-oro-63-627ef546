
/**
 * Audio management for heartbeat sounds
 */

interface HeartbeatAudioConfig {
  primaryFrequency: number;
  secondaryFrequency: number;
  duration: number;
  volume: number;
}

/**
 * Manages audio for heartbeat sounds
 */
export class HeartbeatAudioManager {
  private audioContext: AudioContext | null = null;
  private config: HeartbeatAudioConfig;
  private isAudioReady: boolean = false;
  private lastBeepTime: number = 0;
  private beepPromise: Promise<boolean> | null = null;
  
  /**
   * Create a new audio manager for heartbeat sounds
   */
  constructor(config: HeartbeatAudioConfig) {
    this.config = config;
  }
  
  /**
   * Initialize audio context
   */
  public async initAudio(): Promise<boolean> {
    try {
      // Check if AudioContext is supported
      if (typeof AudioContext === 'undefined') {
        console.error("HeartbeatAudioManager: AudioContext not supported");
        return false;
      }
      
      // Create audio context if not already created
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        console.log("HeartbeatAudioManager: Audio context created with state:", this.audioContext.state);
      }
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log("HeartbeatAudioManager: Audio context resumed");
      }
      
      this.isAudioReady = true;
      return true;
    } catch (error) {
      console.error("HeartbeatAudioManager: Error initializing audio", error);
      this.isAudioReady = false;
      return false;
    }
  }
  
  /**
   * Play a heartbeat sound
   */
  public async playBeep(volume: number = this.config.volume): Promise<boolean> {
    // Check if we already have a pending beep
    if (this.beepPromise) {
      return this.beepPromise;
    }
    
    // Create new beep promise
    this.beepPromise = this.playBeepInternal(volume);
    const result = await this.beepPromise;
    this.beepPromise = null;
    return result;
  }
  
  /**
   * Internal method to play heartbeat sound
   */
  private async playBeepInternal(volume: number): Promise<boolean> {
    try {
      // Initialize audio if not ready
      if (!this.isAudioReady) {
        const initialized = await this.initAudio();
        if (!initialized) return false;
      }
      
      // Check if context is available
      if (!this.audioContext) {
        console.error("HeartbeatAudioManager: No audio context available");
        return false;
      }
      
      // Enforce minimum interval between beeps
      const now = Date.now();
      if (now - this.lastBeepTime < 200) {
        return false;
      }
      this.lastBeepTime = now;
      
      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = Math.min(1, Math.max(0, volume));
      gainNode.connect(this.audioContext.destination);
      
      // Create primary oscillator
      const primaryOsc = this.audioContext.createOscillator();
      primaryOsc.type = 'sine';
      primaryOsc.frequency.value = this.config.primaryFrequency;
      primaryOsc.connect(gainNode);
      
      // Create secondary oscillator for richer sound
      const secondaryOsc = this.audioContext.createOscillator();
      secondaryOsc.type = 'triangle';
      secondaryOsc.frequency.value = this.config.secondaryFrequency;
      
      // Create gain node for secondary oscillator
      const secondaryGain = this.audioContext.createGain();
      secondaryGain.gain.value = volume * 0.3; // Lower volume for secondary
      secondaryOsc.connect(secondaryGain);
      secondaryGain.connect(this.audioContext.destination);
      
      // Calculate duration in seconds
      const durationSeconds = this.config.duration / 1000;
      
      // Set envelope for natural sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + durationSeconds);
      
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(volume * 0.3, this.audioContext.currentTime + 0.01);
      secondaryGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + durationSeconds);
      
      // Start and stop oscillators
      primaryOsc.start();
      secondaryOsc.start();
      
      primaryOsc.stop(this.audioContext.currentTime + durationSeconds);
      secondaryOsc.stop(this.audioContext.currentTime + durationSeconds);
      
      return true;
    } catch (error) {
      console.error("HeartbeatAudioManager: Error playing beep", error);
      return false;
    }
  }
  
  /**
   * Check if audio is initialized and ready
   */
  public isReady(): boolean {
    return this.isAudioReady && !!this.audioContext;
  }
  
  /**
   * Get audio context state
   */
  public getAudioState(): string {
    return this.audioContext ? this.audioContext.state : 'unavailable';
  }
}
