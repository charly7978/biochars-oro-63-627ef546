
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Encuentra picos y valles en una señal real
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo para detección de picos y valles en datos reales
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    // Detección de picos
    if (
      v >= values[i - 1] * 0.95 &&
      v >= values[i + 1] * 0.95
    ) {
      const localMin = Math.min(values[i - 1], values[i + 1]);
      if (v - localMin > 0.02) {
        peakIndices.push(i);
      }
    }
    // Detección de valles
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
  return { peakIndices, valleyIndices };
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
