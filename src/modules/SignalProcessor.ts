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
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,     // Aumentado de 40 a 60 para exigir una señal más fuerte
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 6,    // Aumentado de 4 a 6 para requerir más muestras estables
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 3
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
      // Extraer y procesar el canal rojo (el más importante para PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis avanzado de la señal para determinar la presencia del dedo y calidad
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
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

  private calculateStability(): number {
    if (this.lastValues.length < 3) {
      return 0;
    }
    
    // Calculamos variaciones a corto y largo plazo
    const shortTermVariations = [];
    const longTermTrend = [];
    
    // Variaciones a corto plazo (frame a frame)
    for (let i = 1; i < this.lastValues.length; i++) {
      shortTermVariations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
    }
    
    // Tendencia a largo plazo (comparar con la media móvil)
    const movingAvg = this.lastValues.reduce((sum, val) => sum + val, 0) / this.lastValues.length;
    for (let i = 0; i < this.lastValues.length; i++) {
      longTermTrend.push(Math.abs(this.lastValues[i] - movingAvg));
    }
    
    // Calcular las medias de variaciones
    const avgShortTerm = shortTermVariations.reduce((sum, val) => sum + val, 0) / shortTermVariations.length;
    const avgLongTerm = longTermTrend.reduce((sum, val) => sum + val, 0) / longTermTrend.length;
    
    // Análisis de periodicidad (importante para señales PPG)
    let periodicityScore = 0;
    if (this.lastValues.length > 6) {
      const peaks = [];
      const valleys = [];
      
      // Detección simple de picos y valles
      for (let i = 1; i < this.lastValues.length - 1; i++) {
        if (this.lastValues[i] > this.lastValues[i-1] && this.lastValues[i] > this.lastValues[i+1]) {
          peaks.push(i);
        } else if (this.lastValues[i] < this.lastValues[i-1] && this.lastValues[i] < this.lastValues[i+1]) {
          valleys.push(i);
        }
      }
      
      // Una buena señal PPG debe tener tanto picos como valles en intervalos regulares
      if (peaks.length >= 1 && valleys.length >= 1) {
        // La presencia de picos y valles aumenta la puntuación de periodicidad
        periodicityScore = 0.5 + (Math.min(peaks.length, valleys.length) * 0.1);
        
        // Si tenemos varios picos, verificamos si tienen intervalos regulares
        if (peaks.length > 1) {
          const peakIntervals = [];
          for (let i = 1; i < peaks.length; i++) {
            peakIntervals.push(peaks[i] - peaks[i-1]);
          }
          
          // Calcular variación de intervalos (menor variación = más regular)
          if (peakIntervals.length > 0) {
            const avgInterval = peakIntervals.reduce((sum, val) => sum + val, 0) / peakIntervals.length;
            const intervalVariation = peakIntervals.map(interval => Math.abs(interval - avgInterval) / avgInterval);
            const avgVariation = intervalVariation.reduce((sum, val) => sum + val, 0) / intervalVariation.length;
            
            // Si la variación es baja, la señal es más regular
            if (avgVariation < 0.3) {
              periodicityScore += 0.3;
            }
          }
        }
      }
    }
    
    // Pesos para diferentes componentes de estabilidad
    // - Variaciones a corto plazo: queremos que sean pequeñas pero no cero
    // - Variaciones a largo plazo: preferimos que sigan un patrón periódico
    const shortTermScore = avgShortTerm > 0.1 && avgShortTerm < 3 ? 
                          1 - (Math.min(avgShortTerm, 3) / 3) : 0;
                          
    const longTermScore = avgLongTerm > 0.2 && avgLongTerm < 10 ? 
                         0.8 - (Math.min(avgLongTerm, 10) / 15) : 0;
    
    // Combinamos los puntajes, dando mayor importancia a periodicidad y variaciones a corto plazo
    return (shortTermScore * 0.4) + (longTermScore * 0.2) + (periodicityScore * 0.4);
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastDetectionTime;
    
    // Si el valor de entrada es muy bajo, definitivamente no hay dedo
    // Incrementamos el umbral mínimo de 0 a 10 para evitar falsos positivos por ruido
    if (rawValue <= 10) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Ampliamos el rango de detección para adaptarse a más tipos de piel y condiciones de iluminación
    // Implementamos una histéresis dinámica basada en la estabilidad de las últimas lecturas
    const dynamicHysteresis = this.isCurrentlyDetected ? 
      Math.max(this.currentConfig.HYSTERESIS, 15 * (1 - this.calculateStability())) : 
      this.currentConfig.HYSTERESIS;
    
    // Verificar si el valor está dentro del rango válido con histéresis adaptativa
    const inRange = this.isCurrentlyDetected
      ? rawValue >= (this.currentConfig.MIN_RED_THRESHOLD - dynamicHysteresis) &&
        rawValue <= (this.currentConfig.MAX_RED_THRESHOLD + dynamicHysteresis)
      : rawValue >= this.currentConfig.MIN_RED_THRESHOLD &&
        rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!inRange) {
      // Reducimos la penalización para fluctuaciones breves
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
      
      // Incrementamos el tiempo de timeout para evitar falsos negativos en dedos con circulación pobre
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT * 1.5 && this.consecutiveDetections < 1) {
        this.isCurrentlyDetected = false;
      }
      
      // Calidad gradual incluso con señal débil
      const quality = this.isCurrentlyDetected ? 
        Math.max(15, this.calculateStability() * 60) : 0;
      return { isFingerDetected: this.isCurrentlyDetected, quality };
    }

    // Actualizamos el tiempo de última detección
    this.lastDetectionTime = currentTime;
    
    // Calcular estabilidad temporal de la señal con mayor peso en la consistencia de amplitud
    const stability = this.calculateStability();
    
    // Añadir el valor a nuestro historial para análisis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Actualizamos contadores de estabilidad con más margen para variaciones naturales
    if (stability > 0.6) { // Reducimos aún más el umbral para captar más tipos de señales
      // Señal estable, incrementamos constante
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.4) { // Añadimos un nivel intermedio
      // Señal moderadamente estable
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Señal inestable, pero reducimos la penalización
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3);
    }

    // Actualizar estado de detección con umbral más bajo para captar más señales
    const isStableNow = this.stableFrameCount >= (this.currentConfig.MIN_STABILITY_COUNT * 0.8);

    if (isStableNow) {
      // Incremento gradual basado en la calidad
      const detectionIncrement = stability > 0.8 ? 1.5 : stability > 0.6 ? 1.0 : 0.5;
      this.consecutiveDetections += detectionIncrement;
      
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastStableValue = filtered; // Guardar el último valor estable
      }
    } else {
      // Reducción gradual para evitar falsos negativos
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.3);
    }

    // Calcular calidad de la señal considerando varios factores con mayor peso en la estabilidad y periodicidad
    const stabilityScore = Math.min(1, stability * 1.2); // Amplificar ligeramente la estabilidad
    
    // Puntaje por intensidad - evaluar si está en un rango óptimo (ni muy bajo ni saturado)
    // Rango óptimo más amplio para adaptarse a diferentes tonos de piel
    const lowOptimal = this.currentConfig.MIN_RED_THRESHOLD + 20;
    const highOptimal = this.currentConfig.MAX_RED_THRESHOLD - 30;
    const midOptimal = (lowOptimal + highOptimal) / 2;
    
    // Distancia normalizada al valor óptimo (más cerca = mejor)
    const distanceFromOptimal = Math.abs(rawValue - midOptimal) / (highOptimal - lowOptimal);
    const intensityScore = Math.max(0, 1 - (distanceFromOptimal * 2));
    
    // Puntaje por variabilidad - una buena señal PPG debe tener cierta variabilidad periódica
    let variabilityScore = 0;
    if (this.lastValues.length >= 5) {
      const variations = [];
      for (let i = 1; i < this.lastValues.length; i++) {
        variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
      }
      
      const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
      
      // Rango de variación óptimo más amplio para adaptarse a diferentes señales
      if (avgVariation >= 0.3 && avgVariation <= 5) {
        // Escalar la variabilidad para que los valores medios (1-3) obtengan la puntuación más alta
        const normalizedVariation = Math.min(avgVariation, 5) / 5;
        variabilityScore = normalizedVariation < 0.2 ? normalizedVariation * 2.5 : 
                           normalizedVariation < 0.6 ? 1.0 : 
                           1.0 - ((normalizedVariation - 0.6) * 2.5);
      } else if (avgVariation > 0 && avgVariation < 0.3) {
        // Señal presente pero muy débil
        variabilityScore = 0.3;
      }
    }
    
    // Combinar los puntajes con pesos ajustados para priorizar estabilidad y periodicidad
    const qualityRaw = (stabilityScore * 0.5) + (intensityScore * 0.2) + (variabilityScore * 0.3);
    
    // Bonus de calidad para señales que ya han sido confirmadas por un tiempo
    const confirmationBonus = this.isCurrentlyDetected && this.consecutiveDetections > this.currentConfig.MIN_CONSECUTIVE_DETECTIONS * 2 ? 0.1 : 0;
    
    // Escalar a 0-100 y redondear, con un bonus para señales confirmadas
    const quality = Math.round(Math.min(1, qualityRaw + confirmationBonus) * 100);
    
    // Aplicar umbral final - reportamos calidad incluso con detección parcial para feedback
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: this.isCurrentlyDetected ? quality : Math.round(quality * 0.3) // Calidad reducida si no está completamente confirmado
    };
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
