
/**
 * NOTA IMPORTANTE: Este es un módulo de procesamiento de señales.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import { applySMAFilter, calculatePerfusionIndex } from '../../utils/vitalSignsUtils';

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  rawValue?: number;
}

export class SignalProcessor {
  private readonly BUFFER_SIZE = 300;
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly QUALITY_THRESHOLD = 0.03; // Lowered from 0.05 to increase sensitivity
  private readonly FINGER_DETECTION_THRESHOLD = 25; // Lowered from 30 to detect more easily
  
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private lastProcessedTime: number = 0;
  private consecutiveFingerFrames: number = 0;
  private readonly MIN_FINGER_FRAMES = 2; // Reduced from 3 for faster detection
  
  /**
   * Procesa una señal PPG (fotopletismografía) y devuelve valores filtrados y análisis
   */
  public processSignal(value: number): ProcessedSignal {
    // Aplicar filtro SMA para suavizar la señal
    const { filteredValue, updatedBuffer } = applySMAFilter(value, this.smaBuffer, this.SMA_WINDOW_SIZE);
    this.smaBuffer = updatedBuffer;
    
    // Actualizar buffer de valores PPG
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    // Calcular calidad de la señal
    const quality = this.calculateSignalQuality(filteredValue);
    
    // Detección de dedo en el sensor mejorada
    let fingerDetected = false;
    if (quality > this.QUALITY_THRESHOLD || value > this.FINGER_DETECTION_THRESHOLD) {
      this.consecutiveFingerFrames++;
      if (this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES) {
        fingerDetected = true;
      }
    } else {
      // Improved debouncing to avoid quick toggling of detection state
      this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 1);
    }
    
    // Actualizar tiempo de procesamiento
    this.lastProcessedTime = Date.now();
    
    return {
      filteredValue,
      quality: quality * 100, // Normalizar a porcentaje
      fingerDetected,
      rawValue: value
    };
  }
  
  /**
   * Calcula la calidad de la señal PPG
   */
  private calculateSignalQuality(value: number): number {
    if (this.ppgValues.length < 10) return 0;
    
    // Usar los últimos 30 valores para el cálculo
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular AC y DC
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const ac = max - min;
    const dc = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular índice de perfusión
    const perfusionIndex = calculatePerfusionIndex(ac, dc);
    
    // Normalizar a un rango [0,1] donde valores mayores indican mejor calidad
    // Use a less stringent normalization to improve detection:
    const normalizedQuality = Math.min(1, perfusionIndex * 15);
    
    return normalizedQuality;
  }
  
  /**
   * Obtiene los valores PPG actuales
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.consecutiveFingerFrames = 0;
  }
}
