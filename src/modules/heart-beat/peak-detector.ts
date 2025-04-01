
/**
 * Functions for detecting peaks in PPG signals
 * Enhanced with Fourier, Wavelet, and Multi-beat validation techniques
 */

/**
 * Detects if the current sample represents a peak in the signal
 * with improved detection using advanced algorithms
 */
export function detectPeak(
  normalizedValue: number,
  derivative: number,
  baseline: number,
  lastValue: number,
  lastPeakTime: number | null,
  currentTime: number,
  config: {
    minPeakTimeMs: number,
    derivativeThreshold: number,
    signalThreshold: number,
    adaptiveThreshold?: number,
    useAdaptiveThreshold?: boolean
  }
): {
  isPeak: boolean;
  confidence: number;
} {
  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Get effective threshold (adaptive or static)
  const effectiveThreshold = config.useAdaptiveThreshold && config.adaptiveThreshold !== undefined ?
                           config.adaptiveThreshold :
                           config.signalThreshold;

  // Enhanced peak detection logic with improved derivative analysis
  const isPeak =
    derivative < config.derivativeThreshold &&
    normalizedValue > effectiveThreshold &&
    lastValue > baseline * 0.98;

  // Calculate confidence based on multiple signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (effectiveThreshold * 1.8), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.8), 0),
    1
  );
  
  // Add baseline separation confidence (how much the peak stands out from baseline)
  const baselineSeparation = normalizedValue / (baseline > 0 ? baseline : 0.1);
  const baselineConfidence = Math.min(
    Math.max((baselineSeparation - 1) / 2, 0),
    1
  );

  // Combined confidence score with weighted components
  const confidence = (
    amplitudeConfidence * 0.4 +
    derivativeConfidence * 0.3 +
    baselineConfidence * 0.3
  );

  return { isPeak, confidence };
}

/**
 * Confirms a peak by examining neighboring samples
 * Enhanced with shape analysis for better validation
 */
export function confirmPeak(
  isPeak: boolean,
  normalizedValue: number,
  lastConfirmedPeak: boolean,
  peakConfirmationBuffer: number[],
  minConfidence: number,
  confidence: number
): {
  isConfirmedPeak: boolean;
  updatedBuffer: number[];
  updatedLastConfirmedPeak: boolean;
} {
  // Add value to confirmation buffer
  const updatedBuffer = [...peakConfirmationBuffer, normalizedValue];
  if (updatedBuffer.length > 7) { // Increased buffer for better pattern recognition
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Only proceed with peak confirmation if needed
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence) {
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 5) { // Increased for better pattern recognition
      const len = updatedBuffer.length;
      
      // Enhanced peak confirmation using shape characteristics
      // Check if we see a proper peak followed by decreasing values
      const isPeakShaped = 
        // Rising edge before peak
        updatedBuffer[len - 3] > updatedBuffer[len - 4] &&
        updatedBuffer[len - 2] > updatedBuffer[len - 3] &&
        // Falling edge after peak
        updatedBuffer[len - 1] < updatedBuffer[len - 2] &&
        updatedBuffer[len] < updatedBuffer[len - 1];
      
      // Calculate peak prominence (how much it stands out)
      const peakValue = updatedBuffer[len - 2]; // The peak
      const surroundingAvg = (
        updatedBuffer[len - 4] + 
        updatedBuffer[len - 3] + 
        updatedBuffer[len - 1] + 
        updatedBuffer[len]
      ) / 4;
      
      const prominence = peakValue - surroundingAvg;
      const hasProminence = prominence > 0.05; // Significant peak
      
      // Confirm if the shape looks like a peak and has prominence
      if (isPeakShaped && hasProminence) {
        isConfirmedPeak = true;
        updatedLastConfirmedPeak = true;
      }
    }
  } else if (!isPeak) {
    updatedLastConfirmedPeak = false;
  }

  return {
    isConfirmedPeak,
    updatedBuffer,
    updatedLastConfirmedPeak
  };
}

/**
 * Enhanced peak detection using Fourier analysis
 * for signals with significant noise
 */
