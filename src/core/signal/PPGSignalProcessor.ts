import { Frame, FrameAnalysisResult, FrameData, ProcessingOptions, ROISettings } from '../../types/signal';
import { EMDProcessorImpl } from './EMDProcessor';

const DEFAULT_ROI_SETTINGS: ROISettings = {
  rows: 3,
  cols: 3,
  centerWeight: 1.5,
  qualityThreshold: 0.5,
  redDominanceMin: 1.15  // Reducido para ser más sensible a diferentes tipos de piel
};

// Umbrales ajustados para mejor detección
const MIN_RED_THRESHOLD = 120;  // Reducido para ser más sensible
const MAX_RED_THRESHOLD = 250;
const MIN_SIGNAL_QUALITY = 0.45;  // Reducido para mayor sensibilidad

/**
 * Clase encargada del procesamiento de señales PPG
 * Extrae y procesa la señal fotopletismográfica de los frames de video
 */
export class PPGSignalProcessor {
  private signalBuffer: number[] = [];
  private rgbBuffers: { r: number[], g: number[], b: number[] } = { r: [], g: [], b: [] };
  private roiSettings: ROISettings;
  private emdProcessor: EMDProcessorImpl | null = null;
  private processingOptions: ProcessingOptions;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private samplingRate: number = 30; // fps estimado inicial
  private frameInterval: number = 33.33; // ms entre frames (estimado inicial)
  private lastStableRegion: { row: number, col: number } | null = null;
  private stableRegionCounter: number = 0;
  
  constructor(options?: ProcessingOptions) {
    this.processingOptions = options || {};
    this.roiSettings = options?.roiSettings || DEFAULT_ROI_SETTINGS;
    
    // Inicializar procesador EMD si está habilitado
    if (options?.enableEMD) {
      this.emdProcessor = new EMDProcessorImpl(options.emdOptions);
    }
  }

  /**
   * Procesa un frame de video para extraer la señal PPG
   * @param frame Frame de video a procesar
   * @returns Resultado del análisis del frame
   */
  public processFrame(frame: Frame): FrameAnalysisResult {
    // Calcular el tiempo entre frames para estimar la tasa de muestreo
    const now = Date.now();
    if (this.lastFrameTime > 0) {
      this.frameInterval = now - this.lastFrameTime;
      this.samplingRate = 1000 / this.frameInterval;
    }
    this.lastFrameTime = now;
    this.frameCount++;

    // Dividir el frame en regiones y analizar cada una
    const bestRegion = this.analyzeFrame(frame);
    
    // Si no se encontró una región válida, retornar resultado sin dedo detectado
    if (!bestRegion) {
      return { 
        isFingerDetected: false, 
        signalValue: 0,
        signalQuality: 0,
        timestamp: now,
        frameData: null
      };
    }

    // Extraer los valores RGB promedio de la mejor región
    const { r, g, b } = bestRegion.avgColors;
    
    // Usar el canal de acuerdo a la configuración
    let signalValue: number;
    if (this.processingOptions.useGreenChannel) {
      signalValue = g;  // Usar canal verde (más común en la literatura)
      this.rgbBuffers.g.push(g);
    } else {
      signalValue = r;  // Por defecto usar canal rojo que es más intenso en PPG de dedo
      this.rgbBuffers.r.push(r);
    }
    this.rgbBuffers.b.push(b);
    
    // Mantener un buffer limitado
    const bufferSize = this.processingOptions.windowSize || 150;
    if (this.rgbBuffers.r.length > bufferSize) {
      this.rgbBuffers.r.shift();
      this.rgbBuffers.g.shift();
      this.rgbBuffers.b.shift();
    }
    
    // Añadir al buffer de señal
    this.signalBuffer.push(signalValue);
    if (this.signalBuffer.length > bufferSize) {
      this.signalBuffer.shift();
    }
    
    // Aplicar EMD si está habilitado y tenemos suficientes datos
    let processedSignal = this.signalBuffer;
    let frameData: FrameData | null = null;
    
    if (this.emdProcessor && this.signalBuffer.length >= 30) {
      try {
        const { imfs, residue } = this.emdProcessor.decompose(this.signalBuffer);
        
        // Determinar qué IMFs contienen información de frecuencia cardíaca 
        // Típicamente los IMFs 1-3 contienen la información de pulso
        if (imfs.length >= 2) {
          // Reconstruir señal usando IMFs relevantes (excluir ruido de alta frecuencia)
          processedSignal = this.emdProcessor.reconstruct(imfs, [1, 2]);
          
          frameData = {
            original: this.signalBuffer.slice(),
            processed: processedSignal,
            decomposition: imfs,
            residue: residue
          };
        }
      } catch (error) {
        console.error("Error en procesamiento EMD:", error);
      }
    }
    
    // Calcular calidad de la señal
    const signalQuality = this.calculateSignalQuality(signalValue, bestRegion);
    
    return {
      isFingerDetected: signalQuality > MIN_SIGNAL_QUALITY,
      signalValue: processedSignal[processedSignal.length - 1],
      signalQuality,
      timestamp: now,
      frameData
    };
  }

