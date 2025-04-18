/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Re-export utilities from the centralized location to maintain compatibility
 * All functions process only real data without simulation.
 */

// Re-export relevant utilities from the central location
export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  calculateEMA,
  normalizeValue,
  calculatePerfusionIndex,
  calculateAmplitude // Asegurarse que `calculateAmplitude` esté en lib/utils.ts
} from '@/lib/utils';

// Nota: `findPeaksAndValleys` está obsoleto debido a PeakDetector.
// Nota: `applySMAFilter` y `amplifySignal` podrían estar en lib/utils o necesitar importación específica si se movieron a otro lugar.
// Si se usan externamente a través de este archivo, deben añadirse sus exportaciones desde la ubicación correcta.

// Re-export aliases if needed for compatibility (example)
// export { calculateAC as getAC } from '@/lib/utils';
