/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { FingerDetector } from '../modules/finger-detection/FingerDetector';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';
import { PanTompkinsProcessor } from '../modules/vital-signs/pan-tompkins-processor';
import type { ProcessedSignal } from '../types/signal';

/**
 * Servicio centralizado para procesamiento de señal PPG
 * Coordina el detector de dedo y el procesador de señal
 * Implementa técnicas avanzadas de extracción multiespectral y algoritmo Pan-Tompkins modificado
 */
export class PPGSignalService {
  private fingerDetector: FingerDetector;
  private signalProcessor: SignalProcessor;
  private panTompkinsProcessor: PanTompkinsProcessor;
  private isProcessing: boolean = false;
  private lastProcessedSignal: ProcessedSignal | null = null;
  private rgbSummary: {red: number, green: number, blue: number} = {red: 0, green: 0, blue: 0};
  private frameCount: number = 0;
  
  // Variables para extraccón multiespectral
  private channelQualityHistory: {red: number[], green: number[], blue: number[]} = {
    red: [],
    green: [],
    blue: []
  };
  private readonly CHANNEL_HISTORY_SIZE = 10;
  
  // Variables para almacenar los últimos valores PPG para Pan-Tompkins
  private ppgBuffer: number[] = [];
  private readonly PPG_BUFFER_SIZE = 128; // Ajustado para Pan-Tompkins
  
  constructor() {
    this.fingerDetector = new FingerDetector();
    this.signalProcessor = new SignalProcessor();
    this.panTompkinsProcessor = new PanTompkinsProcessor();
    console.log("PPGSignalService: Servicio inicializado con extracción multiespectral adaptativa y Pan-Tompkins modificado");
  }
  
  /**
   * Inicia el procesamiento de señal
   */
  public startProcessing(): void {
    this.isProcessing = true;
    this.frameCount = 0;
    this.ppgBuffer = [];
    // Reiniciar historial de calidad de canales
    this.channelQualityHistory = { red: [], green: [], blue: [] };
    this.panTompkinsProcessor.reset();
    console.log("PPGSignalService: Procesamiento iniciado con extracción multiespectral y Pan-Tompkins");
  }
  
  /**
   * Detiene el procesamiento de señal
   */
  public stopProcessing(): void {
    this.isProcessing = false;
    this.lastProcessedSignal = null;
    this.fingerDetector.reset();
    this.signalProcessor.reset();
    this.panTompkinsProcessor.reset();
    console.log("PPGSignalService: Procesamiento detenido");
  }
  
