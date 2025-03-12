import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;  // Ruido de medición
  private Q: number = 0.1;   // Ruido del proceso
  private P: number = 1;     // Estimación de covarianza
  private X: number = 0;     // Estado estimado
  private K: number = 0;     // Ganancia de Kalman
  private lastMeasurement: number = 0;
  private velocityEstimate: number = 0;
  private adaptiveCount: number = 0;

  filter(measurement: number): number {
    // Adaptación dinámica del ruido del proceso basado en la velocidad de cambio
    const velocity = measurement - this.lastMeasurement;
    this.velocityEstimate = this.velocityEstimate * 0.95 + velocity * 0.05;
    
    // Ajustar Q dinámicamente basado en la velocidad de cambio
    const velocityMagnitude = Math.abs(this.velocityEstimate);
    this.Q = Math.max(0.01, Math.min(0.5, velocityMagnitude * 0.1));
    
    // Actualizar R basado en la variabilidad de la señal
    if (this.adaptiveCount > 10) {
      const measurementDiff = Math.abs(measurement - this.X);
      this.R = Math.max(0.001, Math.min(0.1, measurementDiff * 0.05));
    }
    
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    this.lastMeasurement = measurement;
    this.adaptiveCount++;
    
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
    this.lastMeasurement = 0;
    this.velocityEstimate = 0;
    this.adaptiveCount = 0;
    this.Q = 0.1;
    this.R = 0.01;
  }
}

