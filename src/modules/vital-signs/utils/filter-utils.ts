
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Algoritmo mejorado de filtrado para evitar discontinuidades
  const validValues = updatedBuffer.filter(v => !isNaN(v) && isFinite(v));
  if (validValues.length === 0) return { filteredValue: value, updatedBuffer };
  
  const filteredValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Amplifica la señal real de forma adaptativa basada en su amplitud
 * Sin uso de datos simulados
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Filtrar valores extremos para mejor estimación de rango
  const sortedValues = [...recentValues].sort((a, b) => a - b);
  const filteredValues = sortedValues.slice(
    Math.floor(sortedValues.length * 0.1),
    Math.ceil(sortedValues.length * 0.9)
  );
  
  // Calcular la amplitud reciente de datos reales
  const recentMin = Math.min(...filteredValues);
  const recentMax = Math.max(...filteredValues);
  const recentRange = recentMax - recentMin;
  
  // Factor de amplificación para señales reales con mejor escalado
  let amplificationFactor = 1.0;
  if (recentRange < 0.05) {
    amplificationFactor = 3.2;
  } else if (recentRange < 0.1) {
    amplificationFactor = 2.8;
  } else if (recentRange < 0.3) {
    amplificationFactor = 2.0;
  } else if (recentRange < 0.5) {
    amplificationFactor = 1.5;
  }
  
  // Amplificar usando solo datos reales con mejor cálculo de media
  const validValues = filteredValues.filter(v => !isNaN(v) && isFinite(v));
  if (validValues.length === 0) return value;
  
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}
