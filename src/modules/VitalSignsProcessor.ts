
import { VitalSignsProcessor as NewVitalSignsProcessor } from './vital-signs/VitalSignsProcessor';
import './HeartBeatProcessor.extension';

/**
 * This is a wrapper class to maintain backward compatibility with
 * the original VitalSignsProcessor implementation while using the 
 * refactored version under the hood.
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  
  // Expose constants for compatibility
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 10;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  private readonly PEAK_THRESHOLD = 0.3;
  
  constructor() {
    this.processor = new NewVitalSignsProcessor();
    
    // Make this processor available globally for other components to use
    if (typeof window !== 'undefined') {
      (window as any).vitalSignsProcessor = this.processor;
      console.log('VitalSignsProcessor: Registered globally through wrapper');
    }
  }
  
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  public reset(): void {
    this.processor.reset();
  }
  
  /**
   * Proxy method to expose blood pressure calculation directly
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    return this.processor.calculateBloodPressure(ppgValues);
  }
  
  /**
   * Proxy method to expose SpO2 calculation directly
   */
  public calculateSpO2(ppgValues: number[]): number {
    if (typeof this.processor.calculateSpO2 === 'function') {
      return this.processor.calculateSpO2(ppgValues);
    }
    return 0;
  }
}
