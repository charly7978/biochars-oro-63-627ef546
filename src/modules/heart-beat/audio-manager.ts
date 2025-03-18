
/**
 * Audio management has been centralized in PPGSignalMeter component
 * This class is kept for compatibility but all actual audio is handled in PPGSignalMeter
 */

export class HeartbeatAudioManager {
  private audioContext: AudioContext | null = null;
  private lastBeepTime: number = 0;
  private audioInitialized: boolean = false;
  
  constructor(private config: {
    primaryFrequency: number,
    secondaryFrequency: number,
    beepDuration: number,
    beepVolume: number,
    minBeepInterval: number
  }) {
    // Clase mantenida por compatibilidad
    // Audio centralizado en PPGSignalMeter para mejor rendimiento
  }
  
  /**
   * Initialize audio context - NOOP as audio is handled in PPGSignalMeter
   */
  public async initAudio(): Promise<boolean> {
    return false;
  }
  
  /**
   * Play heartbeat sound - NOOP as audio is handled in PPGSignalMeter
   */
  public async playBeep(volume: number = this.config.beepVolume): Promise<boolean> {
    return false;
  }
}
