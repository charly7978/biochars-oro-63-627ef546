
import { useState, useEffect, useRef } from 'react';
import { checkSignalQuality, processSignalResult } from './signal-processing';
// Import handlePeakDetection directly from the correct location
import { handlePeakDetection } from './signal-processing/peak-detection';
import { PeakResult, ProcessedSignal } from './types';

/**
 * Hook for processing PPG signals to detect heart beats
 * Direct measurement of real signals only - no simulation
 */
export const useSignalProcessor = () => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [fingerDetected, setFingerDetected] = useState<boolean>(false);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [isHighSignalQuality, setIsHighSignalQuality] = useState<boolean>(false);
  
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const signalValuesRef = useRef<number[]>([]);
  const filteredValuesRef = useRef<number[]>([]);
  const qualityValuesRef = useRef<number[]>([]);
  const lastTenValuesRef = useRef<number[]>([]);
  const lastTenFilteredValuesRef = useRef<number[]>([]);
  
  const [calibrationProgress, setCalibrationProgress] = useState({
    fingerDetection: 0,
    signalQuality: 0,
    stability: 0
  });
  
  const signalQualityThreshold = 0.6;
  const stabilityThreshold = 0.7;
  const fingerDetectionThreshold = 0.8;
  
  const [beepQueue, setBeepQueue] = useState<number[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Calibration parameters
  const calibrationWindowSize = 150;
  const minSignalValues = 50;
  const signalVariationThreshold = 5;
  
  // Signal quality parameters
  const signalQualityWindowSize = 100;
  const minSignalQualityValues = 50;
  const highSignalQualityThreshold = 0.75;
  
  // Stability parameters
  const stabilityWindowSize = 100;
  const minStabilityValues = 50;
  const stabilityThresholdValue = 0.7;
  
  // Finger detection parameters
  const fingerDetectionWindowSize = 100;
  const minFingerDetectionValues = 50;
  const fingerDetectionThresholdValue = 0.8;
  
  // Centralized signal quality parameters
  const LOW_SIGNAL_THRESHOLD = 0.05;
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 10;
  
  // Ref to track weak signals
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Beep sound parameters
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const beepFrequency = 500;
  const beepDuration = 0.1;
  const beepVolume = 0.1;
  
  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Function to request immediate beep
  const requestImmediateBeep = (value: number): boolean => {
    if (!audioContextRef.current) return false;
    
    // Check if audio context is suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    setBeepQueue(prevQueue => [...prevQueue, value]);
    return true;
  };
  
  // Process beep queue
  useEffect(() => {
    if (beepQueue.length === 0 || !audioContextRef.current) return;
    
    const playBeep = async () => {
      if (!audioContextRef.current) return;
      
      // Check if audio context is suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const value = beepQueue[0];
      
      // Create oscillator and gain node
      oscillatorRef.current = audioContextRef.current.createOscillator();
      gainNodeRef.current = audioContextRef.current.createGain();
      
      // Set oscillator frequency and type
      oscillatorRef.current.frequency.setValueAtTime(value, audioContextRef.current.currentTime);
      oscillatorRef.current.type = 'sine';
      
      // Set gain value
      gainNodeRef.current.gain.setValueAtTime(beepVolume, audioContextRef.current.currentTime);
      gainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime + beepDuration);
      
      // Connect nodes
      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // Start and stop oscillator
      oscillatorRef.current.start(audioContextRef.current.currentTime);
      oscillatorRef.current.stop(audioContextRef.current.currentTime + beepDuration);
      
      // Clean up nodes after beep
      oscillatorRef.current.onended = () => {
        if (oscillatorRef.current) {
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        }
        
        // Remove beep from queue
        setBeepQueue(prevQueue => prevQueue.slice(1));
      };
    };
    
    playBeep();
  }, [beepQueue]);
  
  // Function to start processing
  const startProcessing = () => {
    isMonitoringRef.current = true;
    setFingerDetected(false);
    setIsCalibrated(false);
    setIsHighSignalQuality(false);
    setLastSignal(null);
    
    signalValuesRef.current = [];
    filteredValuesRef.current = [];
    qualityValuesRef.current = [];
    lastTenValuesRef.current = [];
    lastTenFilteredValuesRef.current = [];
    consecutiveWeakSignalsRef.current = 0;
    
    setCalibrationProgress({
      fingerDetection: 0,
      signalQuality: 0,
      stability: 0
    });
  };
  
  // Function to stop processing
  const stopProcessing = () => {
    isMonitoringRef.current = false;
    setFingerDetected(false);
    setIsCalibrated(false);
    setIsHighSignalQuality(false);
    setLastSignal(null);
    
    signalValuesRef.current = [];
    filteredValuesRef.current = [];
    qualityValuesRef.current = [];
    lastTenValuesRef.current = [];
    lastTenFilteredValuesRef.current = [];
    consecutiveWeakSignalsRef.current = 0;
    
    setCalibrationProgress({
      fingerDetection: 0,
      signalQuality: 0,
      stability: 0
    });
  };
  
  // Function to process a frame
  const processFrame = (imageData: ImageData) => {
    if (!isMonitoringRef.current) return;
    
    // Process signal result
    const result = processSignalResult(imageData.data, imageData.width, imageData.height);
    
    // Update signal values
    signalValuesRef.current.push(result.value);
    
    // Filter signal values
    const alpha = 0.2;
    const lastFilteredValue = filteredValuesRef.current.length > 0 ?
      filteredValuesRef.current[filteredValuesRef.current.length - 1] :
      result.value;
    const filteredValue = alpha * result.value + (1 - alpha) * lastFilteredValue;
    filteredValuesRef.current.push(filteredValue);
    
    // Update last ten values
    lastTenValuesRef.current.push(result.value);
    if (lastTenValuesRef.current.length > 10) {
      lastTenValuesRef.current.shift();
    }
    
    // Update last ten filtered values
    lastTenFilteredValuesRef.current.push(filteredValue);
    if (lastTenFilteredValuesRef.current.length > 10) {
      lastTenFilteredValuesRef.current.shift();
    }
    
    // Update signal quality values
    qualityValuesRef.current.push(result.quality);
    
    // Check for weak signal using centralized function
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      result.value,
      consecutiveWeakSignalsRef.current,
      {
        lowSignalThreshold: LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
      }
    );
    
    consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
    
    // Update finger detection status
    const fingerDetectionProgress = calculateProgress(
      signalValuesRef.current,
      fingerDetectionWindowSize,
      minSignalValues,
      (values: number[]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return avg > 20;
      },
      fingerDetectionThresholdValue
    );
    
    // Update signal quality status
    const signalQualityProgress = calculateProgress(
      qualityValuesRef.current,
      signalQualityWindowSize,
      minSignalQualityValues,
      (values: number[]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return avg > highSignalQualityThreshold;
      },
      signalQualityThreshold
    );
    
    // Update stability status
    const stabilityProgress = calculateProgress(
      lastTenFilteredValuesRef.current,
      stabilityWindowSize,
      minStabilityValues,
      (values: number[]) => {
        if (values.length < 10) return false;
        const stdDev = calculateStandardDeviation(values);
        return stdDev < signalVariationThreshold;
      },
      stabilityThresholdValue
    );
    
    // Update calibration progress
    setCalibrationProgress({
      fingerDetection: fingerDetectionProgress,
      signalQuality: signalQualityProgress,
      stability: stabilityProgress
    });
    
    // Update finger detected status
    if (fingerDetectionProgress >= fingerDetectionThreshold) {
      setFingerDetected(true);
    } else {
      setFingerDetected(false);
    }
    
    // Update is high signal quality status
    if (signalQualityProgress >= signalQualityThreshold) {
      setIsHighSignalQuality(true);
    } else {
      setIsHighSignalQuality(false);
    }
    
    // Update is calibrated status
    if (stabilityProgress >= stabilityThreshold) {
      setIsCalibrated(true);
    } else {
      setIsCalibrated(false);
    }
    
    // Handle peak detection
    handlePeakDetection(
      result,
      lastPeakTimeRef,
      requestImmediateBeep,
      isMonitoringRef,
      filteredValue
    );
    
    // Update last signal
    setLastSignal({
      value: result.value,
      filteredValue: filteredValue,
      quality: result.quality,
      isPeak: result.isPeak,
      fingerDetected: fingerDetected,
      isWeakSignal: isWeakSignal,
      calibration: {
        progress: calibrationProgress,
        isCalibrated: isCalibrated,
        isHighSignalQuality: isHighSignalQuality
      }
    });
  };
  
  // Helper function to calculate progress
  const calculateProgress = (
    values: any[],
    windowSize: number,
    minValues: number,
    checkCondition: (values: any[]) => boolean,
    threshold: number
  ): number => {
    if (values.length < minValues) {
      return 0;
    }
    
    const window = values.slice(-windowSize);
    const validValues = window.filter(checkCondition);
    const progress = validValues.length / window.length;
    
    return Math.min(progress, threshold);
  };
  
  // Helper function to calculate standard deviation
  const calculateStandardDeviation = (values: number[]): number => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const diffs = values.map(value => value - avg);
    const squareDiffs = diffs.map(diff => diff * diff);
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
  };
  
  return {
    startProcessing,
    stopProcessing,
    processFrame,
    lastSignal,
    fingerDetected,
    isCalibrated,
    isHighSignalQuality,
    calibrationProgress,
    requestImmediateBeep,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    reset: stopProcessing,
    processSignal: (value: number) => ({ 
      bpm: lastValidBpmRef.current, 
      confidence: 0.5, 
      isPeak: false, 
      arrhythmiaCount: 0,
      rrData: { intervals: [], lastPeakTime: lastPeakTimeRef.current }
    })
  };
};
