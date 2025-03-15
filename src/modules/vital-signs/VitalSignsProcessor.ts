
import { ArrhythmiaProcessor } from './arrhythmia-processor';

/**
 * Tipos exportados para uso en la aplicación
 */
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Procesador refactorizado de signos vitales con algoritmos más precisos
 */
export class VitalSignsProcessor {
  // Configuración para SpO2
  private readonly SPO2_WINDOW = 8;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045;
  private readonly SPO2_BUFFER_SIZE = 10;
  
  // Configuración para presión arterial
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;
  private readonly PTT_MIN = 300;
  private readonly PTT_MAX = 1200;
  
  // Filtros
  private readonly SMA_WINDOW = 3;
  
  // Buffers y estado
  private ppgValues: number[] = [];
  private spo2Buffer: number[] = [];
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private smaBuffer: number[] = [];
  private lastValidSpo2: number = 0;
  private lastValidPressure: string = "0/0";
  
  // Procesador de arritmias mejorado
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  
  constructor() {
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada");
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Aplicar filtro de media móvil para suavizar la señal
    const filteredValue = this.applySMAFilter(ppgValue);
    
    // Añadir al buffer de valores
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > 300) {
      this.ppgValues.shift();
    }
    
    // Procesar datos RR para arritmias
    const arrhythmiaResults = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Calcular SpO2 y presión arterial
    const spo2 = this.calculateSpO2(this.ppgValues.slice(-60));
    const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;
    
    // Log de SpO2 cada 10 valores para evitar saturación de logs
    if (this.ppgValues.length % 10 === 0) {
      console.log("VitalSignsProcessor: Valores actuales", {
        spo2,
        pressure: pressureString,
        arrhythmiaStatus: arrhythmiaResults.arrhythmiaStatus,
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus: arrhythmiaResults.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResults.lastArrhythmiaData
    };
  }
  
  /**
   * Calcula la saturación de oxígeno en sangre
   */
  private calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      // Si no hay suficientes datos, usar el último válido con degradación
      if (this.lastValidSpo2 > 0) {
        return Math.max(0, this.lastValidSpo2 - 1);
      }
      return 0;
    }
    
    // Calcular componentes DC y AC de la señal
    const dc = this.calculateDC(values);
    if (dc === 0) {
      if (this.lastValidSpo2 > 0) {
        return Math.max(0, this.lastValidSpo2 - 1);
      }
      return 0;
    }
    
    const ac = this.calculateAC(values);
    
