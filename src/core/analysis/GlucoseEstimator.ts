
import { UserProfile } from '../types';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';
import { SignalAnalyzer } from './SignalAnalyzer';
import { TensorUtils } from '../neural/tensorflow/TensorAdapter';

/**
 * Estimador optimizado para glucosa a partir de señal PPG
 */
export class GlucoseEstimator extends SignalAnalyzer {
  private config: ProcessorConfig;
  private lastEstimate: number = 95;
  private windowSize = 30;
  private signalBuffer: number[] = [];
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
  }
  
  /**
   * Analiza el nivel de glucosa a partir de valores PPG crudos
   */
  public analyze(ppgValues: number[]): number {
    // Actualizar buffer de señal
    this.updateBuffer(ppgValues);
    
    if (this.signalBuffer.length < this.windowSize) {
      return this.lastEstimate;
    }
    
    // Usar los valores más recientes
    const recentValues = this.signalBuffer.slice(-this.windowSize);
    
    // Cálculo de métricas directamente desde datos crudos
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Normalización de señal para análisis espectral
    const normalizedSignal = TensorUtils.normalizeInput(recentValues);
    
    // Calcular estimación base (rango saludable)
    let glucoseEstimate = 95;
    
    // Ajustar basado en características de la señal PPG
    if (amplitude > 0.2) {
      glucoseEstimate -= 5;
    } else if (amplitude < 0.1) {
      glucoseEstimate += 5;
    }
    
    // Ajuste basado en valor medio
    if (mean > 0.6) {
      glucoseEstimate += 3;
    } else if (mean < 0.4) {
      glucoseEstimate -= 3;
    }
    
    // Ajustar con factor de calibración
    const calibrationFactor = this.config.analysisSettings.glucoseCalibrationFactor || 1.0;
    glucoseEstimate = Math.round(glucoseEstimate * calibrationFactor);
    
    // Asegurar rango fisiológico
    glucoseEstimate = Math.max(70, Math.min(180, glucoseEstimate));
    
    // Actualizar estimación más reciente
    this.lastEstimate = glucoseEstimate;
    
    return glucoseEstimate;
  }
  
  /**
   * Actualiza el buffer de señal de forma eficiente
   */
  private updateBuffer(newValues: number[]): void {
    // Agregar nuevos valores y mantener tamaño controlado
    this.signalBuffer = [...this.signalBuffer, ...newValues].slice(-this.windowSize * 2);
  }
  
  /**
   * Método de compatibilidad
   */
  public estimate(ppgValues: number[]): number {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    super.reset();
    this.lastEstimate = 95;
    this.signalBuffer = [];
  }
}
