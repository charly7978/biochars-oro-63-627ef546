
import { ProcessedHeartbeatSignal } from '../types';

export class HeartbeatProcessorAdapter {
  // Proporcionamos una implementación completa para asegurar compatibilidad con tipos

  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private bpmValues: number[] = [];
  private arrhythmiaCounter = 0;

  /**
   * Adapter para resultados del procesador de latido
   */
  adaptResult(result: any): ProcessedHeartbeatSignal {
    const now = Date.now();
    
    // Detectar pico y actualizar RR intervals
    if (result.isPeak && result.confidence > 0.2) {
      if (this.lastPeakTime) {
        const interval = now - this.lastPeakTime;
        this.rrIntervals.push(interval);
        
        // Mantener solo los últimos 8 intervalos
        if (this.rrIntervals.length > 8) {
          this.rrIntervals.shift();
        }
        
        // Verificar arritmia
        if (this.isArrhythmia(interval)) {
          this.arrhythmiaCounter++;
        }
      }
      this.lastPeakTime = now;
    }
    
    // Calcular BPM instantáneo
    let instantaneousBPM = 0;
    if (this.rrIntervals.length > 0) {
      const avgInterval = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
      instantaneousBPM = Math.round(60000 / avgInterval);
    }
    
    // Mantener historial de BPM
    if (instantaneousBPM > 40 && instantaneousBPM < 200) {
      this.bpmValues.push(instantaneousBPM);
      if (this.bpmValues.length > 10) {
        this.bpmValues.shift();
      }
    }
    
    // Calcular BPM promedio (filtrado)
    let heartRate = 0;
    if (this.bpmValues.length >= 3) {
      const sorted = [...this.bpmValues].sort((a, b) => a - b);
      // Quitar outliers
      const filtered = sorted.slice(Math.floor(sorted.length * 0.1), Math.ceil(sorted.length * 0.9));
      const sum = filtered.reduce((a, b) => a + b, 0);
      heartRate = Math.round(sum / filtered.length);
    }
    
    return {
      timestamp: now,
      rawValue: result.filteredValue || 0,  // Usar filteredValue como rawValue
      filteredValue: result.filteredValue || 0,
      amplifiedValue: result.filteredValue ? result.filteredValue * 1.5 : 0, // Amplificar señal
      isPeak: result.isPeak || false,
      peakConfidence: result.confidence || 0,
      instantaneousBPM: instantaneousBPM || null,
      heartRate: heartRate || 0,
      quality: result.confidence ? Math.round(result.confidence * 100) : 0,
      rrIntervals: [...this.rrIntervals],
      isArrhythmia: this.arrhythmiaCounter > 0,
      arrhythmiaCount: this.arrhythmiaCounter
    };
  }
  
  /**
   * Detecta arritmias basado en intervalos RR
   */
  private isArrhythmia(currentInterval: number): boolean {
    if (this.rrIntervals.length < 3) return false;
    
    // Calcular promedio y variación
    const avg = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
    const variation = Math.abs(currentInterval - avg) / avg;
    
    return variation > 0.20; // 20% de variación se considera arritmia
  }
  
  /**
   * Resetea el adaptador
   */
  reset(): void {
    this.lastBeepTime = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.bpmValues = [];
    this.arrhythmiaCounter = 0;
  }
}
