
import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedSignal } from '../types/signal';
import { detectFinger, calculateSignalQuality } from '../utils/FingerDetection';

export const useSignalProcessor = () => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const readyToProcessRef = useRef<boolean>(false);
  const signalBufferRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const lastFingerDetectedRef = useRef<boolean>(false);
  const signalQualityRef = useRef<number>(0);
  const calibrationRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  const rawSignalHistoryRef = useRef<number[]>([]);
  
  // Enhanced parameters for better signal extraction
  const MAX_BUFFER_SIZE = 300;
  const QUALITY_THRESHOLD = 25; // Significantly reduced to capture weaker signals
  const FINGER_DETECTION_FRAMES = 2; // Faster finger detection
  const MIN_SIGNAL_AMPLITUDE = 0.001; // Much more sensitive to amplitude changes
  const fingerDetectionCounterRef = useRef<number>(0);
  
  // Improved filtering for human cardiac signals
  const LP_ALPHA = 0.2; // Increased for faster response to signal changes
  const SMA_WINDOW = 4; // Reduced for better responsiveness
  const lastFilteredValueRef = useRef<number | null>(null);
  
  // Dynamic amplification control
  const amplificationFactorRef = useRef<number>(100.0); // Increased initial amplification
  const previousSignalLevelsRef = useRef<number[]>([]);
  
  // Signal memory for continuity
  const validSignalMemoryRef = useRef<{value: number, quality: number}[]>([]);
  const MAX_MEMORY_SIZE = 30; // Increased for better history tracking
  
  // Detection stability management
  const consecutiveDetectionsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_DETECTIONS = 30;

  // Debug information
  const debugInfoRef = useRef<{
    avgSignalStrength: number,
    signalNoise: number,
    frameRate: number,
    lastFrameTime: number
  }>({
    avgSignalStrength: 0,
    signalNoise: 0,
    frameRate: 0,
    lastFrameTime: 0
  });
  
  useEffect(() => {
    return () => {
      console.log("useSignalProcessor hook cleanup");
      setIsProcessing(false);
      readyToProcessRef.current = false;
    };
  }, []);

  // Enhanced amplification function with better sensitivity
  const adjustAmplification = useCallback((value: number) => {
    const MAX_BUFFER = 15; // Increased buffer for better adaptation
    previousSignalLevelsRef.current.push(Math.abs(value));
    if (previousSignalLevelsRef.current.length > MAX_BUFFER) {
      previousSignalLevelsRef.current.shift();
    }
    
    if (previousSignalLevelsRef.current.length >= 5) {
      // Calculate recent average amplitude
      const avgAmplitude = previousSignalLevelsRef.current.reduce((sum, val) => sum + val, 0) / 
                          previousSignalLevelsRef.current.length;
      
      // Calculate signal variation/noise (important for heartbeat detection)
      const variationSum = previousSignalLevelsRef.current.reduce((sum, val) => 
        sum + Math.abs(val - avgAmplitude), 0);
      const avgVariation = variationSum / previousSignalLevelsRef.current.length;
      
      // Update debug information
      debugInfoRef.current.avgSignalStrength = avgAmplitude;
      debugInfoRef.current.signalNoise = avgVariation;
      
      // Much more aggressive adaptive strategy
      if (avgAmplitude < 0.004) {
        // Very weak signal - amplify significantly more
        amplificationFactorRef.current = Math.min(200, amplificationFactorRef.current * 1.15);
      } 
      else if (avgAmplitude < 0.01) {
        // Weak signal - increase amplification
        amplificationFactorRef.current = Math.min(160, amplificationFactorRef.current * 1.08);
      }
      else if (avgAmplitude < 0.02) {
        // Signal present but weak - gradually increase
        amplificationFactorRef.current = Math.min(140, amplificationFactorRef.current * 1.04);
      }
      // For very strong signals, reduce amplification
      else if (avgAmplitude > 0.3) {
        amplificationFactorRef.current = Math.max(20, amplificationFactorRef.current * 0.90);
      }
      // For strong signals, slightly reduce
      else if (avgAmplitude > 0.15) {
        amplificationFactorRef.current = Math.max(30, amplificationFactorRef.current * 0.95);
      } 
      // For signals in ideal range, make minor adjustments
      else if (avgAmplitude > 0.06) {
        amplificationFactorRef.current = Math.max(50, amplificationFactorRef.current * 0.98);
      } 
      else {
        // Slightly weak signal - minor increase
        amplificationFactorRef.current = Math.min(120, amplificationFactorRef.current * 1.02);
      }
      
      console.log(`Signal Amplitude: ${avgAmplitude.toFixed(4)}, Variation: ${avgVariation.toFixed(4)}, Amplification: ${amplificationFactorRef.current.toFixed(1)}`);
    }
    
    return value * amplificationFactorRef.current;
  }, []);

  const startProcessing = useCallback(() => {
    console.log("Signal processor: iniciando procesamiento");
    setIsProcessing(true);
    
    // Reset all buffers and states
    signalBufferRef.current = [];
    rawSignalHistoryRef.current = [];
    lastTimeRef.current = Date.now();
    lastFingerDetectedRef.current = false;
    lastFilteredValueRef.current = null;
    signalQualityRef.current = 0;
    frameCountRef.current = 0;
    fingerDetectionCounterRef.current = 0;
    previousSignalLevelsRef.current = [];
    validSignalMemoryRef.current = [];
    consecutiveDetectionsRef.current = 0;
    amplificationFactorRef.current = 100.0; // Higher initial amplification
    debugInfoRef.current = {
      avgSignalStrength: 0,
      signalNoise: 0,
      frameRate: 0,
      lastFrameTime: 0
    };
    setLastSignal(null);
    
    // Faster startup
    setTimeout(() => {
      console.log("Signal processor: listo para procesar");
      readyToProcessRef.current = true;
      calibrationRef.current = true;
      
      // Reduced calibration time
      setTimeout(() => {
        calibrationRef.current = false;
      }, 2000);
    }, 1000);
  }, []);

  const stopProcessing = useCallback(() => {
    console.log("Signal processor: deteniendo procesamiento");
    setIsProcessing(false);
    readyToProcessRef.current = false;
  }, []);

  // Improved low-pass filter with better parameters
  const applyLowPassFilter = useCallback((newValue: number, previousValue: number | null): number => {
    if (previousValue === null) return newValue;
    return previousValue + LP_ALPHA * (newValue - previousValue);
  }, []);
  
  // Enhanced SMA filter with weighted recent values
  const applySMAFilter = useCallback((buffer: number[]): number => {
    if (buffer.length === 0) return 0;
    if (buffer.length === 1) return buffer[0];
    
    const windowSize = Math.min(SMA_WINDOW, buffer.length);
    const recentValues = buffer.slice(-windowSize);
    
    // Weight recent values more (triangular weighting)
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < recentValues.length; i++) {
      const weight = i + 1; // More recent values get higher weights
      weightedSum += recentValues[i] * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
  }, []);

  // Significantly improved red channel extraction with focus on PPG signal
  const extractRedChannel = useCallback((imageData: ImageData): number => {
    const width = imageData.width;
    const height = imageData.height;
    
    // Create multiple sampling regions to find best PPG signal
    const REGION_COUNT = 3; // Sample from multiple regions
    const regionSize = Math.min(120, Math.floor(width / 3)); // Larger region
    
    // Center coordinates
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Define multiple sampling regions
    const regions = [
      // Central region (primary)
      {
        startX: centerX - Math.floor(regionSize / 2),
        startY: centerY - Math.floor(regionSize / 2),
        endX: centerX + Math.floor(regionSize / 2),
        endY: centerY + Math.floor(regionSize / 2),
        weight: 0.6 // Primary weight
      },
      // Top region (secondary)
      {
        startX: centerX - Math.floor(regionSize / 2),
        startY: centerY - regionSize - Math.floor(regionSize / 2),
        endX: centerX + Math.floor(regionSize / 2),
        endY: centerY - Math.floor(regionSize / 2),
        weight: 0.2 // Secondary weight
      },
      // Bottom region (secondary)
      {
        startX: centerX - Math.floor(regionSize / 2),
        startY: centerY + Math.floor(regionSize / 2),
        endX: centerX + Math.floor(regionSize / 2),
        endY: centerY + regionSize + Math.floor(regionSize / 2),
        weight: 0.2 // Secondary weight
      }
    ];
    
    let weightedRedValue = 0;
    let totalWeight = 0;
    
    // Process each region
    for (const region of regions) {
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let pixelCount = 0;
      
      // Analyze pixels in this region
      for (let y = region.startY; y < region.endY; y++) {
        for (let x = region.startX; x < region.endX; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            redSum += imageData.data[idx]; // Red channel
            greenSum += imageData.data[idx + 1]; // Green channel
            blueSum += imageData.data[idx + 2]; // Blue channel
            pixelCount++;
          }
        }
      }
      
      if (pixelCount > 0) {
        const avgRed = redSum / pixelCount;
        const avgGreen = greenSum / pixelCount;
        const avgBlue = blueSum / pixelCount;
        
        // Enhanced PPG extraction formula - prioritize red and suppress other channels
        // This formula is optimized for detecting blood volume changes
        const ppgValue = avgRed - (0.68 * avgGreen + 0.32 * avgBlue);
        
        // Add weighted contribution from this region
        weightedRedValue += ppgValue * region.weight;
        totalWeight += region.weight;
      }
    }
    
    // Return weighted average of all regions
    if (totalWeight > 0) {
      // Store raw value in history for trend analysis
      rawSignalHistoryRef.current.push(weightedRedValue / totalWeight);
      if (rawSignalHistoryRef.current.length > 60) { // Keep last second at 60fps
        rawSignalHistoryRef.current.shift();
      }
      
      return weightedRedValue / totalWeight;
    }
    
    return 0;
  }, []);

  const processFrame = useCallback((imageData: ImageData, fingerDetectedOverride?: boolean) => {
    const currentTime = Date.now();
    
    // Calculate and update frame rate for debugging
    if (debugInfoRef.current.lastFrameTime > 0) {
      const frameTimeMs = currentTime - debugInfoRef.current.lastFrameTime;
      debugInfoRef.current.frameRate = 1000 / frameTimeMs;
    }
    debugInfoRef.current.lastFrameTime = currentTime;
    
    frameCountRef.current++;
    
    // Skip if not processing or not ready
    if (!isProcessing || !readyToProcessRef.current) {
      return;
    }
    
    // Enhanced finger detection with better parameters
    const detectionResult = detectFinger(imageData, {
      redThreshold: 60,                // Even lower threshold
      brightnessThreshold: 40,         // Lower brightness requirement
      redDominanceThreshold: 12,       // Less strict red dominance
      regionSize: 40,                  // Optimal region size
      adaptiveMode: true,              // Always use adaptive detection
      maxIntensityThreshold: 225       // Higher max threshold
    });
    
    let fingerDetected = detectionResult.detected;
    
    // Use override if provided
    if (fingerDetectedOverride !== undefined) {
      fingerDetected = fingerDetectedOverride;
    }
    
    // Enhanced detection logic with faster response
    if (fingerDetected) {
      fingerDetectionCounterRef.current++;
      
      if (!lastFingerDetectedRef.current && fingerDetectionCounterRef.current >= FINGER_DETECTION_FRAMES) {
        console.log("Dedo detectado después de", fingerDetectionCounterRef.current, "frames");
        lastFingerDetectedRef.current = true;
        consecutiveDetectionsRef.current = 0;
      }
    } else {
      fingerDetectionCounterRef.current = 0;
      
      if (lastFingerDetectedRef.current) {
        consecutiveDetectionsRef.current++;
        
        // Allow a bit more leeway before considering finger removed
        if (consecutiveDetectionsRef.current >= 8) {
          lastFingerDetectedRef.current = false;
          consecutiveDetectionsRef.current = 0;
        }
      }
    }
    
    // Calculate signal quality with enhanced sensitivity
    const signalQuality = calculateSignalQuality(detectionResult);
    signalQualityRef.current = signalQuality;
    
    // Extract red channel with improved PPG optimization
    const redValue = extractRedChannel(imageData);
    
    // Process only if finger detected with acceptable quality
    if (lastFingerDetectedRef.current) {
      // Add to buffer
      signalBufferRef.current.push(redValue);
      
      // Limit buffer size
      if (signalBufferRef.current.length > MAX_BUFFER_SIZE) {
        signalBufferRef.current.shift();
      }
      
      // Apply enhanced filtering chain optimized for heartbeat detection
      // 1. First SMA with weighted recent values
      const smoothedValue = applySMAFilter(signalBufferRef.current);
      
      // 2. Then low-pass filter with higher alpha for better responsiveness
      const basicFiltered = applyLowPassFilter(smoothedValue, lastFilteredValueRef.current);
      
      // 3. Finally, dynamic amplification
      const amplifiedValue = adjustAmplification(basicFiltered);
      
      lastFilteredValueRef.current = basicFiltered; // Store unamplified value
      
      // Store in valid signal memory
      validSignalMemoryRef.current.push({
        value: amplifiedValue,
        quality: signalQuality
      });
      
      // Limit memory size
      if (validSignalMemoryRef.current.length > MAX_MEMORY_SIZE) {
        validSignalMemoryRef.current.shift();
      }
      
      // Much more permissive signal validation
      const signalValid = signalQuality > QUALITY_THRESHOLD || 
                         Math.abs(amplifiedValue) > MIN_SIGNAL_AMPLITUDE;
      
      if (signalValid || frameCountRef.current % 3 === 0) { // Process every frame when valid or every 3rd frame regardless
        // Create processed signal object
        const processedSignal: ProcessedSignal = {
          timestamp: currentTime,
          rawValue: redValue,
          filteredValue: amplifiedValue,
          quality: signalQuality,
          fingerDetected: lastFingerDetectedRef.current,
          roi: {
            x: Math.floor(imageData.width / 4),
            y: Math.floor(imageData.height / 4),
            width: Math.floor(imageData.width / 2),
            height: Math.floor(imageData.height / 2)
          },
          // Add perfusion index estimate (important for PPG quality assessment)
          perfusionIndex: calculatePerfusionIndex(rawSignalHistoryRef.current),
          // Add waveform features if we have enough data
          waveformFeatures: rawSignalHistoryRef.current.length >= 30 ? 
            extractWaveformFeatures(rawSignalHistoryRef.current) : undefined
        };
        
        // Update lastSignal
        setLastSignal(processedSignal);
        lastTimeRef.current = currentTime;
      }
    } else {
      // Empty signal with gradual fade-out
      const emptySignal: ProcessedSignal = {
        timestamp: currentTime,
        rawValue: 0,
        filteredValue: 0,
        quality: 0,
        fingerDetected: false,
        roi: {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
      };
      
      setLastSignal(emptySignal);
      
      // Gradual cleanup
      if (signalBufferRef.current.length > 20) {
        signalBufferRef.current = signalBufferRef.current.slice(-10);
      } else {
        signalBufferRef.current = [];
      }
      
      lastFilteredValueRef.current = null;
      previousSignalLevelsRef.current = [];
      rawSignalHistoryRef.current = [];
      amplificationFactorRef.current = 100.0; // Reset amplification
    }
  }, [isProcessing, applyLowPassFilter, applySMAFilter, extractRedChannel, adjustAmplification]);

  // Calculate perfusion index - a clinical measure of pulse strength
  const calculatePerfusionIndex = (rawValues: number[]): number => {
    if (rawValues.length < 10) return 0;
    
    const recentValues = rawValues.slice(-30); // Last 30 samples
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // PI = AC/DC ratio (standard clinical definition)
    const ac = max - min;
    const dc = mean;
    
    if (dc === 0) return 0;
    return (ac / Math.abs(dc)) * 100;
  };

  // Extract waveform features useful for heartbeat analysis
  const extractWaveformFeatures = (rawValues: number[]): ProcessedSignal['waveformFeatures'] => {
    if (rawValues.length < 30) return undefined;
    
    const values = rawValues.slice(-30); // Last 30 samples
    
    // Find peaks (potential systolic peaks)
    const peaks: number[] = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
    }
    
    // If not enough peaks, can't extract features
    if (peaks.length < 2) return undefined;
    
    // Find the highest peak (systolic)
    let systolicIdx = peaks[0];
    for (let i = 1; i < peaks.length; i++) {
      if (values[peaks[i]] > values[systolicIdx]) {
        systolicIdx = peaks[i];
      }
    }
    
    // Find diastolic peak (usually before systolic)
    let diastolicIdx = -1;
    for (let i = systolicIdx - 1; i >= 0; i--) {
      if (i > 0 && values[i] > values[i-1] && values[i] > values[i+1]) {
        diastolicIdx = i;
        break;
      }
    }
    
    // If not found before, look after
    if (diastolicIdx === -1) {
      for (let i = systolicIdx + 1; i < values.length - 1; i++) {
        if (values[i] > values[i-1] && values[i] > values[i+1]) {
          diastolicIdx = i;
          break;
        }
      }
    }
    
    // Estimate dicrotic notch (usually after systolic peak)
    let dicroticIdx = -1;
    if (systolicIdx < values.length - 3) {
      // Look for a local minimum after the systolic peak
      for (let i = systolicIdx + 1; i < values.length - 1; i++) {
        if (values[i] < values[i-1] && values[i] < values[i+1]) {
          dicroticIdx = i;
          break;
        }
      }
    }
    
    // Calculate pulse width (time between diastolic and end of systolic wave)
    const pulseWidth = diastolicIdx !== -1 && systolicIdx !== -1 ? 
      Math.abs(systolicIdx - diastolicIdx) : 0;
    
    // Calculate area under curve (approximation)
    let areaUnderCurve = 0;
    for (const val of values) {
      areaUnderCurve += val;
    }
    
    return {
      systolicPeak: values[systolicIdx] || 0,
      diastolicPeak: diastolicIdx !== -1 ? values[diastolicIdx] : 0,
      dicroticNotch: dicroticIdx !== -1 ? values[dicroticIdx] : 0,
      pulseWidth: pulseWidth,
      areaUnderCurve: areaUnderCurve
    };
  };

  return {
    lastSignal,
    isProcessing,
    startProcessing,
    stopProcessing,
    processFrame,
    signalBuffer: signalBufferRef.current,
    signalQuality: signalQualityRef.current
  };
};
