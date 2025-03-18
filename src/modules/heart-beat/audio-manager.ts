
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
    console.log("HeartbeatAudioManager: CONSTRUCTOR LLAMADO, PERO SISTEMA DE AUDIO CENTRALIZADO EN PPGSignalMeter");
  }
  
  /**
   * Initialize audio context - NOOP as audio is handled in PPGSignalMeter
   */
  public async initAudio(): Promise<boolean> {
    console.log("HeartbeatAudioManager: initAudio llamado pero sistema de audio centralizado en PPGSignalMeter");
    return false;
  }
  
  /**
   * Play heartbeat sound - NOOP as audio is handled in PPGSignalMeter
   */
  public async playBeep(volume: number = this.config.beepVolume): Promise<boolean> {
    console.log("HeartbeatAudioManager: playBeep llamado pero sistema de audio centralizado en PPGSignalMeter");
    return false;
  }
}
