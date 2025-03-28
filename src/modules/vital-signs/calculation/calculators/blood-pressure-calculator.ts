
/**
 * Calculador especializado para presión arterial
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { BaseCalculator, BaseVitalSignCalculator, VitalSignCalculation } from '../types';

export class BloodPressureCalculator extends BaseVitalSignCalculator {
  private pulseTransitTime: number = 0;
  private dicroticNotchPosition: number = 0;
  private waveformSlope: number = 0;
  
  constructor() {
    super('bloodPressure', 45); // Customize buffer size if needed
  }
  
  /**
   * Calcula presión arterial basado en señal optimizada
   */
  protected performCalculation(signal: OptimizedSignal): VitalSignCalculation {
    // Analizar forma de onda para extraer características
    this.analyzeWaveform();
    
    // Calcular presión sistólica y diastólica
    const { systolic, diastolic } = this.calculatePressure();
    
    // Calcular confianza del resultado
    const confidence = this.calculateConfidence();
    
    // Formatear resultado
    const pressureValue = systolic > 0 && diastolic > 0 
      ? `${systolic}/${diastolic}` 
      : "--/--";
    
    // Actualizar sugerencias para optimizador
    this.updateOptimizationSuggestions(confidence);
    
    return {
      value: pressureValue,
      confidence,
      timestamp: signal.timestamp,
      metadata: {
        systolic,
        diastolic,
        pulseTransitTime: this.pulseTransitTime,
        dicroticNotchPosition: this.dicroticNotchPosition,
        waveformSlope: this.waveformSlope
      },
      minValue: 0,
      maxValue: 200,
      confidenceThreshold: 0.6,
      defaultValue: "--/--"
    };
  }
  
  /**
   * Analiza forma de onda para extrair características
   */
  private analyzeWaveform(): void {
    if (this.valueBuffer.length < 60) return;
    
    const window = this.valueBuffer.slice(-60);
    
    // Detectar picos
    const peaks = this.detectPeaks(window);
    
    if (peaks.length < 2) {
      this.pulseTransitTime = 0;
      this.dicroticNotchPosition = 0;
      this.waveformSlope = 0;
      return;
    }
    
    // Calcular tiempo de tránsito de pulso (aproximado)
    this.calculatePulseTransitTime(window, peaks);
    
    // Detectar posición de la muesca dicrótica
    this.detectDicroticNotch(window, peaks);
    
    // Calcular pendiente de onda
    this.calculateWaveformSlope(window, peaks);
  }
  
  /**
   * Detecta picos en la forma de onda
   */
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    const threshold = 0.5;
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > threshold && 
          values[i] > values[i-1] && 
          values[i] > values[i-2] && 
          values[i] > values[i+1] && 
          values[i] > values[i+2]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcula tiempo de tránsito de pulso
   */
  private calculatePulseTransitTime(values: number[], peaks: number[]): void {
    if (peaks.length < 2) {
      this.pulseTransitTime = 0;
      return;
    }
    
    // Calcular tiempo promedio entre picos (utilizado como proxy para PTT)
    let ptSum = 0;
    for (let i = 1; i < peaks.length; i++) {
      ptSum += peaks[i] - peaks[i-1];
    }
    
    this.pulseTransitTime = ptSum / (peaks.length - 1);
  }
  
  /**
   * Detecta posición de la muesca dicrótica
   */
  private detectDicroticNotch(values: number[], peaks: number[]): void {
    if (peaks.length < 1) {
      this.dicroticNotchPosition = 0;
      return;
    }
    
    // Buscar muesca dicrótica después del primer pico
    const peak = peaks[0];
    let notchPos = 0;
    let maxSlope = 0;
    
    // Buscar en el intervalo entre pico y 70% del ciclo
    const searchEnd = peak + Math.floor(this.pulseTransitTime * 0.7);
    
    for (let i = peak + 2; i < Math.min(searchEnd, values.length - 1); i++) {
      // Calcular segunda derivada
      const secondDeriv = (values[i+1] - 2*values[i] + values[i-1]);
      
      // Muesca dicrótica visible como cambio abrupto en segunda derivada
      if (Math.abs(secondDeriv) > maxSlope) {
        maxSlope = Math.abs(secondDeriv);
        notchPos = i;
      }
    }
    
    // Normalizar posición respecto al pico
    this.dicroticNotchPosition = notchPos > 0 ? (notchPos - peak) / this.pulseTransitTime : 0;
  }
  
  /**
   * Calcula pendiente de la onda
   */
  private calculateWaveformSlope(values: number[], peaks: number[]): void {
    if (peaks.length < 1) {
      this.waveformSlope = 0;
      return;
    }
    
    // Calcular pendiente de subida desde inicio hasta pico
    const peak = peaks[0];
    
    // Encontrar inicio de onda (punto más bajo antes del pico)
    let startPos = 0;
    let minValue = values[0];
    
    for (let i = 0; i < peak; i++) {
      if (values[i] < minValue) {
        minValue = values[i];
        startPos = i;
      }
    }
    
    // Calcular pendiente
    const rise = values[peak] - values[startPos];
    const run = peak - startPos;
    
    this.waveformSlope = run > 0 ? rise / run : 0;
  }
  
  /**
   * Calcula presión arterial basado en características
   */
  private calculatePressure(): { systolic: number, diastolic: number } {
    if (this.valueBuffer.length < 90 || this.pulseTransitTime === 0) {
      return { systolic: 0, diastolic: 0 };
    }
    
    // Modelo simplificado basado en características
    // En un dispositivo real, estos coeficientes se obtendrían por calibración
    
    // Base values
    const baseSystolic = 120;
    const baseDiastolic = 80;
    
    // Ajuste por tiempo de tránsito de pulso
    // PTT es inversamente proporcional a presión arterial
    const pttFactor = this.pulseTransitTime > 0 ? 
                     30 * (1 - (this.pulseTransitTime / 30)) : 0;
    
    // Ajuste por posición de muesca dicrótica
    // Posición temprana indica mayor resistencia vascular
    const notchFactor = 15 * (1 - this.dicroticNotchPosition);
    
    // Ajuste por pendiente
    // Mayor pendiente indica mayor fuerza contráctil
    const slopeFactor = 10 * this.waveformSlope;
    
    // Cálculo de presión sistólica y diastólica
    const systolic = Math.round(baseSystolic + pttFactor + slopeFactor);
    const diastolic = Math.round(baseDiastolic + (pttFactor * 0.5) + notchFactor);
    
    // Limitar a rangos fisiológicos
    return {
      systolic: Math.max(80, Math.min(200, systolic)),
      diastolic: Math.max(40, Math.min(120, diastolic))
    };
  }
  
  /**
   * Calcula confianza del resultado
   */
  private calculateConfidence(): number {
    if (this.valueBuffer.length < 30) {
      return 0.3; // Confianza baja con pocas muestras
    }
    
    // Factores de confianza
    
    // 1. Cantidad de muestras
    const sampleConfidence = Math.min(1.0, this.valueBuffer.length / this._maxBufferSize);
    
    // 2. Calidad de señal
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    
    // 3. Calidad de características
    const featureQuality = this.calculateFeatureQuality();
    
    // Combinación ponderada
    return (sampleConfidence * 0.2) + (signalQuality * 0.4) + (featureQuality * 0.4);
  }
  
  /**
   * Calcula calidad de las características extraídas
   */
  private calculateFeatureQuality(): number {
    if (this.pulseTransitTime === 0) return 0;
    
    // Factores que indican buena calidad de características
    let qualityScore = 0;
    
    // 1. PTT en rango esperado (aproximadamente 15-25 muestras a 30fps)
    const validPTT = this.pulseTransitTime >= 10 && this.pulseTransitTime <= 35;
    if (validPTT) qualityScore += 0.5;
    
    // 2. Muesca dicrótica detectada en posición correcta (20-50% del ciclo)
    const validNotch = this.dicroticNotchPosition >= 0.2 && this.dicroticNotchPosition <= 0.5;
    if (validNotch) qualityScore += 0.3;
    
    // 3. Pendiente significativa
    const validSlope = this.waveformSlope > 0.05;
    if (validSlope) qualityScore += 0.2;
    
    return qualityScore;
  }
  
  /**
   * Actualiza sugerencias para optimizador
   */
  private updateOptimizationSuggestions(confidence: number): void {
    if (confidence < 0.3) {
      // Baja confianza: enfatizar detalles de forma de onda
      this.suggestedParameters = {
        amplification: 1.5,
        filterStrength: 0.6,
        sensitivity: 1.3
      };
    } else if (confidence < 0.6) {
      // Confianza media: ajustes moderados
      this.suggestedParameters = {
        amplification: 1.3,
        filterStrength: 0.55,
        sensitivity: 1.1
      };
    } else {
      // Alta confianza: no sugerir cambios
      this.suggestedParameters = {};
    }
  }
  
  /**
   * Obtiene el parámetro preferido para ajuste
   */
  protected getPreferredParameter(): string {
    return "sensitivity";
  }
  
  /**
   * Reinicia calculador
   */
  protected resetSpecific(): void {
    this.pulseTransitTime = 0;
    this.dicroticNotchPosition = 0;
    this.waveformSlope = 0;
  }
}
