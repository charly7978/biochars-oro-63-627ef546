
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
      
      // Ensure context is resumed (often needed due to browser autoplay policies)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log("AudioContext resumed from suspended state");
      }
      
      // Create gain node for volume control
      this.beepGainNode = this.audioContext.createGain();
      this.beepGainNode.gain.value = 0.85; // Higher default volume
      this.beepGainNode.connect(this.audioContext.destination);
      
      // Always set up fallback beep sound to ensure sound works
      this.createFallbackBeepSound();
      this.audioInitialized = true;
      
      // Try to load the actual sound file, but don't block initialization on it
      try {
        await this.loadSoundFile();
        console.log("Sound file loaded successfully");
      } catch (err) {
        console.log("Using fallback beep sound generator", err);
      }
      
      return true;
    } catch (error) {
      console.error("Critical error initializing AudioHandler:", error);
      // Still return true to allow processing without audio
      this.audioInitialized = true;
      return true;
    }
  }
  
  private async loadSoundFile(): Promise<void> {
    try {
      // Use a fixed local MP3 file path instead of GitHub URL
      const soundUrl = '/heartbeat.mp3';
      
      const response = await fetch(soundUrl);
      
      if (!response.ok) {
        console.warn(`Failed to fetch sound file: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch sound file: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (this.audioContext) {
        try {
          this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          console.log("Audio file decoded successfully");
        } catch (decodeError) {
          console.error("Error decoding audio data:", decodeError);
          throw decodeError;
        }
      }
    } catch (error) {
      console.error("Error loading audio file:", error);
      throw error;
    }
  }
  
  private createFallbackBeepSound(): void {
    // More robust fallback sound setup
    this.audioInitialized = true;
    console.log("Using fallback beep sound generator");
  }

  public playBeep(confidence: number, quality: number): void {
    if (!this.audioContext) {
      console.warn("No AudioContext available for playBeep");
      return;
    }
    
    try {
      // Always try to resume the audio context if it's suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(err => 
          console.warn("Failed to resume audio context:", err)
        );
      }
      
      // Increase base volume and adjust based on confidence and quality
      const volume = Math.min(1.0, 0.4 + (confidence * 0.6) * (quality / 100 + 0.5));
      
      if (this.audioBuffer && this.beepGainNode) {
        // Play loaded audio file
        this.beepGainNode.gain.value = Math.max(0.4, volume);
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.beepGainNode);
        source.start();
        console.log("Playing heartbeat audio sample, volume:", this.beepGainNode.gain.value);
      } else {
        // Fallback beep using oscillator - make it more audible
        this.playFallbackBeep(Math.max(0.5, volume));
        console.log("Playing fallback beep, volume:", volume);
      }
    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
      // Try fallback if normal playback fails
      this.playFallbackBeep(0.7);
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
      
      // Use better beep settings
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(475, this.audioContext.currentTime); // Higher pitch is more noticeable
      
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
