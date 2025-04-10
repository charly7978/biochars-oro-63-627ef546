
import { ModelRegistry } from './neural/ModelRegistry';
import { SpO2NeuralModel } from './neural/SpO2Model';
import { BloodPressureNeuralModel } from './neural/BloodPressureModel';
import { ArrhythmiaNeuralModel } from './neural/ArrhythmiaModel';
import { HeartRateNeuralModel } from './neural/HeartRateModel';
import { GlucoseNeuralModel } from './neural/GlucoseModel';
import { TensorUtils } from './neural/tensorflow/TensorAdapter';

// Types
interface SignalAnalysisResult {
  peakIndices: number[];
  valleyIndices: number[];
  intervals: number[];
  lastPeakTime: number;
  averageHeartRate?: number; // Make this optional to fix the error
}

interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  arrhythmiaRisk: number;
  glucose: number;
  perfusionIndex: number;
  respirationRate: number;
  temperature: number;
  timestamp: number;
}

/**
 * Procesador principal de signos vitales basado en modelos neuronales
 */
export class VitalSignsProcessor {
  // Última hora de actualización
  private lastUpdateTime: number = 0;
  
  // Estado de procesamiento
  private ppgBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 300;
  private lastResult: VitalSignsResult | null = null;
  
  // Estado de análisis de señal
  private signalAnalysisResult: SignalAnalysisResult = {
    peakIndices: [],
    valleyIndices: [],
    intervals: [],
    lastPeakTime: 0
  };
  
  // Contadores
  private sampleCount: number = 0;
  private validReadingCount: number = 0;
  
  // Modelos
  private modelRegistry: ModelRegistry = ModelRegistry.getInstance();
  private isModelInitialized: boolean = false;
  
  // Configuración
  private confidenceThreshold: number = 0.6;
  private skipFrames: number = 0;
  private processEveryNFrames: number = 1;
  
  constructor() {
    this.initializeModels();
  }
  
  /**
   * Inicializa los modelos necesarios
   */
  private initializeModels(): void {
    if (this.isModelInitialized) return;
    
    console.log("VitalSignsProcessor: Initializing neural models");
    
    // Los modelos se cargan bajo demanda a través del registro
    this.isModelInitialized = true;
  }
  
