/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult } from './types/vital-signs-result';
import { SignalProcessor } from './processors/signal-processor';
import { SPO2Processor } from './processors/spo2-processor';
import { BloodPressureProcessor } from './processors/blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { GlucoseEstimator } from './processors/glucose-estimator';
import { LipidEstimator } from './processors/lipid-estimator';
import { HemoglobinEstimator } from './processors/hemoglobin-estimator';
import { HydrationAnalyzer } from './processors/hydration-analyzer';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { RRIntervalData } from './arrhythmia/types';

/**
 * Implementación unificada del procesador de signos vitales
 */
export class VitalSignsProcessor {
  private signalProcessor: SignalProcessor;
  private spo2Processor: SPO2Processor;
  private bloodPressureProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private glucoseProcessor: GlucoseEstimator;
  private lipidProcessor: LipidEstimator;
  private hemoglobinProcessor: HemoglobinEstimator;
  private hydrationProcessor: HydrationAnalyzer;
  private heartRateDetector: HeartRateDetector;
  
  private lastValidResult: VitalSignsResult | null = null;
  private processedValues: number = 0;
  private noFingerDetectionCounter: number = 0;
  private signalBuffer: number[] = [];
  private readonly sampleRate = 30; // Assumed 30Hz for data collection
  
  private readonly MIN_QUALITY_THRESHOLD = 45;
  private readonly MAX_BUFFER_SIZE = 150;
  
  constructor() {
    this.signalProcessor = new SignalProcessor();
    this.spo2Processor = new SPO2Processor();
    this.bloodPressureProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.glucoseProcessor = new GlucoseEstimator();
    this.lipidProcessor = new LipidEstimator();
    this.hemoglobinProcessor = new HemoglobinEstimator();
    this.hydrationProcessor = new HydrationAnalyzer();
    this.heartRateDetector = new HeartRateDetector();
  }
  
  /**
   * Procesa una señal PPG para extraer signos vitales
   * @param value Valor crudo de señal PPG
   * @returns Resultados de las mediciones de signos vitales
   */
  public processSignal(value: number): VitalSignsResult {
    try {
      // Procesar la señal directamente
      this.processedValues++;
      
      // Aplicar filtrados y procesamiento de señal
      const processedResult = this.signalProcessor.applyFilters(value);
      
      // Comprobar que el resultado tenga las propiedades necesarias
      const { filteredValue, quality, fingerDetected } = processedResult;
      
      // Si estos valores existen en processedResult, los asignamos, si no usamos valores por defecto
      const acSignalValue = 'acSignalValue' in processedResult ? processedResult.acSignalValue : 0;
      const dcBaseline = 'dcBaseline' in processedResult ? processedResult.dcBaseline : 0;
      
      // Incrementar contador de señales no detectadas
      if (!fingerDetected) {
        this.noFingerDetectionCounter++;
      } else {
        this.noFingerDetectionCounter = 0;
      }
      
      // Si hay dedo detectado, procesar signos vitales
      if (fingerDetected && quality > this.MIN_QUALITY_THRESHOLD) {
        this.signalBuffer.push(filteredValue);
        if (this.signalBuffer.length > this.MAX_BUFFER_SIZE) {
          this.signalBuffer.shift();
        }
        
        // Calcular frecuencia cardíaca con el detector específico
        const bpm = this.heartRateDetector.calculateHeartRate(this.signalBuffer, this.sampleRate);
        console.log("BPM calculado:", bpm);
        
        // Obtener los intervalos RR para análisis de arritmias
        const rrData: RRIntervalData = this.heartRateDetector.getRRIntervals();
        
        // Calcular saturación de oxígeno
        const spo2 = this.spo2Processor.calculateSpO2(
          filteredValue,
          this.signalBuffer
        );
        
        // Calcular presión arterial
        const pressure = this.bloodPressureProcessor.calculateBloodPressure(
          filteredValue,
          bpm,
          this.signalBuffer
        );
        
        // Calcular arritmias con los intervalos RR
        const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
        console.log("Resultado arritmias:", arrhythmiaResult);
        
        // Calcular glucosa
        const glucose = this.glucoseProcessor.estimateGlucose(
          filteredValue,
          acSignalValue,
          dcBaseline,
          this.signalBuffer
        );
        console.log("Glucosa estimada:", glucose);
        
        // Calcular lípidos
        const lipids = this.lipidProcessor.estimateLipids(
          filteredValue,
          acSignalValue,
          dcBaseline,
          this.signalBuffer
        );
        
        // Calcular hemoglobina
        const hemoglobin = this.hemoglobinProcessor.estimateHemoglobin(
          filteredValue,
          acSignalValue,
          dcBaseline,
          this.signalBuffer
        );
        
        // Calcular hidratación
        const hydration = this.hydrationProcessor.calculateHydration(
          filteredValue,
          this.signalBuffer
        );
        
        // Crear resultado con BPM incluido
        const result: VitalSignsResult = {
          spo2,
          pressure,
          arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
          lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
          glucose,
          lipids,
          hemoglobin,
          hydration,
          heartRate: bpm  // Incluir la frecuencia cardíaca en los resultados
        };
        
        // Almacenar resultados válidos
        this.lastValidResult = result;
        
        return result;
      } else {
        // Si no hay dedo detectado o calidad insuficiente, devolver último resultado válido o valores vacíos
        return this.lastValidResult || {
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "--",
          glucose: 0,
          lipids: {
            totalCholesterol: 0,
            triglycerides: 0
          },
          hemoglobin: 0,
          hydration: 0,
          heartRate: 0
        };
      }
    } catch (error) {
      console.error("VitalSignsProcessor: Error procesando señal", error);
      
      // En caso de error, devolver valores seguros
      return {
        spo2: 0,
        pressure: "Error",
        arrhythmiaStatus: "Error",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0,
        hydration: 0,
        heartRate: 0
      };
    }
  }
  
  /**
   * Obtiene el contador de arritmias detectadas
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount() || 0;
  }
  
  /**
   * Obtiene los intervalos RR
   */
  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null; } {
    return this.signalProcessor.getRRIntervals();
  }
  
  /**
   * Obtiene el buffer de señal cruda
   */
  public getRawSignalBuffer(): number[] {
    return this.signalProcessor.getRawSignalBuffer();
  }
  
  /**
   * Resetea el procesador de signos vitales
   */
  public reset(): void {
    this.signalProcessor.reset();
    this.spo2Processor.reset();
    this.bloodPressureProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hemoglobinProcessor.reset();
    this.hydrationProcessor.reset();
    this.lastValidResult = null;
    this.processedValues = 0;
    this.noFingerDetectionCounter = 0;
    this.signalBuffer = [];
  }
  
  /**
   * Realiza un reseteo completo del procesador
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaProcessor.reset();
  }
}
