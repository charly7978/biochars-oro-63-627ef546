
// Eliminé la importación inválida y mantuve la funcionalidad de logging simple

// Temporary dummy for missing module to fix import error

export default function logSignalProcessing(level: string, message: string) {
  console.log(`[SignalLogging][${level}] ${message}`);
}

export enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR'
}

