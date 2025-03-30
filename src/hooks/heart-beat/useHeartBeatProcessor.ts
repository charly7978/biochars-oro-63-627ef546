
import { useState, useCallback, useRef } from 'react';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  resetSignalQualityState,
  handlePeakDetection,
  updateLastValidBpm,
  processLowConfidenceResult
} from './signal-processing';

// Constants for heart rate calculation
const MIN_CONFIDENCE_THRESHOLD = 0.4;
const MAX_HEART_RATE = 220;
const MIN_HEART_RATE = 40;
const ARRHYTHMIA_THRESHOLD = 0.15;

// Types
interface HeartBeatResult {
  bpm: number;
  confidence: number;
  rrData: number[];
  timestamp: number;
}

export const useHeartBeatProcessor = () => {
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  
  // State for peak detection
  const peakDetectionState = useRef({
    lastPeakTime: 0,
    peakTimes: [] as number[],
    rrIntervals: [] as number[],
    lastValidBpm: 0,
    consecutiveLowConfidence: 0,
    isMonitoring: false,
    arrhythmiaCount: 0,
    totalBeats: 0,
    lastArrhythmiaCheck: 0
  });
  
  const startMonitoring = useCallback(() => {
    peakDetectionState.current.isMonitoring = true;
    peakDetectionState.current.lastPeakTime = 0;
    peakDetectionState.current.peakTimes = [];
    peakDetectionState.current.rrIntervals = [];
    peakDetectionState.current.lastValidBpm = 0;
    peakDetectionState.current.consecutiveLowConfidence = 0;
    peakDetectionState.current.arrhythmiaCount = 0;
    peakDetectionState.current.totalBeats = 0;
    peakDetectionState.current.lastArrhythmiaCheck = 0;
    resetSignalQualityState();
    setIsArrhythmia(false);
  }, []);
  
  const stopMonitoring = useCallback(() => {
    peakDetectionState.current.isMonitoring = false;
  }, []);
  
  const reset = useCallback(() => {
    peakDetectionState.current.lastPeakTime = 0;
    peakDetectionState.current.peakTimes = [];
    peakDetectionState.current.rrIntervals = [];
    peakDetectionState.current.lastValidBpm = 0;
    peakDetectionState.current.consecutiveLowConfidence = 0;
    peakDetectionState.current.arrhythmiaCount = 0;
    peakDetectionState.current.totalBeats = 0;
    peakDetectionState.current.lastArrhythmiaCheck = 0;
    resetSignalQualityState();
    setIsArrhythmia(false);
  }, []);
  
  const processSignal = useCallback((signalValue: number): HeartBeatResult => {
    if (!peakDetectionState.current.isMonitoring) {
      return {
        bpm: 0,
        confidence: 0,
        rrData: [],
        timestamp: Date.now()
      };
    }
    
    // Check if signal is too weak to process
    if (checkWeakSignal(signalValue)) {
      return createWeakSignalResult(peakDetectionState.current.lastValidBpm);
    }
    
    // Process the signal for peak detection
    const peakResult = handlePeakDetection(signalValue, peakDetectionState.current);
    
    // Use values from peakResult
    peakDetectionState.current.lastPeakTime = peakResult.lastPeakTime;
    peakDetectionState.current.peakTimes = peakResult.peakTimes;
    peakDetectionState.current.rrIntervals = peakResult.rrIntervals;
    
    // Calculate heart rate from RR intervals
    let bpm = 0;
    let confidence = 0;
    
    if (peakDetectionState.current.rrIntervals.length >= 3) {
      // Calculate average RR interval
      const recentRRs = peakDetectionState.current.rrIntervals.slice(-5);
      const avgRR = recentRRs.reduce((sum, rr) => sum + rr, 0) / recentRRs.length;
      
      // Convert to BPM
      bpm = Math.round(60000 / avgRR);
      
      // Validate BPM is within physiological range
      if (bpm < MIN_HEART_RATE || bpm > MAX_HEART_RATE) {
        confidence = 0.2;
      } else {
        // Calculate confidence based on RR interval consistency
        const rrVariability = recentRRs.reduce((sum, rr) => sum + Math.abs(rr - avgRR), 0) / recentRRs.length;
        const normalizedVariability = rrVariability / avgRR;
        confidence = Math.max(0, 1 - normalizedVariability * 2);
        
        // Check for arrhythmia
        if (recentRRs.length >= 4 && peakDetectionState.current.totalBeats > 10) {
          const now = Date.now();
          if (now - peakDetectionState.current.lastArrhythmiaCheck > 2000) {
            peakDetectionState.current.lastArrhythmiaCheck = now;
            
            // Calculate RR interval variability
            const rrDiffs = [];
            for (let i = 1; i < recentRRs.length; i++) {
              rrDiffs.push(Math.abs(recentRRs[i] - recentRRs[i-1]) / recentRRs[i-1]);
            }
            
            const avgRRDiff = rrDiffs.reduce((sum, diff) => sum + diff, 0) / rrDiffs.length;
            
            // If variability exceeds threshold, count as arrhythmia
            if (avgRRDiff > ARRHYTHMIA_THRESHOLD) {
              peakDetectionState.current.arrhythmiaCount++;
              setIsArrhythmia(true);
            } else {
              setIsArrhythmia(false);
            }
          }
        }
        
        // Increment total beats counter
        peakDetectionState.current.totalBeats++;
      }
    } else if (peakDetectionState.current.rrIntervals.length > 0) {
      // Limited data available
      const lastRR = peakDetectionState.current.rrIntervals[peakDetectionState.current.rrIntervals.length - 1];
      bpm = Math.round(60000 / lastRR);
      confidence = 0.3;
    }
    
    // Process the result based on confidence
    if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
      peakDetectionState.current.lastValidBpm = updateLastValidBpm(bpm, peakDetectionState.current.lastValidBpm);
      peakDetectionState.current.consecutiveLowConfidence = 0;
      
      return {
        bpm: peakDetectionState.current.lastValidBpm,
        confidence,
        rrData: peakDetectionState.current.rrIntervals.slice(-10),
        timestamp: Date.now()
      };
    } else {
      // Handle low confidence result
      const processedResult = processLowConfidenceResult(
        bpm,
        confidence,
        peakDetectionState.current.lastValidBpm
      );
      
      peakDetectionState.current.consecutiveLowConfidence++;
      
      return {
        bpm: processedResult.bpm,
        confidence: processedResult.confidence,
        rrData: peakDetectionState.current.rrIntervals.slice(-10),
        timestamp: Date.now()
      };
    }
  }, []);
  
  return {
    processSignal,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    reset,
    getArrhythmiaStats: () => ({
      count: peakDetectionState.current.arrhythmiaCount,
      totalBeats: peakDetectionState.current.totalBeats
    })
  };
};
