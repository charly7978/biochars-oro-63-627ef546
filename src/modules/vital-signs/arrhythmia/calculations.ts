
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calcula la raíz cuadrada de las diferencias cuadráticas medias entre intervalos RR sucesivos.
 * Indicador clave de variabilidad del ritmo cardíaco para detectar arritmias.
 * 
 * @param intervals Array de intervalos RR en milisegundos
 * @returns RMSSD del conjunto de intervalos
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) {
    return 0;
  }
  
  let sumSquaredDiff = 0;
  let countDiffs = 0;
  
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i - 1];
    sumSquaredDiff += diff * diff;
    countDiffs++;
  }
  
  if (countDiffs === 0) {
    return 0;
  }
  
  return Math.sqrt(sumSquaredDiff / countDiffs);
}

/**
 * Calcula la variación relativa de los intervalos RR
 * Útil para identificar patrones irregulares en la frecuencia cardíaca
 * 
 * @param intervals Array de intervalos RR en milisegundos
 * @returns Índice de variación de los intervalos RR (0-1)
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 3) {
    return 0;
  }
  
  // Calcular promedio
  const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  // Calcular desviación absoluta promedio
  let sumAbsDev = 0;
  for (const interval of intervals) {
    sumAbsDev += Math.abs(interval - avg);
  }
  
  const avgAbsDev = sumAbsDev / intervals.length;
  
  // Normalizar respecto al promedio
  return avgAbsDev / avg;
}

/**
 * Detecta arritmias específicas basadas en patrones de intervalos RR
 * 
 * @param intervals Array de intervalos RR en milisegundos
 * @returns Tipo de arritmia detectada o null
 */
export function detectArrhythmiaType(intervals: number[]): string | null {
  if (intervals.length < 5) {
    return null;
  }
  
  const avgRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const rmssd = calculateRMSSD(intervals);
  const variation = calculateRRVariation(intervals);
  
  // Criterios basados en investigación clínica
  if (avgRR < 500) { // FC > 120 lpm
    return "tachycardia";
  }
  
  if (avgRR > 1200) { // FC < 50 lpm
    return "bradycardia";
  }
  
  // Patrón bigeminy: alternancia de intervalos cortos y largos
  let bigeminyCount = 0;
  for (let i = 1; i < intervals.length - 1; i += 2) {
    const pattern1 = intervals[i] - intervals[i-1];
    const pattern2 = intervals[i+1] - intervals[i];
    
    if (Math.sign(pattern1) !== Math.sign(pattern2) && 
        Math.abs(pattern1) > 100 && 
        Math.abs(pattern2) > 100) {
      bigeminyCount++;
    }
  }
  
  if (bigeminyCount >= Math.floor(intervals.length / 4)) {
    return "bigeminy";
  }
  
  // Fibrilación auricular: alta variabilidad y ausencia de patrón
  if (rmssd > 50 && variation > 0.2) {
    return "possible-afib";
  }
  
  return "arrhythmia";
}
