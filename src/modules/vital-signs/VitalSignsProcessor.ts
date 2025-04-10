
/**
 * Main VitalSignsProcessor class that coordinates all the vital signs processing
 */
import { BloodPressureProcessor } from './blood-pressure-processor';
import { SpO2Processor } from './spo2-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidsProcessor } from './lipids-processor';
import { HydrationProcessor } from './hydration-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { VitalSignsResult, RRData } from '../../types/vital-signs';
import { ResultFactory } from './factories/result-factory';

export class VitalSignsProcessor {
  // Processors for each vital sign
  private bloodPressureProcessor: BloodPressureProcessor;
  private spo2Processor: SpO2Processor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidsProcessor: LipidsProcessor;
  private hydrationProcessor: HydrationProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  
  // Buffer for PPG signal
  private ppgBuffer: number[] = [];
  private BUFFER_SIZE = 300;
  
  constructor() {
    // Initialize all processors
    this.bloodPressureProcessor = new BloodPressureProcessor();
    this.spo2Processor = new SpO2Processor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidsProcessor = new LipidsProcessor();
    this.hydrationProcessor = new HydrationProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    
    console.log("VitalSignsProcessor: Initialized with all components");
  }
  
  /**
   * Process a single PPG signal value
   */
  public processSignal(value: number, rrData?: RRData): VitalSignsResult {
    // Add to buffer
    this.ppgBuffer.push(value);
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Calculate each vital sign
    const bloodPressure = this.bloodPressureProcessor.calculateBloodPressure(this.ppgBuffer);
    const spo2 = this.spo2Processor.calculateSpO2(this.ppgBuffer);
    const glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);
    const lipids = this.lipidsProcessor.calculateLipids(this.ppgBuffer);
    const hydration = this.hydrationProcessor.calculateHydration(this.ppgBuffer);
    
    // Process arrhythmia using RR intervals
    const arrhythmia = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Format blood pressure as a string (e.g., "120/80")
    const pressureString = `${bloodPressure.systolic}/${bloodPressure.diastolic}`;
    
    // Use ResultFactory to create standardized result
    return ResultFactory.createResult(
      spo2,
      pressureString,
      arrhythmia?.arrhythmiaStatus || "--",
      glucose,
      lipids,
      hydration,
      0.85, // glucoseConfidence
      0.82, // lipidsConfidence
      0.88, // overallConfidence
      arrhythmia?.lastArrhythmiaData || null
    );
  }
  
  /**
   * Reset all processors
   */
  public reset(): void {
    this.bloodPressureProcessor.reset();
    this.spo2Processor.reset();
    this.glucoseProcessor.reset();
    this.lipidsProcessor.reset();
    this.hydrationProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.ppgBuffer = [];
    
    console.log("VitalSignsProcessor: All processors reset");
  }
  
  /**
   * Get the current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
}
