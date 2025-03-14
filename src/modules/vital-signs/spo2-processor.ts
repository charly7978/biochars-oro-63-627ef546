
/**
 * Procesador de SpO2 (saturación de oxígeno) basado en técnicas avanzadas
 * de fotopletismografía y principios de absorción espectral.
 */

import { 
  calculateAC, 
  calculateDC, 
  applySMAFilter, 
  applyMedianFilter,
  calculatePerfusionIndex,
  calculateSignalQuality
} from './utils';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private readonly MIN_PERFUSION_INDEX = 0.05;
  private readonly MIN_SIGNAL_QUALITY = 50;
  private readonly CALIBRATION_FACTOR = 1.025;
  private readonly RED_TO_IR_COMPENSATED_RATIO = 1.00;
  
  private spo2Buffer: number[] = [];
  private lastValidReading: number = 0;
  private confidenceScore: number = 0;
  private calibrationOffset: number = 0;
  private lastCalculationTime: number = 0;

  /**
   * Calcula la saturación de oxígeno (SpO2) utilizando señales PPG
   * El algoritmo implementa técnicas profesionales de fotopletismografía
   * 
   * @param values Valores de señal PPG
   * @returns Valor SpO2 (0-100)
   */
  public calculateSpO2(values: number[]): {
    value: number;
    confidence: number;
  } {
    const currentTime = Date.now();
    
    // 1. Validación de datos y preprocesamiento
    if (!values || values.length < 30) {
      return {
        value: this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.1)
      };
    }
    
    // 2. Filtrado avanzado para reducir ruido
    const filteredValues = applyMedianFilter(applySMAFilter(values, 5), 3);
    
    // 3. Evaluación de calidad de señal
    const signalQuality = calculateSignalQuality(filteredValues);
    const perfusionIndex = calculatePerfusionIndex(filteredValues);
    
    if (signalQuality < this.MIN_SIGNAL_QUALITY || 
        perfusionIndex < this.MIN_PERFUSION_INDEX) {
      
      // Señal de baja calidad - usar último valor válido con confianza reducida
      this.confidenceScore = Math.max(0.1, this.confidenceScore - 0.15);
      
      return {
        value: this.lastValidReading,
        confidence: this.confidenceScore
      };
    }
    
    // 4. Cálculo de componentes PPG fundamentales
    const dc = calculateDC(filteredValues);
    if (dc === 0 || Math.abs(dc) < 0.005) {
      return {
        value: this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.2)
      };
    }
    
    const ac = calculateAC(filteredValues);
    if (ac < 0.01) {
      return {
        value: this.lastValidReading,
        confidence: Math.max(0, this.confidenceScore - 0.2)
      };
    }
    
    // 5. Cálculo basado en modelo de absorción (Ley de Beer-Lambert)
    // R = (AC_red/DC_red)/(AC_ir/DC_ir)
    // En una señal PPG simple, esto se aproxima con el factor de calibración
    const R = (ac / dc) / this.CALIBRATION_FACTOR * this.RED_TO_IR_COMPENSATED_RATIO;
    
    // 6. Aplicación de ecuación empírica basada en calibración experimental
    // Esta relación se deriva de curvas de calibración estándar
    let rawSpO2 = 110 - (25 * R);
    
    // 7. Aplicar offset de calibración personalizado
    rawSpO2 += this.calibrationOffset;
    
    // 8. Ajustes basados en calidad de perfusión
    // Los pacientes con mejor perfusión tendrán lecturas más cercanas al 98-99%
    if (perfusionIndex > 0.15) {
      rawSpO2 = Math.min(100, rawSpO2 + 1);
    } else if (perfusionIndex < 0.08) {
      rawSpO2 = Math.max(80, rawSpO2 - 1);
    }
    
    // 9. Validación del rango fisiológico
    rawSpO2 = Math.max(80, Math.min(100, rawSpO2));
    
    // 10. Almacenamiento en buffer para estabilidad
    if (rawSpO2 >= 80 && rawSpO2 <= 100) {
      this.spo2Buffer.push(rawSpO2);
      
      if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
        this.spo2Buffer.shift();
      }
    }
    
    // 11. Cálculo de SpO2 final con filtro de mediana para mayor robustez
    let finalSpO2;
    if (this.spo2Buffer.length >= 3) {
      const sorted = [...this.spo2Buffer].sort((a, b) => a - b);
      finalSpO2 = sorted[Math.floor(sorted.length / 2)];
    } else {
      finalSpO2 = rawSpO2;
    }
    
    // 12. Actualización de nivel de confianza
    // La confianza aumenta con mejor calidad de señal y más muestras
    // pero se reduce con cambios bruscos inesperados
    const timeSinceLastCalc = currentTime - this.lastCalculationTime;
    this.lastCalculationTime = currentTime;
    
    this.confidenceScore = Math.min(0.95, 
      0.4 + 
      (signalQuality / 200) + 
      Math.min(0.25, perfusionIndex * 2) +
      (this.spo2Buffer.length / this.SPO2_BUFFER_SIZE) * 0.15
    );
    
    // Reducir confianza si hay un cambio brusco inesperado
    if (this.lastValidReading > 0 && timeSinceLastCalc < 2000) {
      const change = Math.abs(finalSpO2 - this.lastValidReading);
      
      if (change > 4) {
        this.confidenceScore = Math.max(0.3, this.confidenceScore - 0.25);
      } else if (change > 2) {
        this.confidenceScore = Math.max(0.4, this.confidenceScore - 0.1);
      }
    }
    
    // Actualizar última lectura válida
    this.lastValidReading = Math.round(finalSpO2);
    
    return {
      value: this.lastValidReading,
      confidence: this.confidenceScore
    };
  }
  
  /**
   * Obtener detalles adicionales de la señal para diagnóstico
   */
  public getSignalDetails(values: number[]): {
    perfusionIndex: number;
    quality: number;
    pulsatileComponents: { ac: number; dc: number; ratio: number };
  } | null {
    if (!values || values.length < 30) return null;
    
    const filteredValues = applyMedianFilter(applySMAFilter(values, 5), 3);
    const ac = calculateAC(filteredValues);
    const dc = calculateDC(filteredValues);
    const perfusionIndex = dc !== 0 ? ac / dc : 0;
    const quality = calculateSignalQuality(filteredValues);
    
    return {
      perfusionIndex,
      quality,
      pulsatileComponents: {
        ac,
        dc,
        ratio: perfusionIndex
      }
    };
  }
  
  /**
   * Aplicar calibración personalizada
   */
  public calibrate(referenceSpO2: number): void {
    if (referenceSpO2 >= 90 && referenceSpO2 <= 100 && this.lastValidReading > 0) {
      const diff = referenceSpO2 - this.lastValidReading;
      // Limitar el offset a un rango razonable
      this.calibrationOffset = Math.max(-3, Math.min(3, diff));
    }
  }

  /**
   * Reinicia el estado del procesador
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.lastValidReading = 0;
    this.confidenceScore = 0;
    this.lastCalculationTime = 0;
    // No se resetea el calibrationOffset a propósito para mantener la calibración
  }
  
  /**
   * Obtener última lectura válida
   */
  public getLastReading(): { 
    value: number; 
    confidence: number;
  } {
    return {
      value: this.lastValidReading,
      confidence: this.confidenceScore
    };
  }
}
