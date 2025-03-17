
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { RRAnalysisResult } from './types';

/**
 * Specialized class for direct analysis of genuine RR intervals
 * No simulation or artificial manipulation of results
 */
export class RRIntervalAnalyzer {
  /**
   * Analyze RR intervals to detect real arrhythmias
   * Based purely on actual captured signal data
   */
  public analyzeIntervals(intervals: number[]): RRAnalysisResult | null {
    if (intervals.length < 8) return null;
    
    // Filter for physiological values
    const validIntervals = intervals.filter(i => i >= 400 && i <= 1500);
    if (validIntervals.length < intervals.length * 0.75) return null;
    
    // Calculate key metrics from real data
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const lastRR = validIntervals[validIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Calculate RMSSD from actual intervals
    let sumSquaredDiff = 0;
    for (let i = 1; i < validIntervals.length; i++) {
      sumSquaredDiff += Math.pow(validIntervals[i] - validIntervals[i-1], 2);
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (validIntervals.length - 1));
    
    // Detect if this is an arrhythmia based on actual measurements
    const isArrhythmia = 
      (rrVariation > 0.2) && // Significant variation
      (rmssd > 30);          // Elevated RMSSD
      
    return {
      rmssd,
      rrVariation,
      timestamp: Date.now(),
      isArrhythmia,
      heartRate: Math.round(60000 / avgRR),
      signalQuality: 1.0 - (Math.min(0.5, rrVariation))
    };
  }
}
