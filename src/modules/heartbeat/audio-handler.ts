
export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private beepGainNode: GainNode | null = null;
  private audioInitialized = false;
  private humSoundFile: string;
  private oscillator: OscillatorNode | null = null;

  constructor(soundFile: string) {
    this.humSoundFile = soundFile;
  }

  public async initialize(): Promise<boolean> {
    try {
      // Create audio context first
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain node for volume control
      this.beepGainNode = this.audioContext.createGain();
      this.beepGainNode.gain.value = 0.7; // Lower default volume
      this.beepGainNode.connect(this.audioContext.destination);
      
      // Always set up fallback beep sound to ensure sound works
      this.createFallbackBeepSound();
      this.audioInitialized = true;
      
      // Try to load the actual sound file, but don't block initialization on it
      this.loadSoundFile().catch(err => {
        console.log("Failed to load sound file, using fallback beep", err);
      });
      
      return true;
    } catch (error) {
      console.error("Critical error initializing AudioHandler:", error);
      return false;
    }
  }
  
  private async loadSoundFile(): Promise<void> {
    try {
      // Convert GitHub URL to raw content if needed
      const soundUrl = this.humSoundFile.includes('github.com') && !this.humSoundFile.includes('raw') 
        ? this.humSoundFile.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') 
        : this.humSoundFile;
      
      const response = await fetch(soundUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sound file: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (this.audioContext) {
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log("Audio file loaded successfully");
      }
    } catch (error) {
      console.error("Error loading audio file:", error);
      throw error;
    }
  }
  
  private createFallbackBeepSound(): void {
    // Create a simple oscillator pattern as a fallback
    this.audioInitialized = true;
    console.log("Using fallback beep sound generator");
  }

  public playBeep(confidence: number, quality: number): void {
    if (!this.audioContext || !this.audioInitialized) {
      return;
    }
    
    try {
      // Adjust volume based on confidence and quality
      const volume = Math.min(0.8, confidence * (quality / 100 + 0.5));
      
      if (this.audioBuffer && this.beepGainNode) {
        // Play loaded audio file
        this.beepGainNode.gain.value = Math.max(0.3, volume);
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.beepGainNode);
        source.start();
        console.log("Playing heartbeat audio sample");
      } else {
        // Fallback beep using oscillator
        this.playFallbackBeep(volume);
        console.log("Playing fallback beep");
      }
    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
      // Try fallback if normal playback fails
      this.playFallbackBeep(0.5);
    }
  }
  
  private playFallbackBeep(volume: number): void {
    if (!this.audioContext) return;
    
    try {
      // Resume audio context if it's suspended (needed for newer browsers)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Error playing fallback beep:", error);
    }
  }

  public get isInitialized(): boolean {
    return this.audioInitialized;
  }
}
