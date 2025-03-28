
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor de latidos/picos cardíacos de señales PPG
 * Se enfoca únicamente en la extracción de picos que representan latidos
 */
import { calculateMedian } from '../../modules/heart-beat/signal-filters';

// Configuración para la detección de picos
interface PeakDetectionConfig {
  minPeakDistance: number;      // Distancia mínima entre picos en ms
  minPeakHeight: number;        // Altura mínima para considerar un pico
  derivativeThreshold: number;  // Umbral para la derivada
  confidenceThreshold: number;  // Umbral de confianza para confirmar un pico
}

// Resultado de la extracción de latidos
export interface HeartbeatExtractionResult {
  hasPeak: boolean;                // Si se detectó un pico en este frame
  peakTime: number | null;         // Tiempo del pico detectado
  peakValue: number;               // Valor del pico
  confidence: number;              // Confianza en la detección (0-1)
  instantaneousBPM: number | null; // BPM instantáneo basado en tiempo entre picos
  rrInterval: number | null;       // Intervalo RR en ms
}

// Estado interno del extractor
interface ExtractorState {
  values: number[];               // Buffer de valores
  lastPeakTime: number | null;    // Tiempo del último pico detectado
  lastPeakValue: number | null;   // Valor del último pico
  peakCount: number;              // Contador de picos
  minValue: number;               // Valor mínimo detectado
  maxValue: number;               // Valor máximo detectado
  thresholdValue: number;         // Valor umbral dinámico
  rrIntervals: number[];          // Intervalos RR recientes
}

// Configuración predeterminada
const DEFAULT_CONFIG: PeakDetectionConfig = {
  minPeakDistance: 300,     // Mínimo 300ms entre picos (200 BPM máximo)
  minPeakHeight: 0.01,      // Altura mínima del pico
  derivativeThreshold: -0.001, // Umbral de derivada para detectar cambio de pendiente
  confidenceThreshold: 0.4  // Confianza mínima para reportar un pico
};

/**
 * Clase para extraer latidos cardíacos de una señal PPG
 * Enfocada únicamente en la detección de picos que representan latidos
 */
export class HeartbeatExtractor {
  private config: PeakDetectionConfig;
  private state: ExtractorState;
  private lastValues: number[] = [];
  private derivatives: number[] = [];
  
  constructor(config?: Partial<PeakDetectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Inicializar estado
    this.state = {
      values: [],
      lastPeakTime: null,
      lastPeakValue: null,
      peakCount: 0,
      minValue: Infinity,
      maxValue: -Infinity,
      thresholdValue: this.config.minPeakHeight,
      rrIntervals: []
    };
    
    this.lastValues = [];
    this.derivatives = [];
  }
  
