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

  // Arrhythmia segment tracking
  const currentArrhythmiaSegmentRef = useRef<{startTime: number, endTime: number | null} | null>(null);
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  
  /**
   * Process a real PPG signal value
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
      const now = Date.now();
      
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
    
    // Arrhythmia segment management
    let arrhythmiaSegment = null;
    if (currentBeatIsArrhythmiaRef.current) {
      // If this is the start of a new arrhythmia
      if (currentArrhythmiaSegmentRef.current === null) {
        const now = Date.now();
        currentArrhythmiaSegmentRef.current = {
          startTime: now,
          endTime: null
        };
        
        // Add to segments list
        arrhythmiaSegmentsRef.current.push(currentArrhythmiaSegmentRef.current);
      }
      
      arrhythmiaSegment = { ...currentArrhythmiaSegmentRef.current };
    } else if (currentArrhythmiaSegmentRef.current !== null) {
      // End of arrhythmia segment
      currentArrhythmiaSegmentRef.current.endTime = Date.now();
      arrhythmiaSegment = { ...currentArrhythmiaSegmentRef.current };
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
