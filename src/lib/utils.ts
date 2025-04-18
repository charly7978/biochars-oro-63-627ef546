import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utilidad para combinar clases con tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// --- Consolidated Signal Processing Utilities ---

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal real
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal real
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores reales
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0; // Need at least two points to calculate std dev
  const mean = calculateDC(values); // Reuse calculateDC for mean
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n; // Use n for population std dev, or n-1 for sample
  return Math.sqrt(avgSqDiff);
}

/**
 * Calcula la Media Móvil Exponencial (EMA) para suavizar señales reales
 * No se utiliza ninguna simulación
 */
export function calculateEMA(currentValue: number, prevEMA: number, alpha: number): number {
  // Handle initialization case where prevEMA might be undefined or 0
  if (prevEMA === undefined || prevEMA === null) {
      return currentValue;
  }
  return alpha * currentValue + (1 - alpha) * prevEMA;
}


/**
 * Normaliza un valor real dentro de un rango específico [0, 1]
 * No se utiliza simulación
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max - min === 0) return 0; // Avoid division by zero
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized)); // Clamp between 0 and 1
}

/**
 * Calculate perfusion index based on real AC and DC components
 * No simulation is used
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  // Ensure perfusion index is non-negative
  const pi = ac / dc;
  return Math.max(0, pi);
}

/**
 * Calcula la amplitud promedio entre picos y valles relacionados de señales reales.
 * Se asume que los índices de picos y valles corresponden a la señal original `values`.
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (!values || values.length === 0 || peakIndices.length === 0 || valleyIndices.length === 0) {
    return 0;
  }

  const amps: number[] = [];

  // Encontrar el valle más cercano (en tiempo/índice) a cada pico
  for (const peakIdx of peakIndices) {
    let closestValleyIdx = -1;
    let minDistance = Infinity; // Usar Infinity para la comparación inicial

    for (const valleyIdx of valleyIndices) {
      const distance = Math.abs(peakIdx - valleyIdx);
      // Condición adicional: El valle debe estar razonablemente cerca y *antes* o *después* del pico,
      // dependiendo de la morfología esperada. Simplificamos buscando el más cercano.
      if (distance < minDistance) {
        minDistance = distance;
        closestValleyIdx = valleyIdx;
      }
    }

    // Considerar solo pares pico-valle razonablemente cercanos (ajustar umbral según sea necesario)
    const MAX_REASONABLE_DISTANCE = 15; // Ejemplo de umbral, puede necesitar ajuste
    if (closestValleyIdx !== -1 && minDistance < MAX_REASONABLE_DISTANCE) {
      // Asegurarse de que los índices estén dentro de los límites del array `values`
      if (peakIdx >= 0 && peakIdx < values.length && closestValleyIdx >= 0 && closestValleyIdx < values.length) {
          const amp = values[peakIdx] - values[closestValleyIdx];
          // Solo añadir amplitudes positivas
          if (amp > 0) {
              amps.push(amp);
          }
      } else {
          console.warn(`calculateAmplitude: Index out of bounds. Peak: ${peakIdx}, Valley: ${closestValleyIdx}, Length: ${values.length}`);
      }
    }
  }

  if (amps.length === 0) {
      // console.log("calculateAmplitude: No valid peak-valley pairs found.");
      return 0;
  }

  // Calcular la media de las amplitudes válidas
  const averageAmplitude = amps.reduce((a, b) => a + b, 0) / amps.length;
  return averageAmplitude;
}