  /**
   * Procesa un frame de imagen y extrae la señal PPG con técnicas multiespectrales
   * y algoritmo Pan-Tompkins modificado
   * @param imageData Datos de imagen del frame de la cámara
   * @returns Señal procesada o null si no se está procesando
   */
  public processFrame(imageData: ImageData): ProcessedSignal | null {
    if (!this.isProcessing) return null;
    
    this.frameCount++;
    
    try {
      // Extracción multiespectral adaptativa
      const { 
        rawValue, 
        redValue, 
        greenValue, 
        blueValue,
        channelQualities,
        multispectralValue
      } = this.extractMultispectralValues(imageData);
      
      // Guardar valores RGB para análisis fisiológico
      this.rgbSummary = {
        red: redValue,
        green: greenValue,
        blue: blueValue
      };
      
      // Proporcionar valores RGB al procesador para análisis fisiológico
      this.signalProcessor.setRGBValues(redValue, greenValue);
      
      // Aplicar filtro para obtener señal limpia usando el valor multiespectral
      const filteredValue = this.signalProcessor.applySMAFilter(multispectralValue);
      
      // Actualizar buffer PPG para procesamiento Pan-Tompkins
      this.updatePPGBuffer(filteredValue);
      
      // Aplicar algoritmo Pan-Tompkins modificado si tenemos suficientes datos
      const panTompkinsResult = this.panTompkinsProcessor.process(filteredValue, this.ppgBuffer);
      
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
        rawValue: multispectralValue,
        filteredValue: filteredValue,
        quality: signalQuality,
        fingerDetected: fingerDetectionResult.isFingerDetected,
        roi: this.calculateROI(imageData.width, imageData.height),
        physicalSignatureScore: fingerDetectionResult.quality,
        rgbValues: this.rgbSummary,
        panTompkinsMetrics: {
          isPeak: panTompkinsResult.isPeak,
          threshold: panTompkinsResult.threshold,
          accuracy: panTompkinsResult.accuracy,
          signalStrength: panTompkinsResult.signalStrength
        }
      };
      
      // Log detallado cada 30 frames para análisis
      if (this.frameCount % 30 === 0) {
        console.log("PPGSignalService: Análisis multiespectral con Pan-Tompkins", {
          calidad: signalQuality,
          dedoDetectado: fingerDetectionResult.isFingerDetected,
          valorMultiespectral: multispectralValue.toFixed(2),
          pesoRojo: channelQualities.redWeight.toFixed(2),
          pesoVerde: channelQualities.greenWeight.toFixed(2),
          pesoAzul: channelQualities.blueWeight.toFixed(2),
          panTompkins: {
            esPico: panTompkinsResult.isPeak,
            umbral: panTompkinsResult.threshold.toFixed(3),
            precisión: panTompkinsResult.accuracy.toFixed(2)
          },
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
   * Actualiza el buffer PPG para el algoritmo Pan-Tompkins
   */
  private updatePPGBuffer(value: number): void {
    this.ppgBuffer.push(value);
    if (this.ppgBuffer.length > this.PPG_BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
  }
  
  /**
   * Extrae valores RGB promedio del frame usando técnica multiespectral adaptativa
   * Implementa ponderación dinámica basada en calidad de señal de cada canal
   */
  private extractMultispectralValues(imageData: ImageData): { 
    rawValue: number, 
    redValue: number, 
    greenValue: number,
    blueValue: number,
    channelQualities: {
      redQuality: number,
      greenQuality: number,
      blueQuality: number,
      redWeight: number,
      greenWeight: number,
      blueWeight: number
    },
    multispectralValue: number
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
    
    // Analizar calidad de cada canal
    const redQuality = this.analyzeChannelQuality(avgRed, this.channelQualityHistory.red);
    const greenQuality = this.analyzeChannelQuality(avgGreen, this.channelQualityHistory.green);
    const blueQuality = this.analyzeChannelQuality(avgBlue, this.channelQualityHistory.blue);
    
    // Actualizar historial de calidad de canales
    this.updateChannelQualityHistory(avgRed, avgGreen, avgBlue);
    
    // Calcular pesos dinámicos basados en calidad
    const totalQuality = redQuality + greenQuality + blueQuality;
    
    // Establecer pesos predeterminados si no hay suficiente información de calidad
    let redWeight = 0.7;    // Canal rojo tradicionalmente tiene más información PPG
    let greenWeight = 0.25; // Canal verde tiene información complementaria
    let blueWeight = 0.05;  // Canal azul típicamente tiene menos información PPG pero puede ayudar
    
    // Aplicar pesos dinámicos si hay suficiente información de calidad
    if (totalQuality > 0) {
      redWeight = redQuality / totalQuality;
      greenWeight = greenQuality / totalQuality;
      blueWeight = blueQuality / totalQuality;
    }
    
    // Calcular valor multiespectral ponderado
    const multispectralValue = (avgRed * redWeight) + (avgGreen * greenWeight) + (avgBlue * blueWeight);
    
    return {
      rawValue: avgRed, // Mantenemos el valor rojo como referencia para compatibilidad
      redValue: avgRed,
      greenValue: avgGreen,
      blueValue: avgBlue,
      channelQualities: {
        redQuality,
        greenQuality,
        blueQuality,
        redWeight,
        greenWeight,
        blueWeight
      },
      multispectralValue
    };
  }
  
  /**
   * Analiza la calidad de un canal basado en su variabilidad y otros factores
   * @param currentValue Valor actual del canal
   * @param history Historial de valores del canal
   * @returns Puntuación de calidad del canal
   */
  private analyzeChannelQuality(currentValue: number, history: number[]): number {
    if (history.length < 3) return 0.5; // Valor neutral si no hay suficiente historial
    
    // Calcular variación (deseable cierta variación para señal PPG)
    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);
    const coeffVar = stdDev / mean;
    
    // Una buena señal PPG debe tener cierta variabilidad (no demasiada, no demasiado poca)
    let variabilityScore = 0;
    if (coeffVar < 0.001) {
      variabilityScore = 0; // Demasiado estable, probablemente no es PPG
    } else if (coeffVar > 0.1) {
      variabilityScore = 0; // Demasiado variable, probablemente ruido
    } else {
      // Óptimo alrededor de 0.01-0.02
      variabilityScore = 1.0 - Math.abs(0.015 - coeffVar) / 0.015;
      variabilityScore = Math.max(0, Math.min(1, variabilityScore));
    }
    
    // Buscar patrones periódicos (señal de PPG es periódica)
    const periodicityScore = this.detectPeriodicity(history);
    
    // Rango de intensidad adecuado (los canales con intensidad muy baja o muy alta son menos útiles)
    let intensityScore = 0;
    if (currentValue < 20 || currentValue > 235) {
      intensityScore = 0; // Muy bajo o muy alto, probablemente saturado o sin señal
    } else {
      // Preferir valores en rango medio
      intensityScore = 1.0 - Math.abs(128 - currentValue) / 128;
      intensityScore = Math.max(0, Math.min(1, intensityScore));
    }
    
    // Combinar factores para calidad final
    return (variabilityScore * 0.5) + (periodicityScore * 0.3) + (intensityScore * 0.2);
  }
  
  /**
   * Detecta periodicidad en un canal, importante para identificar señal PPG
   * @param history Historial de valores del canal
   * @returns Puntuación de periodicidad
   */
  private detectPeriodicity(history: number[]): number {
    if (history.length < 6) return 0;
    
    // Implementación simplificada de detección de periodicidad
    // Utilizamos autocorrelación para detectar patrones repetitivos
    const maxLag = Math.min(5, Math.floor(history.length / 2));
    const correlations: number[] = [];
    
    // Calcular media para normalización
    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    
    // Calcular autocorrelación para diferentes retrasos
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < history.length - lag; i++) {
        correlation += (history[i] - mean) * (history[i + lag] - mean);
      }
      
      // Normalizar
      let denominator = 0;
      for (let i = 0; i < history.length; i++) {
        denominator += Math.pow(history[i] - mean, 2);
      }
      
      if (denominator > 0) {
        correlation /= denominator;
        correlations.push(Math.abs(correlation));
      } else {
        correlations.push(0);
      }
    }
    
    // La mayor autocorrelación indica nivel de periodicidad
    return correlations.length > 0 ? Math.max(...correlations) : 0;
  }
  
  /**
   * Actualiza el historial de calidad de canales
   */
  private updateChannelQualityHistory(red: number, green: number, blue: number): void {
    this.channelQualityHistory.red.push(red);
    this.channelQualityHistory.green.push(green);
    this.channelQualityHistory.blue.push(blue);
    
    // Mantener tamaño limitado
    if (this.channelQualityHistory.red.length > this.CHANNEL_HISTORY_SIZE) {
      this.channelQualityHistory.red.shift();
      this.channelQualityHistory.green.shift();
      this.channelQualityHistory.blue.shift();
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
    this.channelQualityHistory = { red: [], green: [], blue: [] };
    this.ppgBuffer = [];
    console.log("PPGSignalService: Servicio reiniciado completamente");
  }
}

// Crear una instancia global del servicio
export const ppgSignalService = new PPGSignalService();
