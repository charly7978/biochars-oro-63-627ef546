
import { useCallback, useRef } from 'react';

interface SignalProcessingResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  isArrhythmia?: boolean;
  arrhythmiaCount: number;
  arrhythmiaSegment?: {
    startTime: number;
    endTime: number | null;
  };
}

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const previousPeakTimesRef = useRef<number[]>([]);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Constants
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 10;
  const MAX_PEAK_TIMES = 20;
  const MIN_PEAK_INTERVAL_MS = 300;
  const MAX_PEAK_INTERVAL_MS = 1500;
  
  // Recovery state
  const signalRecoveryTimeoutRef = useRef<number | null>(null);
  const lastRRDataRef = useRef<{intervals: number[], lastPeakTime: number | null}>({
    intervals: [],
    lastPeakTime: null
  });

  // Critical fix: Improve arrhythmia segment tracking - completely revised
  // Clear separation between normal and arrhythmia segments
  const currentArrhythmiaSegmentRef = useRef<{startTime: number, endTime: number | null} | null>(null);
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  
  // Track the last time we processed an arrhythmia
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  /**
   * Process a real PPG signal value with improved arrhythmia segment boundaries
   */
  const processSignal = useCallback((
    value: number,
    currentBPM: number,
    confidence: number,
    processor: any,
    requestBeep: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ): SignalProcessingResult => {
    if (!processor) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        rrData: { intervals: [], lastPeakTime: null },
        arrhythmiaCount: 0
      };
    }
    
    // Process the signal with the processor
    const result = processor.processSignal(value);
    const now = Date.now();
    
    if (result.confidence < 0.1) {
      consecutiveWeakSignalsRef.current++;
      
      // If too many weak signals, gradually reduce BPM rather than dropping to 0
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS && lastValidBpmRef.current > 0) {
        result.bpm = Math.max(0, lastValidBpmRef.current - 1);
        result.confidence = Math.max(0.1, confidence - 0.05);
      }
    } else {
      consecutiveWeakSignalsRef.current = 0;
      
      // Store the BPM if it's valid
      if (result.bpm > 40 && result.bpm < 200 && result.confidence > 0.4) {
        lastValidBpmRef.current = result.bpm;
        lastSignalQualityRef.current = result.confidence;
      }
    }
    
    // Handle peaks and RR intervals with improved persistence
    if (result.isPeak && isMonitoringRef.current) {
      // Check if this peak is within physiological limits of the last one
      let validPeak = true;
      if (lastPeakTimeRef.current !== null) {
        const interval = now - lastPeakTimeRef.current;
        validPeak = interval >= MIN_PEAK_INTERVAL_MS && interval <= MAX_PEAK_INTERVAL_MS;
      }
      
      if (validPeak) {
        // If we're in beep mode and confidence is good, request a beep
        if (result.confidence > 0.4) {
          requestBeep(value);
        }
        
        // Update RR intervals for arrhythmia detection
        const prevPeakTime = lastPeakTimeRef.current;
        lastPeakTimeRef.current = now;
        
        // Save previous peak time for interval calculation
        previousPeakTimesRef.current.push(now);
        if (previousPeakTimesRef.current.length > MAX_PEAK_TIMES) {
          previousPeakTimesRef.current.shift();
        }
        
        // Calculate intervals between peaks
        if (prevPeakTime) {
          const interval = now - prevPeakTime;
          
          // Only use physiologically plausible intervals
          if (interval >= MIN_PEAK_INTERVAL_MS && interval <= MAX_PEAK_INTERVAL_MS) {
            // Update RR intervals with the new interval
            const newIntervals = [...lastRRIntervalsRef.current, interval];
            
            // Keep only the last 20 intervals
            if (newIntervals.length > 20) {
              lastRRIntervalsRef.current = newIntervals.slice(-20);
            } else {
              lastRRIntervalsRef.current = newIntervals;
            }
            
            // Store last RR data for recovery
            lastRRDataRef.current = {
              intervals: [...lastRRIntervalsRef.current],
              lastPeakTime: lastPeakTimeRef.current
            };
          }
        }
      }
    }
    
    let arrhythmiaSegment = null;
    
    // CRITICALLY FIXED: Arrhythmia segment precise boundary detection
    if (currentBeatIsArrhythmiaRef.current) {
      // This is a point with arrhythmia
      lastArrhythmiaTimeRef.current = now;
      
      // If we don't have an active arrhythmia segment, create one
      if (currentArrhythmiaSegmentRef.current === null) {
        // Start a new segment exactly at this moment - the beginning of the red waveform
        currentArrhythmiaSegmentRef.current = {
          startTime: now,
          endTime: null
        };
        
        // Add to tracking list
        arrhythmiaSegmentsRef.current.push(currentArrhythmiaSegmentRef.current);
        console.log("NEW ARRHYTHMIA SEGMENT STARTED at:", new Date(now).toISOString());
      }
      
      // Return the current segment for visualization
      arrhythmiaSegment = { ...currentArrhythmiaSegmentRef.current };
    } 
    // CRITICALLY FIXED: If this beat does NOT have arrhythmia but we had an active segment
    else if (currentArrhythmiaSegmentRef.current !== null) {
      // End the segment immediately - this is the exact end of the red waveform
      currentArrhythmiaSegmentRef.current.endTime = now;
      
      // Return the segment with its end time for visualization
      arrhythmiaSegment = { ...currentArrhythmiaSegmentRef.current };
      
      console.log("ARRHYTHMIA SEGMENT ENDED at:", new Date(now).toISOString(), 
                  "Duration:", now - currentArrhythmiaSegmentRef.current.startTime, "ms");
      
      // Reset current segment to null since it's complete
      currentArrhythmiaSegmentRef.current = null;
    }
    
    // Keep only recent arrhythmia segments (last 5)
    if (arrhythmiaSegmentsRef.current.length > 5) {
      arrhythmiaSegmentsRef.current = arrhythmiaSegmentsRef.current.slice(-5);
    }
    
    // Create RR data to return
    const rrData = {
      intervals: [...lastRRIntervalsRef.current],
      lastPeakTime: lastPeakTimeRef.current
    };
    
    return {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      rrData,
      isArrhythmia: currentBeatIsArrhythmiaRef.current,
      arrhythmiaCount: 0, // This will be set by the ArrhythmiaDetectionService
      arrhythmiaSegment
    };
  }, []);
  
  /**
   * Reset signal processing state
   */
  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    previousPeakTimesRef.current = [];
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    
    // Clear any recovery timeout
    if (signalRecoveryTimeoutRef.current) {
      clearTimeout(signalRecoveryTimeoutRef.current);
      signalRecoveryTimeoutRef.current = null;
    }
    
    // Reset last RR data
    lastRRDataRef.current = {
      intervals: [],
      lastPeakTime: null
    };
    
    // Reset arrhythmia segments
    currentArrhythmiaSegmentRef.current = null;
    arrhythmiaSegmentsRef.current = [];
    lastArrhythmiaTimeRef.current = 0;
    
    console.log("SignalProcessor: Reset completed");
  }, []);
  
  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    previousPeakTimesRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    lastRRDataRef,
    arrhythmiaSegmentsRef,
    currentArrhythmiaSegmentRef
  };
}
