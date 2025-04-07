
/**
 * Simplified processor for vital signs measurement
 * Focus on accuracy and stability rather than complex features
 */

export interface VitalSignsOutput {
  spo2: number;
  heartRate: number;
  pressure: string;
  arrhythmiaStatus: string;
  arrhythmiaCount: number;
  confidence: number;
}

export class SimpleVitalSignsProcessor {
  private lastBpm: number = 0;
  private lastConfidence: number = 0;
  private bpmBuffer: number[] = [];
  private lastUpdateTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private validMeasurementCount: number = 0;
  
  constructor() {
    console.log("SimpleVitalSignsProcessor: Initialized");
  }
  
  /**
   * Process heart rate data into vital signs
   */
  public processHeartRate(bpm: number, confidence: number): VitalSignsOutput {
    const now = Date.now();
    
    // Skip processing if values are invalid
    if (bpm <= 0 || confidence <= 0) {
      return this.createEmptyResult();
    }
    
    // Update internal state
    this.lastBpm = bpm;
    this.lastConfidence = confidence;
    
    // Add to buffer for smoothing
    this.bpmBuffer.push(bpm);
    if (this.bpmBuffer.length > 5) {
      this.bpmBuffer.shift();
    }
    
    // Count valid measurements
    this.validMeasurementCount++;
    
    // Calculate SPO2 based on heart rate (simplified model)
    // This is just a placeholder - real SPO2 needs red/infrared light
    let spo2 = 0;
    if (this.validMeasurementCount > 10 && confidence > 0.6) {
      // Normal resting heart rate leads to higher SPO2 estimates
      // Again, this is NOT medically accurate, just a visual placeholder
      if (bpm >= 60 && bpm <= 100) {
        spo2 = Math.min(99, 95 + Math.random() * 4);
      } else if (bpm > 100) {
        spo2 = Math.max(90, 95 - (bpm - 100) / 10);
      } else {
        spo2 = Math.max(90, 95 - (60 - bpm) / 10);
      }
    }
    
    // Blood pressure placeholder (not accurate)
    const systolic = Math.round(110 + (bpm - 70) * 0.5);
    const diastolic = Math.round(70 + (bpm - 70) * 0.25);
    const pressure = `${systolic}/${diastolic}`;
    
    // Simple arrhythmia detection (placeholder)
    // In a real app, this would analyze RR intervals
    let arrhythmiaStatus = "NORMAL";
    if (this.bpmBuffer.length >= 3) {
      const variations = [];
      for (let i = 1; i < this.bpmBuffer.length; i++) {
        variations.push(Math.abs(this.bpmBuffer[i] - this.bpmBuffer[i-1]));
      }
      
      const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
      
      if (avgVariation > 8 && confidence > 0.5) {
        arrhythmiaStatus = "ARRHYTHMIA DETECTED";
        this.arrhythmiaCounter++;
      }
    }
    
    return {
      spo2: Math.round(spo2),
      heartRate: Math.round(bpm),
      pressure,
      arrhythmiaStatus,
      arrhythmiaCount: this.arrhythmiaCounter,
      confidence
    };
  }
  
  /**
   * Create empty result when no data is available
   */
  private createEmptyResult(): VitalSignsOutput {
    return {
      spo2: 0,
      heartRate: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      arrhythmiaCount: this.arrhythmiaCounter,
      confidence: 0
    };
  }
  
  /**
   * Reset all measurements
   */
  public reset(): void {
    this.lastBpm = 0;
    this.lastConfidence = 0;
    this.bpmBuffer = [];
    this.lastUpdateTime = 0;
    this.validMeasurementCount = 0;
    console.log("SimpleVitalSignsProcessor: Reset completed");
  }
  
  /**
   * Perform full reset including arrhythmia counter
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCounter = 0;
    console.log("SimpleVitalSignsProcessor: Full reset completed");
  }
  
  /**
   * Get the current arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
}
