
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador avanzado de señal PPG
 * Se encarga del procesamiento especializado de señales PPG
 */
import { ProcessedPPGSignal, SignalProcessor, SignalProcessingOptions } from './types';
import { detectFingerPresence } from './utils/finger-detector';
import { evaluateSignalQuality } from './utils/quality-detector';
import { normalizeSignal, amplifySignal } from './utils/signal-normalizer';

/**
 * Clase para el procesamiento avanzado de señales PPG
 */
export class PPGSignalProcessor implements SignalProcessor<ProcessedPPGSignal> {
  // Buffer de valores para análisis
  private readonly VALUES_BUFFER_SIZE = 30;
  private valuesBuffer: number[] = [];
  
  // Buffer de valores filtrados
  private filteredBuffer: number[] = [];
  
  // Configuración del procesador
  private amplificationFactor: number = 1.2;
  private filterStrength: number = 0.25;
  private qualityThreshold: number = 30;
  private fingerDetectionSensitivity: number = 0.6;
  
  /**
   * Procesa una señal PPG y aplica algoritmos avanzados
   */
  public processSignal(value: number): ProcessedPPGSignal {
    const timestamp = Date.now();
    
    // Almacenar valor bruto en buffer
    this.valuesBuffer.push(value);
    if (this.valuesBuffer.length > this.VALUES_BUFFER_SIZE) {
      this.valuesBuffer.shift();
    }
    
    // Aplicar filtrado adaptativo
    const filteredValue = this.applyAdaptiveFilter(value);
    
    // Añadir a buffer de filtrados
    this.filteredBuffer.push(filteredValue);
    if (this.filteredBuffer.length > this.VALUES_BUFFER_SIZE) {
      this.filteredBuffer.shift();
    }
    
    // Normalizar señal
    const normalizedValue = normalizeSignal(filteredValue, this.filteredBuffer);
    
    // Amplificar señal
    const amplifiedValue = amplifySignal(normalizedValue, this.amplificationFactor);
    
    // Detección de dedo basada en patrones de señal
    const fingerDetected = detectFingerPresence(
      this.filteredBuffer,
      this.fingerDetectionSensitivity
    );
    
    // Evaluación de calidad de señal
    const quality = evaluateSignalQuality(
      value,
      filteredValue,
      this.filteredBuffer,
      this.qualityThreshold
    );
    
    // Calcular fuerza de señal
    const signalStrength = this.calculateSignalStrength();
    
    return {
      timestamp,
      rawValue: value,
      filteredValue,
      normalizedValue,
      amplifiedValue,
      quality,
      fingerDetected,
      signalStrength
    };
  }
  
  /**
   * Aplica un filtro adaptativo que se ajusta según características de la señal
   */
  private applyAdaptiveFilter(value: number): number {
    if (this.valuesBuffer.length < 3) return value;
    
    // Calcular variabilidad reciente
    const recent = this.valuesBuffer.slice(-5);
    const variance = this.calculateVariance(recent);
    
    // Ajustar fuerza de filtrado según varianza
    const adaptiveAlpha = this.adjustFilterStrength(variance);
    
    // Aplicar filtro exponencial con alfa adaptativo
    const lastFiltered = this.filteredBuffer.length > 0 
      ? this.filteredBuffer[this.filteredBuffer.length - 1] 
      : value;
      
    return adaptiveAlpha * value + (1 - adaptiveAlpha) * lastFiltered;
  }
  
  /**
   * Ajusta la fuerza del filtrado según la varianza
   */
  private adjustFilterStrength(variance: number): number {
    // Si la varianza es alta (señal ruidosa), filtrar más fuerte
    if (variance > 0.05) return Math.min(0.15, this.filterStrength / 2);
    
    // Si la varianza es baja (señal estable), filtrar más suave
    if (variance < 0.01) return Math.min(0.4, this.filterStrength * 1.5);
    
    // Caso intermedio
    return this.filterStrength;
  }
  
  /**
   * Calcula la varianza de un conjunto de valores
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
  
  /**
   * Calcula la fuerza de la señal basada en amplitud
   */
  private calculateSignalStrength(): number {
    if (this.filteredBuffer.length < 5) return 0;
    
    const recentFiltered = this.filteredBuffer.slice(-10);
    const min = Math.min(...recentFiltered);
    const max = Math.max(...recentFiltered);
    const amplitude = max - min;
    
    // Normalizar a un rango 0-100
    return Math.min(100, Math.max(0, amplitude * 100));
  }
  
  /**
   * Configura el procesador con opciones personalizadas
   */
  public configure(options: SignalProcessingOptions): void {
    if (options.amplificationFactor !== undefined) {
      this.amplificationFactor = options.amplificationFactor;
    }
    
    if (options.filterStrength !== undefined) {
      this.filterStrength = options.filterStrength;
    }
    
    if (options.qualityThreshold !== undefined) {
      this.qualityThreshold = options.qualityThreshold;
    }
    
    if (options.fingerDetectionSensitivity !== undefined) {
      this.fingerDetectionSensitivity = options.fingerDetectionSensitivity;
    }
  }
  
  /**
   * Reinicia el procesador y todos sus buffers
   */
  public reset(): void {
    this.valuesBuffer = [];
    this.filteredBuffer = [];
  }
}

/**
 * Crea una nueva instancia del procesador de señal PPG
 */
export function createPPGSignalProcessor(): PPGSignalProcessor {
  return new PPGSignalProcessor();
}
