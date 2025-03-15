
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { FingerDetector } from '../modules/finger-detection/FingerDetector';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';
import type { ProcessedSignal } from '../types/signal';

/**
 * Servicio centralizado para procesamiento de señal PPG
 * Coordina el detector de dedo y el procesador de señal
 */
export class PPGSignalService {
  private fingerDetector: FingerDetector;
  private signalProcessor: SignalProcessor;
  private isProcessing: boolean = false;
  private lastProcessedSignal: ProcessedSignal | null = null;
  private rgbSummary: {red: number, green: number, blue: number} = {red: 0, green: 0, blue: 0};
  private frameCount: number = 0;
  
  constructor() {
    this.fingerDetector = new FingerDetector();
    this.signalProcessor = new SignalProcessor();
    console.log("PPGSignalService: Servicio inicializado");
  }
  
  /**
   * Inicia el procesamiento de señal
   */
  public startProcessing(): void {
    this.isProcessing = true;
    this.frameCount = 0;
    console.log("PPGSignalService: Procesamiento iniciado");
  }
  
  /**
   * Detiene el procesamiento de señal
   */
  public stopProcessing(): void {
    this.isProcessing = false;
    this.lastProcessedSignal = null;
    this.fingerDetector.reset();
    this.signalProcessor.reset();
    console.log("PPGSignalService: Procesamiento detenido");
  }
  
  /**
   * Procesa un frame de imagen y extrae la señal PPG
   * @param imageData Datos de imagen del frame de la cámara
   * @returns Señal procesada o null si no se está procesando
   */
  public processFrame(imageData: ImageData): ProcessedSignal | null {
    if (!this.isProcessing) return null;
    
    this.frameCount++;
    
    try {
      // Extraer valores RGB del frame para análisis
      const { rawValue, redValue, greenValue, blueValue } = this.extractFrameValues(imageData);
      
      // Guardar valores RGB para análisis fisiológico
      this.rgbSummary = {
        red: redValue,
        green: greenValue,
        blue: blueValue
      };
      
      // Proporcionar valores RGB al procesador para análisis fisiológico
      this.signalProcessor.setRGBValues(redValue, greenValue);
      
      // Aplicar filtro para obtener señal limpia
      const filteredValue = this.signalProcessor.applySMAFilter(rawValue);
      
      // Obtener calidad de señal del procesador
      const signalQuality = this.signalProcessor.getSignalQuality();
      
      // Determinar si hay dedo presente mediante procesador especializado con verificación fisiológica
      const fingerDetectionResult = this.fingerDetector.processQuality(
        signalQuality,
        redValue,
        greenValue
      );
      
      // Construir objeto de señal procesada
      const signal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: rawValue,
        filteredValue: filteredValue,
        quality: signalQuality,
        fingerDetected: fingerDetectionResult.isFingerDetected,
        roi: this.calculateROI(imageData.width, imageData.height),
        physicalSignatureScore: fingerDetectionResult.quality,
        rgbValues: this.rgbSummary
      };
      
      // Log detallado cada 30 frames para análisis
      if (this.frameCount % 30 === 0) {
        console.log("PPGSignalService: Análisis de calidad de señal", {
          calidad: signalQuality,
          dedoDetectado: fingerDetectionResult.isFingerDetected,
          valorRojo: redValue,
          valorVerde: greenValue,
          ratioRG: redValue / Math.max(1, greenValue),
          frame: this.frameCount
        });
      }
      
      this.lastProcessedSignal = signal;
      return signal;
    } catch (error) {
      console.error("PPGSignalService: Error procesando frame", error);
      return null;
    }
  }
  
  /**
   * Extrae valores RGB promedio del frame para análisis
   */
  private extractFrameValues(imageData: ImageData): { 
    rawValue: number, 
    redValue: number, 
    greenValue: number,
    blueValue: number
  } {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    
    // Calcular región central para análisis (25% del centro)
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const roiSize = Math.floor(Math.min(width, height) * 0.25);
    const startX = Math.max(0, centerX - roiSize / 2);
    const startY = Math.max(0, centerY - roiSize / 2);
    const endX = Math.min(width, centerX + roiSize / 2);
    const endY = Math.min(height, centerY + roiSize / 2);
    
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Procesar región de interés
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        redSum += pixels[idx];
        greenSum += pixels[idx + 1];
        blueSum += pixels[idx + 2];
        pixelCount++;
      }
    }
    
    // Calcular promedios
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Valor principal: intensidad roja para análisis PPG
    const rawValue = avgRed;
    
    return {
      rawValue,
      redValue: avgRed,
      greenValue: avgGreen,
      blueValue: avgBlue
    };
  }
  
  /**
   * Calcula la región de interés (ROI) para análisis
   */
  private calculateROI(width: number, height: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const roiSize = Math.floor(Math.min(width, height) * 0.25);
    
    return {
      x: Math.max(0, centerX - roiSize / 2),
      y: Math.max(0, centerY - roiSize / 2),
      width: roiSize,
      height: roiSize
    };
  }
  
  /**
   * Obtiene la última señal procesada
   */
  public getLastProcessedSignal(): ProcessedSignal | null {
    return this.lastProcessedSignal;
  }
  
  /**
   * Obtiene el resumen de valores RGB actuales
   */
  public getRGBSummary(): {red: number, green: number, blue: number} {
    return {...this.rgbSummary};
  }
  
  /**
   * Reinicia completamente el servicio
   */
  public reset(): void {
    this.stopProcessing();
    this.lastProcessedSignal = null;
    this.frameCount = 0;
    console.log("PPGSignalService: Servicio reiniciado completamente");
  }
}

// Crear una instancia global del servicio
export const ppgSignalService = new PPGSignalService();