  /**
   * Calcula la calidad de la señal basada en varios factores
   */
  private calculateSignalQuality(signalValue: number, region: any): number {
    const { avgColors, row, col } = region;
    const { r, g, b } = avgColors;
    
    // Factor 1: Estabilidad de la región (preferimos una región estable para mediciones continuas)
    let stabilityFactor = 0;
    if (this.lastStableRegion && this.lastStableRegion.row === row && this.lastStableRegion.col === col) {
      this.stableRegionCounter = Math.min(50, this.stableRegionCounter + 1);
      stabilityFactor = Math.min(1.0, this.stableRegionCounter / 20);
    } else {
      this.stableRegionCounter = 0;
      this.lastStableRegion = { row, col };
    }
    
    // Factor 2: Dominancia del rojo (el rojo tiende a dominar en el espectro PPG del dedo)
    const redDominance = r / ((g + b) / 2);
    const dominanceFactor = Math.min(1.0, Math.max(0, (redDominance - 1) / 0.5));
    
    // Factor 3: Valor absoluto del rojo (debe estar en un rango razonable)
    const redRangeFactor = r < MIN_RED_THRESHOLD || r > MAX_RED_THRESHOLD ? 
                          0 : 1 - Math.abs((r - 185) / 65);
    
    // Factor 4: Variabilidad de la señal en el tiempo
    let variabilityFactor = 0;
    if (this.signalBuffer.length >= 10) {
      const recentValues = this.signalBuffer.slice(-10);
      const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length;
      const sd = Math.sqrt(variance);
      // Una señal PPG debe tener cierta variabilidad, pero no demasiada
      variabilityFactor = Math.min(1.0, sd / 5);
      if (sd > 20) variabilityFactor *= 0.5;  // Penalizar variabilidad excesiva
    }
    
    // Calcular calidad combinada
    const qualityScore = (
      stabilityFactor * 0.4 + 
      dominanceFactor * 0.3 + 
      redRangeFactor * 0.2 + 
      variabilityFactor * 0.1
    );
    
    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * Analiza un frame completo dividido en regiones (ROI)
   * @returns La mejor región para el análisis PPG
   */
  private analyzeFrame(frame: Frame): any | null {
    if (!frame || !frame.data || frame.width <= 0 || frame.height <= 0) {
      return null;
    }

    const { rows, cols } = this.roiSettings;
    const regionWidth = Math.floor(frame.width / cols);
    const regionHeight = Math.floor(frame.height / rows);
    
    let bestRegion: any = null;
    let highestScore = 0;
    
    // Analizar cada región
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const regionData = this.extractRegion(frame, row, col, regionWidth, regionHeight);
        const regionScore = this.scoreRegion(regionData, row, col);
        
        if (regionScore > highestScore) {
          highestScore = regionScore;
          bestRegion = {
            row, 
            col,
            avgColors: regionData,
            score: regionScore
          };
        }
      }
    }
    
