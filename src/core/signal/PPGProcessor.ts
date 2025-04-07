
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
    SIGNAL_QUALITY_THRESHOLD: 65
  };
  
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private waveletDenoiser: WaveletDenoiser;
  private lastValues: number[] = [];
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private baselineValue: number = 0;
  private periodicityBuffer: number[] = [];
  
  // Nuevas variables para ROI dinámico
  private dynamicROI = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    lastUpdateTime: 0
  };
  private roiUpdateInterval = 500; // ms entre actualizaciones de ROI
  
  // Variables para detección multicanal
  private channelWeights = {
    red: 0.6,
    green: 0.3,
    blue: 0.1
  };
  private channelSignals = {
    red: [] as number[],
    green: [] as number[],
    blue: [] as number[]
  };
  
  // Variables para estabilización de exposición
  private exposureHistory: number[] = [];
  private readonly EXPOSURE_HISTORY_SIZE = 10;
  private exposureNormalizationFactor = 1.0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.waveletDenoiser = new WaveletDenoiser();
    console.log("PPGProcessor: Instancia unificada creada");
  }

  public initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Inicializar canales y buffers
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.periodicityBuffer = [];
      this.exposureHistory = [];
      this.channelSignals = {
        red: [],
        green: [],
        blue: []
      };
      
      // Reiniciar ROI dinámico
      this.dynamicROI = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        lastUpdateTime: 0
      };
      
      this.exposureNormalizationFactor = 1.0;
      
      console.log("PPGProcessor: Inicializado");
      resolve();
    });
  }

  public start(): void {
    this.isProcessing = true;
    console.log("PPGProcessor: Procesamiento iniciado");
  }

  public stop(): void {
    this.isProcessing = false;
    console.log("PPGProcessor: Procesamiento detenido");
  }

  public calibrate(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Optimizar pesos de canales basados en SNR inicial
      this.calculateOptimalChannelWeights();
      console.log("PPGProcessor: Calibración completada");
      resolve(true);
    });
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extraer valores de todos los canales
      const channelValues = this.extractChannelValues(imageData);
      
      // Actualizar ROI dinámicamente
      this.updateDynamicROI(imageData, channelValues.red);
      
      // Actualizar historial de exposición para normalización
      this.updateExposureHistory(channelValues.red);
      
      // Calcular valor combinado multicanal con pesos optimizados
      const combinedValue = this.calculateMultichannelValue(channelValues);
      
      // Aplicar filtros al valor combinado
      const kalmanFiltered = this.kalmanFilter.filter(combinedValue);
      const filtered = this.waveletDenoiser.denoise(kalmanFiltered);
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.CONFIG.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, channelValues.red);
      const perfusionIndex = this.calculatePerfusionIndex();

      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.CONFIG.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: channelValues.red,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.dynamicROI,
        perfusionIndex: perfusionIndex
      };

      this.onSignalReady?.(processedSignal);
    } catch (error) {
      console.error("PPGProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }
  
  // Nuevo método: Extracción de todos los canales
  private extractChannelValues(imageData: ImageData): { red: number, green: number, blue: number } {
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let count = 0;
    
    // Usar el ROI dinámico para la extracción
    const roi = this.dynamicROI;
    
    // Asegurar que el ROI está dentro de los límites de la imagen
    const startX = Math.max(0, Math.min(roi.x, imageData.width - 1));
    const endX = Math.max(0, Math.min(roi.x + roi.width, imageData.width));
    const startY = Math.max(0, Math.min(roi.y, imageData.height - 1));
    const endY = Math.max(0, Math.min(roi.y + roi.height, imageData.height));
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];       // Canal rojo
        greenSum += data[i + 1]; // Canal verde
        blueSum += data[i + 2];  // Canal azul
        count++;
      }
    }
    
    if (count === 0) {
      // Fallback al centro si el ROI está completamente fuera de la imagen
      return this.extractRedChannel(imageData); 
    }
    
    // Aplicar normalización de exposición
    const redAvg = (redSum / count) * this.exposureNormalizationFactor;
    const greenAvg = (greenSum / count) * this.exposureNormalizationFactor;
    const blueAvg = (blueSum / count) * this.exposureNormalizationFactor;
    
    // Almacenar valores para análisis de SNR
    this.channelSignals.red.push(redAvg);
    this.channelSignals.green.push(greenAvg);
    this.channelSignals.blue.push(blueAvg);
    
    // Limitar tamaño de los buffers
    if (this.channelSignals.red.length > 30) {
      this.channelSignals.red.shift();
      this.channelSignals.green.shift();
      this.channelSignals.blue.shift();
    }
    
    return { red: redAvg, green: greenAvg, blue: blueAvg };
  }
  
  // Método para compatibilidad con código existente
  private extractRedChannel(imageData: ImageData): { red: number, green: number, blue: number } {
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let count = 0;
    
    // Analizar el 40% central de la imagen para mejor precisión
    const startX = Math.floor(imageData.width * 0.3);
    const endX = Math.floor(imageData.width * 0.7);
    const startY = Math.floor(imageData.height * 0.3);
    const endY = Math.floor(imageData.height * 0.7);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];       // Canal rojo
        greenSum += data[i + 1]; // Canal verde
        blueSum += data[i + 2];  // Canal azul
        count++;
      }
    }
    
    const redAvg = redSum / count;
    const greenAvg = greenSum / count;
    const blueAvg = blueSum / count;
    
    return { red: redAvg, green: greenAvg, blue: blueAvg };
  }
  
  // Nuevo método: Actualización del ROI dinámico
  private updateDynamicROI(imageData: ImageData, redValue: number): void {
    const now = Date.now();
    
    // Limitar frecuencia de actualización del ROI para reducir carga de CPU
    if (now - this.dynamicROI.lastUpdateTime < this.roiUpdateInterval) {
      return;
    }
    
    // Dividir la imagen en una cuadrícula de 4x4 y encontrar la región con mayor señal
    const gridSize = 4;
    const cellWidth = Math.floor(imageData.width / gridSize);
    const cellHeight = Math.floor(imageData.height / gridSize);
    
    let maxSignalStrength = -1;
    let bestCell = { x: 0, y: 0 };
    
    const data = imageData.data;
    
    for (let gridY = 0; gridY < gridSize; gridY++) {
      for (let gridX = 0; gridX < gridSize; gridX++) {
        let redSum = 0;
        let greenSum = 0;
        let count = 0;
        
        const startX = gridX * cellWidth;
        const endX = Math.min((gridX + 1) * cellWidth, imageData.width);
        const startY = gridY * cellHeight;
        const endY = Math.min((gridY + 1) * cellHeight, imageData.height);
        
        // Muestreo de la celda (no todos los píxeles para optimizar rendimiento)
        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const i = (y * imageData.width + x) * 4;
            redSum += data[i];       // Canal rojo
            greenSum += data[i + 1]; // Canal verde para mejor detección de piel
            count++;
          }
        }
        
        if (count > 0) {
          // Calcular "fuerza de señal" basada en intensidad del rojo y ratio rojo/verde
          // Este ratio es útil para detección de piel humana
          const redAvg = redSum / count;
          const greenAvg = greenSum / count;
          const redGreenRatio = greenAvg > 0 ? redAvg / greenAvg : 0;
          
          // Priorizar áreas con buen ratio rojo/verde (indicativo de piel humana)
          // y buena intensidad de rojo
          const signalStrength = redAvg * Math.pow(redGreenRatio, 0.7);
          
          if (signalStrength > maxSignalStrength) {
            maxSignalStrength = signalStrength;
            bestCell = { x: gridX, y: gridY };
          }
        }
      }
    }
    
    // Actualizar ROI basado en la mejor celda encontrada
    const newROI = {
      x: bestCell.x * cellWidth,
      y: bestCell.y * cellHeight,
      width: cellWidth,
      height: cellHeight,
      lastUpdateTime: now
    };
    
    // Aplicar cambio gradual al ROI para evitar saltos bruscos
    if (this.dynamicROI.x !== 0 || this.dynamicROI.y !== 0) {
      this.dynamicROI = {
        x: Math.floor(this.dynamicROI.x * 0.7 + newROI.x * 0.3),
        y: Math.floor(this.dynamicROI.y * 0.7 + newROI.y * 0.3),
        width: Math.floor(this.dynamicROI.width * 0.7 + newROI.width * 0.3),
        height: Math.floor(this.dynamicROI.height * 0.7 + newROI.height * 0.3),
        lastUpdateTime: now
      };
    } else {
      // Primera actualización
      this.dynamicROI = newROI;
    }
    
    console.log("PPGProcessor: ROI dinámico actualizado", this.dynamicROI);
  }
  
  // Nuevo método: Calcular valor óptimo multicanal
  private calculateMultichannelValue(channelValues: { red: number, green: number, blue: number }): number {
    // Combinar señales de diferentes canales usando pesos
    return (
      channelValues.red * this.channelWeights.red +
      channelValues.green * this.channelWeights.green +
      channelValues.blue * this.channelWeights.blue
    );
  }
  
  // Nuevo método: Optimizar pesos de canales basados en SNR
  private calculateOptimalChannelWeights(): void {
    if (this.channelSignals.red.length < 10) {
      return; // No hay suficientes datos para calcular SNR
    }
    
    // Calcular SNR para cada canal
    const redSNR = this.calculateSNR(this.channelSignals.red);
    const greenSNR = this.calculateSNR(this.channelSignals.green);
    const blueSNR = this.calculateSNR(this.channelSignals.blue);
    
    // Normalizar SNR para obtener pesos (mayor SNR = mayor peso)
    const totalSNR = redSNR + greenSNR + blueSNR;
    
    if (totalSNR > 0) {
      // Asegurar siempre un mínimo para el canal rojo
      const minRedWeight = 0.3;
      let redWeight = Math.max(minRedWeight, redSNR / totalSNR);
      
      // Distribuir el resto entre verde y azul según SNR
      const remainingWeight = 1.0 - redWeight;
      const greenBlueTotal = greenSNR + blueSNR;
      
      let greenWeight = greenBlueTotal > 0 ? remainingWeight * (greenSNR / greenBlueTotal) : 0.3;
      let blueWeight = greenBlueTotal > 0 ? remainingWeight * (blueSNR / greenBlueTotal) : 0.1;
      
      // Actualizar pesos
      this.channelWeights = {
        red: redWeight,
        green: greenWeight,
        blue: blueWeight
      };
      
      console.log("PPGProcessor: Pesos de canales actualizados", {
        weights: this.channelWeights,
        snr: { red: redSNR, green: greenSNR, blue: blueSNR }
      });
    }
  }
  
  // Método auxiliar: Calcular SNR (Relación Señal-Ruido)
  private calculateSNR(signal: number[]): number {
    if (signal.length < 5) return 0;
    
    // 1. Calcular la media
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    // 2. Calcular potencia de señal y ruido
    const signalPower = Math.pow(mean, 2);
    
    // 3. Calcular varianza (potencia de ruido)
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    
    // 4. Calcular SNR
    return variance > 0 ? signalPower / variance : 0;
  }
  
  // Nuevo método: Normalización adaptativa de exposición
  private updateExposureHistory(redValue: number): void {
    this.exposureHistory.push(redValue);
    if (this.exposureHistory.length > this.EXPOSURE_HISTORY_SIZE) {
      this.exposureHistory.shift();
    }
    
    if (this.exposureHistory.length >= this.EXPOSURE_HISTORY_SIZE / 2) {
      // Calcular la media del historial
      const mean = this.exposureHistory.reduce((sum, val) => sum + val, 0) / this.exposureHistory.length;
      
      // Rango objetivo para valores normalizados (optimizado para 8-bit)
      const targetValue = 128;
      
      // Ajustar gradualmente el factor de normalización
      if (mean > 0) {
        const newFactor = targetValue / mean;
        // Cambio gradual para evitar oscilaciones
        this.exposureNormalizationFactor = this.exposureNormalizationFactor * 0.8 + newFactor * 0.2;
      }
    }
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const isInRange = rawValue >= this.CONFIG.MIN_RED_THRESHOLD && 
                      rawValue <= this.CONFIG.MAX_RED_THRESHOLD;
    
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

  private calculatePerfusionIndex(): number {
    if (this.lastValues.length < 10) return 0;
    
    const values = this.lastValues.slice(-10);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const dc = (max + min) / 2;
    
    if (dc === 0) return 0;
    
    const ac = max - min;
    const pi = (ac / dc) * 100;
    
    return Math.min(pi, 10); // Limitar a un máximo razonable de 10%
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