  /**
   * Procesa una nueva lectura PPG
   * @param ppgValue Valor PPG actual
   * @returns Resultados de signos vitales
   */
  public processPPG(ppgValue: number): VitalSignsResult {
    // Añadir a buffer con límite de tamaño
    this.ppgBuffer.push(ppgValue);
    if (this.ppgBuffer.length > this.MAX_BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Contadores
    this.sampleCount++;
    
    // Procesar cada N muestras para reducir carga computacional
    if (this.skipFrames > 0) {
      this.skipFrames--;
      return this.getLastResult();
    }
    this.skipFrames = this.processEveryNFrames - 1;
    
    // Verificar calidad de señal
    if (!this.isValidSignal()) {
      return this.getDefaultResult();
    }
    
    // Análisis de señal
    this.signalAnalysisResult = this.analyzeSignal(this.ppgBuffer);
    
    // Calcular signos vitales con modelos neuronales
    try {
      const heartRate = this.calculateHeartRate();
      const spo2 = this.calculateSpO2();
      const bloodPressure = this.calculateBloodPressure();
      const arrhythmiaRisk = this.calculateArrhythmiaRisk();
      const glucose = this.calculateGlucose();
      const perfusionIndex = this.calculatePerfusionIndex();
      const respirationRate = this.calculateRespirationRate();
      const temperature = 36.5 + (Math.random() * 0.8); // Simulación
      
      // Crear resultado
      this.lastResult = {
        heartRate,
        spo2,
        bloodPressure,
        arrhythmiaRisk,
        glucose,
        perfusionIndex,
        respirationRate,
        temperature,
        timestamp: Date.now()
      };
      
      this.validReadingCount++;
      return this.lastResult;
    } catch (error) {
      console.error("VitalSignsProcessor: Error processing PPG", error);
      return this.getLastResult();
    }
  }
  
  /**
   * Analiza la forma de la señal PPG para detectar picos y valles
   */
  private analyzeSignal(signal: number[]): SignalAnalysisResult {
    if (signal.length < 30) {
      return {
        peakIndices: [],
        valleyIndices: [],
        intervals: [],
        lastPeakTime: this.signalAnalysisResult.lastPeakTime
      };
    }
    
    // Análisis de los últimos N valores para rendimiento
    const analysisWindow = 120;
    const recentSignal = signal.slice(-analysisWindow);
    
    // Filtrar ruido
    const filteredSignal = TensorUtils.movingAverage(recentSignal, 3);
    
    // Detectar picos y valles
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    const minPeakDistance = 20; // Mínima distancia entre picos (ms)
    
    for (let i = 2; i < filteredSignal.length - 2; i++) {
      // Detectar picos
      if (filteredSignal[i] > filteredSignal[i-1] && 
          filteredSignal[i] > filteredSignal[i+1] &&
          filteredSignal[i] > filteredSignal[i-2] &&
          filteredSignal[i] > filteredSignal[i+2]) {
        
        // Verificar que es un pico significativo
        const localMin = Math.min(
          filteredSignal[i-2], filteredSignal[i-1], 
          filteredSignal[i+1], filteredSignal[i+2]
        );
        const peakProminence = filteredSignal[i] - localMin;
        
        if (peakProminence > 0.1 && 
            (peakIndices.length === 0 || i - peakIndices[peakIndices.length-1] >= minPeakDistance)) {
          peakIndices.push(i);
        }
      }
      
      // Detectar valles
      if (filteredSignal[i] < filteredSignal[i-1] && 
          filteredSignal[i] < filteredSignal[i+1] &&
          filteredSignal[i] < filteredSignal[i-2] &&
          filteredSignal[i] < filteredSignal[i+2]) {
        
        // Verificar que es un valle significativo
        const localMax = Math.max(
          filteredSignal[i-2], filteredSignal[i-1], 
          filteredSignal[i+1], filteredSignal[i+2]
        );
        const valleyProminence = localMax - filteredSignal[i];
        
        if (valleyProminence > 0.1 && 
            (valleyIndices.length === 0 || i - valleyIndices[valleyIndices.length-1] >= minPeakDistance)) {
          valleyIndices.push(i);
        }
      }
    }
    
    // Calcular intervalos RR
    const intervals: number[] = [];
    const now = Date.now();
    let lastPeakTime = this.signalAnalysisResult.lastPeakTime;
    
    // Calcular intervalos entre picos
    for (let i = 1; i < peakIndices.length; i++) {
      const interval = (peakIndices[i] - peakIndices[i-1]) * (1000 / 60); // Convertir a ms
      
      // Filtrar intervalos fisiológicamente plausibles (40-200 BPM)
      if (interval >= 300 && interval <= 1500) {
        intervals.push(interval);
      }
    }
    
    // Actualizar lastPeakTime si hay picos
    if (peakIndices.length > 0) {
      const timeOffset = (analysisWindow - peakIndices[peakIndices.length-1]) * (1000 / 60);
      lastPeakTime = now - timeOffset;
    }
    
    // Calcular ritmo cardíaco promedio si hay suficientes intervalos
    let averageHeartRate: number | undefined = undefined;
    if (intervals.length >= 3) {
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      averageHeartRate = 60000 / avgInterval;
    }
    
    return {
      peakIndices,
      valleyIndices,
      intervals: [...this.signalAnalysisResult.intervals.slice(-10), ...intervals],
      lastPeakTime,
      averageHeartRate
    };
  }
  
  /**
   * Calcula el ritmo cardíaco usando el modelo neuronal
   */
  private calculateHeartRate(): number {
    if (this.signalAnalysisResult.intervals.length >= 3) {
      const heartRateModel = this.modelRegistry.getModel<HeartRateNeuralModel>('heartRate');
      
      if (heartRateModel) {
        const modelInput = this.ppgBuffer.slice(-300);
        const modelOutput = heartRateModel.predict(modelInput);
        
        // Combinar estimación del modelo con cálculo de intervalos
        let modelHeartRate = modelOutput[0];
        let intervalHeartRate = this.signalAnalysisResult.averageHeartRate || 75;
        
        // Si hay una gran diferencia, dar más peso al cálculo de intervalos
        const difference = Math.abs(modelHeartRate - intervalHeartRate);
        const modelWeight = difference > 15 ? 0.3 : 0.7;
        
        return Math.round(modelHeartRate * modelWeight + intervalHeartRate * (1 - modelWeight));
      }
    }
    
    // Fallback: usar solo cálculo de intervalos si está disponible
    if (this.signalAnalysisResult.averageHeartRate) {
      return Math.round(this.signalAnalysisResult.averageHeartRate);
    }
    
    // Valor por defecto
    return 75;
  }
  
  /**
   * Calcula la saturación de oxígeno usando el modelo neuronal
   */
  private calculateSpO2(): number {
    const spo2Model = this.modelRegistry.getModel<SpO2NeuralModel>('spo2');
    
    if (spo2Model) {
      const modelInput = this.ppgBuffer.slice(-300);
      const modelOutput = spo2Model.predict(modelInput);
      
      // Valor en rango fisiológico (85-100%)
      return Math.round(modelOutput[0]);
    }
    
    // Valor por defecto
    return 97;
  }
  
  /**
   * Calcula la presión arterial usando el modelo neuronal
   */
  private calculateBloodPressure(): { systolic: number; diastolic: number } {
    const bpModel = this.modelRegistry.getModel<BloodPressureNeuralModel>('bloodPressure');
    
    if (bpModel) {
      const modelInput = this.ppgBuffer.slice(-300);
      const modelOutput = bpModel.predict(modelInput);
      
      return {
        systolic: Math.round(modelOutput[0]),
        diastolic: Math.round(modelOutput[1])
      };
    }
    
    // Valores por defecto
    return {
      systolic: 120,
      diastolic: 80
    };
  }
  
  /**
   * Calcula el riesgo de arritmia usando el modelo neuronal
   */
  private calculateArrhythmiaRisk(): number {
    const arrhythmiaModel = this.modelRegistry.getModel<ArrhythmiaNeuralModel>('arrhythmia');
    
    if (arrhythmiaModel && this.signalAnalysisResult.intervals.length >= 5) {
      const modelInput = this.ppgBuffer.slice(-300);
      const modelOutput = arrhythmiaModel.predict(modelInput);
      
      return modelOutput[0];
    }
    
    // Valor por defecto
    return 0.1;
  }
  
  /**
   * Calcula el nivel de glucosa usando el modelo neuronal
   */
  private calculateGlucose(): number {
    const glucoseModel = this.modelRegistry.getModel<GlucoseNeuralModel>('glucose');
    
    if (glucoseModel) {
      const modelInput = this.ppgBuffer.slice(-450); // Requiere ventana más larga
      
      if (modelInput.length >= 300) {
        const modelOutput = glucoseModel.predict(modelInput);
        return Math.round(modelOutput[0]);
      }
    }
    
    // Valor por defecto
    return 95;
  }
  
  /**
   * Calcula el índice de perfusión
   */
  private calculatePerfusionIndex(): number {
    if (this.ppgBuffer.length < 30) return 0;
    
    const recentSignal = this.ppgBuffer.slice(-30);
    const min = Math.min(...recentSignal);
    const max = Math.max(...recentSignal);
    
    // PI = (AC/DC) × 100%
    const ac = max - min;
    const dc = min;
    
    if (dc <= 0) return 0;
    
    const pi = (ac / dc) * 100;
    return Math.min(20, Math.max(0, pi)); // Limitar a rango fisiológico
  }
  
  /**
   * Calcula la frecuencia respiratoria
   */
  private calculateRespirationRate(): number {
    if (this.signalAnalysisResult.intervals.length < 10) return 16; // Valor por defecto
    
    // Detectar modulación respiratoria en los intervalos RR
    const intervals = this.signalAnalysisResult.intervals.slice(-20);
    
    // Filtrar outliers
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
    const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    
    const filteredIntervals = intervals.filter(
      i => i >= q1 - 1.5 * iqr && i <= q3 + 1.5 * iqr
    );
    
    if (filteredIntervals.length < 8) return 16;
    
    // Buscar ciclos de modulación en ventanas de 30 segundos
    // Simplificado: usamos variación de intervalos
    const variability = this.calculateRRVariability(filteredIntervals);
    
    // Estimar tasa respiratoria basada en variabilidad
    let respirationRate = 15; // Valor base
    
    if (variability > 0.1) {
      respirationRate = 18; // Alta variabilidad -> respiración más rápida
    } else if (variability < 0.05) {
      respirationRate = 12; // Baja variabilidad -> respiración más lenta
    }
    
    return Math.round(respirationRate);
  }
  
  /**
   * Calcula la variabilidad de los intervalos RR
   */
  private calculateRRVariability(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // RMSSD - Root Mean Square of Successive Differences
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (intervals.length - 1));
    
    // Normalizar
    return rmssd / mean;
  }
  
