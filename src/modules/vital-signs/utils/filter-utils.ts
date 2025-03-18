
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
  
  // Cálculo de media móvil con ponderación para dar más importancia a valores recientes
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < updatedBuffer.length; i++) {
    const weight = 1 + i * 0.2; // Valores más recientes tienen más peso
    weightedSum += updatedBuffer[i] * weight;
    totalWeight += weight;
  }
  
  const filteredValue = totalWeight > 0 ? weightedSum / totalWeight : value;
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
  let amplificationFactor = 1.2; // Aumentado ligeramente para mejor visualización
  if (recentRange < 0.1) {
    amplificationFactor = 3.0; // Aumentado para señales débiles
  } else if (recentRange < 0.3) {
    amplificationFactor = 2.2; // Aumentado para señales medias
  } else if (recentRange < 0.5) {
    amplificationFactor = 1.6; // Aumentado para señales normales
  }
  
  // Amplificar usando solo datos reales
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}
