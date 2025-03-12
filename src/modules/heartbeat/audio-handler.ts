
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
      // Load audio asynchronously
      const response = await fetch(this.humSoundFile);
      const arrayBuffer = await response.arrayBuffer();

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain node for volume control
      this.beepGainNode = this.audioContext.createGain();
      this.beepGainNode.gain.value = 0.7; // Lower default volume
      this.beepGainNode.connect(this.audioContext.destination);
      
      // Decode audio
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.audioInitialized = true;
      console.log("AudioHandler: Audio Context Initialized");
      return true;
    } catch (error) {
      console.error("Error initializing AudioHandler:", error);
      return false;
    }
  }

  public playBeep(confidence: number, quality: number): void {
    // Skip if audio not initialized
    if (!this.audioContext || !this.audioBuffer || !this.beepGainNode || !this.audioInitialized) {
      return;
    }
    
    try {
      // Adjust volume based on confidence and quality
      const volume = Math.min(1.0, confidence * (quality / 100 + 0.5));
      this.beepGainNode.gain.value = Math.max(0.3, volume);
      
      // Create and configure source
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.beepGainNode);
      
      // Start playback
      source.start();
      console.log(`BEEP played at ${new Date().toISOString()}`);
    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
    }
  }

  public get isInitialized(): boolean {
    return this.audioInitialized;
  }
}
