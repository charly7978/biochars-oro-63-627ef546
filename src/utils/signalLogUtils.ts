
/**
 * Medical-grade utilities for signal logging and analysis
 * with strict validation requirements
 */

// Re-export all functionality from specialized modules
export { updateSignalLog } from './signal-log/signalLogger';
export { validateSignalValue } from './signal-log/validateSignal';
export { calculateSignalQuality, findSignalPeaks } from './signal-log/qualityAnalyzer';
