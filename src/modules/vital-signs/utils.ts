
/**
 * Para evitar conflictos de exportación, seleccionamos específicamente qué exportar
 * desde cada archivo de utilidades y renombramos las funciones duplicadas.
 */

// Importar y renombrar funciones específicas de vitalSignsUtils
import { 
  estimateSpO2,
  estimateBloodPressure,
  analyzeRRIntervals,
  formatBloodPressure,
  evaluateVitalSigns
} from '../../utils/vitalSignsUtils';

// Importar y renombrar funciones específicas de signalProcessingUtils
import {
  applyMovingAverageFilter,
  applyWeightedFilter,
  calculateSignalQuality,
  detectPeaks,
  amplifyHeartbeatRealtime,
  calculateRMSSD
} from '../../utils/signalProcessingUtils';

// Re-exportar funciones sin conflictos
export {
  // De vitalSignsUtils
  estimateSpO2,
  estimateBloodPressure,
  analyzeRRIntervals,
  formatBloodPressure,
  evaluateVitalSigns,
  
  // De signalProcessingUtils
  applyMovingAverageFilter,
  applyWeightedFilter,
  calculateSignalQuality,
  detectPeaks,
  amplifyHeartbeatRealtime,
  calculateRMSSD
};

// Importar funciones conflictivas de vitalSignsUtils y renombrarlas 
// para uso interno (las renombramos para evitar colisiones)
import {
  calculateAC as vitalSignsCalculateAC,
  calculateDC as vitalSignsCalculateDC,
  findPeaksAndValleys as vitalSignsFindPeaksAndValleys,
  calculateAmplitude as vitalSignsCalculateAmplitude
} from '../../utils/vitalSignsUtils';

// Importar funciones conflictivas de signalProcessingUtils y renombrarlas
import {
  calculateAC as signalProcessingCalculateAC,
  calculateDC as signalProcessingCalculateDC,
  findPeaksAndValleys as signalProcessingFindPeaksAndValleys,
  calculateAmplitude as signalProcessingCalculateAmplitude
} from '../../utils/signalProcessingUtils';

// Re-exportar con nombres diferentes para evitar ambigüedad
export {
  vitalSignsCalculateAC as vsCalculateAC,
  vitalSignsCalculateDC as vsCalculateDC,
  vitalSignsFindPeaksAndValleys as vsFindPeaksAndValleys,
  vitalSignsCalculateAmplitude as vsCalculateAmplitude,
  
  signalProcessingCalculateAC as spCalculateAC,
  signalProcessingCalculateDC as spCalculateDC,
  signalProcessingFindPeaksAndValleys as spFindPeaksAndValleys,
  signalProcessingCalculateAmplitude as spCalculateAmplitude
};

// Exportar las funciones preferidas con sus nombres originales
// Usamos las de signalProcessingUtils como predeterminadas
export {
  signalProcessingCalculateAC as calculateAC,
  signalProcessingCalculateDC as calculateDC,
  signalProcessingFindPeaksAndValleys as findPeaksAndValleys,
  signalProcessingCalculateAmplitude as calculateAmplitude
};
