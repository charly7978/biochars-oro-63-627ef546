
import { ArrhythmiaDetector } from './analysis/ArrhythmiaDetector';
import { SPO2Analyzer } from './analysis/SPO2Analyzer';
import { BloodPressureAnalyzer } from './analysis/BloodPressureAnalyzer';
import { GlucoseEstimator } from './analysis/GlucoseEstimator';
import { LipidEstimator } from './analysis/LipidEstimator';
import { RRData } from './signal/PeakDetector';
import { UserProfile, VitalSignsResult } from './types';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from './config/ProcessorConfig';

/**
 * Procesador principal de señales vitales
 * Coordina todos los analizadores específicos
 */
export class VitalSignsProcessor {
  private spo2Analyzer: SPO2Analyzer;
  private bloodPressureAnalyzer: BloodPressureAnalyzer;
  private arrhythmiaDetector: ArrhythmiaDetector;
  private glucoseEstimator: GlucoseEstimator;
  private lipidEstimator: LipidEstimator;
  
  private lastGoodBPM: number = 0;
  private lastBPMUpdateTime: number = 0;
  private signalBuffer: number[] = [];
  private readonly BUFFER_MAX_SIZE = 300;
  
  private results: VitalSignsResult = {
    spo2: 0,
    pressure: "--/--",
    arrhythmiaStatus: "--",
    lastArrhythmiaData: null,
    glucose: 0,
    lipids: {
      totalCholesterol: 0,
      triglycerides: 0
    }
  };
  
  private arrhythmiaCounter = 0;
  
  constructor(
    private config: ProcessorConfig = DEFAULT_PROCESSOR_CONFIG,
    private userProfile?: UserProfile
  ) {
    console.log("VitalSignsProcessor: Creating analyzers");
    this.spo2Analyzer = new SPO2Analyzer(config, userProfile);
    this.bloodPressureAnalyzer = new BloodPressureAnalyzer(config, userProfile);
    this.arrhythmiaDetector = new ArrhythmiaDetector(userProfile);
    this.glucoseEstimator = new GlucoseEstimator(config, userProfile);
    this.lipidEstimator = new LipidEstimator(config, userProfile);
    
    this.reset();
  }
  
  /**
   * Procesa un nuevo valor de señal PPG
   * @param value Valor filtrado de la señal PPG
   * @param rrData Datos opcionales de intervalos RR
   * @returns Resultado actualizado de signos vitales
   */
  public processSignal(
    value: number, 
    rrData?: RRData
  ): VitalSignsResult {
    // Almacenar el valor en el buffer
    if (value !== 0) {
      this.signalBuffer.push(value);
      
      if (this.signalBuffer.length > this.BUFFER_MAX_SIZE) {
        this.signalBuffer.shift();
      }
    }
    
    let currentBPM = 0;
    
    // Usar datos de RR para obtener ritmo cardíaco
    if (rrData && rrData.intervals && rrData.intervals.length > 0) {
      const lastRR = rrData.intervals[rrData.intervals.length - 1];
      if (lastRR > 0) {
        currentBPM = Math.round(60000 / lastRR);
        
        // Actualizar último BPM válido
        if (currentBPM >= 40 && currentBPM <= 200) {
          this.lastGoodBPM = currentBPM;
          this.lastBPMUpdateTime = Date.now();
        }
      }
      
      // Procesar con analizador de arritmias
      if (rrData.intervals.length >= 3) {
        const arrhythmiaResult = this.arrhythmiaDetector.processRRData(rrData);
        
        if (arrhythmiaResult.arrhythmiaStatus !== 'normal' && 
            arrhythmiaResult.count > this.arrhythmiaCounter) {
          this.arrhythmiaCounter = arrhythmiaResult.count;
        }
        
        // Actualizar estado de arritmia
        let arrhythmiaText = "";
        
        if (this.arrhythmiaCounter > 0) {
          arrhythmiaText = `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`;
        } else {
          arrhythmiaText = `NO ARRITMIAS|0`;
        }
        
        this.results.arrhythmiaStatus = arrhythmiaText;
        this.results.lastArrhythmiaData = arrhythmiaResult.lastArrhythmiaData;
      }
    }
    
    // Actualizar anlizadores con el valor actual
    this.updateAnalyzers(value, this.lastGoodBPM);
    
    // Actualizar resultados cada cierto intervalo
    this.updateResults();
    
    return {...this.results};
  }
  
  /**
   * Actualizar todos los analizadores con nuevos datos
   */
  private updateAnalyzers(value: number, heartRate: number): void {
    if (value === 0) return;
    
    // Actualizar analizador de SpO2
    this.spo2Analyzer.addDataPoint(value);
    
    // Actualizar analizador de presión arterial
    this.bloodPressureAnalyzer.addDataPoint(value, heartRate);
    
    // Actualizar estimadores de glucosa y lípidos
    this.glucoseEstimator.addDataPoint(value);
    this.lipidEstimator.addDataPoint(value);
  }
  
  /**
   * Actualizar todos los resultados de análisis
   */
  private updateResults(): void {
    // Actualizar SpO2
    const spo2Result = this.spo2Analyzer.estimateSPO2();
    if (spo2Result.confidence > this.config.confidenceThreshold) {
      this.results.spo2 = spo2Result.value;
    }
    
    // Actualizar presión arterial
    const bpResult = this.bloodPressureAnalyzer.estimateBloodPressure();
    if (bpResult.confidence > this.config.confidenceThreshold) {
      this.results.pressure = bpResult.formatted;
    }
    
    // Actualizar glucosa
    const glucoseResult = this.glucoseEstimator.estimateGlucose();
    if (glucoseResult.confidence > this.config.confidenceThreshold) {
      this.results.glucose = glucoseResult.value;
    }
    
    // Actualizar lípidos
    const lipidResult = this.lipidEstimator.estimateLipids();
    if (lipidResult.confidence > this.config.confidenceThreshold) {
      this.results.lipids = {
        totalCholesterol: lipidResult.totalCholesterol,
        triglycerides: lipidResult.triglycerides
      };
    }
  }
  
  /**
   * Reinicio suave - mantiene algunas calibraciones
   */
  public reset(): VitalSignsResult {
    const currentResults = {...this.results};
    
    this.signalBuffer = [];
    this.lastGoodBPM = 0;
    
    this.spo2Analyzer.reset();
    this.bloodPressureAnalyzer.reset();
    this.glucoseEstimator.reset();
    this.lipidEstimator.reset();
    
    // No resetear contador de arritmias
    
    this.results = {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: this.results.arrhythmiaStatus, // Mantener estado de arritmia
      lastArrhythmiaData: this.results.lastArrhythmiaData,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
    
    return currentResults;
  }
  
  /**
   * Reinicio completo - resetea todo
   */
  public fullReset(): void {
    this.signalBuffer = [];
    this.lastGoodBPM = 0;
    this.lastBPMUpdateTime = 0;
    this.arrhythmiaCounter = 0;
    
    this.spo2Analyzer.reset();
    this.bloodPressureAnalyzer.reset();
    this.arrhythmiaDetector.reset();
    this.glucoseEstimator.reset();
    this.lipidEstimator.reset();
    
    this.results = {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      lastArrhythmiaData: null,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
  }
  
  /**
   * Obtener el contador actual de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
}