  /**
   * Procesa un nuevo valor PPG y extrae información de latidos
   * @param value Valor PPG filtrado
   * @returns Resultado de la extracción con información de picos/latidos
   */
  public processValue(value: number): HeartbeatExtractionResult {
    const now = Date.now();
    
    // Actualizar buffer de valores
    this.state.values.push(value);
    if (this.state.values.length > 100) {
      this.state.values.shift();
    }
    
    // Actualizar valores min/max
    this.state.minValue = Math.min(this.state.minValue, value);
    this.state.maxValue = Math.max(this.state.maxValue, value);
    
    // Calcular derivada
    this.lastValues.push(value);
    if (this.lastValues.length > 3) {
      this.lastValues.shift();
    }
    
    let derivative = 0;
    if (this.lastValues.length >= 2) {
      derivative = this.lastValues[this.lastValues.length - 1] - this.lastValues[this.lastValues.length - 2];
    }
    
    this.derivatives.push(derivative);
    if (this.derivatives.length > 3) {
      this.derivatives.shift();
    }
    
    // Ajustar umbral dinámicamente (30% del rango)
    const range = this.state.maxValue - this.state.minValue;
    const dynamicThreshold = this.state.minValue + (range * 0.3);
    this.state.thresholdValue = Math.max(this.config.minPeakHeight, dynamicThreshold);
    
    // Verificar tiempo mínimo desde último pico
    const timeSinceLastPeak = this.state.lastPeakTime ? now - this.state.lastPeakTime : Infinity;
    const timeOk = timeSinceLastPeak > this.config.minPeakDistance;
    
    // Detectar pico basado en derivada y altura
    const valueAboveThreshold = value > this.state.thresholdValue;
    const derivativeChange = this.getSmoothedDerivative() < this.config.derivativeThreshold;
    
    let isPeak = false;
    let confidence = 0;
    let instantaneousBPM = null;
    let rrInterval = null;
    
    if (timeOk && valueAboveThreshold && derivativeChange) {
      isPeak = true;
      
      // Calcular confianza (combinación de altura y derivada)
      const heightConfidence = Math.min((value - this.state.thresholdValue) / (this.state.maxValue - this.state.thresholdValue), 1);
      const derivConfidence = Math.min(Math.abs(derivative) / 0.01, 1);
      confidence = (heightConfidence * 0.7) + (derivConfidence * 0.3);
      
      // Solo procesar picos con confianza suficiente
      if (confidence >= this.config.confidenceThreshold) {
        // Actualizar tiempos de pico
        const prevPeakTime = this.state.lastPeakTime;
        this.state.lastPeakTime = now;
        this.state.lastPeakValue = value;
        this.state.peakCount++;
        
        // Calcular intervalo RR y BPM
        if (prevPeakTime) {
          rrInterval = now - prevPeakTime;
          
          // Almacenar intervalo RR para análisis
          this.state.rrIntervals.push(rrInterval);
          if (this.state.rrIntervals.length > 8) {
            this.state.rrIntervals.shift();
          }
          
          // Calcular BPM instantáneo (60000ms / RR interval)
          if (rrInterval >= 300 && rrInterval <= 2000) { // 30-200 BPM
            instantaneousBPM = Math.round(60000 / rrInterval);
          }
        }
        
        console.log("HeartbeatExtractor: Pico detectado", {
          tiempo: new Date(now).toISOString(),
          valor: value,
          confianza: confidence,
          bpmInstantaneo: instantaneousBPM,
          intervaloRR: rrInterval
        });
      } else {
        // Pico de baja confianza
        isPeak = false;
      }
    }
    
    return {
      hasPeak: isPeak && confidence >= this.config.confidenceThreshold,
      peakTime: isPeak ? now : null,
      peakValue: value,
      confidence,
      instantaneousBPM,
      rrInterval
    };
  }
  
  /**
   * Obtiene la derivada suavizada para mejor detección
   */
  private getSmoothedDerivative(): number {
    if (this.derivatives.length === 0) return 0;
    return calculateMedian(this.derivatives);
  }
  
  /**
   * Obtiene el intervalo RR promedio de los últimos latidos
   */
  public getAverageRRInterval(): number | null {
    if (this.state.rrIntervals.length === 0) return null;
    
    // Eliminar valores atípicos
    const validIntervals = this.state.rrIntervals.filter(rr => 
      rr >= 300 && rr <= 2000 // 30-200 BPM
    );
    
    if (validIntervals.length === 0) return null;
    
    // Calcular promedio
    return validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
  }
  
  /**
   * Calcula el BPM promedio basado en los intervalos RR
   */
  public getAverageBPM(): number | null {
    const avgRR = this.getAverageRRInterval();
    if (avgRR === null) return null;
    
    return Math.round(60000 / avgRR);
  }
  
  /**
   * Obtiene la variabilidad del ritmo cardíaco
   */
  public getHeartRateVariability(): number | null {
    if (this.state.rrIntervals.length < 2) return null;
    
    // Calcular desviación estándar de intervalos RR
    const avg = this.state.rrIntervals.reduce((sum, val) => sum + val, 0) / this.state.rrIntervals.length;
    const squaredDiffs = this.state.rrIntervals.map(rr => Math.pow(rr - avg, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Reinicia el extractor
   */
  public reset(): void {
    this.state = {
      values: [],
      lastPeakTime: null,
      lastPeakValue: null,
      peakCount: 0,
      minValue: Infinity,
      maxValue: -Infinity,
      thresholdValue: this.config.minPeakHeight,
      rrIntervals: []
    };
    
    this.lastValues = [];
    this.derivatives = [];
  }
}

/**
 * Crea una instancia de extractor de latidos con configuración predeterminada
 */
export const createHeartbeatExtractor = (config?: Partial<PeakDetectionConfig>): HeartbeatExtractor => {
  return new HeartbeatExtractor(config);
};

/**
 * Extrae información de latidos de un valor PPG dado
 * (Función de utilidad para uso directo)
 */
export const extractHeartbeat = (
  value: number,
  extractor: HeartbeatExtractor
): HeartbeatExtractionResult => {
  return extractor.processValue(value);
};
