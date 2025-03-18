
/**
 * Functions for detecting peaks in PPG signals
 * Enhanced to ensure one real heartbeat = one peak = one beep
 */

/**
 * Detects if the current sample represents a peak in the signal
 * Improved with higher confidence requirements and stricter validation
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
  }
): {
  isPeak: boolean;
  confidence: number;
} {
  // Check minimum time between peaks
  // This is critical to prevent multiple detections of the same heartbeat
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    // Enforce minimum 600ms between peaks (allows max 100 BPM)
    // This prevents the accelerated beeping issue
    if (timeSinceLastPeak < Math.max(config.minPeakTimeMs, 600)) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Enhanced peak detection logic
  // Requires significant negative derivative (downslope of the wave)
  // AND sufficient amplitude above both the threshold and baseline
  const isPeak =
    derivative < config.derivativeThreshold * 0.9 && // Stricter derivative requirement
    normalizedValue > config.signalThreshold * 1.1 && // Higher amplitude requirement
    lastValue > baseline * 1.05; // Stricter baseline requirement

  // Calculate confidence based on signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 2.0), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.7), 0),
    1
  );

  // Combined confidence score with higher threshold
  const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

  return { isPeak, confidence };
}

/**
 * Confirms a peak by examining neighboring samples
 * Enhanced validation requiring stronger evidence of a true peak
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
  if (updatedBuffer.length > 6) { // Increased buffer size for better validation
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Only proceed with peak confirmation if needed
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence * 1.1) { // Higher confidence requirement
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 4) { // Require more samples for confirmation
      const len = updatedBuffer.length;
      
      // Confirm peak if followed by a clear pattern of decreasing values
      // This ensures we're detecting the actual peak of the PPG wave
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2] * 0.95;
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3] * 0.95;
      const goingDown3 = updatedBuffer.length >= 5 ? 
        updatedBuffer[len - 3] < updatedBuffer[len - 4] * 0.95 : true;

      // Require a stronger pattern of decrease to confirm a real peak
      if (goingDown1 && (goingDown2 || goingDown3)) {
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
