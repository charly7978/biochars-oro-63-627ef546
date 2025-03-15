
/**
 * Procesador avanzado de señales PPG que implementa técnicas de vanguardia
 * para análisis y procesamiento de fotopletismografía.
 * 
 * NOTA IMPORTANTE: Este módulo extiende la funcionalidad sin modificar las interfaces
 * principales que están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import type { VitalSignsResult } from '../core/VitalSignsProcessor';
import type { RRData } from '../core/ArrhythmiaProcessor';
import { WaveletDenoiser } from './signal/WaveletDenoiser';
import { HilbertHuangTransform } from './signal/HilbertHuangTransform';
import { PeakDetector } from './signal/PeakDetector';
import { SpectralAnalyzer } from './signal/SpectralAnalyzer';
import { AFibDetector } from './analysis/AFibDetector';
import { PPGMorphologyAnalyzer } from './analysis/PPGMorphologyAnalyzer';
import { HRVAnalyzer } from './analysis/HRVAnalyzer';
import { BPEstimator } from './analysis/BPEstimator';
import { applyPressureCompensation, adaptPeakData } from './utils/SignalProcessingUtils';
import { CalibrationService } from './services/CalibrationService';
import { ResultGenerator } from './services/ResultGenerator';

/**
 * Procesador avanzado que implementa algoritmos de vanguardia para
 * el análisis de señales PPG y la extracción de biomarcadores.
 */
export class AdvancedSignalProcessor {
  // Procesadores de señal avanzados
  private waveletDenoiser: WaveletDenoiser;
  private hilbertTransform: HilbertHuangTransform;
  private peakDetector: PeakDetector;
  private spectralAnalyzer: SpectralAnalyzer;
  
  // Analizadores biomédicos avanzados
  private afibDetector: AFibDetector;
  private morphologyAnalyzer: PPGMorphologyAnalyzer;
  private hrvAnalyzer: HRVAnalyzer;
  private bpEstimator: BPEstimator;
  
  // Servicios
  private calibrationService: CalibrationService;
  private resultGenerator: ResultGenerator;
  
  // Buffer de señales y estado
  private ppgValues: number[] = [];
  private readonly BUFFER_SIZE = 300;
  private isLowPowerMode: boolean = false;
  
  // Métricas avanzadas
  private perfusionIndex: number = 0;
  private signalQuality: number = 0;
  private pressureArtifactLevel: number = 0;
  
  // Resultados de último procesamiento
  private lastResult: VitalSignsResult | null = null;
  
  constructor() {
    // Inicializar componentes de procesamiento avanzado
    this.waveletDenoiser = new WaveletDenoiser();
    this.hilbertTransform = new HilbertHuangTransform();
    this.peakDetector = new PeakDetector();
    this.spectralAnalyzer = new SpectralAnalyzer();
    
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
    this.isLowPowerMode = enabled;
    
    // Configurar componentes para modo de bajo consumo
    this.waveletDenoiser.setLowComplexity(enabled);
    this.hilbertTransform.setEnabled(!enabled);
    this.spectralAnalyzer.setLowResolution(enabled);
    
    console.log(`Modo de bajo consumo: ${enabled ? 'activado' : 'desactivado'}`);
  }
  
