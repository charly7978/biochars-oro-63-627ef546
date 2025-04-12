/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Colección centralizada de utilidades para el análisis de señales PPG.
 * Opera únicamente con datos reales, sin simulación.
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal real.
 * @param values Array de números que representan la señal.
 * @returns El valor AC.
 */
export function calculateAC(values: number[]): number {
  if (values.length < 2) return 0; // Necesita al menos 2 puntos para rango
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  return maxVal - minVal;
}

/**
 * Calcula el componente DC (valor promedio) de una señal real.
 * @param values Array de números que representan la señal.
 * @returns El valor DC.
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((sum, val) => sum + val, 0);
  return sum / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores reales.
 * @param values Array de números.
 * @returns La desviación estándar.
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0; // Necesita al menos 2 puntos para desviación
  const mean = calculateDC(values); // Reutiliza el cálculo del promedio
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

/**
 * Encuentra los índices de picos y valles en una señal utilizando un enfoque simple.
 * @param values Array de números que representan la señal.
 * @param minPeakProminence Umbral mínimo de prominencia para considerar un pico/valle (opcional).
 * @returns Objeto con arrays de índices de picos y valles.
 */
export function findPeaksAndValleys(values: number[], minPeakProminence: number = 0.01): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  if (values.length < 3) {
      return { peakIndices, valleyIndices };
  }

  for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i - 1];
      const current = values[i];
      const next = values[i + 1];

      // Pico: es mayor que sus vecinos inmediatos
      if (current > prev && current > next && (current - Math.max(prev, next) >= minPeakProminence)) {
          peakIndices.push(i);
      }
      // Valle: es menor que sus vecinos inmediatos
      else if (current < prev && current < next && (Math.min(prev, next) - current >= minPeakProminence)) {
          valleyIndices.push(i);
      }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud promedio entre picos y valles consecutivos.
 * @param values Array de la señal.
 * @param peakIndices Índices de los picos.
 * @param valleyIndices Índices de los valles.
 * @returns La amplitud promedio, o 0 si no hay suficientes picos/valles.
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  let totalAmplitude = 0;
  let validPairs = 0;

  if (peakIndices.length === 0 || valleyIndices.length === 0) {
    return 0;
  }

  // Emparejar picos con valles cercanos para calcular amplitudes locales
  let valleyIdx = 0;
  for (const peakIdx of peakIndices) {
    // Encontrar el valle más cercano *antes* del pico (o el primero si no hay antes)
    let closestValleyBefore = -1;
    for (let v = 0; v < valleyIndices.length && valleyIndices[v] < peakIdx; v++) {
      closestValleyBefore = valleyIndices[v];
    }

    // Encontrar el valle más cercano *después* del pico (o el último si no hay después)
     let closestValleyAfter = -1;
     for (let v = 0; v < valleyIndices.length; v++) {
         if (valleyIndices[v] > peakIdx) {
             closestValleyAfter = valleyIndices[v];
             break;
         }
     }

     // Usar el promedio de los valles circundantes si ambos existen
     let valleyValue;
     if(closestValleyBefore !== -1 && closestValleyAfter !== -1) {
         valleyValue = (values[closestValleyBefore] + values[closestValleyAfter]) / 2;
     } else if (closestValleyBefore !== -1) {
         valleyValue = values[closestValleyBefore];
     } else if (closestValleyAfter !== -1) {
         valleyValue = values[closestValleyAfter];
     } else {
         continue; // No se pueden calcular valles para este pico
     }


    if (valleyValue !== undefined) {
      totalAmplitude += values[peakIdx] - valleyValue;
      validPairs++;
    }
  }

  return validPairs > 0 ? totalAmplitude / validPairs : 0;
}

/**
 * Calcula la Media Móvil Exponencial (EMA) para suavizar señales reales.
 * No se utiliza ninguna simulación.
 * @param prevEMA El valor EMA anterior.
 * @param currentValue El valor actual real.
 * @param alpha El factor de suavizado (0 < alpha <= 1).
 * @returns El nuevo valor EMA.
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  // Inicializa si es el primer valor
  if (prevEMA === null || isNaN(prevEMA)) {
      return currentValue;
  }
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normaliza un valor real dentro de un rango [0, 1] basado en min/max.
 * No se utiliza simulación.
 * @param value El valor a normalizar.
 * @param min El valor mínimo del rango.
 * @param max El valor máximo del rango.
 * @returns El valor normalizado, limitado a [0, 1].
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) {
    return 0; // Evita división por cero, devuelve un valor neutral
  }
  const normalized = (value - min) / (max - min);
  // Limita el resultado al rango [0, 1] para evitar valores fuera de rango
  return Math.max(0, Math.min(1, normalized));
}


/**
 * Amplifica la señal real de forma adaptativa basada en su amplitud reciente.
 * Sin uso de datos simulados.
 * @param value El valor actual de la señal.
 * @param recentValues Buffer de los valores recientes de la señal.
 * @param targetRange Rango deseado de la señal amplificada (opcional).
 * @returns El valor amplificado.
 */
export function amplifySignal(value: number, recentValues: number[], targetRange: number = 0.8): number {
  if (recentValues.length < 5) return value; // Necesita un mínimo de historial

  // Calcular la amplitud (rango) y el promedio (DC) de los datos reales recientes
  const recentMin = Math.min(...recentValues);
  const recentMax = Math.max(...recentValues);
  const recentRange = recentMax - recentMin;
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

  // Evitar amplificación si el rango es casi cero o inválido
  if (recentRange <= 0.001) return value;

  // Factor de amplificación adaptativo para llevar la señal al targetRange
  // Se ajusta más agresivamente para señales muy débiles
  let amplificationFactor = targetRange / recentRange;

  // Limitar la amplificación para evitar inestabilidad
  amplificationFactor = Math.max(1.0, Math.min(amplificationFactor, 5.0)); // Limita entre 1x y 5x

  // Amplificar alrededor del promedio (DC) usando solo datos reales
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;

  return amplifiedValue;
} 