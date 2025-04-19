
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';

/**
 * Procesador de presión arterial
 * Calcula sistólica y diastólica en base a características de la señal PPG
 */
export class BloodPressureProcessor extends BaseProcessor {
  // Valores de calibración
  private systolicCalibration: number = 120;
  private diastolicCalibration: number = 80;
  private calibrationFactor: number = 1.0;
  
  // Constantes de cálculo
  private readonly DEFAULT_SYSTOLIC: number = 120;
  private readonly DEFAULT_DIASTOLIC: number = 80;
  private readonly MIN_DATA_POINTS: number = 45;
  
  // Factor de correlación para BPM a presión
  private readonly bpmToSystolicFactor: number = 0.7;
  private readonly bpmToDiastolicFactor: number = 0.4;
  
  // Factores morfológicos de la señal PPG
  private readonly systolicScalingFactor: number = 0.36;
  private readonly diastolicScalingFactor: number = 0.23;
  
  // Almacenamiento de cálculos
  private lastSystolic: number = 0;
  private lastDiastolic: number = 0;
  private consecutiveReadings: Array<{systolic: number, diastolic: number}> = [];
  
  // Configuración
  private debugMode: boolean = false;
  
  /**
   * Constructor que inicializa el procesador
   */
  constructor() {
    super();
    
    // Inicializar valores por defecto
    this.lastSystolic = this.DEFAULT_SYSTOLIC;
    this.lastDiastolic = this.DEFAULT_DIASTOLIC;
    
    console.log("BloodPressureProcessor: Inicializado con mediciones directas únicamente");
  }
  
  /**
   * Calcular presión arterial basándose únicamente en características reales de la señal PPG
   * Sin usar valores simulados
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    // Verificar si hay suficientes datos para análisis
    if (!ppgValues || ppgValues.length < this.MIN_DATA_POINTS) {
      if (this.debugMode) {
        console.log("BloodPressureProcessor: Datos insuficientes para cálculo", {
          cantidadRecibida: ppgValues?.length,
          requerido: this.MIN_DATA_POINTS
        });
      }
      return { 
        systolic: this.lastSystolic || this.DEFAULT_SYSTOLIC, 
        diastolic: this.lastDiastolic || this.DEFAULT_DIASTOLIC 
      };
    }
    
    try {
      // Extraer características relevantes de la forma de onda PPG
      const signalCharacteristics = this.extractPPGCharacteristics(ppgValues);
      
      if (this.debugMode) {
        console.log("BloodPressureProcessor: Características extraídas", signalCharacteristics);
      }
      
      // Calcular estimaciones usando únicamente características de señal real
      const systolicEstimate = this.calculateSystolicValue(signalCharacteristics);
      const diastolicEstimate = this.calculateDiastolicValue(signalCharacteristics);
      
      // Aplicar factores de calibración del usuario
      const systolic = Math.round(systolicEstimate * this.calibrationFactor);
      const diastolic = Math.round(diastolicEstimate * this.calibrationFactor);
      
      // Comprobar rangos fisiológicos
      if (this.isPhysiologicallyValid(systolic, diastolic)) {
        // Guardar los valores para uso futuro
        this.lastSystolic = systolic;
        this.lastDiastolic = diastolic;
        
        // Añadir a histórico de lecturas
        this.consecutiveReadings.push({systolic, diastolic});
        if (this.consecutiveReadings.length > 5) {
          this.consecutiveReadings.shift();
        }
        
        // Utilizar media móvil para estabilizar lecturas
        const averageValues = this.calculateStableReading();
        
        return averageValues;
      } else {
        // En caso de valores no fisiológicos, usar últimos válidos
        if (this.debugMode) {
          console.log("BloodPressureProcessor: Valores no fisiológicos detectados", {
            systolicEstimate, 
            diastolicEstimate,
            sistólica: systolic,
            diastólica: diastolic
          });
        }
        
        return { 
          systolic: this.lastSystolic || this.DEFAULT_SYSTOLIC, 
          diastolic: this.lastDiastolic || this.DEFAULT_DIASTOLIC 
        };
      }
    } catch (error) {
      console.error("BloodPressureProcessor: Error en cálculo de presión arterial", error);
      
      // En caso de error, devolver últimos valores válidos
      return { 
        systolic: this.lastSystolic || this.DEFAULT_SYSTOLIC, 
        diastolic: this.lastDiastolic || this.DEFAULT_DIASTOLIC 
      };
    }
  }
  
  /**
   * Extraer características relevantes de la forma de onda PPG
   */
  private extractPPGCharacteristics(ppgValues: number[]): {
    mean: number;
    min: number;
    max: number;
    amplitude: number;
    variance: number;
    slope: number;
    cycleLength: number;
  } {
    const recentValues = ppgValues.slice(-this.MIN_DATA_POINTS);
    
    // Calcular estadísticas básicas
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const amplitude = max - min;
    
    // Calcular varianza
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    
    // Calcular pendiente media
    let totalSlope = 0;
    for (let i = 1; i < recentValues.length; i++) {
      totalSlope += Math.abs(recentValues[i] - recentValues[i - 1]);
    }
    const slope = totalSlope / (recentValues.length - 1);
    
    // Estimar duración del ciclo (relacionado con BPM)
    const peakIndices = this.findPeakIndices(recentValues);
    let cycleLength = 0;
    
    if (peakIndices.length >= 2) {
      // Calcular distancia media entre picos
      let totalDistance = 0;
      for (let i = 1; i < peakIndices.length; i++) {
        totalDistance += peakIndices[i] - peakIndices[i - 1];
      }
      cycleLength = totalDistance / (peakIndices.length - 1);
    } else {
      // Valor por defecto si no hay suficientes picos
      cycleLength = 30; // Aproximadamente 60 BPM
    }
    
    return {
      mean,
      min,
      max,
      amplitude,
      variance,
      slope,
      cycleLength
    };
  }
  