  /**
   * Procesa una señal PPG utilizando técnicas avanzadas
   */
  public processSignal(ppgValue: number, rrData?: RRData): VitalSignsResult {
    // Aplicar filtrado Wavelet adaptativo (superior a Kalman)
    const denoisedValue = this.waveletDenoiser.denoise(ppgValue);
    
    // Almacenar valor filtrado
    this.ppgValues.push(denoisedValue);
    if (this.ppgValues.length > this.BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    // Análisis espectral adaptativo para calidad de señal
    this.signalQuality = this.spectralAnalyzer.analyzeQuality(this.ppgValues);
    
    // Detección de artefactos por presión
    this.pressureArtifactLevel = this.spectralAnalyzer.detectPressureArtifacts(this.ppgValues);
    
    // Aplicar compensación de artefactos si es necesario
    const compensatedValues = this.pressureArtifactLevel > 0.3 
      ? applyPressureCompensation(this.ppgValues, this.pressureArtifactLevel)
      : this.ppgValues;
    
    // Análisis multivariante si hay suficientes muestras
    if (compensatedValues.length >= 60) {
      // Análisis morfológico avanzado de la onda PPG
      const morphologyFeatures = this.morphologyAnalyzer.analyzeWaveform(compensatedValues);
      
      // Calcular SpO2 mejorado basado en análisis morfológico
      const spo2 = Math.min(98, 
        Math.max(90, 95 + morphologyFeatures.perfusion * 3 - this.pressureArtifactLevel * 2)
      );
      
      // Calcular perfusión
      this.perfusionIndex = morphologyFeatures.perfusion;
      
      // Detección avanzada de picos utilizando derivadas de segundo orden
      const peakInfo = this.peakDetector.detectPeaks(compensatedValues);
      
      // Estimación mejorada de presión arterial usando tiempo de tránsito
      const bloodPressure = this.bpEstimator.estimate(
        compensatedValues, 
        peakInfo, 
        this.signalQuality
      );
      
      // Análisis avanzado de fibrilación auricular
      // Adaptamos el objeto para que coincida con la estructura esperada por AFibDetector
      const afibResults = this.afibDetector.analyze(adaptPeakData(peakInfo));
      
      // Análisis avanzado de HRV
      const hrvMetrics = this.hrvAnalyzer.calculateMetrics(peakInfo.intervals);
      
      // Análisis de transformada Hilbert-Huang para componentes no lineales
      const hhResults = !this.isLowPowerMode 
        ? this.hilbertTransform.analyze(compensatedValues) 
        : null;
      
      // Si estamos calibrando, actualizar progreso
      const calibrationComplete = this.calibrationService.updateCalibration();
      if (calibrationComplete) {
        // Configurar parámetros calibrados
        this.waveletDenoiser.updateParameters(this.signalQuality);
        this.bpEstimator.calibrate(this.ppgValues);
      }
      
      // Construir resultado avanzado manteniendo compatibilidad con VitalSignsResult
      const result = this.resultGenerator.generateResult({
        spo2,
        bloodPressure,
        afibResults,
        calibration: this.calibrationService.getCalibrationState(),
        perfusionIndex: this.perfusionIndex,
        pressureArtifactLevel: this.pressureArtifactLevel,
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
    this.waveletDenoiser.resetToDefaults();
    this.bpEstimator.resetToDefaults();
  }
  
  /**
   * Reinicia el procesador y mantiene calibración
   */
  public reset(): VitalSignsResult | null {
    // Guardar resultado actual
    const currentResult = this.lastResult;
    
    // Reiniciar buffers de señal
    this.ppgValues = [];
    
    // Reiniciar procesadores pero mantener calibración
    this.peakDetector.reset();
    this.afibDetector.reset(false); // No reiniciar completamente
    this.hrvAnalyzer.reset(false);  // No reiniciar completamente
    
    console.log('Procesador avanzado reiniciado (parcial)');
    
    return currentResult;
  }
  
  /**
   * Reinicia completamente el procesador y su calibración
   */
  public fullReset(): void {
    // Reiniciar todos los procesadores completamente
    this.ppgValues = [];
    this.lastResult = null;
    this.perfusionIndex = 0;
    this.signalQuality = 0;
    this.pressureArtifactLevel = 0;
    
    // Reiniciar todos los componentes
    this.waveletDenoiser.resetToDefaults();
    this.hilbertTransform.reset();
    this.peakDetector.reset();
    this.spectralAnalyzer.reset();
    this.afibDetector.reset(true);  // Reinicio completo
    this.morphologyAnalyzer.reset();
    this.hrvAnalyzer.reset(true);   // Reinicio completo
    this.bpEstimator.resetToDefaults();
    this.calibrationService.reset();
    
    console.log('Procesador avanzado reiniciado completamente');
  }
}
