
/**
 * VitalSignsProcessor.ts
 * 
 * Procesador principal de signos vitales con arquitectura modular
 * y mejoras en detección de arritmias y SpO2.
 */

import { SpO2Processor } from './spo2-processor';
import { ArrhythmiaDetector, ArrhythmiaDetectionResult } from './ArrhythmiaDetector';
import { calculateDC, calculateAC, calculateAmplitude, findPeaksAndValleys } from './utils';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  visualWindow?: {
    start: number;
    end: number;
  } | null;
  calibration?: {
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
    };
  };
}

export class VitalSignsProcessor {
  // Configuración general
  private readonly WINDOW_SIZE = 300;
  private readonly SMA_WINDOW = 3;
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;
  
  // Variables de estado
  private ppgValues: number[] = [];
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private smaBuffer: number[] = [];
  private measurementStartTime: number = Date.now();
  
  // Procesadores modulares
  private spo2Processor: SpO2Processor;
  private arrhythmiaDetector: ArrhythmiaDetector;
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.arrhythmiaDetector = new ArrhythmiaDetector({
      minTimeBetweenArrhythmias: 3000,
      maxArrhythmiasPerSession: 10,
      signalQualityThreshold: 0.65
    });
    
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada");
  }
  
  /**
   * Procesa la señal PPG y datos RR para calcular signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Aplicar filtro SMA para suavizar la señal
    const filteredValue = this.applySMAFilter(ppgValue);
    
    // Guardar valor filtrado
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    // Calcular SpO2 usando el procesador dedicado
    const spo2 = this.spo2Processor.calculateSpO2(this.ppgValues.slice(-60));
    
    // Calcular presión arterial
    const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;
    
    // Analizar datos de arritmia si hay intervalos RR disponibles
    let arrhythmiaResult: ArrhythmiaDetectionResult;
    
    if (rrData && rrData.intervals.length > 0) {
      // Calcular calidad de señal basada en variabilidad y amplitud
      const signalQuality = this.calculateSignalQuality(this.ppgValues.slice(-30));
      
      // Analizar intervalos RR para detección de arritmias
      arrhythmiaResult = this.arrhythmiaDetector.analyzeRRIntervals(
        rrData.intervals,
        currentTime,
        signalQuality
      );
    } else {
      // Sin datos RR, mantener estado actual
      arrhythmiaResult = {
        isArrhythmia: false,
        arrhythmiaCounter: this.arrhythmiaDetector.getArrhythmiaCounter(),
        arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaDetector.getArrhythmiaCounter()}`,
        lastArrhythmiaData: null,
        visualWindow: null
      };
    }
    
    // Calcular progreso de calibración (simulado para mantener interfaz compatible)
    const elapsedTime = currentTime - this.measurementStartTime;
    const calibrationProgress = Math.min(1, elapsedTime / 10000);
    
    // Devolver resultado completo
    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      visualWindow: arrhythmiaResult.visualWindow,
      calibration: {
        progress: {
          heartRate: calibrationProgress,
          spo2: calibrationProgress,
          pressure: calibrationProgress,
          arrhythmia: calibrationProgress
        }
      }
    };
  }
  
  /**
   * Calcula la presión arterial a partir de valores PPG
   */
  private calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 120, diastolic: 80 };
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);

    const normalizedPTT = Math.max(300, Math.min(1200, weightedPTT));
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));

    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);

    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }

    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

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

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }
  
  /**
   * Calcula la calidad de señal basada en amplitud y variabilidad
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 10) return 0;
    
    // Calcular amplitud (diferencia entre máximo y mínimo)
    const max = Math.max(...values);
    const min = Math.min(...values);
    const amplitude = max - min;
    
    // Calcular desviación estándar normalizada
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const normalizedStd = std / (max - min);
    
    // Calcular diferencia entre sucesivos puntos
    let sumDiffs = 0;
    for (let i = 1; i < values.length; i++) {
      sumDiffs += Math.abs(values[i] - values[i-1]);
    }
    const avgDiff = sumDiffs / (values.length - 1);
    
    // Combinar métricas para calidad total (0-1)
    // - Amplitud grande es buena (saturada a 1 para valores > 0.2)
    // - Variabilidad moderada es buena (ideal alrededor de 0.15-0.2)
    // - Cambios suaves son buenos (menor es mejor)
    const amplitudeQuality = Math.min(1, amplitude * 5);
    const variabilityQuality = Math.min(1, Math.max(0, 0.5 - Math.abs(normalizedStd - 0.15) * 3));
    const smoothnessQuality = Math.min(1, Math.max(0, 0.15 - avgDiff) * 10);
    
    // Peso mayor a amplitud, seguido de variabilidad, luego suavidad
    const quality = (amplitudeQuality * 0.5) + (variabilityQuality * 0.3) + (smoothnessQuality * 0.2);
    
    return Math.min(1, Math.max(0, quality));
  }
  
  /**
   * Aplica filtro de media móvil simple (SMA)
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
   * Verifica si un latido en un momento dado es arrítmico
   */
  public isHeartbeatArrhythmic(timestamp: number): boolean {
    return this.arrhythmiaDetector.isHeartbeatArrhythmic(timestamp);
  }
  
  /**
   * Reinicia el procesador (soft reset)
   */
  public reset(): VitalSignsResult | null {
    // Guardar último resultado válido antes del reset
    let lastValidResult: VitalSignsResult | null = null;
    
    if (this.ppgValues.length > 60) {
      const spo2 = this.spo2Processor.calculateSpO2(this.ppgValues.slice(-60));
      const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
      const arrhythmiaCounter = this.arrhythmiaDetector.getArrhythmiaCounter();
      
      lastValidResult = {
        spo2,
        pressure: `${bp.systolic}/${bp.diastolic}`,
        arrhythmiaStatus: arrhythmiaCounter > 0 ? 
          `ARRITMIA DETECTADA|${arrhythmiaCounter}` : 
          `SIN ARRITMIAS|${arrhythmiaCounter}`
      };
    }
    
    // Reiniciar valores internos
    this.ppgValues = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.smaBuffer = [];
    this.measurementStartTime = Date.now();
    
    // Reiniciar procesadores
    this.spo2Processor.reset();
    this.arrhythmiaDetector.reset();
    
    console.log("VitalSignsProcessor: Reset completo");
    
    return lastValidResult;
  }
  
  /**
   * Reinicio completo (hard reset)
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full reset ejecutado");
  }
}