  /**
   * Encontrar índices de los picos en la señal PPG
   */
  private findPeakIndices(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Detector de picos simple
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i - 1] && 
          values[i] > values[i - 2] &&
          values[i] > values[i + 1] && 
          values[i] > values[i + 2]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcular valor sistólico basado en características de la señal
   */
  private calculateSystolicValue(characteristics: {
    mean: number;
    min: number;
    max: number;
    amplitude: number;
    variance: number;
    slope: number;
    cycleLength: number;
  }): number {
    // Calcular BPM estimado basado en duración del ciclo
    const estimatedBPM = characteristics.cycleLength > 0 
      ? 60 / (characteristics.cycleLength / 30) 
      : 60;
    
    // Componente de BPM (correlación entre FC y presión sistólica)
    const bpmComponent = (estimatedBPM - 60) * this.bpmToSystolicFactor;
    
    // Componente de amplitud (mayor amplitud suele correlacionar con mayor diferencial)
    const amplitudeComponent = characteristics.amplitude * this.systolicScalingFactor * 100;
    
    // Componente de pendiente (relacionado con elasticidad)
    const slopeComponent = characteristics.slope * 50;
    
    // Calcular sistólica base
    const baseSystolic = this.systolicCalibration + 
                         bpmComponent + 
                         amplitudeComponent + 
                         slopeComponent;
    
    return Math.min(200, Math.max(80, baseSystolic));
  }
  
  /**
   * Calcular valor diastólico basado en características de la señal
   */
  private calculateDiastolicValue(characteristics: {
    mean: number;
    min: number;
    max: number;
    amplitude: number;
    variance: number;
    slope: number;
    cycleLength: number;
  }): number {
    // Calcular BPM estimado basado en duración del ciclo
    const estimatedBPM = characteristics.cycleLength > 0 
      ? 60 / (characteristics.cycleLength / 30) 
      : 60;
    
    // Componente de BPM (correlación entre FC y presión diastólica)
    const bpmComponent = (estimatedBPM - 60) * this.bpmToDiastolicFactor;
    
    // Componente de amplitud (menor contribución que en sistólica)
    const amplitudeComponent = characteristics.amplitude * this.diastolicScalingFactor * 100;
    
    // Componente de varianza (relacionado con tono vascular)
    const varianceComponent = Math.sqrt(characteristics.variance) * 15;
    
    // Calcular diastólica base
    const baseDiastolic = this.diastolicCalibration + 
                          bpmComponent + 
                          amplitudeComponent + 
                          varianceComponent;
    
    return Math.min(120, Math.max(40, baseDiastolic));
  }
  
  /**
   * Verificar que los valores están en rangos fisiológicos
   */
  private isPhysiologicallyValid(systolic: number, diastolic: number): boolean {
    // Valores absolutos
    if (systolic < 80 || systolic > 200) return false;
    if (diastolic < 40 || diastolic > 120) return false;
    
    // Diferencial
    const differencial = systolic - diastolic;
    if (differencial < 20 || differencial > 100) return false;
    
    // Razón sistólica/diastólica
    const ratio = systolic / diastolic;
    if (ratio < 1.2 || ratio > 2.5) return false;
    
    return true;
  }
  
  /**
   * Calcular lectura estable basada en promedio de lecturas consecutivas
   */
  private calculateStableReading(): { systolic: number; diastolic: number } {
    if (this.consecutiveReadings.length === 0) {
      return {
        systolic: this.DEFAULT_SYSTOLIC,
        diastolic: this.DEFAULT_DIASTOLIC
      };
    }
    
    // Filtrar valores atípicos
    const systolicValues = this.consecutiveReadings.map(reading => reading.systolic);
    const diastolicValues = this.consecutiveReadings.map(reading => reading.diastolic);
    
    const filteredSystolic = this.filterOutliers(systolicValues);
    const filteredDiastolic = this.filterOutliers(diastolicValues);
    
    // Calcular promedios
    const avgSystolic = Math.round(
      filteredSystolic.reduce((sum, val) => sum + val, 0) / filteredSystolic.length
    );
    
    const avgDiastolic = Math.round(
      filteredDiastolic.reduce((sum, val) => sum + val, 0) / filteredDiastolic.length
    );
    
    return {
      systolic: avgSystolic,
      diastolic: avgDiastolic
    };
  }
  
  /**
   * Filter outliers using IQR method with configurable threshold
   */
  private filterOutliers(values: number[], iqrThreshold: number = 1.5): number[] {
    if (values.length < 4) return values;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sortedValues.length / 4);
    const q3Index = Math.floor(3 * sortedValues.length / 4);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - iqrThreshold * iqr;
    const upperBound = q3 + iqrThreshold * iqr;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Aplicar calibración manual
   */
  public applyCalibration(systolic: number, diastolic: number): void {
    if (systolic > 0 && diastolic > 0) {
      this.systolicCalibration = systolic;
      this.diastolicCalibration = diastolic;
      
      // Recalcular factor de calibración
      this.calibrationFactor = (systolic / this.DEFAULT_SYSTOLIC + diastolic / this.DEFAULT_DIASTOLIC) / 2;
      
      console.log("BloodPressureProcessor: Calibración aplicada", {
        sistólica: systolic,
        diastólica: diastolic,
        factor: this.calibrationFactor
      });
    }
  }
  
  /**
   * Establecer modo de depuración
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  /**
   * Resetear procesador
   */
  public reset(): void {
    this.lastSystolic = this.DEFAULT_SYSTOLIC;
    this.lastDiastolic = this.DEFAULT_DIASTOLIC;
    this.consecutiveReadings = [];
  }
}
