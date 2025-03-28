
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor de señal PPG
 * Se enfoca únicamente en la extracción y preprocesamiento de la señal PPG
 */
import { applyMedianFilter, applyMovingAverageFilter, applyEMAFilter } from '../../modules/heart-beat/signal-filters';

// Configuración para la extracción de señal PPG
interface PPGExtractionConfig {
  medianFilterSize: number;   // Tamaño del filtro de mediana
  movingAvgFilterSize: number; // Tamaño del filtro de media móvil
  emaAlpha: number;           // Factor alfa para EMA
  qualityThreshold: number;   // Umbral de calidad mínimo
  minAmplitude: number;       // Amplitud mínima para considerar señal válida
}

// Resultado de la extracción de señal PPG
export interface PPGSignalExtractionResult {
  rawValue: number;           // Valor original sin procesar
  filteredValue: number;      // Valor filtrado
  quality: number;            // Calidad de la señal (0-100)
  fingerDetected: boolean;    // Si se detecta un dedo sobre el sensor
  amplitude: number;          // Amplitud de la señal (máx-mín)
  baseline: number;           // Línea base de la señal
  timestamp: number;          // Marca de tiempo
}

// Estado interno del extractor
interface SignalExtractorState {
  rawValues: number[];        // Valores originales
  filteredValues: number[];   // Valores filtrados
  medianBuffer: number[];     // Buffer para filtro de mediana
  movingAvgBuffer: number[];  // Buffer para filtro de media móvil
  lastFilteredValue: number;  // Último valor filtrado
  noiseLevel: number;         // Nivel de ruido estimado
  minValue: number;           // Valor mínimo reciente
  maxValue: number;           // Valor máximo reciente
  fingerDetectionStartTime: number | null; // Tiempo de inicio de detección de dedo
  fingerConfirmed: boolean;   // Si la detección de dedo está confirmada
}

// Configuración predeterminada
const DEFAULT_CONFIG: PPGExtractionConfig = {
  medianFilterSize: 5,
  movingAvgFilterSize: 10,
  emaAlpha: 0.3,
  qualityThreshold: 40,
  minAmplitude: 0.02
};

/**
 * Clase para extraer y preprocesar señales PPG
 * Enfocada únicamente en la calidad y procesamiento de la señal
 */
export class PPGSignalExtractor {
  private config: PPGExtractionConfig;
  private state: SignalExtractorState;
  private readonly MIN_FINGER_CONFIRMATION_TIME = 1000; // Tiempo mínimo para confirmar dedo (ms)
  
  constructor(config?: Partial<PPGExtractionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Inicializar estado
    this.state = {
      rawValues: [],
      filteredValues: [],
      medianBuffer: [],
      movingAvgBuffer: [],
      lastFilteredValue: 0,
      noiseLevel: 1,
      minValue: Infinity,
      maxValue: -Infinity,
      fingerDetectionStartTime: null,
      fingerConfirmed: false
    };
  }
  
