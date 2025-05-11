
/**
 * Functions for detecting peaks in PPG signals
 */

/**
 * Detects if the current sample represents a peak in the signal
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
  // Check minimum time between peaks for physiological validity
  // No human heart can beat faster than 220 bpm (273ms between beats)
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Peak detection logic - improved for better reliability
  const isPeak =
    derivative < config.derivativeThreshold &&
    normalizedValue > config.signalThreshold &&
    lastValue > baseline * 0.95; // Reduced from 0.98 for better sensitivity

  // Calculate confidence based on signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.5), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.7), 0),
    1
  );

  // Combined confidence score with slight priority to amplitude
  const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4);

  // Log data for peaks with decent confidence
  if (isPeak && confidence > 0.3) {
    console.log("Heart peak detected:", {
      normalizedValue,
      derivative,
      confidence,
      timeSinceLastPeak: lastPeakTime ? currentTime - lastPeakTime : "none"
    });
  }

  return { isPeak, confidence };
}

/**
 * Confirms a peak by examining neighboring samples
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
      
      // Confirm peak if followed by decreasing values (trending down)
      // Relaxed condition to only require one decreasing step
      const goingDown = updatedBuffer[len - 1] < updatedBuffer[len - 2];

      if (goingDown) {
        isConfirmedPeak = true;
        updatedLastConfirmedPeak = true;
        
        console.log("Confirmed heart peak with confidence:", confidence);
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
