
/**
 * Audio management has been removed as requested
 */

export class HeartbeatAudioManager {
  constructor(private config: any) {
    console.log("HeartbeatAudioManager: Audio functionality has been removed");
  }
  
  public async initAudio(): Promise<boolean> {
    console.log("HeartbeatAudioManager: Audio functionality has been removed");
    return false;
  }
  
  public async playBeep(volume: number = 0): Promise<boolean> {
    console.log("HeartbeatAudioManager: Audio functionality has been removed");
    return false;
  }
}