    // Índice de perfusión - medida de calidad de la señal
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      // Señal de baja calidad
      if (this.lastValidSpo2 > 0) {
        // Degradación más rápida para señal de mala calidad
        return Math.max(0, this.lastValidSpo2 - 2);
      }
      return 0;
    }
    
    // Calcular ratio R para SpO2
    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    // Aproximación lineal basada en calibración empírica
    let spO2 = Math.round(98 - (15 * R));
    
    // Ajustar basado en calidad de señal
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(99, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }
    
    // Limitación a valores fisiológicamente plausibles
    spO2 = Math.min(99, Math.max(70, spO2));
    
    // Suavizado de valores con buffer
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
    
    if (this.spo2Buffer.length > 0) {
      // Media ponderada con más peso a valores recientes
      let sumWeighted = 0;
      let sumWeights = 0;
      
      this.spo2Buffer.forEach((val, idx) => {
        const weight = idx + 1;
        sumWeighted += val * weight;
        sumWeights += weight;
      });
      
      spO2 = Math.round(sumWeighted / sumWeights);
    }
    
    this.lastValidSpo2 = spO2;
    return spO2;
  }
  
  /**
   * Calcula la presión arterial estimada
   */
  private calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      // Si no hay datos suficientes, usar estimaciones estándar o último válido
      if (this.lastValidPressure !== "0/0") {
        const [sys, dia] = this.lastValidPressure.split('/').map(Number);
        return { systolic: sys, diastolic: dia };
      }
      return { systolic: 120, diastolic: 80 };
    }
    
    // Encontrar picos y valles en la señal
    const { peakIndices, valleyIndices } = this.findPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 120, diastolic: 80 };
    }
    
    // Calcular tiempo de tránsito de pulso (PTT)
    const fps = 30;
    const msPerSample = 1000 / fps;
    
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    // PTT ponderado con más influencia de valores recientes
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);
    
    // Normalizar PTT a rango fisiológico
    const normalizedPTT = Math.max(this.PTT_MIN, Math.min(this.PTT_MAX, weightedPTT));
    
    // Calcular amplitud de la señal
    const amplitude = this.calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));
    
    // Factores de corrección basados en PTT y amplitud
    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    // Estimaciones instantáneas
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);
    
    // Rango fisiológico
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    // Asegurar diferencial de presión razonable
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }
    
    // Buffers para suavizado
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
    
    // Aplicar media exponencial ponderada
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }
    
    finalSystolic = finalSystolic / weightSum;
    finalDiastolic = finalDiastolic / weightSum;
    
    // Redondear a enteros
    const result = {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
    
    this.lastValidPressure = `${result.systolic}/${result.diastolic}`;
    return result;
  }
  
  /**
   * Encuentra picos y valles en una señal
   */
  private findPeaksAndValleys(values: number[]) {
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    // Ventana de 5 puntos (2 antes, punto actual, 2 después)
    for (let i = 2; i < values.length - 2; i++) {
      const v = values[i];
      // Un punto es pico si es mayor que 2 puntos antes y después
      if (
        v > values[i - 1] &&
        v > values[i - 2] &&
        v > values[i + 1] &&
        v > values[i + 2]
      ) {
        peakIndices.push(i);
      }
      // Un punto es valle si es menor que 2 puntos antes y después
      if (
        v < values[i - 1] &&
        v < values[i - 2] &&
        v < values[i + 1] &&
        v < values[i + 2]
      ) {
        valleyIndices.push(i);
      }
    }
    return { peakIndices, valleyIndices };
  }
  
  /**
   * Calcula la amplitud media de la señal
   */
  private calculateAmplitude(
    values: number[],
    peaks: number[],
    valleys: number[]
  ): number {
    if (peaks.length === 0 || valleys.length === 0) return 0;
    
    const amps: number[] = [];
    const len = Math.min(peaks.length, valleys.length);
    
    for (let i = 0; i < len; i++) {
      const amp = values[peaks[i]] - values[valleys[i]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
    
    if (amps.length === 0) return 0;
    
    // Ordenar y eliminar outliers (20% superior e inferior)
    amps.sort((a, b) => a - b);
    const trimAmount = Math.floor(amps.length * 0.2);
    const trimmed = amps.slice(trimAmount, amps.length - trimAmount);
    
    // Calcular media de valores válidos
    const mean = trimmed.length > 0 
      ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length
      : amps.reduce((a, b) => a + b, 0) / amps.length;
      
    return mean;
  }
  
  /**
   * Calcula la componente AC (variación) de la señal
   */
  private calculateAC(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Ordenar y recortar outliers (10% en cada extremo)
    const sorted = [...values].sort((a, b) => a - b);
    const trimAmount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (trimmed.length === 0) return 0;
    return Math.max(...trimmed) - Math.min(...trimmed);
  }
  
  /**
   * Calcula la componente DC (nivel base) de la señal
   */
  private calculateDC(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Ordenar y recortar outliers (10% en cada extremo)
    const sorted = [...values].sort((a, b) => a - b);
    const trimAmount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (trimmed.length === 0) return 0;
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }
  
  /**
   * Aplica un filtro de media móvil simple
   */
  private applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastValidSpo2 = 0;
    this.lastValidPressure = "0/0";
    this.arrhythmiaProcessor.reset();
    console.log("VitalSignsProcessor: Reset completo");
  }
  
  /**
   * Reinicio completo de todos los componentes
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Reset completo de todos los componentes");
  }
}
