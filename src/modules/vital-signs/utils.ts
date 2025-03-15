
/**
 * Utilidades para el procesamiento de señales vitales
 */

/**
 * Encuentra picos y valles en una señal PPG
 */
export function findPeaksAndValleys(values: number[]): {
  peakIndices: number[];
  valleyIndices: number[];
} {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  if (values.length < 3) {
    return { peakIndices, valleyIndices };
  }
  
  // Usar ventana deslizante para detectar picos y valles
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const next = values[i + 1];
    
    // Detectar pico: valor actual mayor que vecinos
    if (current > prev && current > next) {
      peakIndices.push(i);
    }
    
    // Detectar valle: valor actual menor que vecinos
    if (current < prev && current < next) {
      valleyIndices.push(i);
    }
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud de la señal PPG usando los picos y valles identificados
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (peakIndices.length === 0 || valleyIndices.length === 0) {
    return 0;
  }
  
  // Calcular amplitudes promedio entre picos y valles
  let totalAmplitude = 0;
  let count = 0;
  
  // Calcular la amplitud para cada ciclo completo de la señal
  for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
    const peakIdx = peakIndices[i];
    // Encontrar el valle más cercano anterior al pico
    let nearestValleyIdx = -1;
    for (const valleyIdx of valleyIndices) {
      if (valleyIdx < peakIdx) {
        nearestValleyIdx = valleyIdx;
      } else {
        break;
      }
    }
    
    if (nearestValleyIdx !== -1) {
      const peak = values[peakIdx];
      const valley = values[nearestValleyIdx];
      totalAmplitude += Math.abs(peak - valley);
      count++;
    }
  }
  
  return count > 0 ? totalAmplitude / count : 0;
}
