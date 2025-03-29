
/**
 * Procesador de frames de cámara
 * Extrae datos PPG de frames de video
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { CombinedExtractor } from '../extraction/CombinedExtractor';

export class CameraFrameProcessor {
  private extractor: CombinedExtractor;
  private lastProcessedTime: number = 0;
  private processingInterval: number = 30; // ms entre procesamiento
  private frameCount: number = 0;
  
  constructor() {
    this.extractor = new CombinedExtractor();
    console.log("CameraFrameProcessor: Inicializado con extractor combinado");
  }
  
  /**
   * Procesa un frame de la cámara y extrae datos PPG
   */
  public processFrame(imageData: ImageData): { 
    ppgSignal: ProcessedPPGSignal,
    heartBeatData: { isPeak: boolean, intervals: number[], lastPeakTime: number | null }
  } | null {
    try {
      const now = Date.now();
      
      // Limitar frecuencia de procesamiento
      if (now - this.lastProcessedTime < this.processingInterval) {
        return null;
      }
      
      this.lastProcessedTime = now;
      this.frameCount++;
      
      // Extraer valor PPG del frame (R-G)
      const ppgValue = this.extractPPGValue(imageData);
      
      // Procesar a través del extractor combinado
      const result = this.extractor.processValue(ppgValue);
      
      // Registro periódico
      if (this.frameCount % 30 === 0) {
        console.log("CameraFrameProcessor: Frame procesado", {
          frameCount: this.frameCount,
          ppgValue,
          signalStrength: result.ppg.signalStrength,
          fingerDetected: result.ppg.fingerDetected,
          isPeak: result.heartbeat.isPeak,
          rrIntervals: result.heartbeat.intervals.length
        });
      }
      
      // Construir objeto de señal PPG procesada
      const ppgSignal: ProcessedPPGSignal = {
        rawValue: ppgValue,
        filteredValue: result.combined.value,
        timestamp: now,
        quality: result.quality || 0,
        fingerDetected: result.ppg.fingerDetected,
        isPeak: result.heartbeat.isPeak,
        lastPeakTime: result.heartbeat.lastPeakTime,
        rrIntervals: result.heartbeat.intervals,
        signalStrength: result.ppg.signalStrength
      };
      
      return {
        ppgSignal,
        heartBeatData: {
          isPeak: result.heartbeat.isPeak,
          intervals: result.heartbeat.intervals,
          lastPeakTime: result.heartbeat.lastPeakTime
        }
      };
    } catch (error) {
      console.error("Error procesando frame:", error);
      return null;
    }
  }
  
  /**
   * Extrae valor PPG de un frame de imagen
   * Utiliza diferencia R-G como señal PPG primaria
   */
  private extractPPGValue(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Region de interés (centro de la imagen)
    const roiSize = Math.min(width, height) / 3;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const startX = Math.max(0, centerX - Math.floor(roiSize / 2));
    const startY = Math.max(0, centerY - Math.floor(roiSize / 2));
    const endX = Math.min(width, centerX + Math.floor(roiSize / 2));
    const endY = Math.min(height, centerY + Math.floor(roiSize / 2));
    
    // Acumuladores para componentes RGB
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Muestrear cada 4 píxeles para rendimiento
    const sampleStep = 4;
    
    // Procesar región de interés
    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        const idx = (y * width + x) * 4;
        redSum += data[idx];
        greenSum += data[idx + 1];
        blueSum += data[idx + 2];
        pixelCount++;
      }
    }
    
    // Evitar división por cero
    if (pixelCount === 0) return 0;
    
    // Calcular promedios
    const redAvg = redSum / pixelCount;
    const greenAvg = greenSum / pixelCount;
    const blueAvg = blueSum / pixelCount;
    
    // Calcular señal PPG como diferencia normalizada
    // La señal principal es R-G (sensible a cambios en la sangre)
    const signal = (redAvg - greenAvg) / (redAvg + greenAvg + 1);
    
    return signal;
  }
  
  /**
   * Configura el extractor combinado
   */
  public configure(config: {
    heartbeat?: {
      peakThreshold?: number;
      minPeakDistance?: number;
    };
    ppg?: {
      minSignalThreshold?: number;
    };
  }): void {
    this.extractor.configure(config);
  }
  
  /**
   * Reinicia el procesador y el extractor
   */
  public reset(): void {
    this.extractor.reset();
    this.frameCount = 0;
    this.lastProcessedTime = 0;
  }
  
  /**
   * Establece intervalo entre procesamiento de frames
   */
  public setProcessingInterval(interval: number): void {
    this.processingInterval = Math.max(10, interval);
  }
}
