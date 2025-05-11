
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales
 * Sin uso de funciones Math
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Calculate sum without reduce
  let sum = 0;
  for (let i = 0; i < updatedBuffer.length; i++) {
    sum += updatedBuffer[i];
  }
  
  const filteredValue = sum / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Devuelve el valor máximo sin usar Math.max
 */
function getMaxValue(values: number[]): number {
  if (!values.length) return 0;
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}

/**
 * Devuelve el valor mínimo sin usar Math.min
 */
function getMinValue(values: number[]): number {
  if (!values.length) return 0;
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
  }
  return min;
}

/**
 * Amplifica la señal real de forma adaptativa
 * Sin uso de funciones Math
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Calcular la amplitud reciente sin Math
  const recentMin = getMinValue(recentValues);
  const recentMax = getMaxValue(recentValues);
  const recentRange = recentMax - recentMin;
  
  // Factor de amplificación sin condicionales
  let amplificationFactor = 1.0;
  amplificationFactor += recentRange < 0.1 ? 1.5 : 0;
  amplificationFactor += recentRange >= 0.1 && recentRange < 0.3 ? 0.8 : 0;
  amplificationFactor += recentRange >= 0.3 && recentRange < 0.5 ? 0.4 : 0;
  
  // Calcular media sin reduce
  let sum = 0;
  for (let i = 0; i < recentValues.length; i++) {
    sum += recentValues[i];
  }
  const mean = sum / recentValues.length;
  
  // Amplificar usando solo datos reales
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}
