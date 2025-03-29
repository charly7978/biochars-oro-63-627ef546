
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Encuentra picos y valles en una señal real
 * Modificado para representar correctamente los picos en la gráfica PPG
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo mejorado para detección de picos y valles en datos reales
  // Busca picos correctamente orientados (hacia arriba)
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    // Detección de picos (orientados hacia arriba)
    if (
      v >= values[i - 1] * 0.95 &&
      v >= values[i + 1] * 0.95
    ) {
      const localMin = Math.min(values[i - 1], values[i + 1]);
      if (v - localMin > 0.02) {
        peakIndices.push(i);
      }
    }
    // Detección de valles (orientados hacia abajo)
    if (
      v <= values[i - 1] * 1.05 &&
      v <= values[i + 1] * 1.05
    ) {
      const localMax = Math.max(values[i - 1], values[i + 1]);
      if (localMax - v > 0.02) {
        valleyIndices.push(i);
      }
    }
  }
  
  // Filtrar picos muy cercanos (mejora de visualización)
  const filteredPeaks: number[] = [];
  const MIN_DISTANCE = 3;
  
  for (let i = 0; i < peakIndices.length; i++) {
    if (i === 0 || peakIndices[i] - peakIndices[i - 1] >= MIN_DISTANCE) {
      filteredPeaks.push(peakIndices[i]);
    }
  }
  
  return { peakIndices: filteredPeaks, valleyIndices };
}

/**
 * Calcula la amplitud entre picos y valles de señales reales
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
      const distance = Math.abs(peakIdx - valleyIdx);
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
  return amps.reduce((a, b) => a + b, 0) / amps.length;
}

/**
 * Detecta patrones de arritmia basados en cambios de amplitud y tiempo entre picos
 * Análisis mejorado para visualización en tiempo real
 */
export function detectArrhythmiaPattern(
  peakIndices: number[],
  values: number[],
  samplingRate: number = 30
): { 
  isArrhythmia: boolean; 
  segments: Array<{ start: number; end: number }>; 
  confidence: number 
} {
  if (peakIndices.length < 4) {
    return { isArrhythmia: false, segments: [], confidence: 0 };
  }
  
  // Calcular intervalos RR (tiempo entre picos)
  const rrIntervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    rrIntervals.push((peakIndices[i] - peakIndices[i - 1]) * (1000 / samplingRate));
  }
  
  // Calcular variabilidad
  let meanRR = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  let variability = 0;
  
  for (const interval of rrIntervals) {
    variability += Math.pow(interval - meanRR, 2);
  }
  
  variability = Math.sqrt(variability / rrIntervals.length) / meanRR;
  
  // Detectar segmentos de posible arritmia
  const segments: Array<{ start: number; end: number }> = [];
  let isArrhythmia = false;
  let confidence = 0;
  
  // Un intervalo RR se considera arrítmico si difiere más del 20% de la media
  for (let i = 0; i < rrIntervals.length; i++) {
    if (Math.abs(rrIntervals[i] - meanRR) > meanRR * 0.2) {
      const start = peakIndices[i];
      const end = peakIndices[i + 1] || values.length - 1;
      segments.push({ start, end });
      isArrhythmia = true;
    }
  }
  
  // Calcular confianza basada en variabilidad
  if (isArrhythmia) {
    confidence = Math.min(1, Math.max(0, variability * 5));
  }
  
  return { isArrhythmia, segments, confidence };
}
