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

  // Peak detection logic
  const isPeak =
    derivative < config.derivativeThreshold &&
    normalizedValue > config.signalThreshold &&
    lastValue > baseline * 0.98;

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
 * Confirma si un pico candidato es válido basado en contexto local.
 * TEMPORALMENTE SIMPLIFICADO PARA DEPURACIÓN: Confirma casi cualquier candidato.
 */
export function confirmPeak(
  isPeakCandidate: boolean,
  normalizedValue: number,
  confidence: number,
  signalWindow: number[], // No usado en la versión simplificada
  currentState: PeakConfirmationState,
  minConfidence: number,
  adaptiveThreshold: number // No usado en la versión simplificada
): {
  isConfirmedPeak: boolean;
  updatedState: PeakConfirmationState;
} {
  let isConfirmed = false;

  // Lógica de confirmación MUY SIMPLIFICADA para depuración:
  // Confirmar si es un candidato, supera la confianza mínima 
  // y no acabamos de confirmar uno en el ciclo anterior.
  if (isPeakCandidate && confidence >= minConfidence && !currentState.lastConfirmedPeak) {
    isConfirmed = true;
  }

  /* Lógica original más compleja comentada temporalmente:
    currentState.buffer.push(isPeakCandidate ? normalizedValue : -1); 
    if (currentState.buffer.length > CONFIRMATION_WINDOW_SIZE) {
      currentState.buffer.shift();
    }
    const currentWindowIndex = Math.floor(CONFIRMATION_WINDOW_SIZE / 2);
    if (currentState.buffer[currentWindowIndex] > 0 && 
        confidence >= minConfidence && 
        !currentState.lastConfirmedPeak) { 
      let isLocalMax = true;
      for (let i = 0; i < CONFIRMATION_WINDOW_SIZE; i++) {
        if (i !== currentWindowIndex && currentState.buffer[i] > currentState.buffer[currentWindowIndex]) {
          isLocalMax = false;
          break;
        }
      }
      if (isLocalMax) {
        const windowCenterIndex = Math.floor(signalWindow.length / 2);
        const peakValue = signalWindow[windowCenterIndex];
        let leftValley = peakValue;
        let rightValley = peakValue;
        let peakWidth = 1;
        let leftIndex = windowCenterIndex - 1;
        let rightIndex = windowCenterIndex + 1;
        while (leftIndex >= 0) {
            if (signalWindow[leftIndex] >= signalWindow[leftIndex + 1]) break; 
            leftValley = Math.min(leftValley, signalWindow[leftIndex]);
            peakWidth++;
            leftIndex--;
        }
        while (rightIndex < signalWindow.length) {
            if (signalWindow[rightIndex] >= signalWindow[rightIndex - 1]) break; 
            rightValley = Math.min(rightValley, signalWindow[rightIndex]);
             peakWidth++;
            rightIndex++;
        }
        const prominence = peakValue - Math.max(leftValley, rightValley);
        if (prominence >= adaptiveThreshold * MIN_PEAK_PROMINENCE_FACTOR && 
            peakWidth <= MAX_PEAK_WIDTH_SAMPLES) {
           isConfirmed = true;
        } 
      }
    }
  */

  currentState.lastConfirmedPeak = isConfirmed;
  // Devolver una copia del estado buffer si aún se usa, aunque la lógica simplificada no lo llene igual
  return { 
      isConfirmedPeak: isConfirmed, 
      updatedState: { ...currentState, buffer: [...currentState.buffer] } 
  };
}
