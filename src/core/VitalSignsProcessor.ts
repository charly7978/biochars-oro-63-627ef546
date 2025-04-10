import { createSignalProcessor } from './signal-processing';
import { PeakDetector, type RRData } from './signal/PeakDetector';
import { ArrhythmiaDetector } from './analysis/ArrhythmiaDetector';
import { BloodPressureAnalyzer } from './analysis/BloodPressureAnalyzer';
import { DEFAULT_PROCESSOR_CONFIG, ProcessorConfig } from './config/ProcessorConfig';
import { GlucoseEstimator } from './analysis/GlucoseEstimator';
import { LipidEstimator } from './analysis/LipidEstimator';
import { HemoglobinEstimator } from './analysis/HemoglobinEstimator';
import type { ProcessedSignal } from './types';
import { UserProfile } from './types';
import { TensorFlowModelRegistry } from './neural/tensorflow/TensorFlowModelRegistry';
import { TFHeartRateModel } from './neural/tensorflow/models/TFHeartRateModel';
import { DEFAULT_TENSORFLOW_CONFIG } from './neural/tensorflow/TensorFlowConfig';

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
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      hemoglobin: number;
    };
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  neuralNetworkInfo?: {
    modelsUsed: string[];
    confidence: number;
    processingTime: number;
  };
}

/**
 * Procesador unificado de signos vitales
 * - Arquitectura modular que elimina duplicidades
 * - Enfoque en precisión y consistencia
 * - Optimizado para diversos dispositivos móviles
 * - Integración con TensorFlow.js para procesamiento avanzado
 */
export class VitalSignsProcessor {
  // Componentes de procesamiento
  private signalProcessor = createSignalProcessor();
  private peakDetector: PeakDetector;
  private arrhythmiaDetector: ArrhythmiaDetector;
  private bpAnalyzer: BloodPressureAnalyzer;
  private glucoseEstimator: GlucoseEstimator;
  private lipidEstimator: LipidEstimator;
  private hemoglobinEstimator: HemoglobinEstimator;
  
  // Estado del procesador
  private lastValidResults: VitalSignsResult | null = null;
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 50;
  private readonly CALIBRATION_DURATION_MS: number = 8000;
  private arrhythmiaCounter: number = 0;
  
