
/**
 * Procesador avanzado de señales PPG que implementa técnicas de vanguardia
 * para análisis y procesamiento de fotopletismografía.
 * 
 * NOTA IMPORTANTE: Este módulo extiende la funcionalidad sin modificar las interfaces
 * principales que están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import type { VitalSignsResult } from '../core/VitalSignsProcessor';
import type { RRData } from '../core/ArrhythmiaProcessor';
import { AFibDetector } from './analysis/AFibDetector';
import { PPGMorphologyAnalyzer } from './analysis/PPGMorphologyAnalyzer';
import { HRVAnalyzer } from './analysis/HRVAnalyzer';
import { BPEstimator } from './analysis/BPEstimator';
import { adaptPeakData } from './utils/SignalProcessingUtils';
import { CalibrationService } from './services/CalibrationService';
import { ResultGenerator } from './services/ResultGenerator';
import { ProcessorManager } from './ProcessorManager';
import { ProcessorConfig } from './config/ProcessorConfig';

/**
 * Procesador avanzado que implementa algoritmos de vanguardia para
 * el análisis de señales PPG y la extracción de biomarcadores.
 */
export class AdvancedSignalProcessor {
  // Gestor central de procesamiento
  private processorManager: ProcessorManager;
  
  // Analizadores biomédicos avanzados
  private afibDetector: AFibDetector;
  private morphologyAnalyzer: PPGMorphologyAnalyzer;
  private hrvAnalyzer: HRVAnalyzer;
  private bpEstimator: BPEstimator;
  
  // Servicios
  private calibrationService: CalibrationService;
  private resultGenerator: ResultGenerator;
  
  // Resultados de último procesamiento
  private lastResult: VitalSignsResult | null = null;
  
  constructor() {
    // Inicializar gestor de procesamiento
    this.processorManager = new ProcessorManager();
    
    // Inicializar analizadores biomédicos
    this.afibDetector = new AFibDetector();
    this.morphologyAnalyzer = new PPGMorphologyAnalyzer();
    this.hrvAnalyzer = new HRVAnalyzer();
    this.bpEstimator = new BPEstimator();
    
    // Inicializar servicios
    this.calibrationService = new CalibrationService();
    this.resultGenerator = new ResultGenerator();
    
    console.log('Procesador avanzado de señales PPG inicializado');
  }
  
  /**
   * Activa el modo de bajo consumo para dispositivos con recursos limitados
   */
  public setLowPowerMode(enabled: boolean): void {
    this.processorManager.setLowPowerMode(enabled);
    console.log(`Modo de bajo consumo: ${enabled ? 'activado' : 'desactivado'}`);
  }
  
  /**
   * Procesa una señal PPG utilizando técnicas avanzadas
   */
  public processSignal(ppgValue: number, rrData?: RRData): VitalSignsResult {
    // Procesar el valor a través del gestor principal
    const { denoisedValue, hasEnoughData, signalQuality } = this.processorManager.processValue(ppgValue);
    
    // Análisis multivariante si hay suficientes muestras
    if (hasEnoughData) {
      // Obtener datos analizados (picos, valores compensados)
      const { peakInfo, compensatedValues } = this.processorManager.analyzeSignal();
      
      // Análisis morfológico avanzado de la onda PPG
      const morphologyFeatures = this.morphologyAnalyzer.analyzeWaveform(compensatedValues);
      
      // Actualizar métricas de calidad basadas en análisis morfológico
      this.processorManager.updateQualityFromMorphology(morphologyFeatures);
      
      // Calcular SpO2 mejorado basado en análisis morfológico
      const spo2 = Math.min(98, 
        Math.max(90, 95 + morphologyFeatures.perfusion * 3 - 
        this.processorManager.getQualityMetrics().pressureArtifactLevel * 2)
      );
      
      // Estimación mejorada de presión arterial usando tiempo de tránsito
      const bloodPressure = this.bpEstimator.estimate(
        compensatedValues, 
        peakInfo, 
        signalQuality
      );
      
      // Análisis avanzado de fibrilación auricular
      // Adaptamos el objeto para que coincida con la estructura esperada por AFibDetector
      const afibResults = this.afibDetector.analyze(adaptPeakData(peakInfo));
      
      // Análisis avanzado de HRV
      const hrvMetrics = this.hrvAnalyzer.calculateMetrics(peakInfo.intervals);
      
      // Si estamos calibrando, actualizar progreso
      const calibrationComplete = this.calibrationService.updateCalibration();
      if (calibrationComplete) {
        // Configurar parámetros calibrados
        this.processorManager.updateDenoiserParameters(signalQuality);
        this.bpEstimator.calibrate(compensatedValues);
      }
      
      // Obtener métricas de calidad actualizadas
      const qualityMetrics = this.processorManager.getQualityMetrics();
      
      // Construir resultado avanzado manteniendo compatibilidad con VitalSignsResult
      const result = this.resultGenerator.generateResult({
        spo2,
        bloodPressure,
        afibResults,
        calibration: this.calibrationService.getCalibrationState(),
        perfusionIndex: qualityMetrics.perfusionIndex,
        pressureArtifactLevel: qualityMetrics.pressureArtifactLevel,
        hrvMetrics
      });
      
      this.lastResult = result;
      return result;
    }
    
    // Si no hay suficientes muestras, retornar valores por defecto
    const defaultResult = this.resultGenerator.generateDefaultResult(
      this.calibrationService.getCalibrationState()
    );
    
    return this.lastResult || defaultResult;
  }
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    this.calibrationService.startCalibration();
  }
  
  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    this.calibrationService.forceCalibrationCompletion();
    
    // Aplicar valores predeterminados de calibración
    this.processorManager.updateDenoiserParameters(100); // Forzar calibración óptima
    this.bpEstimator.resetToDefaults();
  }
  
  /**
   * Reinicia el procesador y mantiene calibración
   */
  public reset(): VitalSignsResult | null {
    // Guardar resultado actual
    const currentResult = this.lastResult;
    
    // Reinicio parcial (mantiene calibración)
    this.processorManager.reset(false);
    this.afibDetector.reset(false);
    this.hrvAnalyzer.reset(false);
    
    console.log('Procesador avanzado reiniciado (parcial)');
    
    return currentResult;
  }
  
  /**
   * Reinicia completamente el procesador y su calibración
   */
  public fullReset(): void {
    // Reiniciar todos los procesadores completamente
    this.lastResult = null;
    
    // Reinicio completo de todos los componentes
    this.processorManager.reset(true);
    this.afibDetector.reset(true);
    this.morphologyAnalyzer.reset();
    this.hrvAnalyzer.reset(true);
    this.bpEstimator.resetToDefaults();
    this.calibrationService.reset();
    
    console.log('Procesador avanzado reiniciado completamente');
  }
}