  /**
   * Procesa un nuevo valor PPG y extrae información de la señal
   * @param value Valor PPG sin procesar
   * @returns Resultado con la señal procesada y métricas
   */
  public processValue(value: number): PPGSignalExtractionResult {
    const now = Date.now();
    
    // Almacenar valor original
    this.state.rawValues.push(value);
    if (this.state.rawValues.length > 100) {
      this.state.rawValues.shift();
    }
    
    // Aplicar filtros en cascada
    const medianFiltered = applyMedianFilter(value, this.state.medianBuffer, this.config.medianFilterSize);
    this.state.medianBuffer.push(value);
    if (this.state.medianBuffer.length > this.config.medianFilterSize) {
      this.state.medianBuffer.shift();
    }
    
    const movingAvgFiltered = applyMovingAverageFilter(medianFiltered, this.state.movingAvgBuffer, this.config.movingAvgFilterSize);
    this.state.movingAvgBuffer.push(medianFiltered);
    if (this.state.movingAvgBuffer.length > this.config.movingAvgFilterSize) {
      this.state.movingAvgBuffer.shift();
    }
    
    const emaFiltered = applyEMAFilter(movingAvgFiltered, this.state.lastFilteredValue, this.config.emaAlpha);
    this.state.lastFilteredValue = emaFiltered;
    
    // Actualizar valores filtrados
    this.state.filteredValues.push(emaFiltered);
    if (this.state.filteredValues.length > 100) {
      this.state.filteredValues.shift();
    }
    
    // Actualizar valores min/max
    if (this.state.filteredValues.length > 10) {
      const recent = this.state.filteredValues.slice(-20);
      this.state.minValue = Math.min(...recent);
      this.state.maxValue = Math.max(...recent);
    }
    
    // Calcular amplitud
    const amplitude = this.state.maxValue - this.state.minValue;
    
    // Estimar ruido (variación de alta frecuencia)
    if (this.state.filteredValues.length > 3) {
      const last = this.state.filteredValues.slice(-3);
      const deltas = [Math.abs(last[1] - last[0]), Math.abs(last[2] - last[1])];
      const avgDelta = (deltas[0] + deltas[1]) / 2;
      
      // Actualizar nivel de ruido con suavizado
      this.state.noiseLevel = this.state.noiseLevel * 0.9 + avgDelta * 0.1;
    }
    
    // Calcular calidad de señal
    const signalToNoise = amplitude / (this.state.noiseLevel + 0.0001);
    const rawQuality = Math.min(Math.max(signalToNoise * 50, 0), 100);
    
    // Afinar calidad según amplitud
    let quality = rawQuality;
    if (amplitude < this.config.minAmplitude) {
      quality *= (amplitude / this.config.minAmplitude);
    }
    
    // Detección de dedo
    const hasSignalQuality = quality >= this.config.qualityThreshold;
    const hasAmplitude = amplitude >= this.config.minAmplitude;
    let fingerDetected = false;
    
    if (hasSignalQuality && hasAmplitude) {
      // Iniciar detección de dedo si no estaba iniciada
      if (!this.state.fingerDetectionStartTime) {
        this.state.fingerDetectionStartTime = now;
      }
      
      // Confirmar dedo si ha pasado tiempo suficiente
      if (!this.state.fingerConfirmed && this.state.fingerDetectionStartTime &&
          (now - this.state.fingerDetectionStartTime) >= this.MIN_FINGER_CONFIRMATION_TIME) {
        this.state.fingerConfirmed = true;
        console.log("PPGSignalExtractor: Dedo confirmado", {
          tiempo: new Date(now).toISOString(),
          calidad: quality,
          amplitud: amplitude
        });
      }
      
      fingerDetected = true;
    } else if (!hasSignalQuality || !hasAmplitude) {
      // Reiniciar detección de dedo
      if (this.state.fingerConfirmed) {
        console.log("PPGSignalExtractor: Dedo perdido", {
          calidad: quality,
          amplitud: amplitude,
          umbralCalidad: this.config.qualityThreshold,
          umbralAmplitud: this.config.minAmplitude
        });
      }
      
      this.state.fingerDetectionStartTime = null;
      fingerDetected = false;
      
      // Mantener dedo confirmado por un tiempo para evitar falsos negativos
      if (this.state.fingerConfirmed) {
        fingerDetected = true;
        
        // Si la señal sigue siendo muy mala por un tiempo, entonces sí resetear
        if (quality < this.config.qualityThreshold * 0.5 || amplitude < this.config.minAmplitude * 0.5) {
          this.state.fingerConfirmed = false;
        }
      }
    }
    
    // Calcular línea base (promedio)
    const baseline = this.state.filteredValues.reduce((sum, val) => sum + val, 0) / 
                   Math.max(1, this.state.filteredValues.length);
    
    return {
      rawValue: value,
      filteredValue: emaFiltered,
      quality,
      fingerDetected: fingerDetected || this.state.fingerConfirmed,
      amplitude,
      baseline,
      timestamp: now
    };
  }
  
  /**
   * Obtiene el buffer de valores filtrados
   */
  public getFilteredValues(): number[] {
    return [...this.state.filteredValues];
  }
  
  /**
   * Obtiene la amplitud actual de la señal
   */
  public getAmplitude(): number {
    return this.state.maxValue - this.state.minValue;
  }
  
  /**
   * Obtiene el nivel de ruido estimado
   */
  public getNoiseLevel(): number {
    return this.state.noiseLevel;
  }
  
  /**
   * Reinicia el extractor
   */
  public reset(): void {
    this.state = {
      rawValues: [],
      filteredValues: [],
      medianBuffer: [],
      movingAvgBuffer: [],
      lastFilteredValue: 0,
      noiseLevel: 1,
      minValue: Infinity,
      maxValue: -Infinity,
      fingerDetectionStartTime: null,
      fingerConfirmed: false
    };
  }
}

/**
 * Crea una instancia de extractor de señal PPG con configuración predeterminada
 */
export const createPPGSignalExtractor = (config?: Partial<PPGExtractionConfig>): PPGSignalExtractor => {
  return new PPGSignalExtractor(config);
};

/**
 * Extrae información de señal PPG de un valor dado
 * (Función de utilidad para uso directo)
 */
export const extractPPGSignal = (
  value: number,
  extractor: PPGSignalExtractor
): PPGSignalExtractionResult => {
  return extractor.processValue(value);
};
