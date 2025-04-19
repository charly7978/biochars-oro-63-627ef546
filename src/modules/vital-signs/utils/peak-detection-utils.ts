
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Encuentra picos y valles en una señal real
 * Algoritmo mejorado para detectar correctamente los picos en la señal PPG
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Necesitamos al menos 3 puntos para detectar picos y valles
  if (values.length < 3) {
    return { peakIndices, valleyIndices };
  }

  // Calcular umbral adaptativo basado en la amplitud de la señal
  const max = Math.max(...values);
  const min = Math.min(...values);
  const amplitude = max - min;
  const threshold = Math.max(0.005, amplitude * 0.03); // Umbral reducido para mayor sensibilidad

  // Algoritmo mejorado para detección de picos y valles en datos reales
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    const prev1 = values[i - 1];
    const next1 = values[i + 1];
    
    // Detección de picos (simplificada para mayor sensibilidad)
    if (v > prev1 && v > next1) {
      // Verificar que el pico sea significativo respecto a sus vecinos
      const localMin = Math.min(prev1, next1);
      if (v - localMin > threshold) {
        peakIndices.push(i);
        
        // Registro detallado solo para cada 5to pico para evitar sobrecarga de consola
        if (peakIndices.length % 5 === 0) {
          console.log("Peak detected at index", i, "value:", v, "diff:", v - localMin);
        }
      }
    }
    
    // Detección de valles (simplificada para mayor sensibilidad)
    if (v < prev1 && v < next1) {
      // Verificar que el valle sea significativo respecto a sus vecinos
      const localMax = Math.max(prev1, next1);
      if (localMax - v > threshold) {
        valleyIndices.push(i);
      }
    }
  }
  
  // Registrar resultados de la detección
  if (peakIndices.length > 0 || valleyIndices.length > 0) {
    console.log("Peak/Valley detection results:", {
      totalPeaks: peakIndices.length,
      totalValleys: valleyIndices.length,
      signalLength: values.length,
      threshold
    });
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud entre picos y valles de señales reales
 * Implementación mejorada para detectar amplitud en señales de baja calidad
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[] = [],
  valleyIndices: number[] = []
): number {
  // Si no se proporcionan índices, calcular la amplitud general
  if (peakIndices.length === 0 || valleyIndices.length === 0) {
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }

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
    
    if (closestValleyIdx !== -1 && minDistance < 30) { // Aumentado para mayor sensibilidad
      const amp = values[peakIdx] - values[closestValleyIdx];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) {
    // Si no se encontraron amplitudes válidas, usar método alternativo
    if (values.length > 0) {
      // Ordenar valores y tomar diferencia entre percentiles
      const sortedValues = [...values].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedValues.length * 0.95);
      const p5Index = Math.floor(sortedValues.length * 0.05);
      return sortedValues[p95Index] - sortedValues[p5Index];
    }
    return 0;
  }

  // Calcular la media con datos reales, excluyendo outliers
  const sortedAmps = [...amps].sort((a, b) => a - b);
  const validAmps = sortedAmps.slice(
    Math.floor(sortedAmps.length * 0.1),
    Math.ceil(sortedAmps.length * 0.9)
  );
  
  if (validAmps.length === 0) return sortedAmps[Math.floor(sortedAmps.length / 2)] || 0;
  return validAmps.reduce((a, b) => a + b, 0) / validAmps.length;
}
