
import { RRInterval } from '../../types/heartbeat';
import { ProcessorConfig } from '../config/ProcessorConfig';

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map: number;  // Mean Arterial Pressure
  confidence: number;
}

export class BloodPressureAnalyzer {
  private baselineSystolic = 120;
  private baselineDiastolic = 80;
  private config: ProcessorConfig;
  
  constructor(config: ProcessorConfig) {
    this.config = config;
  }
  
  /**
   * Calculate blood pressure based on heart rate variability and PPG signal
   * @param rrIntervals Array of RR intervals
   * @param ppgValues Array of PPG signal values
   * @returns Blood pressure estimation result
   */
  calculateBloodPressure(rrIntervals: RRInterval[], ppgValues: number[]): BloodPressureResult {
    if (!rrIntervals || rrIntervals.length < 5 || !ppgValues || ppgValues.length < 10) {
      return { systolic: 0, diastolic: 0, map: 0, confidence: 0 };
    }
    
    // Calculate heart rate from RR intervals
    let totalMs = 0;
    for (const interval of rrIntervals) {
      totalMs += interval.duration;
    }
    const avgRRInterval = totalMs / rrIntervals.length;
    const heartRate = 60000 / avgRRInterval;
    
    // Calculate signal features
    const signalAmplitude = Math.max(...ppgValues) - Math.min(...ppgValues);
    
    // Calculate time-based features (rise time, fall time)
    let riseTime = 0;
    let fallTime = 0;
    let peakCount = 0;
    
    for (let i = 1; i < ppgValues.length - 1; i++) {
      if (ppgValues[i] > ppgValues[i-1] && ppgValues[i] > ppgValues[i+1]) {
        peakCount++;
        
        // Find rise time (time from trough to peak)
        let j = i - 1;
        while (j > 0 && ppgValues[j] >= ppgValues[j-1]) j--;
        riseTime += (i - j);
        
        // Find fall time (time from peak to trough)
        let k = i + 1;
        while (k < ppgValues.length - 1 && ppgValues[k] >= ppgValues[k+1]) k++;
        fallTime += (k - i);
      }
    }
    
    if (peakCount > 0) {
      riseTime /= peakCount;
      fallTime /= peakCount;
    }
    
    // Calculate systolic using PTT (Pulse Transit Time) approximation
    // Uses the ratio of rise time to fall time as PTT analog
    const pttAnalog = riseTime / (fallTime + 0.01);
    
    // Apply calibration factor
    const adjustedHeartRate = heartRate * this.config.bpCalibrationFactor;
    
    // BP calculation based on research models
    // Systolic = baselineSystolic + k1*(HR-baselineHR) + k2*(1/PTT - 1/baselinePTT)
    const systolic = this.baselineSystolic + 
      0.7 * (adjustedHeartRate - 70) + 
      30 * (signalAmplitude - 0.5) +
      25 * (pttAnalog - 0.5);
    
    // Diastolic typically follows systolic with smaller variation
    const diastolic = this.baselineDiastolic + 
      0.4 * (adjustedHeartRate - 70) + 
      10 * (signalAmplitude - 0.5) +
      15 * (pttAnalog - 0.5);
    
    // Mean Arterial Pressure calculation
    const map = diastolic + (systolic - diastolic) / 3;
    
    // Calculate confidence based on signal and heart rate stability
    const rrVariability = this.calculateRRVariability(rrIntervals);
    const confidence = Math.max(0, Math.min(1, 
      (1 - rrVariability / 150) * 
      (signalAmplitude > 0.2 ? 1 : signalAmplitude / 0.2) *
      (peakCount > 5 ? 1 : peakCount / 5)
    ));
    
    return {
      systolic: Math.round(Math.max(70, Math.min(220, systolic))),
      diastolic: Math.round(Math.max(40, Math.min(120, diastolic))),
      map: Math.round(map),
      confidence: confidence
    };
  }
  
  private calculateRRVariability(rrIntervals: RRInterval[]): number {
    if (rrIntervals.length < 2) return 0;
    
    const intervals = rrIntervals.map(rr => rr.duration);
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    let variance = 0;
    for (const interval of intervals) {
      variance += Math.pow(interval - mean, 2);
    }
    variance /= intervals.length;
    
    return Math.sqrt(variance);
  }
}
