
/**
 * Service for providing audio feedback in the application
 */

class AudioFeedbackServiceClass {
  private audioContext: AudioContext | null = null;
  private audioInitialized: boolean = false;
  private audioEnabled: boolean = true;
  
  constructor() {
    this.initAudio();
  }
  
  /**
   * Initialize audio context
   */
  private initAudio(): void {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        this.audioInitialized = true;
        console.log('AudioFeedbackService: Audio context initialized');
      } else {
        console.warn('AudioFeedbackService: AudioContext not supported in this environment');
      }
    } catch (error) {
      console.error('AudioFeedbackService: Error initializing audio context:', error);
    }
  }
  
  /**
   * Check if audio is available
   */
  private ensureAudioAvailable(): boolean {
    if (!this.audioEnabled) {
      console.log('AudioFeedbackService: Audio is disabled by user settings');
      return false;
    }
    
    if (!this.audioInitialized || !this.audioContext) {
      this.initAudio();
    }
    
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(err => {
        console.error('AudioFeedbackService: Error resuming audio context:', err);
      });
    }
    
    return !!this.audioContext && this.audioContext.state === 'running';
  }
  
  /**
   * Play a beep sound
   * @param type Type of beep (normal or arrhythmia)
   * @param volume Volume level (0-1)
   */
  public playBeep(type: 'normal' | 'arrhythmia', volume: number = 0.7): void {
    if (!this.ensureAudioAvailable()) return;
    
    try {
      const ctx = this.audioContext!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (type === 'normal') {
        // Regular heartbeat beep
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(volume * 0.05, ctx.currentTime);
      } else {
        // Arrhythmia signal - lower frequency, louder
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(volume * 0.08, ctx.currentTime);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      // Longer duration for arrhythmias
      osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.2 : 0.1));
      
      console.log(`AudioFeedbackService: Playing ${type} beep at volume ${volume}`);
    } catch (error) {
      console.error('AudioFeedbackService: Error generating audio:', error);
    }
  }
  
  /**
   * Enable or disable audio
   */
  public setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    console.log(`AudioFeedbackService: Audio ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Close audio context when app is done
   */
  public dispose(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(err => {
        console.error('AudioFeedbackService: Error closing audio context:', err);
      });
      this.audioContext = null;
      this.audioInitialized = false;
    }
  }
}

// Singleton instance
const AudioFeedbackService = new AudioFeedbackServiceClass();

export default AudioFeedbackService;
