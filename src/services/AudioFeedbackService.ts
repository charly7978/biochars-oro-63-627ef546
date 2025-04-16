
class AudioFeedbackService {
  private static instance: AudioFeedbackService;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;
  
  private readonly soundPaths: Record<string, string> = {
    'heartbeat': '/sounds/heartbeat.mp3',
    'notification': '/sounds/notification.mp3',
    'success': '/sounds/success.mp3',
    'error': '/sounds/error.mp3',
    'arrhythmia': '/sounds/error.mp3'
  };

  private constructor() {
    // Private constructor for singleton pattern
    this.preloadSounds();
  }

  public static getInstance(): AudioFeedbackService {
    if (!AudioFeedbackService.instance) {
      AudioFeedbackService.instance = new AudioFeedbackService();
    }
    return AudioFeedbackService.instance;
  }

  private preloadSounds(): void {
    for (const [key, path] of Object.entries(this.soundPaths)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.audioCache.set(key, audio);
    }
  }

  public static playBeep(type: string = 'heartbeat', volume: number = 0.7): boolean {
    const service = AudioFeedbackService.getInstance();
    return service.playSound(type, volume);
  }

  private playSound(type: string, volume: number): boolean {
    if (this.isMuted) return false;
    
    const audio = this.audioCache.get(type);
    if (audio) {
      // Clone the audio to allow overlapping sounds
      const soundClone = audio.cloneNode() as HTMLAudioElement;
      soundClone.volume = volume;
      soundClone.play().catch(err => {
        console.error(`Error playing sound '${type}':`, err);
      });
      return true;
    } else {
      console.warn(`Sound type '${type}' not found`);
      return false;
    }
  }

  public static setMuted(muted: boolean): void {
    const service = AudioFeedbackService.getInstance();
    service.isMuted = muted;
  }

  public static isMuted(): boolean {
    const service = AudioFeedbackService.getInstance();
    return service.isMuted;
  }

  // Play heartbeat feedback
  public static triggerHeartbeatFeedback(type: 'normal' | 'arrhythmia'): boolean {
    const volume = type === 'arrhythmia' ? 0.8 : 0.7;
    return AudioFeedbackService.playBeep(type === 'arrhythmia' ? 'arrhythmia' : 'heartbeat', volume);
  }

  // Clean up resources
  public static cleanUp(): void {
    const service = AudioFeedbackService.getInstance();
    service.audioCache.clear();
    console.log("AudioFeedbackService: Cleaned up");
  }
}

export default AudioFeedbackService;
