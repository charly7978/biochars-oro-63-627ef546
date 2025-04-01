
/**
 * Diagnostics module for signal processing
 */

interface DiagnosticsEntry {
  timestamp: number;
  processingTime: number;
  signalStrength: number;
  signalQuality: number;
}

// Storage for diagnostics data
const diagnosticsBuffer: DiagnosticsEntry[] = [];
const MAX_ENTRIES = 100;

/**
 * Add diagnostics data to the buffer
 */
export function addDiagnosticsData(entry: DiagnosticsEntry): void {
  diagnosticsBuffer.push(entry);
  if (diagnosticsBuffer.length > MAX_ENTRIES) {
    diagnosticsBuffer.shift();
  }
}

/**
 * Get all diagnostics data
 */
export function getDiagnosticsData(): DiagnosticsEntry[] {
  return [...diagnosticsBuffer];
}

/**
 * Clear all diagnostics data
 */
export function clearDiagnosticsData(): void {
  diagnosticsBuffer.length = 0;
}
