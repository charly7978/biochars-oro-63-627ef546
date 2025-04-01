
/**
 * Calculador de presión arterial
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { CalculationResultItem } from '../types';
import { BaseCalculator } from './base-calculator';

/**
 * Calculador especializado para valores de presión arterial
 * Deriva presión sistólica y diastólica de características PPG
 */
export class BloodPressureCalculator extends BaseCalculator {
  private readonly baseSystolic = 120; // mmHg
  private readonly baseDiastolic = 80; // mmHg
  private calibrationSystolic = 0;
  private calibrationDiastolic = 0;
  private lastPeaks: number[] = [];
  private lastValleys: number[] = [];
  
  constructor() {
    super();
    // Buffer más grande para análisis
    this._maxBufferSize = 100;
  }
  
  /**
   * Calcula presión arterial basada en características de la señal
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem {
    if (!signal) {
      return { value: '0/0', confidence: 0, status: 'error', data: null };
    }
    
    // Añadir valor al buffer
    this.valueBuffer.push(signal.value);
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Requerir suficientes muestras
    if (this.valueBuffer.length < 30) {
      return { 
        value: `${this.baseSystolic}/${this.baseDiastolic}`, 
        confidence: 0.3, 
        status: 'calibrating', 
        data: null 
      };
    }
    
    // Extraer características de la señal
    const features = this.extractFeatures(signal);
    
    // Calcular confianza basada en calidad de señal
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    
    // Calcular presión
    const { systolic, diastolic } = this.calculateBloodPressure(features);
    
    // Calcular confianza
    const confidence = (
      (signalQuality / 100) * 0.5 +
      Math.min(1, this.valueBuffer.length / this._maxBufferSize) * 0.3 +
      0.2 // Base
    );
    
    // Actualizar valor y confianza
    this.lastCalculatedValue = systolic;
    this.lastConfidence = confidence;
    
    return {
      value: `${systolic}/${diastolic}`,
      confidence,
      status: 'ok',
      data: features
    };
  }
  
  /**
   * Extrae características relevantes para estimación de presión arterial
   */
  private extractFeatures(signal: OptimizedSignal) {
    // Características clave relacionadas con perfil de la señal
    
    // Ventana de análisis
    const recentValues = this.valueBuffer.slice(-40);
    
    // Detectar picos y valles
    const { peaks, valleys } = this.detectPeaksAndValleys(recentValues);
    
    // Actualizar últimos picos y valles
    this.lastPeaks = peaks.map(p => recentValues[p]);
    this.lastValleys = valleys.map(v => recentValues[v]);
    
    // 1. Calcular amplitudes
    const amplitudes = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      if (peaks[i] > valleys[i]) {
        const amp = recentValues[peaks[i]] - recentValues[valleys[i]];
        amplitudes.push(amp);
      }
    }
    const avgAmplitude = amplitudes.length > 0 ? 
      amplitudes.reduce((sum, val) => sum + val, 0) / amplitudes.length : 0;
    
    // 2. Calcular tiempo de subida y dicrótico
    const riseTime = this.calculateRiseTime(recentValues, peaks, valleys);
    const dicroticNotch = this.findDicroticNotch(recentValues, peaks, valleys);
    
    // 3. Índice de rigidez (Stiffness Index)
    const stiffnessIndex = this.calculateStiffnessIndex(recentValues, peaks, valleys);
    
    // 4. Reflectancia
    const reflectanceIndex = this.calculateReflectanceIndex(recentValues, peaks, valleys);
    
    // 5. Ancho de pulso
    const pulseWidth = this.calculatePulseWidth(recentValues, peaks, valleys);
    
