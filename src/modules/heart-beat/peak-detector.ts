
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
  // Check minimum time between peaks - increased to avoid false detections
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs * 1.2) { // Aumento del 20% en el tiempo mínimo
      return { isPeak: false, confidence: 0 };
    }
  }

  // Peak detection logic with stricter thresholds
  const isPeak =
    derivative < config.derivativeThreshold * 0.8 && // Más restrictivo en la derivada
    normalizedValue > config.signalThreshold * 1.3 && // Mayor umbral para la señal
    lastValue > baseline * 1.05; // Verificación más estricta contra la línea base

  // Calculate confidence based on signal characteristics with higher requirements
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 2.2), 0), // Mayor divisor para reducir confianza
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.7), 0), // Más exigente
    1
  );

  // Combined confidence score with higher minimum threshold
  const rawConfidence = (amplitudeConfidence + derivativeConfidence) / 2;
  const confidence = rawConfidence < 0.3 ? 0 : rawConfidence; // Umbral mínimo de confianza

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

  // Only proceed with peak confirmation if needed, with higher confidence requirement
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence * 1.5) { // Aumentado 50% el umbral mínimo
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 3) {
      const len = updatedBuffer.length;
      
      // Confirm peak if followed by decreasing values - stricter verification
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2] * 0.9; // Debe bajar al menos un 10%
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3] * 0.9; // Debe bajar al menos un 10%

      if (goingDown1 && goingDown2) { // Cambiado a AND para mayor restricción
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
