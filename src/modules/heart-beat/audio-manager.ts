
/**
 * Audio manager for heart beat sounds
 */

interface HeartbeatAudioOptions {
  primaryFrequency: number;
  secondaryFrequency: number;
  duration: number;
  volume: number;
}

export class HeartbeatAudioManager {
  private context: AudioContext | null = null;
  private options: HeartbeatAudioOptions;
  private isReady: boolean = false;
  private lastBeepTime: number = 0;
  
  constructor(options: HeartbeatAudioOptions) {
    this.options = options;
  }
  
  /**
   * Initialize audio context
   */
  public async initAudio(): Promise<boolean> {
    try {
      // Create audio context only when needed
      if (!this.context) {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Resume context if not running
      if (this.context.state !== 'running') {
        await this.context.resume();
      }
      
      this.isReady = true;
      return true;
    } catch (err) {
      console.error('HeartbeatAudioManager: Error initializing audio', err);
      this.isReady = false;
      return false;
    }
  }
  
  /**
   * Play a beep sound
   */
  public async playBeep(volume: number = 0.7): Promise<boolean> {
    try {
      // Check if we're ready to play sound
      if (!this.isReady || !this.context) {
        await this.initAudio();
      }
      
      if (!this.context) {
        console.error('HeartbeatAudioManager: Audio context not available');
        return false;
      }
      
      // Enforce minimum time between beeps
      const now = Date.now();
      if (now - this.lastBeepTime < this.options.duration * 2) {
        return false;
      }
      
      this.lastBeepTime = now;
      
      // Create oscillator for beep
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();
      
      // Set up audio nodes
      oscillator.type = 'sine';
      oscillator.frequency.value = this.options.primaryFrequency;
      gainNode.gain.value = volume * this.options.volume;
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      // Schedule beep start/stop
      oscillator.start();
      oscillator.stop(this.context.currentTime + this.options.duration / 1000);
      
      // Clean up after beep is done
      setTimeout(() => {
        oscillator.disconnect();
        gainNode.disconnect();
      }, this.options.duration + 50);
      
      return true;
    } catch (error) {
      console.error('HeartbeatAudioManager: Error playing beep', error);
      return false;
    }
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    this.isReady = false;
  }
}