  // Progreso de calibración
  private calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0
  };
  
  // Finalización forzada de calibración
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  
  // Buffer de señal PPG
  private ppgValues: number[] = [];
  
  // Integración TensorFlow
  private tfModelRegistry: TensorFlowModelRegistry;
  private useNeuralNetworks: boolean = true;
  private neuralNetworkReady: boolean = false;
  private neuralNetworkInitializing: boolean = false;
  
  /**
   * Constructor del procesador unificado con soporte para TensorFlow
   */
  constructor(config: Partial<ProcessorConfig> = {}) {
    const fullConfig = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    
    const defaultUserProfile: UserProfile = {
      age: 30,
      gender: 'unknown',
      height: 170,
      weight: 70,
      activityLevel: 'moderate'
    };
    
    this.peakDetector = new PeakDetector();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
    this.bpAnalyzer = new BloodPressureAnalyzer(defaultUserProfile);
    this.glucoseEstimator = new GlucoseEstimator(fullConfig);
    this.lipidEstimator = new LipidEstimator(fullConfig);
    this.hemoglobinEstimator = new HemoglobinEstimator(fullConfig);
    
    // Create specialized channels in the signal processor
    this.signalProcessor.createChannel('heartbeat');
    this.signalProcessor.createChannel('spo2');
    this.signalProcessor.createChannel('arrhythmia');
    this.signalProcessor.createChannel('bloodPressure');
    
    // Inicializar TensorFlow
    this.tfModelRegistry = TensorFlowModelRegistry.getInstance(DEFAULT_TENSORFLOW_CONFIG);
    this.initTensorFlow();
    
    console.log('Procesador de signos vitales unificado inicializado con soporte TensorFlow');
  }
  
  /**
   * Inicializa modelos TensorFlow
   */
  private async initTensorFlow(): Promise<void> {
    if (this.neuralNetworkInitializing) return;
    
    this.neuralNetworkInitializing = true;
    
    try {
      // Registrar modelos de TensorFlow
      const heartRateModel = new TFHeartRateModel();
      this.tfModelRegistry.registerModel('heartRate', heartRateModel);
      
      // Más modelos serán registrados aquí...
      
      this.neuralNetworkReady = true;
      console.log('Modelos TensorFlow inicializados correctamente');
    } catch (error) {
      console.error('Error inicializando modelos TensorFlow:', error);
      this.useNeuralNetworks = false;
    } finally {
      this.neuralNetworkInitializing = false;
    }
  }
  
  /**
   * Inicia proceso de calibración
   */
  public startCalibration(): void {
    if (this.isCalibrating) return;
    
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;
    
    // Reiniciar progreso de calibración
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      glucose: 0,
      lipids: 0,
      hemoglobin: 0
    };
    
    // Establecer temporizador de calibración
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      this.completeCalibration();
    }, this.CALIBRATION_DURATION_MS);
    
    // Notificar a TensorFlow sobre inicio de calibración
    if (this.useNeuralNetworks && this.neuralNetworkReady) {
      this.tfModelRegistry.notifyCalibrationStarted();
    }
    
    console.log('Calibración iniciada');
  }
  
  /**
   * Completa el proceso de calibración
   */
  private completeCalibration(): void {
    if (!this.isCalibrating) return;
    
    this.isCalibrating = false;
    this.forceCompleteCalibration = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    // Determinar si tenemos suficientes muestras para calibración
    const hasEnoughSamples = this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES;
    
    // Aplicar calibración solo si hay suficientes muestras
    if (hasEnoughSamples && this.ppgValues.length > 100) {
      const recentValues = this.ppgValues.slice(-100);
      
      // Actualizar progreso a 100% para todos los componentes
      Object.keys(this.calibrationProgress).forEach(key => {
        this.calibrationProgress[key] = 100;
      });
      
      console.log('Calibración completada con éxito');
    } else {
      console.log('Calibración fallida: insuficientes muestras');
    }
  }
  
  /**
   * Procesa una señal PPG y genera resultados de signos vitales con TensorFlow
   */
  public async processSignal(
    ppgValue: number,
    rrData?: RRData
  ): Promise<VitalSignsResult> {
    // Añadir valor a buffer
    this.ppgValues.push(ppgValue);
    if (this.ppgValues.length > DEFAULT_PROCESSOR_CONFIG.bufferSize) {
      this.ppgValues.shift();
    }
    
    // Process through the central signal processor
    const channels = this.signalProcessor.processSignal(ppgValue);
    
    // Get processed values from channels
    const heartbeatChannel = channels.get('heartbeat');
    const quality = heartbeatChannel?.getLastMetadata()?.quality || 0;
    
    // Detectar picos en la señal
    const peakInfo = this.peakDetector.detectPeaks(this.ppgValues);
    
    // Procesar arritmias
    const arrhythmiaResult = this.arrhythmiaDetector.processRRData(rrData);
    if (arrhythmiaResult.arrhythmiaStatus.includes("ARRITMIA")) {
      this.arrhythmiaCounter++;
    }
    
    // Variables para información neural
    const neuralNetworkInfo = {
      modelsUsed: [] as string[],
      confidence: 0,
      processingTime: 0
    };
    
    // Datos precalculados con métodos convencionales
    const conventionalHeartRate = peakInfo.heartRate || 0;
    const conventionalSpo2 = this.calculateSpO2(this.ppgValues);
    const conventionalBloodPressure = this.bpAnalyzer.analyze(this.ppgValues);
    
    // Variables para resultados finales
    let heartRate = conventionalHeartRate;
    let spo2 = conventionalSpo2;
    let bloodPressure = conventionalBloodPressure;
    
    // Usar TensorFlow si está disponible y hay suficientes datos
    if (this.useNeuralNetworks && this.neuralNetworkReady && this.ppgValues.length >= 200 && quality > 50) {
      try {
        // Obtener timestamp para medir tiempo de procesamiento
        const neuralStartTime = performance.now();
        
        // Procesar frecuencia cardíaca con TensorFlow
        const heartRateModel = this.tfModelRegistry.getModel<TFHeartRateModel>('heartRate');
        if (heartRateModel) {
          const tfHeartRate = await heartRateModel.predict(this.ppgValues.slice(-300));
          
          // Combinar resultados (70% neural, 30% convencional)
          heartRate = Math.round(tfHeartRate[0] * 0.7 + conventionalHeartRate * 0.3);
          neuralNetworkInfo.modelsUsed.push('heartRate');
        }
        
        // Añadir otros modelos cuando estén disponibles
        
        // Calcular tiempo de procesamiento
        neuralNetworkInfo.processingTime = performance.now() - neuralStartTime;
        
        // Calcular confianza basada en calidad de señal
        neuralNetworkInfo.confidence = Math.min(100, quality * 1.2) / 100;
        
      } catch (error) {
        console.error('Error en procesamiento neural:', error);
        // Fallback a métodos convencionales (ya asignados)
      }
    }
    
    // Procesar estimaciones no invasivas
    const glucose = this.glucoseEstimator.analyze(this.ppgValues);
    const lipids = this.lipidEstimator.analyze(this.ppgValues);
    const hemoglobin = this.hemoglobinEstimator.analyze(this.ppgValues);
    
    // Actualizar conteo de muestras de calibración
    if (this.isCalibrating) {
      this.calibrationSamples++;
      this.updateCalibrationProgress();
      
      // Verificar si calibración debe finalizar
      if (this.forceCompleteCalibration || 
          Date.now() - this.calibrationStartTime >= this.CALIBRATION_DURATION_MS) {
        this.completeCalibration();
      }
    }
    
    // Crear resultado
    const result: VitalSignsResult = {
      spo2,
      pressure: `${bloodPressure.systolic}/${bloodPressure.diastolic}`,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
    
    // Añadir información neural si se usó
    if (neuralNetworkInfo.modelsUsed.length > 0) {
      result.neuralNetworkInfo = neuralNetworkInfo;
    }
    
    // Añadir información de calibración si está en proceso
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    // Actualizar últimos resultados válidos
    this.lastValidResults = result;
    
    return result;
  }
  
  /**
   * Calcula SpO2 basado en valores PPG
   */
  private calculateSpO2(values: number[]): number {
    if (values.length < 30) return 98; // Valor por defecto
    
    // Implementación simplificada para este ejemplo
    // En producción, usar análisis más sofisticado
    let spo2 = 98; // Valor base saludable
    
    const recentValues = values.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Ajustar ligeramente basado en amplitud
    if (amplitude > 0.1) {
      spo2 = Math.min(100, spo2 + 1);
    } else if (amplitude < 0.05) {
      spo2 = Math.max(90, spo2 - 2);
    }
    
    return Math.round(spo2);
  }
  
  /**
   * Actualiza progreso de calibración
   */
  private updateCalibrationProgress(): void {
    const progress = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
    
    // Actualizar progreso de manera ligeramente diferente para cada componente
    this.calibrationProgress.heartRate = progress;
    this.calibrationProgress.spo2 = Math.max(0, progress - 5);
    this.calibrationProgress.pressure = Math.max(0, progress - 10);
    this.calibrationProgress.arrhythmia = Math.max(0, progress - 15);
    this.calibrationProgress.glucose = Math.max(0, progress - 20);
    this.calibrationProgress.lipids = Math.max(0, progress - 25);
    this.calibrationProgress.hemoglobin = Math.max(0, progress - 30);
  }
  
  /**
   * Verifica si se está calibrando actualmente
   */
  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }
  
  /**
   * Obtiene estado de progreso de calibración
   */
  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    return {
      isCalibrating: this.isCalibrating,
      progress: { ...this.calibrationProgress }
    };
  }
  
  /**
   * Get the arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Fuerza la finalización de la calibración
   */
  public forceCalibrationCompletion(): void {
    if (this.isCalibrating) {
      this.forceCompleteCalibration = true;
      this.completeCalibration();
    }
  }
  
  /**
   * Activa o desactiva el uso de redes neuronales
   */
  public setUseNeuralNetworks(enabled: boolean): void {
    this.useNeuralNetworks = enabled;
    console.log(`Redes neuronales ${enabled ? 'activadas' : 'desactivadas'}`);
    
    // Inicializar TensorFlow si se activa y no está listo
    if (enabled && !this.neuralNetworkReady && !this.neuralNetworkInitializing) {
      this.initTensorFlow();
    }
  }
  
  /**
   * Obtiene información sobre modelos neuronales
   */
  public getNeuralNetworkInfo(): {
    enabled: boolean;
    ready: boolean;
    models: Array<{id: string; name: string; version: string; architecture: string}>;
  } {
    // Use getAllModels instead of getModelInfo
    const models = this.neuralNetworkReady ? 
      Array.from(this.tfModelRegistry.getAllModels().entries()).map(([id, model]) => ({
        id,
        name: (model as any).name || 'Unknown',
        version: (model as any).version || '1.0.0',
        architecture: (model as any).architecture || 'Unknown'
      })) : [];
      
    return {
      enabled: this.useNeuralNetworks,
      ready: this.neuralNetworkReady,
      models
    };
  }
  
  /**
   * Reinicia el procesador manteniendo parámetros de calibración
   */
  public reset(): VitalSignsResult | null {
    this.ppgValues = [];
    this.peakDetector.reset();
    this.arrhythmiaDetector.reset();
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    this.isCalibrating = false;
    this.forceCompleteCalibration = false;
    this.arrhythmiaCounter = 0;
    
    // Reset the signal processor
    this.signalProcessor.reset();
    
    return this.lastValidResults;
  }
  
  /**
   * Reinicio completo incluyendo calibración
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
    
    // Use dispose instead of resetModels
    if (this.neuralNetworkReady) {
      this.tfModelRegistry.dispose();
    }
  }
  
  /**
   * Manejador de señales procesadas
   */
  private handleProcessedSignal(signal: ProcessedSignal): void {
    // Implementación de callback para señales procesadas
    // Este método podría expandirse según necesidades
    console.log('Señal procesada:', signal);
  }
}

// Exportar estimadores
export { GlucoseEstimator } from './analysis/GlucoseEstimator';
export { LipidEstimator } from './analysis/LipidEstimator';
export { HemoglobinEstimator } from './analysis/HemoglobinEstimator';
