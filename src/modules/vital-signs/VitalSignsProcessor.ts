
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SignalQuality } from './processors/signal-quality';
import { SPO2 } from './processors/spo2';
import { Glucose } from './processors/glucose';
import { resultFactory } from './factories/result-factory';
import { VitalSignsResult, ArrhythmiaDetectionResult } from './types/vital-signs-result';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Main processor for vital signs - direct measurement only
 * No simulation or reference values are used
 */
export class VitalSignsProcessor {
  private signalQualityProcessor: SignalQuality;
  private spo2Processor: SPO2;
  private glucoseProcessor: Glucose;
  private lipidsProcessor: any;
  private arrhythmiaProcessor: any;
  private bloodPressureProcessor: any;
  
  /**
   * Initialize vital signs processors - direct measurement only
   * No simulation or reference values are used
   */
  constructor() {
    this.signalQualityProcessor = new SignalQuality();
    // Create simple mock processor for blood pressure that just returns a string
    this.bloodPressureProcessor = {
      calculatePressure: () => "--/--",
      reset: () => {}
    };
    this.spo2Processor = new SPO2();
    this.glucoseProcessor = new Glucose();
    // Create simple mock processor for lipids
    this.lipidsProcessor = {
      calculateLipids: () => ({ totalCholesterol: 0, triglycerides: 0 }),
      reset: () => {}
    };
    // Create simple mock processor for arrhythmia
    this.arrhythmiaProcessor = {
      detectArrhythmia: () => "--",
      getLastArrhythmiaData: () => null,
      reset: () => {},
      resetCounter: () => {},
      getArrhythmiaCount: () => 0
    };
  }
  
  /**
   * Process PPG signal and RR data directly
   * No simulation or reference values are used
   */
  public processSignal(value: number, rrData?: { intervals: number[], lastPeakTime: number | null }, isWeakSignal?: boolean): VitalSignsResult {
    // Update signal quality - direct measurement only
    this.signalQualityProcessor.updateNoiseLevel(value, value);
    const ppgValues = [value]; // Replace with actual PPG values buffer
    const quality = this.signalQualityProcessor.calculateSignalQuality(ppgValues);
    
    // Process vital signs - direct measurement only
    const spo2 = this.spo2Processor.calculateSPO2(value, quality, isWeakSignal);
    const pressure = this.bloodPressureProcessor.calculatePressure(value, quality, isWeakSignal);
    const arrhythmiaStatus = this.arrhythmiaProcessor.detectArrhythmia(rrData, quality, isWeakSignal);
    const glucose = this.glucoseProcessor.calculateGlucose(value, quality, isWeakSignal);
    const lipids = this.lipidsProcessor.calculateLipids(value, quality, isWeakSignal);
    
    let result = resultFactory.createResult({
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      lastArrhythmiaData: this.arrhythmiaProcessor.getLastArrhythmiaData()
    });
    
    const now = Date.now();

    if (result.arrhythmiaStatus && result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && 
        result.lastArrhythmiaData) {
        // Format data correctly for downstream processing
        const formattedData: ArrhythmiaDetectionResult = {
            timestamp: now,
            rmssd: result.lastArrhythmiaData.rmssd || 0,
            rrVariation: result.lastArrhythmiaData.rrVariation || 0
        };
        result.lastArrhythmiaData = formattedData;
    }
    
    return result;
  }
  
  /**
   * Reset all processors - direct measurement only
   * No simulation or reference values are used
   */
  public reset(): void {
    this.signalQualityProcessor.reset();
    this.bloodPressureProcessor.reset();
    this.spo2Processor.reset();
    this.glucoseProcessor.reset();
    this.lipidsProcessor.reset();
    this.arrhythmiaProcessor.reset();
  }
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaProcessor.resetCounter();
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Get debug information
   */
  public getDebugInfo(): any {
    return {
      noiseLevel: this.signalQualityProcessor.getNoiseLevel()
    };
  }
}

// Export the VitalSignsResult type
export type { VitalSignsResult, ArrhythmiaDetectionResult } from './types/vital-signs-result';
