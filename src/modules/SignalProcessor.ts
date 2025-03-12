import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';
import { CameraController } from './CameraController';

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
  private cameraController: CameraController;
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,          // Buffer para análisis
    MIN_RED_THRESHOLD: 35,    // Umbral de detección rojo
    MAX_RED_THRESHOLD: 255,   // Máximo permitido
    STABILITY_WINDOW: 8,      // Aumentado: analiza más frames para mejor estabilidad
    MIN_STABILITY_COUNT: 6,   // Aumentado: requiere más frames estables consecutivos
    HYSTERESIS: 10,          // Aumentado: más resistencia a cambios rápidos
    MIN_CONSECUTIVE_DETECTIONS: 2  // Requiere 2 detecciones consecutivas para confirmar
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
    this.cameraController = new CameraController();
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      await this.cameraController.setupCamera();
      await this.cameraController.optimizeForPPG();
      
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
    this.cameraController.stop();
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
    if (!this.isProcessing) return;

    try {
        // Log de entrada
        console.log("=== INICIO FRAME ===");
        console.log("Dimensiones imagen:", imageData.width, "x", imageData.height);
        
        const redValue = this.extractRedChannel(imageData);
        console.log("Valor rojo (raw):", redValue);
        
        // Log de valores RGB en el centro
        const centerX = Math.floor(imageData.width / 2);
        const centerY = Math.floor(imageData.height / 2);
        const centerIndex = (centerY * imageData.width + centerX) * 4;
        console.log("RGB Centro:", {
            r: imageData.data[centerIndex],
            g: imageData.data[centerIndex + 1],
            b: imageData.data[centerIndex + 2]
        });

        const filtered = this.kalmanFilter.filter(redValue);
        console.log("Valor filtrado:", filtered);
        console.log("Buffer actual:", this.lastValues);
        
        const result = this.analyzeSignal(imageData, redValue);
        console.log("Resultado análisis:", result);
        
        console.log("=== FIN FRAME ===");
        
        // Guardar el valor filtrado para análisis
        this.lastValues.push(filtered);
        if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
          this.lastValues.shift();
        }
        
        const { isFingerDetected, quality, waveformFeatures } = result;
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
    let maxRed = 0, minRed = 255;
    let pixelCount = 0;
    
    // ROI más pequeño para evitar sobreexposición
    const roiSize = Math.min(imageData.width, imageData.height) * 0.25; // 25% del tamaño
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));

    // Análisis con compensación de exposición
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const i = (y * imageData.width + x) * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            // Compensación de sobreexposición
            const exposureFactor = Math.max(1, Math.min(2, 255 / Math.max(r, g, b)));
            
            redSum += r * exposureFactor;
            greenSum += g * exposureFactor;
            blueSum += b * exposureFactor;
            maxRed = Math.max(maxRed, r * exposureFactor);
            minRed = Math.min(minRed, r * exposureFactor);
            pixelCount++;
        }
    }

    if (pixelCount === 0) return 0;

    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;

    // Criterios adaptados a sobreexposición
    const isRedDominant = avgRed > (avgGreen * 1.1);
    const hasGoodRange = (maxRed - minRed) > 10; // Verificar que hay variación
    const isInRange = avgRed >= 35 && avgRed <= 240; // Límite superior más bajo

    if (isRedDominant && hasGoodRange && isInRange) {
        // Normalizar el valor para evitar saturación
        return Math.min(200, avgRed);
    }

    return 0;
  }

  private analyzeSignal(imageData: ImageData, rawValue: number): { 
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
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const centerIndex = (centerY * imageData.width + centerX) * 4;
    const centerR = imageData.data[centerIndex];
    const centerG = imageData.data[centerIndex + 1];
    const centerB = imageData.data[centerIndex + 2];
    
    const isRedDominant = centerR > 50 && centerG < 10 && centerB < 10;
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                     rawValue <= 240 && isRedDominant;
    
    if (!isInRange) {
        this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
        return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length >= this.currentConfig.STABILITY_WINDOW) {
        const window = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
        
        // Normalizar valores
        const normalizedWindow = window.map(v => v / 255 * 100);
        
        // Calcular estabilidad usando ventana deslizante
        const variations = [];
        for (let i = 1; i < normalizedWindow.length; i++) {
            variations.push(Math.abs(normalizedWindow[i] - normalizedWindow[i-1]));
        }
        
        // Calcular promedio y desviación estándar de variaciones
        const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
        const stdDeviation = Math.sqrt(
            variations.reduce((a, b) => a + Math.pow(b - avgVariation, 2), 0) / variations.length
        );
        
        // Criterios de estabilidad más estrictos
        const isStable = avgVariation < 2.0 && stdDeviation < 1.5;
        
        if (isStable) {
            this.consecutiveDetections++;
            if (this.consecutiveDetections >= this.currentConfig.MIN_STABILITY_COUNT) {
                // Calcular calidad basada en estabilidad
                const stabilityScore = Math.max(0, 1 - (avgVariation / 2.0));
                const variationScore = Math.max(0, 1 - (stdDeviation / 1.5));
                const quality = Math.round((stabilityScore * 0.6 + variationScore * 0.4) * 100);
                
                return {
                    isFingerDetected: true,
                    quality: Math.max(40, quality),
                    waveformFeatures: this.extractWaveformFeatures(normalizedWindow)
                };
            }
        } else {
            // Reducción gradual de detecciones consecutivas
            this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
        }
    }

    return { isFingerDetected: false, quality: 0 };
  }

  private extractWaveformFeatures(normalizedWindow: number[]): {
    systolicPeak: number,
    diastolicPeak: number,
    dicroticNotch: number,
    pulseWidth: number,
    areaUnderCurve: number
  } {
    // Encontrar pico sistólico (pico principal)
    const systolicPeak = Math.max(...normalizedWindow);
    
    // Encontrar valle diastólico (valle más profundo)
    const diastolicPeak = Math.min(...normalizedWindow);
    
    // Detectar muesca dicrótica (segundo pico más pequeño después del pico sistólico)
    const peaksSorted = normalizedWindow.filter(v => v === systolicPeak || v === diastolicPeak)
                            .sort((a, b) => b - a);
    const dicroticNotch = peaksSorted.length > 1 ? peaksSorted[1] : 0;
    
    // Calcular ancho del pulso
    const pulseWidth = normalizedWindow.length >= 2 ? 
      normalizedWindow[normalizedWindow.length - 1] - normalizedWindow[0] : 0;
    
    // Calcular área bajo la curva usando método trapezoidal
    const areaUnderCurve = this.calculateAreaUnderCurve(normalizedWindow);
    
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

const constraints = {
    video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
        exposureMode: 'manual',
        whiteBalance: 'manual'
    }
};

