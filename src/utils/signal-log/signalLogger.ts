
// Fix SignalLogEntry type error
import { SignalValue } from '../../types/signal';

/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

export interface SignalLogEntry {
  timestamp: number;
  value: SignalValue;
  quality: number;
  isFingerDetected: boolean;
  heartRate?: number;
  rmssd?: number;
}

export class SignalLogger {
  private logs: SignalLogEntry[] = [];
  private readonly MAX_LOG_SIZE = 1000;
  
  logSignal(entry: SignalLogEntry): void {
    this.logs.push({
      timestamp: entry.timestamp,
      value: entry.value,
      quality: entry.quality,
      isFingerDetected: entry.isFingerDetected,
      heartRate: entry.heartRate,
      rmssd: entry.rmssd
    });
    
    if (this.logs.length > this.MAX_LOG_SIZE) {
      this.logs.shift();
    }
  }
  
  getLogs(): SignalLogEntry[] {
    return [...this.logs];
  }
  
  clear(): void {
    this.logs = [];
  }
}

export const signalLogger = new SignalLogger();
