
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
  // Make sure buffer is an array before using spread operator
  const safeBuffer = Array.isArray(buffer) ? buffer : [];
  
  const updatedBuffer = [...safeBuffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Amplifica la señal real de forma adaptativa basada en su amplitud
 * Sin uso de datos simulados
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Calcular la amplitud reciente de datos reales
  const recentMin = Math.min(...recentValues);
  const recentMax = Math.max(...recentValues);
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
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}
