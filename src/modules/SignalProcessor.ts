import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

/**
 * Implementación del filtro de Kalman para suavizar señales
 */
class KalmanFilter {
  private R: number = 0.01;  // Ruido de medición
  private Q: number = 0.1;   // Ruido de proceso
  private P: number = 1;     // Estimación de error
  private X: number = 0;     // Valor estimado
  private K: number = 0;     // Ganancia de Kalman

  filter(measurement: number): number {
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

/**
 * Procesador de señales PPG (Fotopletismografía)
 * Implementa la interfaz SignalProcessor
 */
export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  
  // Parámetros de detección de dedo
  private readonly MIN_RED_VALUE = 60;    // Valor mínimo del canal rojo para considerar presencia de dedo
  private readonly MAX_RED_VALUE = 250;   // Valor máximo del canal rojo (evitar saturación)
  private readonly MIN_RED_RATIO = 1.2;   // Ratio mínimo entre rojo y otros canales
  
  // Tamaño de buffer para análisis de señal
  private readonly BUFFER_SIZE = 30;
  
  // Parámetros de análisis de señal PPG
  private readonly MIN_PEAK_AMPLITUDE = 3;      // Amplitud mínima entre pico y valle (más sensible)
  private readonly MAX_BPM = 180;              // Máximo ritmo cardíaco fisiológico
  private readonly MIN_BPM = 40;               // Mínimo ritmo cardíaco fisiológico
  private readonly MIN_PEAK_DISTANCE = Math.round(60 / this.MAX_BPM * 30); // En frames a 30fps
  private readonly MAX_PEAK_DISTANCE = Math.round(60 / this.MIN_BPM * 30); // En frames a 30fps
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;

    try {
      // 1. Detectar dedo
      const { redValue, isFingerPresent } = this.detectFinger(imageData);
      
      // Si no hay dedo, retornar señal con calidad 0
      if (!isFingerPresent) {
        const processedSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: redValue,
          quality: 0,
          fingerDetected: false,
          roi: this.detectROI(redValue)
        };
        this.onSignalReady?.(processedSignal);
        return;
      }
      
      // 2. Si hay dedo, procesar señal PPG
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Almacenar valor filtrado
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // 3. Analizar calidad de la señal PPG
      const { quality, isPPGSignal } = this.analyzeSignalQuality(filtered);

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerPresent && isPPGSignal,
        roi: this.detectROI(redValue)
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private detectFinger(imageData: ImageData): { redValue: number, isFingerPresent: boolean } {
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let count = 0;
    
    // Analizar solo el centro de la imagen (25% central)
    const startX = Math.floor(imageData.width * 0.375);
    const endX = Math.floor(imageData.width * 0.625);
    const startY = Math.floor(imageData.height * 0.375);
    const endY = Math.floor(imageData.height * 0.625);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];      // Canal rojo
        greenSum += data[i+1];  // Canal verde
        blueSum += data[i+2];   // Canal azul
        count++;
      }
    }
    
    const redValue = redSum / count;
    const greenValue = greenSum / count;
    const blueValue = blueSum / count;
    
    // Verificar presencia de dedo:
    // 1. El valor del canal rojo debe estar en un rango válido
    // 2. El canal rojo debe ser significativamente mayor que los otros canales
    const isInRange = redValue >= this.MIN_RED_VALUE && redValue <= this.MAX_RED_VALUE;
    const redToGreenRatio = redValue / (greenValue + 1);  // +1 para evitar división por cero
    const redToBlueRatio = redValue / (blueValue + 1);
    
    const hasValidRatios = redToGreenRatio >= this.MIN_RED_RATIO && 
                          redToBlueRatio >= this.MIN_RED_RATIO;
    
    return {
      redValue,
      isFingerPresent: isInRange && hasValidRatios
    };
  }

  private analyzeSignalQuality(currentValue: number): { quality: number, isPPGSignal: boolean } {
    if (this.lastValues.length < this.BUFFER_SIZE) {
      return { quality: 0, isPPGSignal: false };
    }

    // 1. Encontrar picos y valles
    const { peaks, valleys } = this.findPeaksAndValleys(this.lastValues);
    
    // Si no hay suficientes picos o valles, no es una señal PPG
    if (peaks.length < 2 || valleys.length < 2) {
      return { quality: 0, isPPGSignal: false };
    }

    // 2. Verificar distancias entre picos (debe corresponder a un ritmo cardíaco fisiológico)
    const peakDistances = [];
    for (let i = 1; i < peaks.length; i++) {
      const distance = peaks[i] - peaks[i-1];
      if (distance < this.MIN_PEAK_DISTANCE || distance > this.MAX_PEAK_DISTANCE) {
        return { quality: 0, isPPGSignal: false };
      }
      peakDistances.push(distance);
    }

    // 3. Verificar amplitud pico-valle
    const amplitudes = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      const amplitude = Math.abs(this.lastValues[peaks[i]] - this.lastValues[valleys[i]]);
      if (amplitude < this.MIN_PEAK_AMPLITUDE) {
        return { quality: 0, isPPGSignal: false };
      }
      amplitudes.push(amplitude);
    }

    // 4. Calcular calidad basada en:
    // - Consistencia de distancias entre picos
    // - Consistencia de amplitudes
    
    // Variabilidad de distancias entre picos (menor es mejor)
    const avgDistance = peakDistances.reduce((a,b) => a + b, 0) / peakDistances.length;
    const distanceVariability = peakDistances.reduce((acc, dist) => 
      acc + Math.abs(dist - avgDistance), 0) / peakDistances.length / avgDistance;

    // Variabilidad de amplitudes (menor es mejor)
    const avgAmplitude = amplitudes.reduce((a,b) => a + b, 0) / amplitudes.length;
    const amplitudeVariability = amplitudes.reduce((acc, amp) => 
      acc + Math.abs(amp - avgAmplitude), 0) / amplitudes.length / avgAmplitude;

    // Calcular calidad (0-100)
    const quality = Math.round(
      (1 - distanceVariability * 2) * 50 + // 50% basado en regularidad de ritmo
      (1 - amplitudeVariability * 2) * 50   // 50% basado en regularidad de amplitud
    );

    // Una señal PPG real debe tener una calidad mínima
    const isPPGSignal = quality >= 35;  // Más permisivo

    return { quality: Math.max(0, Math.min(100, quality)), isPPGSignal };
  }

  private findPeaksAndValleys(values: number[]): { peaks: number[], valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    // Necesitamos al menos 3 puntos para encontrar un pico o valle
    for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i-1];
      const curr = values[i];
      const next = values[i+1];
      
      // Un punto es un pico si es mayor que sus vecinos
      if (curr > prev && curr > next) {
        peaks.push(i);
      }
      // Un punto es un valle si es menor que sus vecinos
      else if (curr < prev && curr < next) {
        valleys.push(i);
      }
    }
    
    return { peaks, valleys };
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

  start(): void {
    this.isProcessing = true;
    this.initialize();
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.kalmanFilter.reset();
  }

  async calibrate(): Promise<boolean> {
    await this.initialize();
    return true;
  }
}