    return {
      avgAmplitude,
      riseTime,
      dicroticNotch,
      stiffnessIndex,
      reflectanceIndex,
      pulseWidth,
      peakCount: peaks.length,
      valleyCount: valleys.length
    };
  }
  
  /**
   * Detecta picos y valles en una señal
   */
  private detectPeaksAndValleys(values: number[]) {
    const peaks = [];
    const valleys = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      // Detección de picos (5-punto)
      if (values[i] > values[i-2] && values[i] > values[i-1] && 
          values[i] > values[i+1] && values[i] > values[i+2]) {
        peaks.push(i);
      }
      
      // Detección de valles (5-punto)
      if (values[i] < values[i-2] && values[i] < values[i-1] && 
          values[i] < values[i+1] && values[i] < values[i+2]) {
        valleys.push(i);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Calcula tiempo de subida entre valle y pico
   */
  private calculateRiseTime(values: number[], peaks: number[], valleys: number[]): number {
    const riseTimes = [];
    
    for (let i = 0; i < valleys.length; i++) {
      // Encontrar el siguiente pico después del valle
      const valley = valleys[i];
      let nextPeak = -1;
      
      for (const peak of peaks) {
        if (peak > valley) {
          nextPeak = peak;
          break;
        }
      }
      
      if (nextPeak > 0) {
        // Tiempo en muestras
        riseTimes.push(nextPeak - valley);
      }
    }
    
    if (riseTimes.length === 0) return 0;
    
    // Promedio
    return riseTimes.reduce((sum, val) => sum + val, 0) / riseTimes.length;
  }
  
  /**
   * Busca la muesca dicrótica después de cada pico
   */
  private findDicroticNotch(values: number[], peaks: number[], valleys: number[]): number {
    // La muesca dicrótica aparece como una pequeña inflexión después del pico sistólico
    const notchDistances = [];
    
    for (const peak of peaks) {
      let notchPos = -1;
      let minSlope = 0;
      
      // Buscar posición donde la pendiente cambia
      for (let i = peak + 2; i < Math.min(values.length - 1, peak + 15); i++) {
        const slope1 = values[i] - values[i-1];
        const slope2 = values[i+1] - values[i];
        
        // Cambio significativo de pendiente
        if (slope1 < 0 && slope2 > slope1) {
          if (notchPos === -1 || slope2 - slope1 > minSlope) {
            notchPos = i;
            minSlope = slope2 - slope1;
          }
        }
      }
      
      if (notchPos > 0) {
        notchDistances.push(notchPos - peak);
      }
    }
    
    if (notchDistances.length === 0) return 0;
    
    // Devolver promedio
    return notchDistances.reduce((sum, val) => sum + val, 0) / notchDistances.length;
  }
  
  /**
   * Calcula el índice de rigidez arterial
   */
  private calculateStiffnessIndex(values: number[], peaks: number[], valleys: number[]): number {
    // Índice de rigidez: relación entre altura pico y tiempo al pico
    const indices = [];
    
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      if (peaks[i] > valleys[i]) {
        const height = values[peaks[i]] - values[valleys[i]];
        const time = peaks[i] - valleys[i];
        if (time > 0) {
          indices.push(height / time);
        }
      }
    }
    
    if (indices.length === 0) return 1;
    
    return indices.reduce((sum, val) => sum + val, 0) / indices.length;
  }
  
  /**
   * Calcula índice de reflectancia (onda reflejada)
   */
  private calculateReflectanceIndex(values: number[], peaks: number[], valleys: number[]): number {
    // Índice de reflectancia: altura de la muesca dicrótica / altura del pico
    const indices = [];
    
    for (const peak of peaks) {
      // Buscar muesca dicrótica
      let notchPos = -1;
      let minSlope = 0;
      
      for (let i = peak + 2; i < Math.min(values.length - 1, peak + 15); i++) {
        const slope1 = values[i] - values[i-1];
        const slope2 = values[i+1] - values[i];
        
        if (slope1 < 0 && slope2 > slope1) {
          if (notchPos === -1 || slope2 - slope1 > minSlope) {
            notchPos = i;
            minSlope = slope2 - slope1;
          }
        }
      }
      
      if (notchPos > 0) {
        // Encuentra valle anterior al pico
        let prevValley = -1;
        for (const v of valleys) {
          if (v < peak) prevValley = v;
        }
        
        if (prevValley >= 0) {
          const peakHeight = values[peak] - values[prevValley];
          const notchHeight = values[notchPos] - values[prevValley];
          
          if (peakHeight > 0) {
            indices.push(notchHeight / peakHeight);
          }
        }
      }
    }
    
    if (indices.length === 0) return 0.5;
    
    return indices.reduce((sum, val) => sum + val, 0) / indices.length;
  }
  
  /**
   * Calcula ancho de pulso
   */
  private calculatePulseWidth(values: number[], peaks: number[], valleys: number[]): number {
    const widths = [];
    
    // Por cada pico, medir distancia entre valles adyacentes
    for (const peak of peaks) {
      let prevValley = -1;
      let nextValley = -1;
      
      // Encontrar valle anterior
      for (const v of valleys) {
        if (v < peak) prevValley = v;
      }
      
      // Encontrar valle siguiente
      for (const v of valleys) {
        if (v > peak) {
          nextValley = v;
          break;
        }
      }
      
      if (prevValley >= 0 && nextValley >= 0) {
        widths.push(nextValley - prevValley);
      }
    }
    
    if (widths.length === 0) return 20; // Valor por defecto
    
    return widths.reduce((sum, val) => sum + val, 0) / widths.length;
  }
  
  /**
   * Calcula presión arterial basada en características
   */
  private calculateBloodPressure(features: any): { systolic: number, diastolic: number } {
    /*
     * Modelo de cálculo basado en investigación:
     * - Tiempo de subida rápido = presión sistólica más alta
     * - Muesca dicrótica más cercana al pico = presión sistólica más alta
     * - Mayor índice de rigidez = presión más alta
     * - Mayor reflectancia = presión diastólica más alta
     */
    
    // Valores iniciales
    let systolic = this.baseSystolic;
    let diastolic = this.baseDiastolic;
    
    // 1. Ajuste por tiempo de subida (inverso)
    const riseTimeNorm = Math.max(0.1, Math.min(1, features.riseTime / 20));
    systolic += (1 - riseTimeNorm) * 20;
    
    // 2. Ajuste por muesca dicrótica (inverso)
    const notchNorm = Math.max(0.1, Math.min(1, features.dicroticNotch / 15));
    systolic += (1 - notchNorm) * 15;
    
    // 3. Ajuste por índice de rigidez (directo)
    const stiffnessNorm = Math.max(0.1, Math.min(1, features.stiffnessIndex));
    systolic += stiffnessNorm * 10;
    diastolic += stiffnessNorm * 8;
    
    // 4. Ajuste por índice de reflectancia (directo para diastólica)
    const reflectanceNorm = Math.max(0.1, Math.min(1, features.reflectanceIndex * 2));
    diastolic += reflectanceNorm * 10;
    
    // 5. Ajuste por ancho de pulso (inverso para sistólica, directo para diastólica)
    const widthNorm = Math.max(0.1, Math.min(1, features.pulseWidth / 25));
    systolic += (1 - widthNorm) * 5;
    diastolic += widthNorm * 7;
    
    // Ajuste diferencial (sistólica siempre mayor que diastólica)
    const minDiff = 30; // Diferencia mínima entre sistólica y diastólica
    if (systolic - diastolic < minDiff) {
      const currentDiff = systolic - diastolic;
      const adjust = (minDiff - currentDiff) / 2;
      systolic += adjust;
      diastolic -= adjust;
    }
    
    // Considerar calibración
    if (this.calibrationSystolic > 0 && this.calibrationDiastolic > 0) {
      const sysDiff = this.calibrationSystolic - this.baseSystolic;
      const diaDiff = this.calibrationDiastolic - this.baseDiastolic;
      
      systolic += sysDiff * 0.7;
      diastolic += diaDiff * 0.7;
    }
    
    // Limitar a valores realistas
    systolic = Math.max(90, Math.min(180, Math.round(systolic)));
    diastolic = Math.max(50, Math.min(120, Math.round(diastolic)));
    
    return { systolic, diastolic };
  }
  
  /**
   * Calibra el calculador con un valor de referencia
   */
  public calibrate(reference: { systolic: number, diastolic: number }): void {
    if (reference && reference.systolic > 0 && reference.diastolic > 0) {
      // Actualizar niveles de calibración
      this.calibrationSystolic = reference.systolic;
      this.calibrationDiastolic = reference.diastolic;
      
      // Ajustar confianza según calibración
      if (this.lastConfidence < 0.7) {
        this.lastConfidence = 0.7;
      }
      
      // Sugerir ajustes específicos para optimizador
      if (reference.systolic > 140 || reference.diastolic > 90) {
        // Presión alta
        this.suggestedParameters = {
          sensitivity: 1.1,
          filterStrength: 0.4
        };
      } else if (reference.systolic < 110 || reference.diastolic < 70) {
        // Presión baja
        this.suggestedParameters = {
          sensitivity: 1.3,
          filterStrength: 0.3
        };
      } else {
        // Presión normal
        this.suggestedParameters = {
          sensitivity: 1.2,
          filterStrength: 0.35
        };
      }
    }
  }
  
  /**
   * Genera ajustes recomendados para optimizador
   */
  public generateOptimizerFeedback(): any {
    const feedback = [];
    
    // Añadir sugerencia si confianza es baja
    if (this.lastConfidence < 0.5) {
      feedback.push({
        channel: 'bloodPressure',
        adjustment: 'increase',
        magnitude: 0.15,
        parameter: 'amplification'
      });
      
      feedback.push({
        channel: 'bloodPressure',
        adjustment: 'decrease',
        magnitude: 0.1,
        parameter: 'filterStrength'
      });
    } else if (this.lastConfidence > 0.85) {
      // Si confianza es alta, ajuste fino
      feedback.push({
        channel: 'bloodPressure',
        adjustment: 'fine-tune',
        magnitude: 0.05,
        parameter: 'noiseThreshold'
      });
    }
    
    return feedback;
  }
}
