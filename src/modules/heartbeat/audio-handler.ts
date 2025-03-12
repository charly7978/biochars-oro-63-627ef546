
export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private beepGainNode: GainNode | null = null;
  private audioInitialized = false;
  private humSoundFile: string;
  private lastBeepTime = 0;
  private minTimeBetweenBeeps = 300; // Minimum time between beeps in ms

  constructor(soundFile: string) {
    this.humSoundFile = soundFile;
  }

  public async initialize(): Promise<boolean> {
    try {
      console.log("AudioHandler: Starting initialization with sound file", this.humSoundFile);
      
      // Create audio context first
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log("AudioHandler: Audio context created", this.audioContext.state);
      
      // Create gain node for volume control
      this.beepGainNode = this.audioContext.createGain();
      this.beepGainNode.gain.value = 0.85; // Higher default volume
      this.beepGainNode.connect(this.audioContext.destination);
      
      try {
        // Load audio asynchronously - handling direct URL strings
        console.log("AudioHandler: Fetching sound file...");
        const response = await fetch(this.humSoundFile);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch sound file: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log("AudioHandler: Sound file fetched, size:", arrayBuffer.byteLength);
        
        // Resume audio context if suspended (needed for iOS and some browsers)
        if (this.audioContext.state === 'suspended') {
          console.log("AudioHandler: Resuming suspended audio context");
          await this.audioContext.resume();
        }
        
        // Decode audio with error handling
        try {
          console.log("AudioHandler: Decoding audio data...");
          this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.audioInitialized = true;
          console.log("AudioHandler: Audio Context Initialized successfully");
          
          // Play a silent sound to unlock audio on iOS
          await this.playUnlockSound();
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
      silentGain.gain.value = 0.1; // Slightly audible to ensure it works
      silentSource.connect(silentGain);
      silentGain.connect(this.audioContext.destination);
      silentSource.start(0);
      silentSource.stop(0.2);
      
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
    
    // Throttle beeps to prevent too frequent sounds
    const now = Date.now();
    if (now - this.lastBeepTime < this.minTimeBetweenBeeps) {
      return;
    }
    this.lastBeepTime = now;
    
    try {
      // Ensure audio context is running
      if (this.audioContext.state !== 'running') {
        console.log("Resuming audio context before playing beep");
        this.audioContext.resume().catch(err => console.error("Error resuming audio context:", err));
      }
      
      // Adjust volume based on confidence and quality
      const volume = Math.min(1.0, confidence * (quality / 100 + 0.5));
      
      if (this.audioBuffer && this.beepGainNode) {
        // Normal beep with audio buffer
        this.beepGainNode.gain.value = Math.max(0.7, volume);
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
      this.playFallbackBeep(0.7);
    }
  }
  
  private playFallbackBeep(volume: number): void {
    if (!this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime); // Lower frequency for heartbeat sound
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, this.audioContext.currentTime + 0.1);
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
