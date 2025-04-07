
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Simple peak detection logic for heart rate signal
 */

/**
 * Handle peak detection and trigger beep if needed
 * Simplified version focused on stability
 */
export const handlePeakDetection = (
  result: any,
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void => {
  // Only process confirmed peaks during monitoring
  if (result.isPeak && isMonitoringRef.current) {
    const now = Date.now();
    
    // Store the peak time for BPM calculation
    lastPeakTimeRef.current = now;
    
    // Simplified beep request - only basic parameters
    requestImmediateBeep(value);
  }
}
