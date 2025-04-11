
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Detecta picos en señales PPG con mayor sensibilidad y precisión
 * Optimizado para detectar todos los latidos reales sin generar falsos positivos
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
  // Verificar tiempo mínimo entre picos para evitar detecciones múltiples
  // Reducido para permitir detección más frecuente en ritmos cardíacos rápidos
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs * 0.75) { // Reducido a 75% del tiempo configurado
      return { isPeak: false, confidence: 0 };
    }
  }

  // Lógica mejorada para detección de picos
  // Un pico se detecta cuando:
  // 1. La derivada cruza por cero de positivo a negativo (indica un máximo local)
  // 2. El valor está por encima del umbral de señal
  // 3. El valor anterior también estaba por encima de la línea base
  const isPeak =
    derivative < config.derivativeThreshold * 0.7 && // Umbral más sensible para la derivada
    normalizedValue > config.signalThreshold * 0.8 && // Umbral más sensible para la amplitud
    lastValue > baseline * 0.9; // Comparación con línea base más sensible

  // Cálculo mejorado de confianza basado en características de la señal
  // La confianza combina la amplitud de la señal y la fuerza de la derivada
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.3), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.6), 0),
    1
  );

  // Ponderación ajustada: amplitud tiene más peso que derivada
  const confidence = (amplitudeConfidence * 0.8 + derivativeConfidence * 0.2);

  return { isPeak, confidence };
}

/**
 * Confirma un pico examinando muestras vecinas
 * Con criterios más sensibles para capturar todos los picos genuinos
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
  // Agregar valor al buffer de confirmación
  const updatedBuffer = [...peakConfirmationBuffer, normalizedValue];
  if (updatedBuffer.length > 5) {
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Solo proceder con confirmación de pico si es necesario
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence * 0.85) { // Umbral de confianza reducido
    // Necesita suficientes muestras en buffer para confirmación
    if (updatedBuffer.length >= 3) {
      const len = updatedBuffer.length;
      
      // Confirmar pico si va seguido de valores decrecientes (pendiente negativa)
      // O si el valor actual es significativamente mayor que los anteriores
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2] * 0.97;
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3] * 0.97;
      const isPeakShaped = updatedBuffer[len - 2] > updatedBuffer[len - 3] * 1.03 && 
                         updatedBuffer[len - 2] > updatedBuffer[len - 1] * 1.03;

      if (goingDown1 || goingDown2 || isPeakShaped) {
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
