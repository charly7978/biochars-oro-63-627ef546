
/**
 * Evaluador de calidad de señal PPG real
 * Proporciona evaluación básica de calidad de señal
 */

export interface SignalQualityResult {
  level: number;
  color: string;
  label: string;
}

/**
 * Evalúa la calidad de la señal PPG
 * @param ppg - Array de valores PPG para evaluar
 * @returns Resultado de evaluación de calidad
 */
export function evaluateSignalQuality(ppg: number[]): SignalQualityResult {
  if (!ppg || ppg.length < 10) {
    return { level: 0, color: 'gray', label: 'Sin datos' };
  }

  // Análisis básico de la señal
  const min = Math.min(...ppg);
  const max = Math.max(...ppg);
  const range = max - min;
  
  // Calcular varianza para detector ruido
  const mean = ppg.reduce((sum, val) => sum + val, 0) / ppg.length;
  const variance = ppg.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / ppg.length;
  const normalizedVariance = variance / (mean * mean);
  
  // Detectar inestabilidad
  let changes = 0;
  let lastDirection = 0;
  
  for (let i = 1; i < ppg.length; i++) {
    const direction = ppg[i] > ppg[i-1] ? 1 : ppg[i] < ppg[i-1] ? -1 : 0;
    if (direction !== 0 && direction !== lastDirection) {
      changes++;
      lastDirection = direction;
    }
  }
  
  const changeRate = changes / ppg.length;
  
  // Calcular nivel de calidad (0-1)
  let level = 0;
  
  // Factores de calidad
  const amplitudeScore = Math.min(range * 3, 0.5); // Amplitud contribuye hasta 50%
  const stabilityScore = Math.max(0, 0.3 - normalizedVariance * 2); // Estabilidad hasta 30% 
  const rhythmScore = Math.max(0, 0.2 - Math.abs(changeRate - 0.15) * 0.8); // Ritmo hasta 20%
  
  level = amplitudeScore + stabilityScore + rhythmScore;
  level = Math.min(1, Math.max(0, level));
  
  // Determinar color y etiqueta
  let color = 'gray';
  let label = 'Desconocida';
  
  if (level > 0.85) {
    color = 'green';
    label = 'Excelente';
  } else if (level > 0.65) {
    color = 'green';
    label = 'Buena';
  } else if (level > 0.45) {
    color = 'yellow';
    label = 'Regular';
  } else if (level > 0.25) {
    color = 'orange';
    label = 'Baja';
  } else {
    color = 'red';
    label = 'Muy baja';
  }
  
  return { level, color, label };
}
