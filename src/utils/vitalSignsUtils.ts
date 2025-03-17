
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

  // Algoritmo optimizado para detección de picos y valles usando ventana de 3 puntos
  // Reducimos los requisitos de altura de pico para más sensibilidad
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    // Detección de picos (punto más alto en una ventana de 3 puntos)
    // con una sensibilidad aumentada (95% en lugar de 98%)
    if (
      v >= values[i - 1] * 0.95 &&
      v >= values[i + 1] * 0.95
    ) {
      // Agregamos una verificación de altura mínima para evitar ruido
      const localMin = Math.min(values[i - 1], values[i + 1]);
      if (v - localMin > 0.02) { // Umbral mínimo para considerar un pico
        peakIndices.push(i);
      }
    }
    // Detección de valles (punto más bajo en una ventana de 3 puntos)
    // con una sensibilidad aumentada
    if (
      v <= values[i - 1] * 1.05 &&
      v <= values[i + 1] * 1.05
    ) {
      const localMax = Math.max(values[i - 1], values[i + 1]);
      if (localMax - v > 0.02) { // Umbral mínimo para considerar un valle
        valleyIndices.push(i);
      }
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
  
  // Usamos un enfoque más flexible para relacionar picos y valles
  // Para cada pico, buscamos el valle más cercano
  for (const peakIdx of peakIndices) {
    let closestValleyIdx = -1;
    let minDistance = Number.MAX_VALUE;
    
    for (const valleyIdx of valleyIndices) {
      const distance = Math.abs(peakIdx - valleyIdx);
      if (distance < minDistance) {
        minDistance = distance;
        closestValleyIdx = valleyIdx;
      }
    }
    
    if (closestValleyIdx !== -1 && minDistance < 10) { // Limitamos a valles cercanos
      const amp = values[peakIdx] - values[closestValleyIdx];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) return 0;

  // Usamos todos los valores para calcular la media
  return amps.reduce((a, b) => a + b, 0) / amps.length;
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

/**
 * Amplifica la señal de forma adaptativa basada en su amplitud
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Calcular la amplitud reciente
  const recentMin = Math.min(...recentValues);
  const recentMax = Math.max(...recentValues);
  const recentRange = recentMax - recentMin;
  
  // Factor de amplificación inversamente proporcional a la amplitud
  // Señales débiles se amplifican más
  let amplificationFactor = 1.0;
  if (recentRange < 0.1) {
    amplificationFactor = 2.5; // Alta amplificación para señales muy débiles
  } else if (recentRange < 0.3) {
    amplificationFactor = 1.8; // Amplificación media para señales débiles
  } else if (recentRange < 0.5) {
    amplificationFactor = 1.4; // Baja amplificación para señales medias
  }
  
  // Centrar el valor respecto a la media y amplificar
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}
