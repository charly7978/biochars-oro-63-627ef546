
/**
 * Functions for detecting peaks in PPG signals
 */

/**
 * Detects if the current sample represents a peak in the signal
 * Optimized for detecting true physiological peaks (systolic peaks in PPG waveform)
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
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Peak detection logic - for upward peaks (systolic peaks in PPG)
  // We detect when we're near peak by looking for:
  // 1. Value higher than threshold
  // 2. Derivative transitioning from positive to negative (at the peak)
  // 3. Last value higher than baseline (we're in upward part of the waveform)
  const isPeak =
    derivative < -config.derivativeThreshold && // Negative derivative means we just passed peak
    normalizedValue > config.signalThreshold && // Value is high enough to be significant
    lastValue > baseline * 1.02;               // Last value was above baseline (upward trend)

  // Calculate confidence based on signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.8), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.8), 0),
    1
  );

  // Combined confidence score
  const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

  return { isPeak, confidence };
}

/**
 * Confirms a peak by examining neighboring samples
 * Ensures that we only trigger on real heartbeat peaks
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
  if (updatedBuffer.length > 5) {
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Only proceed with peak confirmation if needed
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence) {
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 3) {
      const len = updatedBuffer.length;
      
      // Confirm peak if followed by decreasing values 
      // (for upward peaks, values after peak should decrease)
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2];
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3];

      if (goingDown1 || goingDown2) {
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
