
import { RRAnalysisResult } from '../hooks/arrhythmia/types';

/**
 * Logs comprehensive RR interval analysis results for diagnostics
 */
export function logRRAnalysis(
  analysisData: RRAnalysisResult,
  lastIntervals: number[]
): void {
  console.log("Advanced RR Analysis", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    heartRate: analysisData.heartRate,
    signalQuality: analysisData.signalQuality,
    lastThreeIntervals: lastIntervals.slice(-3),
    timestamp: new Date().toISOString()
  });
}

/**
 * Logs details about possible arrhythmia
 */
export function logPossibleArrhythmia(analysisData: RRAnalysisResult): void {
  console.log("Potential arrhythmia detected", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    timestamp: new Date().toISOString()
  });
}

/**
 * Logs confirmed arrhythmia with comprehensive metrics
 */
export function logConfirmedArrhythmia(
  analysisData: RRAnalysisResult,
  lastIntervals: number[],
  counter: number
): void {
  console.log("Confirmed arrhythmia:", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    intervals: lastIntervals.slice(-3),
    counter,
    timestamp: new Date().toISOString()
  });
}

/**
 * Logs arrhythmias that were detected but ignored
 */
export function logIgnoredArrhythmia(
  timeSinceLastArrhythmia: number,
  maxArrhythmiasPerSession: number,
  currentCounter: number
): void {
  console.log("Arrhythmia detected but ignored", {
    reason: timeSinceLastArrhythmia < 1000 ? 
      "Too soon after previous arrhythmia" : "Maximum arrhythmia count reached",
    timeSinceLastArrhythmia,
    maxAllowed: maxArrhythmiasPerSession,
    currentCount: currentCounter,
    timestamp: new Date().toISOString()
  });
}