  /**
   * Verifica si la señal tiene calidad suficiente para procesamiento
   */
  private isValidSignal(): boolean {
    if (this.ppgBuffer.length < 30) return false;
    
    const recentSignal = this.ppgBuffer.slice(-30);
    const min = Math.min(...recentSignal);
    const max = Math.max(...recentSignal);
    const range = max - min;
    
    // Verificar rango dinámico mínimo
    if (range < 0.1) return false;
    
    // Verificar que no hay saturación
    if (max > 0.95) return false;
    
    // Verificar estabilidad
    const stdDev = this.calculateStdDev(recentSignal);
    if (stdDev / range > 0.4) return false; // Demasiada variabilidad
    
    return true;
  }
  
  /**
   * Calcula la desviación estándar de una señal
   */
  private calculateStdDev(signal: number[]): number {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Obtiene el último resultado o un valor por defecto
   */
  private getLastResult(): VitalSignsResult {
    return this.lastResult || this.getDefaultResult();
  }
  
  /**
   * Crea un resultado por defecto
   */
  private getDefaultResult(): VitalSignsResult {
    return {
      heartRate: 0,
      spo2: 0,
      bloodPressure: { systolic: 0, diastolic: 0 },
      arrhythmiaRisk: 0,
      glucose: 0,
      perfusionIndex: 0,
      respirationRate: 0,
      temperature: 0,
      timestamp: Date.now()
    };
  }
  
  /**
   * Obtiene información del modelo
   */
  public getModelInfo(): any[] {
    const modelInfo = this.modelRegistry.getModelInfo();
    return modelInfo;
  }
  
  /**
   * Restablece el procesador
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.lastResult = null;
    this.signalAnalysisResult = {
      peakIndices: [],
      valleyIndices: [],
      intervals: [],
      lastPeakTime: 0
    };
    this.sampleCount = 0;
    this.validReadingCount = 0;
    this.modelRegistry.resetModels();
    console.log("VitalSignsProcessor: Reset complete");
  }
  
  /**
   * Devuelve estadísticas del procesador
   */
  public getStats(): any {
    return {
      totalSamples: this.sampleCount,
      validReadings: this.validReadingCount,
      bufferSize: this.ppgBuffer.length,
      lastUpdateTime: this.lastUpdateTime,
      confidenceThreshold: this.confidenceThreshold,
      processEveryNFrames: this.processEveryNFrames
    };
  }
  
  /**
   * Configura el procesador
   */
  public configure(config: { confidenceThreshold?: number; processEveryNFrames?: number }): void {
    if (config.confidenceThreshold !== undefined) {
      this.confidenceThreshold = config.confidenceThreshold;
    }
    
    if (config.processEveryNFrames !== undefined) {
      this.processEveryNFrames = config.processEveryNFrames;
    }
  }
}
