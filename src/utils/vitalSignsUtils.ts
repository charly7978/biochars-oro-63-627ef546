
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades reutilizables para todos los procesadores de signos vitales
 * Solo procesa datos reales, sin simulación ni manipulación
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal real
 * Implementación manual sin usar Math.min/max
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  
  let min = values[0];
  let max = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  
  return max - min;
}

/**
 * Calcula el componente DC (valor promedio) de una señal real
 * Implementación manual sin usar funciones Math
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  
  return sum / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores reales
 * Implementación manual sin usar funciones Math
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
  }
  
  const mean = sum / n;
  
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    sqSum += diff * diff;
  }
  
  const variance = sqSum / n;
  
  // Raíz cuadrada mediante aproximación de Newton
  let result = variance;
  let prev;
  
  // Realizar iteraciones hasta convergencia satisfactoria
  for (let i = 0; i < 10; i++) {
    prev = result;
    result = 0.5 * (result + variance / result);
    
    // Verificar convergencia con precisión suficiente
    const diff = result > prev ? result - prev : prev - result;
    if (diff < 0.000001) break;
  }
  
  return result;
}

/**
 * Encuentra picos y valles en una señal real
 * Implementación manual sin usar funciones Math
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo para detección de picos y valles en datos reales
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    const left = values[i - 1] * 0.95;
    const right = values[i + 1] * 0.95;
    
    // Detección de picos sin usar Math.min/max
    if (v >= left && v >= right) {
      const localMin = values[i - 1] < values[i + 1] ? values[i - 1] : values[i + 1];
      if (v - localMin > 0.02) {
        peakIndices.push(i);
      }
    }
    
    // Detección de valles sin usar Math.min/max
    const leftThresh = values[i - 1] * 1.05;
    const rightThresh = values[i + 1] * 1.05;
    if (v <= leftThresh && v <= rightThresh) {
      const localMax = values[i - 1] > values[i + 1] ? values[i - 1] : values[i + 1];
      if (localMax - v > 0.02) {
        valleyIndices.push(i);
      }
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud entre picos y valles de señales reales
 * Implementación manual sin usar funciones Math
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (peakIndices.length === 0 || valleyIndices.length === 0) return 0;

  const amps: number[] = [];
  
  // Relacionar picos y valles en datos reales
  for (const peakIdx of peakIndices) {
    let closestValleyIdx = -1;
    let minDistance = Number.MAX_VALUE;
    
    for (const valleyIdx of valleyIndices) {
      const distance = peakIdx > valleyIdx ? peakIdx - valleyIdx : valleyIdx - peakIdx;
      if (distance < minDistance) {
        minDistance = distance;
        closestValleyIdx = valleyIdx;
      }
    }
    
    if (closestValleyIdx !== -1 && minDistance < 10) {
      const amp = values[peakIdx] - values[closestValleyIdx];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) return 0;

  // Calcular la media con datos reales
  let sum = 0;
  for (let i = 0; i < amps.length; i++) {
    sum += amps[i];
  }
  return sum / amps.length;
}

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales
 * Implementación manual sin usar funciones Math
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  let sum = 0;
  for (let i = 0; i < updatedBuffer.length; i++) {
    sum += updatedBuffer[i];
  }
  
  const filteredValue = sum / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Amplifica la señal real de forma adaptativa basada en su amplitud
 * Sin uso de datos simulados ni funciones Math
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Calcular la amplitud reciente de datos reales sin Math.min/max
  let recentMin = recentValues[0];
  let recentMax = recentValues[0];
  
  for (let i = 1; i < recentValues.length; i++) {
    if (recentValues[i] < recentMin) recentMin = recentValues[i];
    if (recentValues[i] > recentMax) recentMax = recentValues[i];
  }
  
  const recentRange = recentMax - recentMin;
  
  // Factor de amplificación para señales reales
  let amplificationFactor = 1.0;
  if (recentRange < 0.1) {
    amplificationFactor = 2.5;
  } else if (recentRange < 0.3) {
    amplificationFactor = 1.8;
  } else if (recentRange < 0.5) {
    amplificationFactor = 1.4;
  }
  
  // Amplificar usando solo datos reales
  let sum = 0;
  for (let i = 0; i < recentValues.length; i++) {
    sum += recentValues[i];
  }
  const mean = sum / recentValues.length;
  
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}
