
export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private beepGainNode: GainNode | null = null;
  private audioInitialized = false;
  private humSoundFile: string;

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
      
      try {
        // Load audio asynchronously - handling direct URL strings
        const response = await fetch(this.humSoundFile);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch sound file: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Resume audio context if suspended (needed for iOS and some browsers)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        // Decode audio with error handling
        try {
          this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.audioInitialized = true;
          console.log("AudioHandler: Audio Context Initialized successfully");
          
          // Play a silent sound to unlock audio on iOS
          this.playUnlockSound();
          return true;
        } catch (decodeError) {
          console.error("Audio decoding failed, trying fallback beep method:", decodeError);
          // Create a simple oscillator as fallback
          this.createFallbackBeepSound();
          return true;
        }
      } catch (fetchError) {
        console.error("Error fetching audio file, using fallback beep:", fetchError);
        this.createFallbackBeepSound();
        return true;
      }
    } catch (error) {
      console.error("Critical error initializing AudioHandler:", error);
      return false;
    }
  }
  
  private async playUnlockSound(): Promise<void> {
    // Play a short silent sound to unlock audio on iOS and other browsers
    if (!this.audioContext) return;
    
    try {
      const silentSource = this.audioContext.createOscillator();
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0.001; // Nearly silent
      silentSource.connect(silentGain);
      silentGain.connect(this.audioContext.destination);
      silentSource.start(0);
      silentSource.stop(0.1);
      
      console.log("Played audio unlock sound");
    } catch (error) {
      console.error("Error playing unlock sound:", error);
    }
  }
  
  private createFallbackBeepSound(): void {
    // Create a simple oscillator pattern as a fallback
    this.audioInitialized = true;
    console.log("Using fallback beep sound generator");
  }

  public playBeep(confidence: number, quality: number): void {
    if (!this.audioContext || !this.audioInitialized) {
      console.error("Cannot play beep: audio not initialized");
      return;
    }
    
    try {
      // Ensure audio context is running
      if (this.audioContext.state !== 'running') {
        this.audioContext.resume().catch(err => console.error("Error resuming audio context:", err));
      }
      
      // Adjust volume based on confidence and quality
      const volume = Math.min(0.9, confidence * (quality / 100 + 0.5));
      
      if (this.audioBuffer && this.beepGainNode) {
        // Normal beep with audio buffer
        this.beepGainNode.gain.value = Math.max(0.5, volume);
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.beepGainNode);
        
        // Start the source now
        source.start(0);
        console.log(`BEEP played at ${new Date().toISOString()} with volume ${volume.toFixed(2)}`);
      } else {
        // Fallback beep using oscillator
        this.playFallbackBeep(volume);
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
      
      console.log(`Fallback BEEP played at ${new Date().toISOString()} with volume ${volume.toFixed(2)}`);
    } catch (error) {
      console.error("Error playing fallback beep:", error);
    }
  }

  public get isInitialized(): boolean {
    return this.audioInitialized;
  }
}
