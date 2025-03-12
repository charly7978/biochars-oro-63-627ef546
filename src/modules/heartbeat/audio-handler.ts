
export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private beepGainNode: GainNode | null = null;
  private audioInitialized = false;
  private humSoundFile: string;
  private lastBeepTime = 0;
  private minTimeBetweenBeeps = 300; // Minimum time between beeps in ms
  private useOscillator = false; // Flag to use oscillator instead of sound file

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
      
      // Try to resume audio context immediately (needed for iOS)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(err => {
          console.warn("Could not resume audio context immediately:", err);
        });
      }
      
      // Play silent sound to unlock audio on iOS
      await this.playUnlockSound();
      
      try {
        // Load audio file - with fallback to oscillator if it fails
        console.log("AudioHandler: Fetching sound file...");
        const response = await fetch(this.humSoundFile);
        
        if (!response.ok) {
          console.warn(`Failed to fetch sound file: ${response.status} ${response.statusText}`);
          this.useOscillator = true;
          this.audioInitialized = true;
          console.log("AudioHandler: Using oscillator fallback");
          return true;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log("AudioHandler: Sound file fetched, size:", arrayBuffer.byteLength);
        
        try {
          console.log("AudioHandler: Decoding audio data...");
          this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.audioInitialized = true;
          console.log("AudioHandler: Audio successfully initialized with sound file");
          return true;
        } catch (decodeError) {
          console.error("Audio decoding failed, using oscillator fallback:", decodeError);
          this.useOscillator = true;
          this.audioInitialized = true;
          return true;
        }
      } catch (fetchError) {
        console.error("Error fetching audio file, using oscillator fallback:", fetchError);
        this.useOscillator = true;
        this.audioInitialized = true;
        return true;
      }
    } catch (error) {
      // Try one more time with oscillator only
      console.error("Critical error initializing AudioHandler, attempting fallback:", error);
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.beepGainNode = this.audioContext.createGain();
        this.beepGainNode.connect(this.audioContext.destination);
        this.useOscillator = true;
        this.audioInitialized = true;
        console.log("AudioHandler: Fallback oscillator initialized");
        return true;
      } catch (fallbackError) {
        console.error("Complete audio initialization failure:", fallbackError);
        return false;
      }
    }
  }
  
  private async playUnlockSound(): Promise<void> {
    // Play a short sound to unlock audio on iOS and other browsers
    if (!this.audioContext) return;
    
    try {
      // Create a short silent oscillator
      const silentSource = this.audioContext.createOscillator();
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0.1; // Slightly audible to ensure it works
      silentSource.connect(silentGain);
      silentGain.connect(this.audioContext.destination);
      
      // Resume the context before playing
      await this.audioContext.resume();
      
      // Play the sound
      silentSource.start(0);
      silentSource.stop(0.2);
      
      console.log("AudioHandler: Played audio unlock sound");
    } catch (error) {
      console.error("Error playing unlock sound:", error);
    }
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
        this.audioContext.resume()
          .then(() => this.playBeepWithActiveContext(confidence, quality))
          .catch(err => {
            console.error("Error resuming audio context:", err);
            // Try anyway
            this.playBeepWithActiveContext(confidence, quality);
          });
      } else {
        this.playBeepWithActiveContext(confidence, quality);
      }
    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
      // Try fallback
      this.playOscillatorBeep(0.8);
    }
  }
  
  private playBeepWithActiveContext(confidence: number, quality: number): void {
    // Adjust volume based on confidence and quality
    const volume = Math.min(1.0, confidence * (quality / 100 + 0.5));
    
    if (this.audioBuffer && !this.useOscillator && this.beepGainNode) {
      // Play with loaded sound file
      try {
        this.beepGainNode.gain.value = Math.max(0.7, volume);
        const source = this.audioContext!.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.beepGainNode);
        source.start(0);
        console.log(`AudioHandler: BEEP played with sound file at ${new Date().toISOString()} with volume ${volume.toFixed(2)}`);
      } catch (err) {
        console.error("Error playing buffer source:", err);
        this.playOscillatorBeep(volume);
      }
    } else {
      // Use oscillator fallback
      this.playOscillatorBeep(volume);
    }
  }
  
  private playOscillatorBeep(volume: number): void {
    if (!this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Configure oscillator for heartbeat-like sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime); // Lower frequency for heartbeat
      
      // Create envelope for natural sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, this.audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      console.log(`AudioHandler: Oscillator BEEP played at ${new Date().toISOString()} with volume ${volume.toFixed(2)}`);
    } catch (error) {
      console.error("Error playing oscillator beep:", error);
    }
  }

  public get isInitialized(): boolean {
    return this.audioInitialized;
  }
}
