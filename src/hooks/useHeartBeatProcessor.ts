
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastProcessedTimeRef = useRef<number>(0);
  const processingIntervalRef = useRef<number>(33); // Process at 30Hz for better stability
  const signalBufferRef = useRef<number[]>([]);
  const BUFFER_SIZE = 60; // Larger buffer for better signal analysis
  const stableReadingsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creating new HeartBeatProcessor instance', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
    }

    return () => {
      console.log('useHeartBeatProcessor: Cleaning up processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor not initialized', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Implement rate limiting for processing stability
    const now = Date.now();
    if (now - lastProcessedTimeRef.current < processingIntervalRef.current) {
      return {
        bpm: currentBPM,
        confidence,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: processorRef.current.getRRIntervals()
      };
    }
    lastProcessedTimeRef.current = now;

    // Store signal in buffer for quality analysis
    signalBufferRef.current.push(value);
    if (signalBufferRef.current.length > BUFFER_SIZE) {
      signalBufferRef.current.shift();
    }

    // Robust signal quality analysis
    const signalQuality = analyzeSignalQuality(signalBufferRef.current);

    // Apply more aggressive adaptive amplification based on signal quality
    const amplificationFactor = calculateAmplificationFactor(signalQuality);
    const amplifiedValue = value * amplificationFactor;

    // Process signal through heart beat processor
    const result = processorRef.current.processSignal(amplifiedValue);
    const rrData = processorRef.current.getRRIntervals();

    // Only update BPM if we have reasonable confidence and physiological range
    if (result.bpm > 0 && result.confidence >= 0.6 && result.bpm >= 45 && result.bpm <= 180) {
      // Check if current reading is similar to last valid reading
      const bpmDifference = lastValidBpmRef.current > 0 ? 
                          Math.abs(result.bpm - lastValidBpmRef.current) : 0;
      
      // Require several stable readings before reporting BPM
      if (bpmDifference <= 8 || lastValidBpmRef.current === 0) {
        stableReadingsCountRef.current++;
        lastValidBpmRef.current = result.bpm;
      } else {
        // Reset stability counter if reading is too different
        stableReadingsCountRef.current = Math.max(0, stableReadingsCountRef.current - 1);
      }
      
      // Only update displayed BPM when we have enough stable readings
      if (stableReadingsCountRef.current >= 3) {
        // Use weighted average to smooth BPM updates
        // Give more weight to new value for faster response
        const newBPM = currentBPM === 0 ? 
                     result.bpm : 
                     Math.round(result.bpm * 0.7 + currentBPM * 0.3);
        
        setCurrentBPM(newBPM);
        setConfidence(result.confidence);
      }
    } else if (result.confidence < 0.4) {
      // Gradually reduce stable count for low confidence readings
      stableReadingsCountRef.current = Math.max(0, stableReadingsCountRef.current - 0.5);
    }

    return {
      ...result,
      bpm: stableReadingsCountRef.current >= 3 ? Math.round(result.bpm) : currentBPM,
      filteredValue: amplifiedValue,
      rrData
    };
  }, [currentBPM, confidence]);

  // Enhanced signal quality analysis
  const analyzeSignalQuality = (buffer: number[]): number => {
    if (buffer.length < 15) return 0.5; // Default value if insufficient data
    
    // Calculate basic statistics
    const min = Math.min(...buffer);
    const max = Math.max(...buffer);
    const range = max - min;
    const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
    
    // Calculate variance and standard deviation
    const variance = buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buffer.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate coefficient of variation
    const cv = stdDev / (Math.abs(mean) || 1);
    
    // Analyze differences between consecutive samples (for noise detection)
    let diffSum = 0;
    for (let i = 1; i < buffer.length; i++) {
      diffSum += Math.abs(buffer[i] - buffer[i-1]);
    }
    const avgDiff = diffSum / (buffer.length - 1);
    
    // Check for sharp spikes that might indicate signal issues
    let spikeCount = 0;
    for (let i = 2; i < buffer.length; i++) {
      if (Math.abs(buffer[i] - buffer[i-1]) > 3 * avgDiff) {
        spikeCount++;
      }
    }
    const spikeRatio = spikeCount / (buffer.length - 2);
    
    // Calculate periodicity (looking for regular patterns)
    const autocorrelation = calculateAutocorrelation(buffer);
    const periodicity = Math.max(...autocorrelation.slice(10, 30)) / autocorrelation[0];
    
    // Initial quality score based on signal properties
    let qualityScore = 0;
    
    // 1. Signal too weak
    if (range < 0.08) {
      qualityScore = 0.1;
    }
    // 2. Too much noise
    else if (cv > 0.8 || spikeRatio > 0.2) {
      qualityScore = 0.2;
    }
    // 3. Rapid changes between samples (high frequency noise)
    else if (avgDiff > 0.4) {
      qualityScore = 0.3;
    }
    // 4. Pretty good signal with some periodicity
    else if (periodicity > 0.3) {
      qualityScore = 0.7 + (periodicity * 0.3);
    }
    // 5. Decent signal with moderate variability
    else {
      // Combine CV and range into a balanced score
      const cvScore = cv < 0.2 ? 0.8 : (cv > 0.6 ? 0.4 : map(cv, 0.2, 0.6, 0.8, 0.4));
      const rangeScore = (range < 0.15) ? map(range, 0.08, 0.15, 0.3, 0.7) : 
                        (range > 0.8 ? map(range, 0.8, 1.5, 0.7, 0.4) : 0.7);
      
      qualityScore = (cvScore * 0.6 + rangeScore * 0.4);
    }
    
    return Math.min(1.0, Math.max(0.1, qualityScore));
  };
  
  // Helper function to calculate autocorrelation for periodicity detection
  const calculateAutocorrelation = (buffer: number[]): number[] => {
    const n = buffer.length;
    const result: number[] = [];
    const mean = buffer.reduce((sum, val) => sum + val, 0) / n;
    
    // Normalize values around mean
    const normalized = buffer.map(v => v - mean);
    
    // Calculate autocorrelation for different lags
    for (let lag = 0; lag < Math.min(40, Math.floor(n/2)); lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += normalized[i] * normalized[i + lag];
      }
      result.push(sum);
    }
    
    return result;
  };
  
  // Helper function to map values between ranges
  const map = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
    return ((value - inMin) * (outMax - outMin) / (inMax - inMin)) + outMin;
  };
  
  // Calculate amplification factor based on signal quality and other heuristics
  const calculateAmplificationFactor = (quality: number): number => {
    // Base amplification factor
    const baseFactor = 2.5;
    
    // Adjust amplification inversely proportional to quality
    // Lower quality signals need more amplification
    const qualityAdjustment = map(quality, 0, 1, 1.2, -0.5);
    
    // Calculate final factor with limits
    const factor = Math.max(1.5, Math.min(3.8, baseFactor + qualityAdjustment));
    
    return factor;
  };

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
    } else {
      console.warn('useHeartBeatProcessor: Cannot reset - processor does not exist', {
        timestamp: new Date().toISOString()
      });
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    lastProcessedTimeRef.current = 0;
    signalBufferRef.current = [];
    stableReadingsCountRef.current = 0;
    lastValidBpmRef.current = 0;
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset
  };
};
