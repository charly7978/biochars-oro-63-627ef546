
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Medical-grade utilities for signal logging and analysis
 * with strict validation requirements for real signals only
 */

// Re-export all functionality from specialized modules
export { updateSignalLog } from './signal-log/signalLogger';
export { validateSignalValue } from './signal-log/validateSignal';
export { calculateSignalQuality, findSignalPeaks } from './signal-log/qualityAnalyzer';
