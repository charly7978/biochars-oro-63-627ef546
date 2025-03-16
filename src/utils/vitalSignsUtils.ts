
/**
 * Utilidades reutilizables para todos los procesadores de signos vitales
 * Evita duplicación de código entre diferentes módulos
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(avgSqDiff);
}

/**
 * Encuentra picos y valles en una señal
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo mejorado para detección de picos y valles usando ventana de 5 puntos
  // Reducimos ligeramente los requisitos de altura de pico
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    // Detección de picos (punto más alto en una ventana de 5 puntos)
    // con una sensibilidad ligeramente aumentada (98% en lugar de 100%)
    if (
      v >= values[i - 1] * 0.98 &&
      v >= values[i - 2] * 0.98 &&
      v >= values[i + 1] * 0.98 &&
      v >= values[i + 2] * 0.98
    ) {
      peakIndices.push(i);
    }
    // Detección de valles (punto más bajo en una ventana de 5 puntos)
    // con una sensibilidad ligeramente aumentada
    if (
      v <= values[i - 1] * 1.02 &&
      v <= values[i - 2] * 1.02 &&
      v <= values[i + 1] * 1.02 &&
      v <= values[i + 2] * 1.02
    ) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud entre picos y valles
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (peakIndices.length === 0 || valleyIndices.length === 0) return 0;

  const amps: number[] = [];
  const len = Math.min(peakIndices.length, valleyIndices.length);
  
  for (let i = 0; i < len; i++) {
    const amp = values[peakIndices[i]] - values[valleyIndices[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  
  if (amps.length === 0) return 0;

  // Calcular la media robusta (sin outliers)
  amps.sort((a, b) => a - b);
  // Reducimos el recorte de outliers del 10% al 8% para mantener más picos significativos
  const trimmedAmps = amps.slice(
    Math.floor(amps.length * 0.08),
    Math.ceil(amps.length * 0.92)
  );
  
  return trimmedAmps.length > 0
    ? trimmedAmps.reduce((a, b) => a + b, 0) / trimmedAmps.length
    : amps.reduce((a, b) => a + b, 0) / amps.length;
}

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a un valor
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}
