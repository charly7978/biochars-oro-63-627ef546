
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
  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Peak detection logic - MEJORADO para mayor sensibilidad y menos falsos positivos
  const isPeak =
    derivative < config.derivativeThreshold &&
    normalizedValue > config.signalThreshold &&
    lastValue > baseline * 0.96; // Reducido ligeramente para mejor detección

  // Calculate confidence based on signal characteristics - OPTIMIZADO
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.5), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.6), 0),
    1
  );

  // Combined confidence score - mejorado para darle más peso al derivativo (indicio mejor de cambio real)
  const confidence = (amplitudeConfidence * 0.4 + derivativeConfidence * 0.6);

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
      
      // Confirmar pico si los valores posteriores descienden significativamente
      const peakValue = updatedBuffer[len - 3]; // Asumiendo que el pico es el 3er último valor del buffer
      const valueAfter1 = updatedBuffer[len - 2];
      const valueAfter2 = updatedBuffer[len - 1];
      
      const drop1 = peakValue - valueAfter1;
      const drop2 = valueAfter1 - valueAfter2;

      // MEJORADO: algoritmo más sensible para detección de patrones de descenso
      const MIN_DROP_RATIO = 0.12; // Reducido para mayor sensibilidad
      const isSignificantDrop = 
        drop1 > peakValue * MIN_DROP_RATIO || 
        drop2 > peakValue * MIN_DROP_RATIO;
        
      // Mantener la lógica anterior como respaldo si la señal es más ruidosa
      const goingDownSimple = valueAfter2 < valueAfter1 && valueAfter1 < peakValue;

      if (isSignificantDrop && goingDownSimple) { // Requiere ambas condiciones
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