async function adjustCameraSettings(videoTrack: MediaStreamTrack) {
    const capabilities = videoTrack.getCapabilities();
    
    // Ajustar exposición si está disponible
    if (capabilities.exposureMode?.includes('manual')) {
        await videoTrack.applyConstraints({
            advanced: [{
                exposureMode: 'manual'
            }]
        });
    }
}

class ExposureController {
    private currentExposure: number = 1000; // valor inicial
    private readonly MIN_EXPOSURE = 100;
    private readonly MAX_EXPOSURE = 10000;

    adjustExposure(imageData: ImageData): number {
        const data = imageData.data;
        let totalBrightness = 0;
        
        // Calcular brillo promedio
        for(let i = 0; i < data.length; i += 4) {
            totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
        }
        
        const avgBrightness = totalBrightness / (data.length / 4);
        
        // Ajustar si está fuera del rango óptimo (128-180)
        if(avgBrightness > 180) {
            // Reducir exposición
            this.currentExposure = Math.max(this.MIN_EXPOSURE, this.currentExposure * 0.8);
        } else if(avgBrightness < 128) {
            // Aumentar exposición
            this.currentExposure = Math.min(this.MAX_EXPOSURE, this.currentExposure * 1.2);
        }
        
        return this.currentExposure;
    }

    getCurrentExposure(): number {
        return this.currentExposure;
    }

    reset(): void {
        this.currentExposure = 1000;
    }
}

