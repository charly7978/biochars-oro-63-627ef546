import { useState, useCallback, useRef, useEffect } from 'react';
import { KalmanFilter, calculateBPMFromIntervals } from '../utils/signalProcessingUtils';

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

interface HeartBeatProcessorState {
  signalBuffer: number[];
  medianBuffer: number[];
  movingAverageBuffer: number[];
  smoothedValue: number;
  lastPeakTime: number | null;
  previousPeakTime: number | null;
  bpmHistory: number[];
  baseline: number;
  lastValue: number;
  values: number[];
  peakConfirmationBuffer: number[];
  lastConfirmedPeak: boolean;
  smoothBPM: number;
}

export const useHeartBeatProcessor = () => {
  // State
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [lastRRInterval, setLastRRInterval] = useState(0);
  const [rmssd, setRmssd] = useState(0);
  
  // References
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const rrIntervalsRef = useRef<number[]>([]);
  const arrhythmiaCounterRef = useRef<number>(0);
  const kalmanFilterRef = useRef<KalmanFilter>(new KalmanFilter());
  const stateRef = useRef<HeartBeatProcessorState>({
    signalBuffer: [],
    medianBuffer: [],
    movingAverageBuffer: [],
    smoothedValue: 0,
    lastPeakTime: null,
    previousPeakTime: null,
    bpmHistory: [],
    baseline: 0,
    lastValue: 0,
    values: [],
    peakConfirmationBuffer: [],
    lastConfirmedPeak: false,
    smoothBPM: 0
  });
  
  // Constants
  const SAMPLE_RATE = 30;
  const WINDOW_SIZE = 60;
  const MIN_BPM = 40;
  const MAX_BPM = 200;
  const SIGNAL_THRESHOLD = 0.60;
  const MIN_CONFIDENCE = 0.50;
  const DERIVATIVE_THRESHOLD = -0.03;
  const MIN_PEAK_TIME_MS = 400;
  
  // Error threshold based on clinical standards
  const RMSSD_THRESHOLD = 25;  // ms
  const DETECTION_WINDOW_SIZE = 8;
  const ARRHYTHMIA_COUNTER_RESET_MS = 5000;
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  // Initialization
  useEffect(() => {
    console.log("useHeartBeatProcessor: hook initialized", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      reset();
    };
  }, []);
  
  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   * Key metric for heart rate variability analysis
   */
  const calculateRMSSD = useCallback((intervals: number[]): number => {
    if (intervals.length < 2) return 0;
    
    // Calculate successive differences
    const successiveDiffs: number[] = [];
    for (let i = 1; i < intervals.length; i++) {
      const diff = Math.abs(intervals[i] - intervals[i - 1]);
      successiveDiffs.push(diff);
    }
    
    // Square the differences
    const squaredDiffs = successiveDiffs.map(diff => diff * diff);
    
    // Calculate mean of squared differences
    const meanSquared = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length;
    
    // Take the square root
    return Math.sqrt(meanSquared);
  }, []);
  
  /**
   * Detect arrhythmia based on HRV metrics
   */
  const detectArrhythmia = useCallback((rmssdValue: number, intervals: number[]): boolean => {
    if (intervals.length < DETECTION_WINDOW_SIZE) return false;
    
    const rrVariability = Math.abs(rmssdValue);
    const isArrhythmic = rrVariability > RMSSD_THRESHOLD;
    
    // Increment/reset arrhythmia counter
    const now = Date.now();
    if (isArrhythmic) {
      arrhythmiaCounterRef.current += 1;
      lastArrhythmiaTimeRef.current = now;
    } else if (now - lastArrhythmiaTimeRef.current > ARRHYTHMIA_COUNTER_RESET_MS) {
      // Reset counter after some time without arrhythmias
      arrhythmiaCounterRef.current = 0;
    }
    
    return isArrhythmic;
  }, []);
  
  /**
   * Apply median filter to input signal
   */
  const medianFilter = useCallback((value: number): number => {
    const buffer = stateRef.current.medianBuffer;
    buffer.push(value);
    
    if (buffer.length > 3) {
      buffer.shift();
    }
    
    const sorted = [...buffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, []);
  
  /**
   * Apply moving average filter
   */
  const calculateMovingAverage = useCallback((value: number): number => {
    const buffer = stateRef.current.movingAverageBuffer;
    buffer.push(value);
    
    if (buffer.length > 5) {
      buffer.shift();
    }
    
    const sum = buffer.reduce((a, b) => a + b, 0);
    return sum / buffer.length;
  }, []);
  
  /**
   * Apply exponential moving average filter
   */
  const calculateEMA = useCallback((value: number): number => {
    const alpha = 0.3;
    stateRef.current.smoothedValue = alpha * value + (1 - alpha) * stateRef.current.smoothedValue;
    return stateRef.current.smoothedValue;
  }, []);
  
  /**
   * Detect peaks in the heart beat signal
   */
  const detectPeak = useCallback((normalizedValue: number, derivative: number): { 
    isPeak: boolean; 
    confidence: number 
  } => {
    const state = stateRef.current;
    const now = Date.now();
    const timeSinceLastPeak = state.lastPeakTime
      ? now - state.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    const isPeak =
      derivative < DERIVATIVE_THRESHOLD &&
      normalizedValue > SIGNAL_THRESHOLD &&
      state.lastValue > state.baseline * 0.98;

    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (SIGNAL_THRESHOLD * 1.8), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(DERIVATIVE_THRESHOLD * 0.8), 0),
      1
    );

    const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

    return { isPeak, confidence };
  }, []);
  
  /**
   * Confirm peaks with additional analysis
   */
  const confirmPeak = useCallback((isPeak: boolean, normalizedValue: number, confidence: number): boolean => {
    const state = stateRef.current;
    state.peakConfirmationBuffer.push(normalizedValue);
    
    if (state.peakConfirmationBuffer.length > 5) {
      state.peakConfirmationBuffer.shift();
    }

    if (isPeak && !state.lastConfirmedPeak && confidence >= MIN_CONFIDENCE) {
      if (state.peakConfirmationBuffer.length >= 3) {
        const len = state.peakConfirmationBuffer.length;
        const goingDown1 =
          state.peakConfirmationBuffer[len - 1] < state.peakConfirmationBuffer[len - 2];
        const goingDown2 =
          state.peakConfirmationBuffer[len - 2] < state.peakConfirmationBuffer[len - 3];

        if (goingDown1 && goingDown2) {
          state.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      state.lastConfirmedPeak = false;
    }

    return false;
  }, []);
  
  /**
   * Update BPM calculation when a new peak is detected
   */
  const updateBPM = useCallback(() => {
    const state = stateRef.current;
    if (!state.lastPeakTime || !state.previousPeakTime) return;
    
    const interval = state.lastPeakTime - state.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    if (instantBPM >= MIN_BPM && instantBPM <= MAX_BPM) {
      state.bpmHistory.push(instantBPM);
      if (state.bpmHistory.length > 12) {
        state.bpmHistory.shift();
      }
    }
  }, []);
  
  /**
   * Get smoothed BPM value
   */
  const getSmoothBPM = useCallback(() => {
    const state = stateRef.current;
    const rawBPM = calculateCurrentBPM();
    
    if (state.smoothBPM === 0) {
      state.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    const alpha = 0.2;
    state.smoothBPM = alpha * rawBPM + (1 - alpha) * state.smoothBPM;
    return state.smoothBPM;
  }, []);
  
  /**
   * Calculate current BPM from recent history
   */
  const calculateCurrentBPM = useCallback(() => {
    const bpmHistory = stateRef.current.bpmHistory;
    if (bpmHistory.length < 2) {
      return 0;
    }
    
    const sorted = [...bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    if (!trimmed.length) return 0;
    
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }, []);
  
  /**
   * Process signal to detect heart beats
   */
  const processSignal = useCallback((value: number): HeartBeatResult => {
    const state = stateRef.current;
    
    // Apply filters
    const medVal = medianFilter(value);
    const movAvgVal = calculateMovingAverage(medVal);
    const smoothed = calculateEMA(movAvgVal);

    // Add to signal buffer
    state.signalBuffer.push(smoothed);
    if (state.signalBuffer.length > WINDOW_SIZE) {
      state.signalBuffer.shift();
    }

    if (state.signalBuffer.length < 30) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Update baseline
    state.baseline = state.baseline * 0.995 + smoothed * 0.005;

    const normalizedValue = smoothed - state.baseline;

    // Update values array for derivative calculation
    state.values.push(smoothed);
    if (state.values.length > 3) {
      state.values.shift();
    }

    // Calculate smoothed derivative
    let smoothDerivative = smoothed - state.lastValue;
    if (state.values.length === 3) {
      smoothDerivative = (state.values[2] - state.values[0]) / 2;
    }
    state.lastValue = smoothed;

    // Detect and confirm peaks
    const { isPeak, confidence } = detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = state.lastPeakTime
        ? now - state.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= MIN_PEAK_TIME_MS) {
        state.previousPeakTime = state.lastPeakTime;
        state.lastPeakTime = now;
        updateBPM();
        
        // Update RR intervals
        if (state.previousPeakTime && state.lastPeakTime) {
          const rrInterval = state.lastPeakTime - state.previousPeakTime;
          rrIntervalsRef.current.push(rrInterval);
          
          // Keep RR intervals history to a reasonable size
          if (rrIntervalsRef.current.length > DETECTION_WINDOW_SIZE * 2) {
            rrIntervalsRef.current.shift();
          }
          
          // Update last RR interval
          setLastRRInterval(rrInterval);
          
          // Calculate RMSSD if we have enough intervals
          if (rrIntervalsRef.current.length >= DETECTION_WINDOW_SIZE) {
            const currentRmssd = calculateRMSSD(rrIntervalsRef.current.slice(-DETECTION_WINDOW_SIZE));
            setRmssd(currentRmssd);
            
            // Detect arrhythmia
            const isArrhythmicBeat = detectArrhythmia(currentRmssd, rrIntervalsRef.current);
            setIsArrhythmia(isArrhythmicBeat);
          }
        }
      }
    }

    return {
      bpm: Math.round(getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak,
      filteredValue: smoothed,
      rrData: {
        intervals: rrIntervalsRef.current,
        lastPeakTime: state.lastPeakTime
      }
    };
  }, [
    medianFilter, 
    calculateMovingAverage, 
    calculateEMA, 
    detectPeak, 
    confirmPeak, 
    updateBPM, 
    getSmoothBPM,
    calculateRMSSD,
    detectArrhythmia
  ]);
  
  /**
   * Reset all state and filters
   */
  const reset = useCallback(() => {
    // Reset Kalman filter
    kalmanFilterRef.current.reset();
    
    // Reset state
    stateRef.current = {
      signalBuffer: [],
      medianBuffer: [],
      movingAverageBuffer: [],
      smoothedValue: 0,
      lastPeakTime: null,
      previousPeakTime: null,
      bpmHistory: [],
      baseline: 0,
      lastValue: 0,
      values: [],
      peakConfirmationBuffer: [],
      lastConfirmedPeak: false,
      smoothBPM: 0
    };
    
    // Reset references
    rrIntervalsRef.current = [];
    arrhythmiaCounterRef.current = 0;
    
    // Reset state variables
    setRmssd(0);
    setIsArrhythmia(false);
    setLastRRInterval(0);
  }, []);
  
  return {
    processSignal,
    reset,
    rmssd,
    isArrhythmia,
    lastRRInterval,
    arrhythmiaCounter: arrhythmiaCounterRef.current
  };
};
