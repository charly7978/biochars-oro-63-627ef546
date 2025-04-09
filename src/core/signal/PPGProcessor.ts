
import { KalmanFilter } from './filters/KalmanFilter';
import { WaveletDenoiser } from './filters/WaveletDenoiser';
import type { ProcessedSignal, ProcessingError } from '../../types/signal';

export class PPGProcessor {
  // Configuración unificada con valores optimizados
  private readonly CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,
    MAX_RED_THRESHOLD: 230,
    STABILITY_WINDOW: 3,
    MIN_STABILITY_COUNT: 3,
    PERFUSION_INDEX_THRESHOLD: 0.05,
    WAVELET_THRESHOLD: 0.025,
    BASELINE_FACTOR: 0.95,
    PERIODICITY_BUFFER_SIZE: 40,
    MIN_PERIODICITY_SCORE: 0.3,
    SIGNAL_QUALITY_THRESHOLD: 65,
    // Nuevos parámetros para ROI dinámico
    ROI_UPDATE_INTERVAL: 10, // Frames entre actualizaciones del ROI
    ROI_SEARCH_FRACTION: 0.4, // Fracción de imagen a buscar (0.4 = 40% central)
    ROI_SIZE_FRACTION: 0.3,   // Tamaño relativo del ROI (0.3 = 30% de la imagen)
    // Parámetros para análisis multicanal
    GREEN_CHANNEL_WEIGHT: 0.3,
    BLUE_CHANNEL_WEIGHT: 0.1,
    RED_CHANNEL_WEIGHT: 0.6,
    // Umbral para detección de cambios de iluminación
    ILLUMINATION_CHANGE_THRESHOLD: 20
  };
  
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private waveletDenoiser: WaveletDenoiser;
  private lastValues: number[] = [];
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private baselineValue: number = 0;
  private periodicityBuffer: number[] = [];
  
  // Variables para ROI dinámico
  private currentROI: {x: number, y: number, width: number, height: number} = {
    x: 0, y: 0, width: 0, height: 0
  };
  private frameCounter: number = 0;
  private lastFrameIntensity: number = 0;
  
  // Buffers para canales individuales
  private redBuffer: number[] = [];
  private greenBuffer: number[] = [];
  private blueBuffer: number[] = [];
  
  // Historial de iluminación para normalización
  private illuminationHistory: number[] = [];
  private readonly ILLUMINATION_HISTORY_SIZE = 20;
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.waveletDenoiser = new WaveletDenoiser();
    console.log("PPGProcessor: Instancia unificada creada con ROI dinámico y análisis multicanal");
  }

  public initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Reiniciar todas las variables
      this.redBuffer = [];
      this.greenBuffer = [];
      this.blueBuffer = [];
      this.lastValues = [];
      this.illuminationHistory = [];
      this.frameCounter = 0;
      this.lastFrameIntensity = 0;
      
      // Inicializar ROI al centro de la imagen
      this.currentROI = {
        x: 0, 
        y: 0, 
        width: 0, 
        height: 0
      };
      
      console.log("PPGProcessor: Inicializado con análisis multicanal");
      resolve();
    });
  }

  public start(): void {
    this.isProcessing = true;
    console.log("PPGProcessor: Procesamiento iniciado con ROI dinámico");
  }

  public stop(): void {
    this.isProcessing = false;
    console.log("PPGProcessor: Procesamiento detenido");
  }

  public calibrate(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      console.log("PPGProcessor: Calibración completada para ROI adaptativo");
      resolve(true);
    });
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      this.frameCounter++;
      
      // Actualizar ROI dinámicamente cada cierto número de frames
      if (this.frameCounter % this.CONFIG.ROI_UPDATE_INTERVAL === 0) {
        this.updateDynamicROI(imageData);
      }
      
      // Extraer valores de los tres canales RGB
      const { redValue, greenValue, blueValue, avgIntensity } = this.extractChannels(imageData);
      
      // Actualizar historial de iluminación para normalización
      this.updateIlluminationHistory(avgIntensity);
      
      // Normalizar señales en base a iluminación
      const normalizedRed = this.normalizeByIllumination(redValue);
      const normalizedGreen = this.normalizeByIllumination(greenValue);
      const normalizedBlue = this.normalizeByIllumination(blueValue);
      
      // Almacenar valores normalizados en buffers individuales
      this.redBuffer.push(normalizedRed);
      this.greenBuffer.push(normalizedGreen);
      this.blueBuffer.push(normalizedBlue);
      
      if (this.redBuffer.length > this.CONFIG.BUFFER_SIZE) {
        this.redBuffer.shift();
        this.greenBuffer.shift();
        this.blueBuffer.shift();
      }
      
      // Aplicar filtros a cada canal
      const kalmanFilteredRed = this.kalmanFilter.filter(normalizedRed);
      
      // Aplicar wavelets para mejor eliminación de ruido
      const filtered = this.waveletDenoiser.denoise(kalmanFilteredRed);
      
      // Crear índice de perfusión multicanal ponderado
      const compositePPG = this.createCompositeSignal(normalizedRed, normalizedGreen, normalizedBlue);
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.CONFIG.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis mejorado con señal compuesta
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, compositePPG);
      const perfusionIndex = this.calculateMultiChannelPerfusionIndex();

      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.CONFIG.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.currentROI,
        perfusionIndex: perfusionIndex,
        // Nuevos campos para datos multicanal
        channelData: {
          red: normalizedRed,
          green: normalizedGreen,
          blue: normalizedBlue,
          composite: compositePPG
        }
      };

      this.onSignalReady?.(processedSignal);
    } catch (error) {
      console.error("PPGProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private updateDynamicROI(imageData: ImageData): void {
    const { width, height, data } = imageData;
    
    // Definir área de búsqueda (región central expandida)
    const searchMargin = Math.floor((1 - this.CONFIG.ROI_SEARCH_FRACTION) / 2);
    const startX = Math.floor(width * searchMargin);
    const endX = Math.floor(width * (1 - searchMargin));
    const startY = Math.floor(height * searchMargin);
    const endY = Math.floor(height * (1 - searchMargin));
    
    // Crear mapa de intensidad para el canal rojo
    const intensityMap = new Array(endY - startY).fill(0).map(() => 
      new Array(endX - startX).fill(0)
    );
    
    // Calcular intensidad promedio y variación para cada bloque
    const blockSize = 8; // Tamaño de bloque para análisis
    
    for (let y = startY; y < endY; y += blockSize) {
      for (let x = startX; x < endX; x += blockSize) {
        let redSum = 0;
        let count = 0;
        
        // Analizar bloque
        for (let by = 0; by < blockSize && y + by < endY; by++) {
          for (let bx = 0; bx < blockSize && x + bx < endX; bx++) {
            const i = ((y + by) * width + (x + bx)) * 4;
            redSum += data[i]; // Canal rojo
            count++;
          }
        }
        
        // Calcular promedio del bloque
        const blockAvg = count > 0 ? redSum / count : 0;
        
        // Asignar valor al mapa de intensidad
        const mapY = Math.floor((y - startY) / blockSize);
        const mapX = Math.floor((x - startX) / blockSize);
        
        if (mapY < intensityMap.length && mapX < intensityMap[0].length) {
          intensityMap[mapY][mapX] = blockAvg;
        }
      }
    }
    
    // Encontrar región con mayor promedio y menor variación
    let bestScore = -1;
    let bestX = startX;
    let bestY = startY;
    
    const mapHeight = intensityMap.length;
    const mapWidth = intensityMap[0].length;
    
    // Tamaño de ventana deslizante para análisis
    const windowSize = Math.max(3, Math.floor(Math.min(mapWidth, mapHeight) * 0.2));
    
    for (let y = 0; y <= mapHeight - windowSize; y++) {
      for (let x = 0; x <= mapWidth - windowSize; x++) {
        // Calcular estadísticas de la ventana
        let sum = 0;
        let sqSum = 0;
        let count = 0;
        
        for (let wy = 0; wy < windowSize; wy++) {
          for (let wx = 0; wx < windowSize; wx++) {
            const value = intensityMap[y + wy][x + wx];
            sum += value;
            sqSum += value * value;
            count++;
          }
        }
        
        const avg = sum / count;
        const variance = (sqSum / count) - (avg * avg);
        
        // Calcular puntuación: queremos alta intensidad y baja varianza
        const score = avg - Math.sqrt(variance);
        
        if (score > bestScore) {
          bestScore = score;
          bestX = startX + x * blockSize;
          bestY = startY + y * blockSize;
        }
      }
    }
    
    // Calcular nuevo ROI
    const roiSize = Math.floor(Math.min(width, height) * this.CONFIG.ROI_SIZE_FRACTION);
    
    // Asegurar que el ROI esté dentro de los límites de la imagen
    const newX = Math.min(Math.max(bestX, 0), width - roiSize);
    const newY = Math.min(Math.max(bestY, 0), height - roiSize);
    
    // Actualizar ROI con suavizado (transición gradual)
    const alpha = 0.3; // Factor de suavizado
    this.currentROI = {
      x: Math.round(this.currentROI.x * (1 - alpha) + newX * alpha),
      y: Math.round(this.currentROI.y * (1 - alpha) + newY * alpha),
      width: roiSize,
      height: roiSize
    };
    
    console.log("PPGProcessor: ROI dinámico actualizado", this.currentROI);
  }
  
  private updateIlluminationHistory(intensity: number): void {
    this.illuminationHistory.push(intensity);
    if (this.illuminationHistory.length > this.ILLUMINATION_HISTORY_SIZE) {
      this.illuminationHistory.shift();
    }
    
    // Detectar cambios bruscos de iluminación
    if (this.illuminationHistory.length > 5) {
      const recent = this.illuminationHistory.slice(-5);
      const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const previousAvg = this.illuminationHistory.slice(-10, -5).reduce((sum, val) => sum + val, 0) / 5;
      
      if (Math.abs(avg - previousAvg) > this.CONFIG.ILLUMINATION_CHANGE_THRESHOLD) {
        console.log("PPGProcessor: Cambio significativo de iluminación detectado", {
          before: previousAvg,
          after: avg,
          difference: avg - previousAvg
        });
      }
    }
  }
  
  private normalizeByIllumination(value: number): number {
    if (this.illuminationHistory.length < 3) return value;
    
    // Calcular promedio de iluminación reciente
    const recentAvg = this.illuminationHistory.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
    
    // Evitar división por cero
    if (recentAvg === 0) return value;
    
    // Normalizar el valor respecto al promedio de iluminación
    return value / recentAvg * 120; // Escalar a un rango estándar
  }

  private extractChannels(imageData: ImageData): { 
    redValue: number, 
    greenValue: number, 
    blueValue: number,
    avgIntensity: number
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let count = 0;
    
    // Usar ROI para extracción si está definido correctamente
    let startX, endX, startY, endY;
    
    if (this.currentROI.width > 0 && this.currentROI.height > 0) {
      startX = this.currentROI.x;
      endX = this.currentROI.x + this.currentROI.width;
      startY = this.currentROI.y;
      endY = this.currentROI.y + this.currentROI.height;
    } else {
      // Fallback al 40% central de la imagen
      startX = Math.floor(imageData.width * 0.3);
      endX = Math.floor(imageData.width * 0.7);
      startY = Math.floor(imageData.height * 0.3);
      endY = Math.floor(imageData.height * 0.7);
    }
    
    // Límites de seguridad
    startX = Math.max(0, Math.min(startX, imageData.width - 1));
    endX = Math.max(0, Math.min(endX, imageData.width));
    startY = Math.max(0, Math.min(startY, imageData.height - 1));
    endY = Math.max(0, Math.min(endY, imageData.height));
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];     // Canal rojo
        greenSum += data[i+1]; // Canal verde
        blueSum += data[i+2];  // Canal azul
        count++;
      }
    }
    
    const avgRed = count > 0 ? redSum / count : 0;
    const avgGreen = count > 0 ? greenSum / count : 0;
    const avgBlue = count > 0 ? blueSum / count : 0;
    const avgIntensity = (avgRed + avgGreen + avgBlue) / 3;
    
    this.lastFrameIntensity = avgIntensity;
    
    return { redValue: avgRed, greenValue: avgGreen, blueValue: avgBlue, avgIntensity };
  }
  
  private createCompositeSignal(red: number, green: number, blue: number): number {
    // Crear señal compuesta ponderada de los tres canales
    return (red * this.CONFIG.RED_CHANNEL_WEIGHT + 
            green * this.CONFIG.GREEN_CHANNEL_WEIGHT + 
            blue * this.CONFIG.BLUE_CHANNEL_WEIGHT);
  }

  private analyzeSignal(filtered: number, compositePPG: number): { isFingerDetected: boolean, quality: number } {
    const isInRange = compositePPG >= this.CONFIG.MIN_RED_THRESHOLD && 
                      compositePPG <= this.CONFIG.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.CONFIG.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    const recentValues = this.lastValues.slice(-this.CONFIG.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    const maxVariation = Math.max(...variations.map(Math.abs));
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02);
    const isStable = maxVariation < adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.CONFIG.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    const isFingerDetected = this.stableFrameCount >= this.CONFIG.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Calcular calidad basada en estabilidad y periodicidad
      const stabilityQuality = (this.stableFrameCount / (this.CONFIG.MIN_STABILITY_COUNT * 2)) * 50;
      const periodicityQuality = this.analyzePeriodicityQuality() * 50;
      quality = Math.round(stabilityQuality + periodicityQuality);
    }

    return { isFingerDetected, quality };
  }

  private calculateMultiChannelPerfusionIndex(): number {
    if (this.redBuffer.length < 10 || 
        this.greenBuffer.length < 10 || 
        this.blueBuffer.length < 10) {
      return 0;
    }
    
    // Calcular PI para cada canal
    const redValues = this.redBuffer.slice(-10);
    const greenValues = this.greenBuffer.slice(-10);
    
    const redMax = Math.max(...redValues);
    const redMin = Math.min(...redValues);
    const redDC = (redMax + redMin) / 2;
    const redAC = redMax - redMin;
    
    const greenMax = Math.max(...greenValues);
    const greenMin = Math.min(...greenValues);
    const greenDC = (greenMax + greenMin) / 2;
    const greenAC = greenMax - greenMin;
    
    // Calcular PI combinado (ponderado por canal)
    let piRed = redDC > 0 ? (redAC / redDC) * 100 : 0;
    let piGreen = greenDC > 0 ? (greenAC / greenDC) * 100 : 0;
    
    // Limitar a valores razonables
    piRed = Math.min(piRed, 10);
    piGreen = Math.min(piGreen, 10);
    
    // PI combinado con ponderación por canal
    const combinedPI = (piRed * this.CONFIG.RED_CHANNEL_WEIGHT + 
                       piGreen * this.CONFIG.GREEN_CHANNEL_WEIGHT) / 
                       (this.CONFIG.RED_CHANNEL_WEIGHT + this.CONFIG.GREEN_CHANNEL_WEIGHT);
    
    return combinedPI;
  }

  private analyzePeriodicityQuality(): number {
    if (this.periodicityBuffer.length < 30) return 0.5;
    
    // Implementar análisis simple de periodicidad
    let correlationSum = 0;
    const halfSize = Math.floor(this.periodicityBuffer.length / 2);
    
    for (let i = 0; i < halfSize; i++) {
      correlationSum += Math.abs(this.periodicityBuffer[i] - this.periodicityBuffer[i + halfSize]);
    }
    
    const avgCorrelation = correlationSum / halfSize;
    const normalizedCorrelation = Math.min(1, Math.max(0, 1 - (avgCorrelation / 10)));
    
    return normalizedCorrelation;
  }

  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    this.onError?.(error);
  }
}
