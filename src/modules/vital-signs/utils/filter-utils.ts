
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales
 */
export function applySMAFilter(values: number[], windowSize: number): number[] {
  if (!values || !Array.isArray(values) || values.length === 0) {
    return [];
  }
  
  const result: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Take the current value and previous (windowSize-1) values if they exist
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += values[j];
      count++;
    }
    
    result.push(sum / count);
  }
  
  return result;
}

/**
 * Amplifica la señal real de forma adaptativa basada en su amplitud
 * Sin uso de datos simulados
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (!recentValues || !Array.isArray(recentValues) || recentValues.length === 0) return value;
  
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
