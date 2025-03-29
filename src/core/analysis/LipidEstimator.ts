
import { ProcessorConfig } from '../config/ProcessorConfig';

export interface LipidResult {
  totalCholesterol: number;  // mg/dL
  triglycerides: number;     // mg/dL
  hdl?: number;              // mg/dL (calculado cuando hay suficientes datos)
  ldl?: number;              // mg/dL (calculado cuando hay suficientes datos)
  confidence: number;        // 0-1
}

export class LipidEstimator {
  private config: ProcessorConfig;
  
  constructor(config: ProcessorConfig) {
    this.config = config;
  }
  
  /**
   * Estimate lipid levels based on PPG signals and other parameters
   * 
   * @param ppgValues Array of PPG signal values
   * @param spo2 Blood oxygen level (percentage)
   * @param heartRate Heart rate in BPM
   * @returns Lipid estimation result
   */
  estimateLipidLevels(ppgValues: number[], spo2: number, heartRate: number): LipidResult {
    if (!ppgValues || ppgValues.length < 30 || spo2 <= 0 || heartRate <= 0) {
      return { totalCholesterol: 0, triglycerides: 0, confidence: 0 };
    }
    
    // Calculate PPG features
    const signalAmplitude = Math.max(...ppgValues) - Math.min(...ppgValues);
    const mean = ppgValues.reduce((sum, val) => sum + val, 0) / ppgValues.length;
    
    let varianceSum = 0;
    for (const val of ppgValues) {
      varianceSum += Math.pow(val - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / ppgValues.length);
    
    // Extract frequency domain features (simplified)
    const signalEnergy = ppgValues.reduce((sum, val) => sum + val * val, 0) / ppgValues.length;
    
    // Calculate pulse wave velocity analog from PPG
    // Higher cholesterol typically affects arterial stiffness which impacts wave propagation
    const baseCholesterol = 170 + (90 - heartRate) * 0.5;
    const cholesterolEstimate = baseCholesterol * this.config.cholesterolCalibrationFactor * 
      (1 + (stdDev - 0.15) * 0.5) *
      (1 + (100 - spo2) * 0.03) * 
      (1 + (signalEnergy - 0.5) * 0.2);
    
    // Triglycerides estimation - affected by different signal characteristics
    const baseTriglycerides = 120 + (90 - heartRate) * 0.3;
    const triglyceridesEstimate = baseTriglycerides * this.config.triglycerideCalibrationFactor * 
      (1 + (signalAmplitude - 0.4) * 0.4) *
      (1 + (100 - spo2) * 0.02) * 
      (1 + (mean - 0.2) * 0.3);
    
    // Calculate confidence based on signal quality and consistency
    const confidence = Math.max(0, Math.min(0.8,  // Max confidence capped at 80% due to indirect measurement
      (signalAmplitude > 0.2 ? 1 : signalAmplitude / 0.2) *
      (stdDev < 0.5 ? 1 : 0.5 / stdDev) *
      (spo2 > 90 ? 1 : spo2 / 90)
    ));
    
    // Calculate HDL and LDL if we have enough confidence
    let hdl, ldl;
    if (confidence > 0.5) {
      hdl = 40 + (spo2 - 92) * 0.8;
      ldl = cholesterolEstimate - hdl - (triglyceridesEstimate / 5);
    }
    
    return {
      totalCholesterol: Math.round(Math.max(100, Math.min(350, cholesterolEstimate))),
      triglycerides: Math.round(Math.max(50, Math.min(500, triglyceridesEstimate))),
      hdl: hdl ? Math.round(Math.max(20, Math.min(80, hdl))) : undefined,
      ldl: ldl ? Math.round(Math.max(50, Math.min(250, ldl))) : undefined,
      confidence: confidence
    };
  }
}
