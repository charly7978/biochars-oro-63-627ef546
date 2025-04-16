
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

  public static playBeep(type: string = 'heartbeat', volume: number = 0.7): void {
    const service = AudioFeedbackService.getInstance();
    service.playSound(type, volume);
  }

  private playSound(type: string, volume: number): void {
    if (this.isMuted) return;
    
    const audio = this.audioCache.get(type);
    if (audio) {
      // Clone the audio to allow overlapping sounds
      const soundClone = audio.cloneNode() as HTMLAudioElement;
      soundClone.volume = volume;
      soundClone.play().catch(err => {
        console.error(`Error playing sound '${type}':`, err);
      });
    } else {
      console.warn(`Sound type '${type}' not found`);
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
}

export default AudioFeedbackService;
