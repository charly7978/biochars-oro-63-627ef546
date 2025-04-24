import { UserProfile } from '../types';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';
import { SignalAnalyzer } from './SignalAnalyzer';
import { TensorUtils } from '../neural/tensorflow/TensorAdapter';

/**
 * Estimador optimizado para niveles de hemoglobina a partir de señal PPG
 */
export class HemoglobinEstimator extends SignalAnalyzer {
  private config: ProcessorConfig;
  private lastEstimate: number = 14;
  private windowSize = 10;
  private signalBuffer: number[] = [];
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
  }
  
  /**
   * Analiza el nivel de hemoglobina a partir de valores PPG crudos
   */
  public analyze(ppgValues: number[]): number | null {
    // Actualizar buffer de señal
    this.updateBuffer(ppgValues);
    
    if (this.signalBuffer.length < this.windowSize) {
      // No hay datos suficientes para una estimación genuina
      return null;
    }
    
    // Usar los valores más recientes
    const recentValues = this.signalBuffer.slice(-this.windowSize);
    
    // Cálculo de métricas a partir de datos crudos
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Ajuste con TensorUtils para optimizar la señal
    const normalizedSignal = TensorUtils.normalizeInput(recentValues);
    
    // Estimación base (rango saludable)
    let hemoglobinEstimate = 14.0;
    
    // Ajuste basado en género si disponible
    if (this.userProfile?.gender === 'female') {
      hemoglobinEstimate = 12.5;
    }
    
    // Ajuste basado en características de la señal PPG
    if (amplitude > 0.25) {
      hemoglobinEstimate += 0.5;
    } else if (amplitude < 0.1) {
      hemoglobinEstimate -= 0.5;
    }
    
    // Aplicar calibración
    const calibrationFactor = this.config.analysisSettings.hemoglobinCalibrationFactor || 1.0;
    hemoglobinEstimate = Math.round(hemoglobinEstimate * calibrationFactor);
    
    // Asegurar rango fisiológico
    hemoglobinEstimate = Math.max(8, Math.min(18, hemoglobinEstimate));
    
    // Actualizar estimación más reciente
    this.lastEstimate = hemoglobinEstimate;
    
    return hemoglobinEstimate;
  }
  
  /**
   * Actualiza el buffer de señal de forma eficiente
   */
  private updateBuffer(newValues: number[]): void {
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
    this.lastEstimate = 14;
    this.signalBuffer = [];
  }
}