    // Si la puntuación más alta no supera el umbral, considerar que no hay dedo presente
    if (highestScore < this.roiSettings.qualityThreshold) {
      return null;
    }
    
    return bestRegion;
  }

  /**
   * Extrae información de color de una región específica
   */
  private extractRegion(frame: Frame, row: number, col: number, regionWidth: number, regionHeight: number): { r: number, g: number, b: number } {
    const startX = col * regionWidth;
    const startY = row * regionHeight;
    const endX = Math.min(startX + regionWidth, frame.width);
    const endY = Math.min(startY + regionHeight, frame.height);
    
    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * frame.width + x) * 4;
        totalR += frame.data[idx];     // R
        totalG += frame.data[idx + 1]; // G
        totalB += frame.data[idx + 2]; // B
        pixelCount++;
      }
    }
    
    return {
      r: totalR / pixelCount,
      g: totalG / pixelCount,
      b: totalB / pixelCount
    };
  }

  /**
   * Asigna una puntuación a una región basada en su idoneidad para detección PPG
   */
  private scoreRegion(regionColors: { r: number, g: number, b: number }, row: number, col: number): number {
    const { r, g, b } = regionColors;
    const { rows, cols, centerWeight } = this.roiSettings;
    
    // Verificar si los valores están en rangos razonables para PPG
    if (r < MIN_RED_THRESHOLD || r > MAX_RED_THRESHOLD) {
      return 0;
    }
    
    // Mejor detección si el rojo domina sobre otros colores (característica de sangre)
    const redDominance = r / ((g + b) / 2);
    if (redDominance < this.roiSettings.redDominanceMin) {
      return 0;
    }
    
    // Favorecer regiones centrales (donde suele estar el dedo)
    const rowCenter = (rows - 1) / 2;
    const colCenter = (cols - 1) / 2;
    const rowDistance = Math.abs(row - rowCenter);
    const colDistance = Math.abs(col - colCenter);
    const distanceFromCenter = Math.sqrt(rowDistance * rowDistance + colDistance * colDistance);
    const maxDistance = Math.sqrt(rowCenter * rowCenter + colCenter * colCenter);
    const centerFactor = 1 - (distanceFromCenter / maxDistance);
    
    // Asignar más peso al factor central si se especifica
    const adjustedCenterFactor = centerWeight > 1 ? 
                                Math.pow(centerFactor, 1 / centerWeight) : 
                                centerFactor;
    
    // Calcular puntuación final
    let score = (
      redDominance * 0.4 + 
      adjustedCenterFactor * 0.4 + 
      Math.min(1, r / 200) * 0.2
    );
    
    return score;
  }

  /**
   * Obtiene el buffer de señal actual
   */
  public getSignalBuffer(): number[] {
    return this.signalBuffer.slice();
  }
  
  /**
   * Obtiene los buffers RGB para análisis
   */
  public getRGBBuffers(): { r: number[], g: number[], b: number[] } {
    return {
      r: this.rgbBuffers.r.slice(),
      g: this.rgbBuffers.g.slice(),
      b: this.rgbBuffers.b.slice()
    };
  }
  
  /**
   * Obtiene la tasa de muestreo actual (frames por segundo)
   */
  public getSamplingRate(): number {
    return this.samplingRate;
  }
  
  /**
   * Obtiene la calidad de procesamiento basada en la estabilidad del intervalo de frames
   */
  public getProcessingQuality(): number {
    if (this.frameCount < 30) return 0.5; // Calidad por defecto hasta tener suficientes frames
    
    // Una buena cámara debería tener intervalos consistentes entre frames
    return Math.min(1.0, 33 / this.frameInterval);
  }
  
  /**
   * Reinicia los buffers y el estado del procesador
   */
  public reset(): void {
    this.signalBuffer = [];
    this.rgbBuffers = { r: [], g: [], b: [] };
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.lastStableRegion = null;
    this.stableRegionCounter = 0;
  }
} 