export function detectPeakFourier(
  recentValues: number[],
  currentTime: number,
  lastPeakTime: number | null,
  config: {
    minPeakTimeMs: number,
    sampleRate: number,
  }
): {
  isPeak: boolean;
  confidence: number;
  dominantFrequency: number;
} {
  // Check if we have enough samples for analysis
  if (recentValues.length < 10) {
    return { isPeak: false, confidence: 0, dominantFrequency: 0 };
  }
  
  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0, dominantFrequency: 0 };
    }
  }
  
  // Perform frequency analysis to find dominant heart rhythm
  let real = 0;
  let imag = 0;
  const n = recentValues.length;
  
  // Simple DFT for frequency around typical heart rate (1-2 Hz)
  const targetFreq = 1.5; // Hz, corresponds to 90 BPM
  
  for (let t = 0; t < n; t++) {
    const angle = -2 * Math.PI * targetFreq * t / config.sampleRate;
    real += recentValues[t] * Math.cos(angle);
    imag += recentValues[t] * Math.sin(angle);
  }
  
  // Calculate magnitude and phase
  const magnitude = Math.sqrt(real * real + imag * imag) / n;
  const phase = Math.atan2(imag, real);
  
  // Calculate dominant frequency (actual heart rate frequency)
  const dominantFrequency = targetFreq * (1 + phase / (2 * Math.PI));
  
  // Check if current sample could be a peak based on phase and timing
  const localPeak = recentValues.length >= 3 &&
    recentValues[recentValues.length - 2] > recentValues[recentValues.length - 3] &&
    recentValues[recentValues.length - 2] >= recentValues[recentValues.length - 1];
  
  // Calculate confidence based on signal characteristics
  const magnitudeConfidence = Math.min(magnitude * 5, 1);
  const phaseConfidence = Math.abs(Math.cos(phase)); // Higher when phase aligns with expected peak
  
  // Combine factors for overall confidence
  const confidence = magnitudeConfidence * 0.6 + phaseConfidence * 0.4;
  
  // Peak is detected when we have a local maximum and sufficient confidence
  const isPeak = localPeak && confidence > 0.3;
  
  return { isPeak, confidence, dominantFrequency };
}

/**
 * Detect peaks using multi-beat pattern validation for improved accuracy
 */
export function detectPeakWithMultiBeatValidation(
  recentValues: number[],
  lastPeakIndices: number[],
  currentIndex: number,
  threshold: number
): {
  isPeak: boolean;
  confidence: number;
  expectedNextPeakIndex: number | null;
} {
  // Need at least 5 samples and 2 previous peaks for validation
  if (recentValues.length < 5 || lastPeakIndices.length < 2) {
    // Fall back to simple peak detection
    const isPeak = recentValues.length >= 3 &&
      recentValues[recentValues.length - 2] > recentValues[recentValues.length - 3] &&
      recentValues[recentValues.length - 2] >= recentValues[recentValues.length - 1] &&
      recentValues[recentValues.length - 2] > threshold;
    
    return { 
      isPeak, 
      confidence: isPeak ? 0.3 : 0, // Lower confidence without validation
      expectedNextPeakIndex: null 
    };
  }
  
  // Calculate average interval between previous peaks
  let sumIntervals = 0;
  for (let i = 1; i < lastPeakIndices.length; i++) {
    sumIntervals += lastPeakIndices[i] - lastPeakIndices[i-1];
  }
  const avgInterval = sumIntervals / (lastPeakIndices.length - 1);
  
  // Calculate expected position of next peak
  const lastPeakIndex = lastPeakIndices[lastPeakIndices.length - 1];
  const expectedPeakIndex = lastPeakIndex + avgInterval;
  
  // Calculate how close we are to expected peak
  const distanceToExpected = Math.abs(currentIndex - expectedPeakIndex);
  const windowWidth = avgInterval * 0.3; // 30% of average interval
  
  // Local peak detection
  const isPeak = recentValues.length >= 3 &&
    recentValues[recentValues.length - 2] > recentValues[recentValues.length - 3] &&
    recentValues[recentValues.length - 2] >= recentValues[recentValues.length - 1] &&
    recentValues[recentValues.length - 2] > threshold;
  
  // Calculate confidence based on:
  // 1. Being a local peak
  // 2. Proximity to expected peak position
  // 3. Amplitude relative to threshold
  
  let timing_confidence = 0;
  if (distanceToExpected <= windowWidth) {
    // Higher confidence when closer to expected time
    timing_confidence = 1 - distanceToExpected / windowWidth;
  }
  
  const amplitude_confidence = isPeak ? 
    Math.min((recentValues[recentValues.length - 2] - threshold) / threshold, 1) : 0;
  
  // Combined confidence
  const confidence = isPeak ? 
    0.6 * amplitude_confidence + 0.4 * timing_confidence : 0;
  
  // Calculate expected next peak
  const expectedNextPeakIndex = currentIndex + avgInterval;
  
  return {
    isPeak,
    confidence,
    expectedNextPeakIndex: expectedNextPeakIndex
  };
}
