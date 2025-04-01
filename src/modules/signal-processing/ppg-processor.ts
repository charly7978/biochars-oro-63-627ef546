
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador avanzado de señal PPG
 * Se encarga del procesamiento especializado de señales PPG
 */
import { ProcessedPPGSignal, SignalProcessor, SignalProcessingOptions } from './types';
import { detectFingerPresence, evaluateFingerDetectionConfidence } from './utils/finger-detector';
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
  
  // Variables de estado para detección de picos
  private peakBuffer: number[] = [];
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private arrhythmiaCounter: number = 0;
  
  // Configuración del procesador
  private amplificationFactor: number = 1.5; // AUMENTADO para captar señales más débiles
  private filterStrength: number = 0.25;
  private qualityThreshold: number = 30;
  private fingerDetectionSensitivity: number = 0.6;
  private peakDetectionThreshold: number = 0.15; // REDUCIDO para mejor sensibilidad
  
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
    
    // Amplificar señal - AUMENTO SIGNIFICATIVO
    const amplifiedValue = amplifySignal(normalizedValue, this.amplificationFactor);
    
    // Almacenar amplificada para detección de picos
    this.peakBuffer.push(amplifiedValue);
    if (this.peakBuffer.length > 5) {
      this.peakBuffer.shift();
    }
    
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
    
    // Detección de pico cardíaco
    const isPeak = this.detectPeak(amplifiedValue);
    const peakConfidence = isPeak ? Math.min(quality / 100, 0.9) : 0;
    
    // Cálculo de BPM e intervalo RR
    let instantaneousBPM = 0;
    let rrInterval: number | null = null;
    
    if (isPeak) {
      const now = Date.now();
      
      if (this.lastPeakTime !== null) {
        // Calcular intervalo RR en ms
        rrInterval = now - this.lastPeakTime;
        
        // Calcular BPM instantáneo
        if (rrInterval > 0) {
          instantaneousBPM = Math.round(60000 / rrInterval);
          
          // Validar BPM en rango fisiológico
          if (instantaneousBPM >= 40 && instantaneousBPM <= 200) {
            // Guardar intervalo para análisis
            this.rrIntervals.push(rrInterval);
            if (this.rrIntervals.length > 10) {
              this.rrIntervals.shift();
            }
            
            // Detectar posible arritmia
            if (this.rrIntervals.length >= 3) {
              if (this.detectArrhythmia()) {
                this.arrhythmiaCounter++;
              }
            }
          } else {
            console.log("PPGProcessor: BPM fuera de rango fisiológico:", instantaneousBPM);
          }
        }
      }
      
      this.lastPeakTime = now;
    }
    
    // Calcular variabilidad cardíaca si hay suficientes datos
    let heartRateVariability: number | undefined;
    if (this.rrIntervals.length >= 3) {
      heartRateVariability = this.calculateHRV();
    }
    
    // Loggear diagnóstico si la calidad es buena pero no detecta picos
    if (quality > 60 && fingerDetected && signalStrength > 20 && !isPeak) {
      console.log("ALERTA PPG: Calidad buena pero no se detectan picos", {
        calidad: quality,
        dedoDetectado: fingerDetected, 
        fuerzaSeñal: signalStrength,
        valorAmplificado: amplifiedValue,
        umbralPico: this.peakDetectionThreshold
      });
    }
    
    return {
      timestamp,
      rawValue: value,
      filteredValue,
      normalizedValue,
      amplifiedValue,
      isPeak,
      peakConfidence,
      instantaneousBPM,
      rrInterval,
      quality,
      fingerDetected,
      signalStrength,
      arrhythmiaCount: this.arrhythmiaCounter,
      heartRateVariability
    };
  }
  
  /**
   * Detecta un pico cardíaco en la señal
   */
  private detectPeak(value: number): boolean {
    if (this.peakBuffer.length < 3) return false;
    
    // Algoritmo simple: detectar si el valor actual es mayor que los 2 anteriores
    // y supera el umbral mínimo
    const current = this.peakBuffer[this.peakBuffer.length - 1];
    const prev1 = this.peakBuffer[this.peakBuffer.length - 2];
    const prev2 = this.peakBuffer[this.peakBuffer.length - 3];
    
    // Comprobar si hay un pico (más sensible ahora)
    const isPeak = current > this.peakDetectionThreshold && 
                   current > prev1 && 
                   prev1 > prev2 &&
                   // Prevenir múltiples picos muy cercanos
                   (this.lastPeakTime === null || 
                    Date.now() - this.lastPeakTime > 300);
    
    if (isPeak) {
      console.log("PPGProcessor: Pico detectado", { 
        valor: current, 
        umbral: this.peakDetectionThreshold 
      });
    }
    
    return isPeak;
  }
  
  /**
   * Detecta posible arritmia basada en intervalos RR
   */
  private detectArrhythmia(): boolean {
    if (this.rrIntervals.length < 3) return false;
    
    // Obtener últimos intervalos
    const intervals = this.rrIntervals.slice(-3);
    
    // Calcular promedio y variabilidad
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variations = intervals.map(interval => Math.abs(interval - avg) / avg);
    
    // Si hay variabilidad alta, posible arritmia
    return Math.max(...variations) > 0.2;
  }
  
  /**
   * Calcular métrica HRV (RMSSD)
   */
  private calculateHRV(): number {
    if (this.rrIntervals.length < 3) return 0;
    
    // Calcular diferencias sucesivas
    let sumSquaredDiff = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i - 1];
      sumSquaredDiff += diff * diff;
    }
    
    // Raíz cuadrada del promedio
    return Math.sqrt(sumSquaredDiff / (this.rrIntervals.length - 1));
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
    if (variance < 0.01) return Math.min(0.5, this.filterStrength * 2.0); // Aumentado para ser más sensible
    
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
    
    // Normalizar a un rango 0-100 - MÁS SENSIBLE A CAMBIOS PEQUEÑOS
    return Math.min(100, Math.max(0, amplitude * 150)); // Aumentado de 100 a 150
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
    
    if (options.peakDetectionThreshold !== undefined) {
      this.peakDetectionThreshold = options.peakDetectionThreshold;
    }
    
    console.log("PPGProcessor: Configuración actualizada", {
      amplificación: this.amplificationFactor,
      filtroPotencia: this.filterStrength,
      umbralCalidad: this.qualityThreshold,
      sensibilidadDedo: this.fingerDetectionSensitivity,
      umbralPico: this.peakDetectionThreshold
    });
  }
  
  /**
   * Reinicia el procesador y todos sus buffers
   */
  public reset(): void {
    this.valuesBuffer = [];
    this.filteredBuffer = [];
    this.peakBuffer = [];
    this.lastPeakTime = null;
    this.rrIntervals = [];
    console.log("PPGProcessor: Estado reseteado completamente");
  }
}

/**
 * Crea una nueva instancia del procesador de señal PPG
 */
export function createPPGSignalProcessor(): PPGSignalProcessor {
  return new PPGSignalProcessor();
}