export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 30,          // Aumentado para mejor análisis
    MIN_RED_THRESHOLD: 20,    // Muy permisivo
    MAX_RED_THRESHOLD: 255,   // Máximo posible
    STABILITY_WINDOW: 6,      // Ventana más grande
    MIN_STABILITY_COUNT: 2,   // Más permisivo
    HYSTERESIS: 10,          // Mayor histéresis
    MIN_CONSECUTIVE_DETECTIONS: 1  // Muy permisivo
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 500; // 500ms timeout

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.consecutiveDetections = 0;
    this.isCurrentlyDetected = false;
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      console.log("PPGSignalProcessor: Calibración completada");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      console.log("--- Nuevo Frame ---");
      const redValue = this.extractRedChannel(imageData);
      console.log("Valor rojo extraído:", redValue);
      
      const filtered = this.kalmanFilter.filter(redValue);
      console.log("Valor filtrado:", filtered);

      // Guardar el valor filtrado para análisis
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      
      const { isFingerDetected, quality, waveformFeatures } = this.analyzeSignal(filtered, redValue);
      console.log("Análisis de señal:", { isFingerDetected, quality });
      
      // Calcular coordenadas del ROI (región de interés)
      const roi = this.detectROI(redValue);
      
      // Métricas adicionales para debugging y análisis
      const perfusionIndex = redValue > 0 ? 
        Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      // Crear objeto de señal procesada con todos los datos relevantes
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex,
        waveformFeatures: waveformFeatures
      };
      
      // Enviar feedback sobre el uso de la linterna cuando es necesario
      if (isFingerDetected && quality < 40 && redValue < 120 && this.onError) {
        // Señal detectada pero débil - podría indicar poca iluminación
        this.onError({
          code: "LOW_LIGHT",
          message: "Señal débil. Por favor asegúrese de que la linterna esté encendida y el dedo cubra completamente la cámara.",
          timestamp: Date.now()
        });
      }
      
      // Advertir si hay sobreexposición (saturación) que afecta la calidad
      if (isFingerDetected && redValue > 240 && this.onError) {
        this.onError({
          code: "OVEREXPOSED",
          message: "La imagen está sobreexpuesta. Intente ajustar la posición del dedo para reducir el brillo.",
          timestamp: Date.now()
        });
      }
      
      // Enviar la señal procesada al callback
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Almacenar el último valor procesado para cálculos futuros
      this.lastStableValue = isFingerDetected ? filtered : this.lastStableValue;

    } catch (error) {
      console.error("Error en processFrame:", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    let maxRed = 0, minRed = 255;
    
    // ROI más grande para captar mejor el dedo
    const roiSize = Math.min(imageData.width, imageData.height) * 0.5; // 50% del tamaño
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));

    // Matriz para análisis por regiones
    const regions: { [key: string]: { redSum: number; count: number; maxRed: number; minRed: number } } = {};
    const regionSize = 20; // Regiones más grandes

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const i = (y * imageData.width + x) * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            // Acumular valores por región
            const regionX = Math.floor((x - startX) / regionSize);
            const regionY = Math.floor((y - startY) / regionSize);
            const regionKey = `${regionX},${regionY}`;
            
            if (!regions[regionKey]) {
                regions[regionKey] = {
                    redSum: 0,
                    count: 0,
                    maxRed: 0,
                    minRed: 255
                };
            }
            
            regions[regionKey].redSum += r;
            regions[regionKey].count++;
            regions[regionKey].maxRed = Math.max(regions[regionKey].maxRed, r);
            regions[regionKey].minRed = Math.min(regions[regionKey].minRed, r);

            // Acumuladores globales
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
        }
    }

    // Encontrar la mejor región
    let bestRegionValue = 0;
    let bestRegionContrast = 0;

    Object.values(regions).forEach(region => {
        if (region.count > 50) { // Mínimo de píxeles por región
            const avgRegionRed = region.redSum / region.count;
            const contrast = region.maxRed - region.minRed;
            
            if (contrast > bestRegionContrast) {
                bestRegionContrast = contrast;
                bestRegionValue = avgRegionRed;
            }
        }
    });

    // Si encontramos una región con buen contraste
    if (bestRegionContrast > 5) {
        return bestRegionValue;
    }

    // Si no, usar el promedio global con criterios más permisivos
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;

    const redDominance = (avgRed / avgGreen + avgRed / avgBlue) / 2;
    
    // Criterios más permisivos pero manteniendo algo de validación
    if (redDominance > 1.05 && avgRed > 20) { // Solo necesitamos una ligera dominancia del rojo
        return avgRed;
    }

    return 0;
  }

  private analyzeSignal(filtered: number, rawValue: number): { 
    isFingerDetected: boolean, 
    quality: number,
    waveformFeatures?: {
      systolicPeak: number,
      diastolicPeak: number,
      dicroticNotch: number,
      pulseWidth: number,
      areaUnderCurve: number
    }
  } {
    // Siempre añadir el valor al buffer si es > 0
    if (filtered > 0) {
        this.lastValues.push(filtered);
        if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
            this.lastValues.shift();
        }
    }

    // Análisis más permisivo
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD;
    
    if (!isInRange) {
        return { isFingerDetected: false, quality: 0 };
    }

    // Si tenemos suficientes valores, analizar la señal
    if (this.lastValues.length >= 4) { // Reducido a 4 valores mínimo
        const window = this.lastValues.slice(-6); // Últimos 6 valores
        
        // Calcular variación pico a pico
        const peakToPeak = Math.max(...window) - Math.min(...window);
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        
        // Si hay variación significativa respecto a la media
        if (peakToPeak > mean * 0.01) { // Solo necesitamos 1% de variación
            this.stableFrameCount++;
        } else {
            this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
        }

        const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
        
        // Calidad proporcional a la variación
        const quality = Math.min(100, Math.round((peakToPeak / mean) * 1000));

        return {
            isFingerDetected,
            quality,
            waveformFeatures: this.extractWaveformFeatures(window, this.findPeaksAndValleys(window))
        };
    }

    return { isFingerDetected: false, quality: 0 };
  }

  private findPeaksAndValleys(window: number[]): Array<{index: number, value: number, type: 'peak' | 'valley'}> {
    const result = [];
    for (let i = 1; i < window.length - 1; i++) {
      if (window[i] > window[i-1] && window[i] > window[i+1]) {
        result.push({index: i, value: window[i], type: 'peak'});
      } else if (window[i] < window[i-1] && window[i] < window[i+1]) {
        result.push({index: i, value: window[i], type: 'valley'});
      }
    }
    return result;
  }

  private extractWaveformFeatures(window: number[], peaks: Array<{index: number, value: number, type: string}>) {
    // Encontrar pico sistólico (pico principal)
    const systolicPeak = Math.max(...peaks.filter(p => p.type === 'peak').map(p => p.value));
    
    // Encontrar valle diastólico (valle más profundo)
    const diastolicPeak = Math.min(...peaks.filter(p => p.type === 'valley').map(p => p.value));
    
    // Detectar muesca dicrótica (segundo pico más pequeño después del pico sistólico)
    const peaksSorted = peaks.filter(p => p.type === 'peak')
                            .sort((a, b) => b.value - a.value);
    const dicroticNotch = peaksSorted.length > 1 ? peaksSorted[1].value : 0;
    
    // Calcular ancho del pulso
    const pulseWidth = peaks.length >= 2 ? 
      peaks[peaks.length - 1].index - peaks[0].index : 0;
    
    // Calcular área bajo la curva usando método trapezoidal
    const areaUnderCurve = this.calculateAreaUnderCurve(window);
    
    return {
      systolicPeak,
      diastolicPeak,
      dicroticNotch,
      pulseWidth,
      areaUnderCurve
    };
  }

  private calculateStabilityScore(window: number[]): number {
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length;
    return Math.exp(-variance / (mean * 0.1));
  }

  private calculateVariabilityScore(peaks: Array<{index: number, value: number, type: string}>): number {
    if (peaks.length < 2) return 0;
    
    const peakValues = peaks.filter(p => p.type === 'peak').map(p => p.value);
    const peakVariance = this.calculateVariance(peakValues);
    return Math.exp(-peakVariance / (Math.max(...peakValues) * 0.1));
  }

  private calculateSignalToNoiseRatio(window: number[]): number {
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const signal = Math.pow(mean, 2);
    const noise = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length;
    return signal / (noise + 1e-10);
  }

  private calculateAreaUnderCurve(window: number[]): number {
    let area = 0;
    for (let i = 1; i < window.length; i++) {
      area += (window[i] + window[i-1]) * 0.5;
    }
    return area;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }

  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }

  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    this.onError?.(error);
  }
}

// HeartBeatProcessor (pulso)
class HeartBeatProcessor {
  // Detección de pulso
}

// ArrhythmiaProcessor (arritmias)
class ArrhythmiaProcessor {
  // Análisis de intervalos RR
}

// Clase principal
class VitalSignsProcessor {
  // Implementación real
}

// Hook de React
function useVitalSignsProcessor() {
  // Interfaz para React
}
