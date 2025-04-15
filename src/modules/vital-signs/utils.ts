/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Re-export vital sign utilities from the central location
 * All functions process only real data without simulation.
 */

export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  calculateAmplitude,
  amplifySignal,
  calculatePerfusionIndex
} from '../../utils/vitalSignsUtils';
