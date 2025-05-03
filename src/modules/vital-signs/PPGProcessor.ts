/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador de señales PPG con OpenCV.js
 * Utiliza procesamiento avanzado de señales para extraer información fisiológica real
 */

import OpenCV, { 
  waitForOpenCV, 
  isOpenCVAvailable,
  findMinValue,
  findMaxValue
} from '../../opencv/opencv-wrapper';

// Tipos para estructura de datos PPG
export interface PPGRawData {
  timestamp: number;
  value: number;
}

export interface PPGProcessedResult {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  heartRate: number;
  confidence: number;
  quality: number;
  peaks: number[];
  valleys: number[];
  perfusionIndex: number;
}

// Configuración del procesador
interface PPGProcessorConfig {
  sampleRate: number;
  bufferSize: number;
  medianFilterSize: number;
  gaussianFilterSize: number;
  minHeartRate: number;
  maxHeartRate: number;
}

// Procesador principal
export class PPGProcessor {
  private config: PPGProcessorConfig;
  private buffer: PPGRawData[] = [];
  private initialized: boolean = false;
  private lastResult: PPGProcessedResult | null = null;
  private openCVReady: boolean = false;
  
  // Default config
  private readonly DEFAULT_CONFIG: PPGProcessorConfig = {
    sampleRate: 30,          // Hz
    bufferSize: 150,         // Muestras (~5 segundos a 30Hz)
    medianFilterSize: 5,     // 5 muestras
    gaussianFilterSize: 7,   // 7 muestras
    minHeartRate: 40,        // BPM
    maxHeartRate: 180        // BPM
  };
  
  constructor(config: Partial<PPGProcessorConfig> = {}) {
    // Mezclar configuración personalizada con valores por defecto
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    
    // Inicializar OpenCV
    this.init();
  }
  
  /**
   * Inicializa el procesador y OpenCV
   */
  private async init(): Promise<void> {
    try {
      if (!isOpenCVAvailable()) {
        await waitForOpenCV();
      }
      this.openCVReady = true;
      this.initialized = true;
      console.log('PPGProcessor: OpenCV inicializado correctamente');
    } catch (error) {
      console.error('PPGProcessor: Error inicializando OpenCV', error);
      this.openCVReady = false;
    }
  }
  
  /**
   * Procesa un nuevo valor de señal PPG
   */
  public async processValue(value: number): Promise<PPGProcessedResult | null> {
    // Esperar inicialización
    if (!this.initialized) {
      if (!this.openCVReady) {
        try {
          await this.init();
        } catch (error) {
          console.error('PPGProcessor: No se pudo inicializar OpenCV', error);
          return null;
        }
      }
    }
    
    // Timestamp actual
    const timestamp = Date.now();
    
    // Agregar valor al buffer
    this.buffer.push({ timestamp, value });
    
    // Mantener tamaño del buffer
    if (this.buffer.length > this.config.bufferSize) {
      this.buffer.shift();
    }
    
    // Si no hay suficientes datos, no procesar
    if (this.buffer.length < 30) {
      return null;
    }
    
    // Extraer valores para procesamiento
    const rawValues = this.buffer.map(item => item.value);
    
    try {
      // Procesar señal con OpenCV
      const processedSignal = await OpenCV.processPPGSignal(rawValues);
      const { filteredSignal, peaks, valleys, amplitude, quality } = processedSignal;
      
      // Extraer características avanzadas
      const features = await OpenCV.extractPPGFeatures(filteredSignal, this.config.sampleRate);
      const { heartRate, perfusionIndex, signalQuality } = features;
      
      // Calcular confianza basada en calidad
      const confidence = quality / 100;
      
      // Generar resultado
      const result: PPGProcessedResult = {
        timestamp,
        rawValue: value,
        filteredValue: filteredSignal[filteredSignal.length - 1],
        heartRate,
        confidence,
        quality: signalQuality,
        peaks,
        valleys,
        perfusionIndex
      };
      
      // Almacenar último resultado
      this.lastResult = result;
      
      return result;
    } catch (error) {
      console.error('PPGProcessor: Error procesando señal', error);
      return this.lastResult;
    }
  }
  
  /**
   * Reset del procesador
   */
  public reset(): void {
    this.buffer = [];
    this.lastResult = null;
    console.log('PPGProcessor: Reset completo');
  }
  
  /**
   * Obtiene características de la señal actual
   */
  public async getSignalStats(): Promise<{
    min: number;
    max: number;
    range: number;
    perfusionIndex: number;
    quality: number;
  }> {
    if (this.buffer.length < 30) {
      return {
        min: 0,
        max: 0,
        range: 0,
        perfusionIndex: 0,
        quality: 0
      };
    }
    
    const values = this.buffer.map(item => item.value);
    const min = findMinValue(values);
    const max = findMaxValue(values);
    const range = max - min;
    
    // Usar último resultado si existe, de lo contrario calcular
    const perfusionIndex = this.lastResult?.perfusionIndex || 0;
    const quality = this.lastResult?.quality || 0;
    
    return {
      min,
      max,
      range,
      perfusionIndex,
      quality
    };
  }
  
  /**
   * Obtener último resultado procesado
   */
  public getLastResult(): PPGProcessedResult | null {
    return this.lastResult;
  }
  
  /**
   * Verifica si el procesador está listo
   */
  public isReady(): boolean {
    return this.initialized && this.openCVReady;
  }
  
  /**
   * Obtener configuración actual
   */
  public getConfig(): PPGProcessorConfig {
    return { ...this.config };
  }
  
  /**
   * Actualizar configuración
   */
  public updateConfig(newConfig: Partial<PPGProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default PPGProcessor; 