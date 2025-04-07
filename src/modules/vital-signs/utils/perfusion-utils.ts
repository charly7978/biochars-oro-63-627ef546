
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate perfusion index based on real AC and DC components
 * No simulation is used
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  return ac / dc;
}

/**
 * Calculate enhanced perfusion index using multiple channels
 * @param redAC AC component of red channel
 * @param redDC DC component of red channel
 * @param greenAC AC component of green channel (optional)
 * @param greenDC DC component of green channel (optional)
 * @param blueAC AC component of blue channel (optional)
 * @param blueDC DC component of blue channel (optional)
 * @param weights Channel weights (defaults to red: 0.7, green: 0.25, blue: 0.05)
 * @returns Enhanced perfusion index
 */
export function calculateMultichannelPerfusionIndex(
  redAC: number, redDC: number,
  greenAC?: number, greenDC?: number,
  blueAC?: number, blueDC?: number,
  weights: { red: number, green: number, blue: number } = { red: 0.7, green: 0.25, blue: 0.05 }
): number {
  // Calculate individual channel PIs
  const redPI = redDC > 0 ? redAC / redDC : 0;
  
  // If we don't have green and blue values, just return red PI
  if (greenAC === undefined || greenDC === undefined || blueAC === undefined || blueDC === undefined) {
    return redPI;
  }
  
  const greenPI = greenDC > 0 ? greenAC / greenDC : 0;
  const bluePI = blueDC > 0 ? blueAC / blueDC : 0;
  
  // Combine PIs using weighted average
  const combinedPI = 
    (redPI * weights.red) + 
    (greenPI * weights.green) + 
    (bluePI * weights.blue);
  
  return combinedPI;
}

/**
 * Analyze perfusion index quality
 * @param perfusionIndex Calculated PI
 * @returns Quality score (0-100)
 */
export function analyzePerfusionQuality(perfusionIndex: number): number {
  if (perfusionIndex <= 0) return 0;
  
  // Perfusion Index interpretation:
  // < 0.02: Very poor
  // 0.02-0.05: Poor
  // 0.05-0.10: Adequate
  // 0.10-0.20: Good
  // > 0.20: Excellent
  
  if (perfusionIndex < 0.02) return Math.max(0, Math.min(30, perfusionIndex * 1500));
  if (perfusionIndex < 0.05) return Math.max(30, Math.min(50, 30 + (perfusionIndex - 0.02) * 667));
  if (perfusionIndex < 0.10) return Math.max(50, Math.min(75, 50 + (perfusionIndex - 0.05) * 500));
  if (perfusionIndex < 0.20) return Math.max(75, Math.min(95, 75 + (perfusionIndex - 0.10) * 200));
  
  return 95; // Cap at 95 for very high PIs
}
