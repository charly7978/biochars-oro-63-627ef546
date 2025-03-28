
/**
 * Procesador avanzado de frames de cámara
 * Optimizado para extraer señales PPG con alta precisión
 */

import { ImageData } from '../../types/signal';

export interface FrameProcessingResult {
  redChannel: number;
  greenChannel: number;
  blueChannel: number;
  combinedSignal: number;
  brightness: number;
  frameQuality: number;
}

export class CameraFrameProcessor {
  private lastResults: FrameProcessingResult[] = [];
  private readonly maxHistorySize = 20;
  private readonly redWeight = 1.5;
  private readonly greenWeight = 2.0;
  private readonly blueWeight = 0.8;
  
  /**
   * Procesa un frame de la cámara para extraer datos de señal PPG
   */
  public processFrame(imageData: ImageData): FrameProcessingResult {
    // Extraer canales RGB y calcular señal combinada
    const result = this.extractChannelData(imageData);
    
    // Almacenar resultado para análisis histórico
    this.addToHistory(result);
    
    return result;
  }
  
  /**
   * Extrae datos RGB y calcula señal combinada optimizada
   */
  private extractChannelData(imageData: ImageData): FrameProcessingResult {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Optimización: analizar solo una región central
    const centerRegionX = Math.floor(width * 0.3);
    const centerRegionY = Math.floor(height * 0.3);
    const centerWidth = Math.floor(width * 0.4);
    const centerHeight = Math.floor(height * 0.4);
    
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Procesar solo región central para mejor rendimiento y precisión
    for (let y = centerRegionY; y < centerRegionY + centerHeight; y += 2) {
      const rowOffset = y * width * 4;
      
      for (let x = centerRegionX; x < centerRegionX + centerWidth; x += 2) {
        const idx = rowOffset + x * 4;
        
        redSum += data[idx];
        greenSum += data[idx + 1];
        blueSum += data[idx + 2];
        
        pixelCount++;
      }
    }
    
    // Calcular promedios
    const redAvg = redSum / pixelCount;
    const greenAvg = greenSum / pixelCount;
    const blueAvg = blueSum / pixelCount;
    
    // Calcular brillo promedio
    const brightness = (redAvg + greenAvg + blueAvg) / 3;
    
    // Calcular señal combinada con pesos optimizados para PPG
    const combinedSignal = (
      redAvg * this.redWeight + 
      greenAvg * this.greenWeight + 
      blueAvg * this.blueWeight
    ) / (this.redWeight + this.greenWeight + this.blueWeight);
    
    // Evaluar calidad del frame
    const frameQuality = this.calculateFrameQuality(redAvg, greenAvg, blueAvg, brightness);
    
    return {
      redChannel: redAvg,
      greenChannel: greenAvg,
      blueChannel: blueAvg,
      combinedSignal,
      brightness,
      frameQuality
    };
  }
  
  /**
   * Calcula la calidad estimada del frame para detección PPG
   */
  private calculateFrameQuality(red: number, green: number, blue: number, brightness: number): number {
    // Calidad base
    let quality = 70;
    
    // Factor 1: Brillo adecuado (ni muy oscuro ni muy brillante)
    if (brightness < 50) {
      // Penalizar frames muy oscuros
      quality -= (50 - brightness) / 2;
    } else if (brightness > 200) {
      // Penalizar frames muy brillantes (saturados)
      quality -= (brightness - 200) / 2;
    } else if (brightness > 80 && brightness < 180) {
      // Bonificar rango óptimo de brillo
      quality += 10;
    }
    
    // Factor 2: Dominancia del canal verde (indica mejor señal PPG)
    const isGreenDominant = green > red && green > blue;
    if (isGreenDominant) {
      quality += 15;
    }
    
    // Factor 3: Proporción entre canales (estimador de presencia de dedo)
    const redToBlueRatio = red / Math.max(1, blue);
    if (redToBlueRatio > 1.3 && redToBlueRatio < 2.5) {
      quality += 10; // Proporciones típicas con dedo sobre cámara
    }
    
    // Limitamos calidad a rango 0-100
    return Math.max(0, Math.min(100, quality));
  }
  
  /**
   * Añade un resultado al historial
   */
  private addToHistory(result: FrameProcessingResult): void {
    this.lastResults.push(result);
    if (this.lastResults.length > this.maxHistorySize) {
      this.lastResults.shift();
    }
  }
  
  /**
   * Obtiene los últimos resultados de procesamiento
   */
  public getHistory(): FrameProcessingResult[] {
    return [...this.lastResults];
  }
  
  /**
   * Resetea el procesador
   */
  public reset(): void {
    this.lastResults = [];
  }
}
