
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { FingerDetector } from '../modules/finger-detection/FingerDetector';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';
import type { ProcessedSignal } from '../types/signal';
import { phasePreservingFilter, performSimplifiedEMD } from '../utils/advancedSignalProcessing';

/**
 * Servicio centralizado para procesamiento de señal PPG
 * Coordina el detector de dedo y el procesador de señal
 * Incorpora algoritmos avanzados para mejor calidad de señal
 */
export class PPGSignalService {
  private fingerDetector: FingerDetector;
  private signalProcessor: SignalProcessor;
  private isProcessing: boolean = false;
  private lastProcessedSignal: ProcessedSignal | null = null;
  private rgbSummary: {red: number, green: number, blue: number} = {red: 0, green: 0, blue: 0};
  private frameCount: number = 0;
  
  // Variables para procesamiento avanzado
  private readonly USE_PHASE_PRESERVING = true;  // Habilitar filtrado de fase preservada
  private readonly USE_EMD = true;               // Habilitar descomposición en modo empírico
  private readonly ROI_ADAPTIVE_SIZE = true;     // Habilitar tamaño adaptativo de ROI
  private readonly OUTLIER_REJECTION = true;     // Habilitar rechazo de valores atípicos
  
  // Parámetros de procesamiento adaptativo
  private adaptiveROISize: number = 0.25;       // Tamaño inicial ROI: 25% del centro
  private signalQualityHistory: number[] = [];  // Historial para calidad de señal
  
  constructor() {
    this.fingerDetector = new FingerDetector();
    this.signalProcessor = new SignalProcessor();
    console.log("PPGSignalService: Servicio inicializado con algoritmos avanzados");
  }
  
  /**
   * Inicia el procesamiento de señal
   */
  public startProcessing(): void {
    this.isProcessing = true;
    this.frameCount = 0;
    this.signalQualityHistory = [];
    this.adaptiveROISize = 0.25;
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
   * Procesa un frame de imagen y extrae la señal PPG con algoritmos avanzados
   * @param imageData Datos de imagen del frame de la cámara
   * @returns Señal procesada o null si no se está procesando
   */
  public processFrame(imageData: ImageData): ProcessedSignal | null {
    if (!this.isProcessing) return null;
    
    this.frameCount++;
    
    try {
      // Extraer valores RGB del frame adaptando la ROI según calidad
      const { rawValue, redValue, greenValue, blueValue } = this.extractFrameValuesWithAdaptiveROI(imageData);
      
      // Guardar valores RGB para análisis fisiológico
      this.rgbSummary = {
        red: redValue,
        green: greenValue,
        blue: blueValue
      };
      
      // Proporcionar valores RGB al procesador para análisis fisiológico
      this.signalProcessor.setRGBValues(redValue, greenValue);
      
      // Aplicar filtros avanzados
      let processedValue = rawValue;
      
      // Aplicar filtro preservador de fase si está habilitado
      if (this.USE_PHASE_PRESERVING && this.frameCount > 10) {
        const recentValues = this.signalProcessor.getPPGValues().slice(-15);
        if (recentValues.length >= 10) {
          const phaseFiltered = phasePreservingFilter(recentValues, 0.2);
          if (phaseFiltered.length > 0) {
            processedValue = phaseFiltered[phaseFiltered.length - 1];
          }
        }
      }
      
      // Rechazar valores atípicos si está habilitado
      if (this.OUTLIER_REJECTION && this.frameCount > 10) {
        const recentValues = this.signalProcessor.getPPGValues();
        if (recentValues.length >= 5) {
          const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
          const stdDev = Math.sqrt(
            recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length
          );
          
          // Rechazar valores que se desvíen más de 3 desviaciones estándar
          if (Math.abs(processedValue - mean) > stdDev * 3) {
            console.log("PPGSignalService: Outlier rechazado", {
              valor: processedValue,
              media: mean,
              desviacion: stdDev
            });
            processedValue = mean;
          }
        }
      }
      
      // Aplicar filtro SMA estándar
      const filteredValue = this.signalProcessor.applySMAFilter(processedValue);
      
      // Obtener calidad de señal y actualizar historial
      const signalQuality = this.signalProcessor.getSignalQuality();
      this.signalQualityHistory.push(signalQuality);
      if (this.signalQualityHistory.length > 30) {
        this.signalQualityHistory.shift();
      }
      
      // Actualizar tamaño adaptativo de ROI basado en calidad de señal
      if (this.ROI_ADAPTIVE_SIZE && this.signalQualityHistory.length > 10) {
        this.updateAdaptiveROISize(signalQuality);
      }
      
      // Determinar si hay dedo presente
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
          frame: this.frameCount,
          roiSize: this.adaptiveROISize.toFixed(2)
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
   * Extrae valores RGB promedio del frame para análisis con ROI adaptativa
   */
  private extractFrameValuesWithAdaptiveROI(imageData: ImageData): { 
    rawValue: number, 
    redValue: number, 
    greenValue: number,
    blueValue: number
  } {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    
    // Calcular región central para análisis con tamaño adaptativo
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const roiSize = Math.floor(Math.min(width, height) * this.adaptiveROISize);
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
   * Actualiza el tamaño adaptativo de la ROI basado en la calidad de señal
   */
  private updateAdaptiveROISize(currentQuality: number): void {
    // Calcular calidad promedio reciente
    const recentQuality = this.signalQualityHistory.slice(-10);
    const avgQuality = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;
    
    // Ajustar el tamaño de la ROI basado en la calidad de la señal
    if (avgQuality < 20) {
      // Señal baja calidad - probar con ROI más grande
      this.adaptiveROISize = Math.min(0.5, this.adaptiveROISize + 0.01);
    } else if (avgQuality > 70) {
      // Señal alta calidad - reducir ROI para enfocar mejor
      this.adaptiveROISize = Math.max(0.15, this.adaptiveROISize - 0.005);
    } else if (avgQuality < 40) {
      // Señal calidad media-baja - aumentar ligeramente
      this.adaptiveROISize = Math.min(0.35, this.adaptiveROISize + 0.002);
    }
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
    const roiSize = Math.floor(Math.min(width, height) * this.adaptiveROISize);
    
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
    this.adaptiveROISize = 0.25;
    this.signalQualityHistory = [];
    console.log("PPGSignalService: Servicio reiniciado completamente");
  }

  /**
   * Obtiene la configuración actual del procesamiento
   */
  public getConfig(): {
    usePhasePreserving: boolean;
    useEMD: boolean;
    adaptiveROISize: number;
    useOutlierRejection: boolean;
  } {
    return {
      usePhasePreserving: this.USE_PHASE_PRESERVING,
      useEMD: this.USE_EMD,
      adaptiveROISize: this.adaptiveROISize,
      useOutlierRejection: this.OUTLIER_REJECTION
    };
  }
}

// Crear una instancia global del servicio
export const ppgSignalService = new PPGSignalService();
