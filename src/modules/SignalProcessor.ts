import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.1;
  private P: number = 1;
  private X: number = 0;
  private K: number = 0;

  filter(measurement: number): number {
    this.P = this.P + this.Q;
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

export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  private waveformBuffer: number[] = [];
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,          // Aumentado para mejor análisis
    MIN_RED_THRESHOLD: 100,   // Ajustado para mejor detección
    MAX_RED_THRESHOLD: 230,   // Limitado para evitar saturación
    STABILITY_WINDOW: 8,      // Aumentado para análisis más robusto
    MIN_STABILITY_COUNT: 5    // Más estricto para evitar falsos positivos
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private baselineValue: number | null = null;
  private readonly VARIANCE_THRESHOLD = 0.15; // 15% de variación máxima permitida

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada con nueva configuración");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.baselineValue = null;
      this.waveformBuffer = [];
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
    this.baselineValue = null;
    this.waveformBuffer = [];
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
      // Extraer y procesar el canal rojo (el más importante para PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis avanzado de la señal para determinar la presencia del dedo y calidad
      const { isFingerDetected, quality, waveformQuality } = this.analyzeSignal(filtered, redValue);
      
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
        waveformQuality: waveformQuality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
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
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let maxRed = 0;
    let minRed = 255;
    
    // ROI (Region of Interest) adaptativo
    // Usar un área centrada con tamaño dinámico para mejor precisión
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    // Tamaño del ROI adaptativo basado en la resolución de la cámara
    // Cámaras de mayor resolución necesitan ROIs más pequeños en proporción
    const adaptiveRoiPercent = imageData.width > 720 ? 0.25 : 0.35; // 25% o 35% del tamaño
    const roiSize = Math.min(imageData.width, imageData.height) * adaptiveRoiPercent;
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Matrices para análisis de subregiones
    const regionSize = 20; // Regiones de 20x20 píxeles
    const regionsX = Math.ceil((endX - startX) / regionSize);
    const regionsY = Math.ceil((endY - startY) / regionSize);
    
    // Inicializar matrices para análisis de regiones
    const regionRedAvg = Array(regionsY).fill(0).map(() => Array(regionsX).fill(0));
    const regionGreenAvg = Array(regionsY).fill(0).map(() => Array(regionsX).fill(0));
    const regionBlueAvg = Array(regionsY).fill(0).map(() => Array(regionsX).fill(0));
    const regionCount = Array(regionsY).fill(0).map(() => Array(regionsX).fill(0));
    
    // Fase 1: Acumular valores por regiones
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const regY = Math.floor((y - startY) / regionSize);
        const regX = Math.floor((x - startX) / regionSize);
        
        if (regY >= 0 && regY < regionsY && regX >= 0 && regX < regionsX) {
          const i = (y * imageData.width + x) * 4;
          const r = data[i];     // Canal rojo
          const g = data[i+1];   // Canal verde
          const b = data[i+2];   // Canal azul
          
          // Acumular valores para esta región
          regionRedAvg[regY][regX] += r;
          regionGreenAvg[regY][regX] += g;
          regionBlueAvg[regY][regX] += b;
          regionCount[regY][regX]++;
        }
      }
    }
    
    // Fase 2: Calcular promedios por región y encontrar las mejores
    let bestRegionScore = 0;
    let bestRegionX = 0;
    let bestRegionY = 0;
    
    for (let ry = 0; ry < regionsY; ry++) {
      for (let rx = 0; rx < regionsX; rx++) {
        if (regionCount[ry][rx] > 0) {
          // Calcular promedios para esta región
          const rAvg = regionRedAvg[ry][rx] / regionCount[ry][rx];
          const gAvg = regionGreenAvg[ry][rx] / regionCount[ry][rx];
          const bAvg = regionBlueAvg[ry][rx] / regionCount[ry][rx];
          
          // Calcular ratio de dominancia del rojo (adaptado a diferentes tonos de piel)
          // Más alto es mejor para la detección PPG
          const redDominance = rAvg / ((gAvg + bAvg) / 2);
          
          // Calculamos un score compuesto que favorece regiones con:
          // 1. Alta dominancia de rojo
          // 2. Nivel rojo en el rango óptimo (ni muy alto ni muy bajo)
          // 3. Buena diferencia entre rojo y los demás canales
          const brightnessFactor = Math.max(0, 1 - Math.abs(rAvg - 150) / 150); // Óptimo cerca de 150
          const redDiffFactor = Math.min(1, (rAvg - Math.max(gAvg, bAvg)) / 50);
          
          const regionScore = redDominance * 0.5 + brightnessFactor * 0.3 + redDiffFactor * 0.2;
          
          if (regionScore > bestRegionScore) {
            bestRegionScore = regionScore;
            bestRegionX = rx;
            bestRegionY = ry;
          }
        }
      }
    }
    
    // Fase 3: Procesar solo los píxeles de la mejor región para extracción final
    if (bestRegionScore > 1.2) { // Umbral mínimo de calidad para considerar una región válida
      // Recalcular los límites para la mejor región
      const bestStartX = Math.max(startX, startX + bestRegionX * regionSize);
      const bestEndX = Math.min(endX, bestStartX + regionSize);
      const bestStartY = Math.max(startY, startY + bestRegionY * regionSize);
      const bestEndY = Math.min(endY, bestStartY + regionSize);
      
      // Reiniciar contadores para el análisis final
      redSum = 0;
      greenSum = 0;
      blueSum = 0;
      pixelCount = 0;
      
      // Procesar la mejor región encontrada
      for (let y = bestStartY; y < bestEndY; y++) {
        for (let x = bestStartX; x < bestEndX; x++) {
          const i = (y * imageData.width + x) * 4;
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          // Verificación adicional para asegurar dominancia de rojo
          if (r > g * 1.1 && r > b * 1.1) {
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            // Seguimiento de valores máximos y mínimos para análisis de variación
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
          }
        }
      }
    } else {
      // Si no encontramos una buena región, usamos el ROI completo con criterios más laxos
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * imageData.width + x) * 4;
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          // Criterio más permisivo para capturar alguna señal
          if (r > Math.max(g, b) * 1.05) {
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
          }
        }
      }
    }
    
    // Si no encontramos suficientes píxeles, probablemente no hay un dedo
    if (pixelCount < 10) {
      return 0;
    }
    
    // Calcular el valor promedio del canal rojo
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Verificaciones finales para confirmar que es una señal válida
    const redVariation = maxRed - minRed;
    const isRedDominant = avgRed > avgGreen * 1.15 && avgRed > avgBlue * 1.15;
    const hasGoodContrast = redVariation > 3 && redVariation < 60; // Evitar señales planas o ruidosas
    const isInRange = avgRed > 40 && avgRed < 250; // Rango ampliado
    
    // Retornar el valor procesado o 0 si no se detecta un dedo
    return (isRedDominant && hasGoodContrast && isInRange) ? avgRed : 0;
  }

  private analyzeSignal(filtered: number, rawValue: number): { 
    isFingerDetected: boolean; 
    quality: number;
    waveformQuality: number;
  } {
    // Actualizar buffer de valores
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.STABILITY_WINDOW) {
      this.lastValues.shift();
    }

    // Actualizar buffer de forma de onda
    this.waveformBuffer.push(rawValue);
    if (this.waveformBuffer.length > 10) {
      this.waveformBuffer.shift();
    }

    // Verificación básica de rango
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                     rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!isInRange) {
      this.resetDetectionState();
      return { 
        isFingerDetected: false, 
        quality: 0,
        waveformQuality: 0
      };
    }

    // Análisis estadístico de la señal
    const stats = this.calculateSignalStats();
    
    // Actualizar línea base
    if (this.baselineValue === null) {
      this.baselineValue = stats.mean;
    } else {
      this.baselineValue = this.baselineValue * 0.95 + stats.mean * 0.05;
    }

    // Análisis de estabilidad
    const normalizedVariance = stats.variance / (stats.mean * stats.mean);
    const isStable = normalizedVariance < this.VARIANCE_THRESHOLD;

    // Análisis de tendencia
    const trend = this.analyzeTrend();

    // Análisis de forma de onda
    const waveformQuality = this.analyzeWaveform();

    // Actualizar contador de estabilidad
    if (isStable && trend.isValid && waveformQuality > 0.6) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
    }

    // Calcular calidad general de la señal
    const quality = this.calculateSignalQuality(stats, trend, waveformQuality);

    // Determinar si el dedo está detectado
    const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    return { 
      isFingerDetected, 
      quality,
      waveformQuality
    };
  }

  private calculateSignalStats() {
    const mean = this.lastValues.reduce((a, b) => a + b, 0) / this.lastValues.length;
    const variance = this.lastValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.lastValues.length;
    return { mean, variance };
  }

  private analyzeTrend() {
    if (this.lastValues.length < 3) return { isValid: false, direction: 0 };

    const recent = this.lastValues.slice(-3);
    const differences = recent.slice(1).map((v, i) => v - recent[i]);
    const consistentDirection = differences.every(d => Math.sign(d) === Math.sign(differences[0]));
    const reasonableMagnitude = differences.every(d => Math.abs(d) < this.lastValues[0] * 0.3);

    return {
      isValid: consistentDirection && reasonableMagnitude,
      direction: consistentDirection ? Math.sign(differences[0]) : 0
    };
  }

  private analyzeWaveform(): number {
    if (this.waveformBuffer.length < 10) return 0;

    // Dividir la forma de onda en fase ascendente y descendente
    const midPoint = Math.floor(this.waveformBuffer.length / 2);
    const rising = this.waveformBuffer.slice(0, midPoint);
    const falling = this.waveformBuffer.slice(midPoint);

    // Verificar características de la onda PPG
    const risingScore = this.analyzeWaveformSegment(rising, true);
    const fallingScore = this.analyzeWaveformSegment(falling, false);

    return (risingScore + fallingScore) / 2;
  }

  private analyzeWaveformSegment(segment: number[], isRising: boolean): number {
    let validPoints = 0;
    
    for (let i = 1; i < segment.length; i++) {
      const diff = segment[i] - segment[i-1];
      const isValid = isRising ? 
        diff >= 0 && diff < segment[i-1] * 0.3 : // Subida gradual
        diff <= 0 && Math.abs(diff) < segment[i-1] * 0.3; // Bajada gradual
      
      if (isValid) validPoints++;
    }

    return validPoints / (segment.length - 1);
  }

  private calculateSignalQuality(
    stats: { mean: number; variance: number },
    trend: { isValid: boolean; direction: number },
    waveformQuality: number
  ): number {
    // Puntuación basada en la amplitud de la señal
    const amplitudeScore = Math.min(
      (stats.mean - this.currentConfig.MIN_RED_THRESHOLD) / 
      (this.currentConfig.MAX_RED_THRESHOLD - this.currentConfig.MIN_RED_THRESHOLD),
      1
    );

    // Puntuación basada en la estabilidad
    const stabilityScore = Math.max(0, 1 - Math.sqrt(stats.variance) / stats.mean);

    // Puntuación basada en la tendencia
    const trendScore = trend.isValid ? 1 : 0.5;

    // Ponderación de los diferentes factores
    const quality = Math.round(
      (amplitudeScore * 0.3 + 
       stabilityScore * 0.3 + 
       trendScore * 0.2 + 
       waveformQuality * 0.2) * 100
    );

    return Math.max(0, Math.min(100, quality));
  }

  private resetDetectionState() {
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.baselineValue = null;
    this.lastValues = [];
    this.waveformBuffer = [];
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
