
/**
 * Analizador multicanal para procesamiento PPG
 * Implementa análisis de RGB optimizado para fotopletismografía
 */
import { calculateMultichannelPerfusionIndex } from '../../modules/vital-signs/utils/perfusion-utils';

export class MultichannelAnalyzer {
  // Configuración de pesos para análisis multicanal
  private channelWeights = { red: 0.7, green: 0.25, blue: 0.05 };
  
  // Historial de señales para análisis
  private redValues: number[] = [];
  private greenValues: number[] = [];
  private blueValues: number[] = [];
  
  // Tamaño del buffer de historial
  private readonly HISTORY_SIZE = 20;
  
  // Factores de ganancia adaptativos para cada canal
  private redGain: number = 1.0;
  private greenGain: number = 0.8;
  private blueGain: number = 0.7;
  
  // Umbrales de intensidad óptima para detección
  private readonly OPTIMAL_RED_RANGE = { min: 130, max: 220 };
  private readonly OPTIMAL_GREEN_RANGE = { min: 100, max: 200 };
  private readonly OPTIMAL_BLUE_RANGE = { min: 80, max: 180 };
  
  /**
   * Procesa la región de interés (ROI) para extraer valor multicanal optimizado
   */
  public processROI(
    imageData: ImageData, 
    roi: { x: number, y: number, width: number, height: number }
  ): { 
    redValue: number, 
    greenValue: number, 
    blueValue: number, 
    weightedValue: number,
    perfusionIndex: number 
  } {
    // Extraer valores promedio de cada canal en la ROI
    const { redAvg, greenAvg, blueAvg, redAC, greenAC, blueAC, redDC, greenDC, blueDC } = 
      this.extractChannelValues(imageData, roi);
    
    // Guardar en historial
    this.updateChannelHistory(redAvg, greenAvg, blueAvg);
    
    // Aplicar optimización adaptativa de ganancias
    this.optimizeChannelGains(redAvg, greenAvg, blueAvg);
    
    // Aplicar ganancias a los valores
    const redValueAmplified = redAvg * this.redGain;
    const greenValueAmplified = greenAvg * this.greenGain;
    const blueValueAmplified = blueAvg * this.blueGain;
    
    // Calcular valor ponderado según pesos configurados
    const weightedValue = 
      (redValueAmplified * this.channelWeights.red) + 
      (greenValueAmplified * this.channelWeights.green) + 
      (blueValueAmplified * this.channelWeights.blue);
    
    // Calcular índice de perfusión multicanal mejorado
    const perfusionIndex = calculateMultichannelPerfusionIndex(
      redAC, redDC, 
      greenAC, greenDC,
      blueAC, blueDC,
      this.channelWeights
    );
    
    return {
      redValue: redValueAmplified,
      greenValue: greenValueAmplified,
      blueValue: blueValueAmplified,
      weightedValue,
      perfusionIndex
    };
  }
  
  /**
   * Extrae valores promedio y componentes AC/DC de los canales RGB en la ROI
   */
  private extractChannelValues(
    imageData: ImageData,
    roi: { x: number, y: number, width: number, height: number }
  ): { 
    redAvg: number, 
    greenAvg: number, 
    blueAvg: number,
    redAC: number,
    greenAC: number,
    blueAC: number,
    redDC: number,
    greenDC: number,
    blueDC: number
  } {
    const { data, width } = imageData;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let redMin = 255, redMax = 0;
    let greenMin = 255, greenMax = 0;
    let blueMin = 255, blueMax = 0;
    let pixelCount = 0;
    
    // Asegurar que la ROI esté dentro de los límites de la imagen
    const endX = Math.min(roi.x + roi.width, imageData.width);
    const endY = Math.min(roi.y + roi.height, imageData.height);
    const startX = Math.max(0, roi.x);
    const startY = Math.max(0, roi.y);
    
    // Recorrer la ROI para extraer valores de canales
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * width + x) * 4;
        
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        
        // Acumular sumas
        redSum += red;
        greenSum += green;
        blueSum += blue;
        
        // Encontrar mínimos y máximos para componentes AC
        redMin = Math.min(redMin, red);
        redMax = Math.max(redMax, red);
        
        greenMin = Math.min(greenMin, green);
        greenMax = Math.max(greenMax, green);
        
        blueMin = Math.min(blueMin, blue);
        blueMax = Math.max(blueMax, blue);
        
        pixelCount++;
      }
    }
    
    // Calcular promedios (DC)
    const redAvg = pixelCount > 0 ? redSum / pixelCount : 0;
    const greenAvg = pixelCount > 0 ? greenSum / pixelCount : 0;
    const blueAvg = pixelCount > 0 ? blueSum / pixelCount : 0;
    
    // Calcular componentes AC (amplitud de la señal)
    const redAC = redMax - redMin;
    const greenAC = greenMax - greenMin;
    const blueAC = blueMax - blueMin;
    
    // Usar promedios como componentes DC
    const redDC = redAvg;
    const greenDC = greenAvg;
    const blueDC = blueAvg;
    
    return {
      redAvg, greenAvg, blueAvg,
      redAC, greenAC, blueAC,
      redDC, greenDC, blueDC
    };
  }
  
  /**
   * Actualiza el historial de valores de canales
   */
  private updateChannelHistory(red: number, green: number, blue: number): void {
    this.redValues.push(red);
    this.greenValues.push(green);
    this.blueValues.push(blue);
    
    if (this.redValues.length > this.HISTORY_SIZE) {
      this.redValues.shift();
      this.greenValues.shift();
      this.blueValues.shift();
    }
  }
  
  /**
   * Optimiza las ganancias de canales dinámicamente
   */
  private optimizeChannelGains(red: number, green: number, blue: number): void {
    // Solo optimizar si tenemos suficientes datos
    if (this.redValues.length < 5) return;
    
    // Optimizar ganancia del canal rojo
    if (red < this.OPTIMAL_RED_RANGE.min) {
      this.redGain = Math.min(3.0, this.redGain * 1.05);
    } else if (red > this.OPTIMAL_RED_RANGE.max) {
      this.redGain = Math.max(0.5, this.redGain * 0.95);
    }
    
    // Optimizar ganancia del canal verde
    if (green < this.OPTIMAL_GREEN_RANGE.min) {
      this.greenGain = Math.min(3.0, this.greenGain * 1.05);
    } else if (green > this.OPTIMAL_GREEN_RANGE.max) {
      this.greenGain = Math.max(0.5, this.greenGain * 0.95);
    }
    
    // Optimizar ganancia del canal azul
    if (blue < this.OPTIMAL_BLUE_RANGE.min) {
      this.blueGain = Math.min(3.0, this.blueGain * 1.05);
    } else if (blue > this.OPTIMAL_BLUE_RANGE.max) {
      this.blueGain = Math.max(0.5, this.blueGain * 0.95);
    }
    
    // Ajustar pesos de canal basados en calidad de señal
    this.adjustChannelWeights();
  }
  
  /**
   * Ajusta los pesos de canales basados en calidad de señal
   */
  private adjustChannelWeights(): void {
    if (this.redValues.length < 5) return;
    
    // Calcular variabilidad en cada canal
    const redVariability = this.calculateVariability(this.redValues);
    const greenVariability = this.calculateVariability(this.greenValues);
    const blueVariability = this.calculateVariability(this.blueValues);
    
    // Normalizar medidas de variabilidad
    const totalVariability = redVariability + greenVariability + blueVariability;
    
    if (totalVariability > 0) {
      // Asignar más peso a canales con mayor variabilidad (con límites)
      const redWeight = Math.min(0.8, Math.max(0.3, redVariability / totalVariability));
      const greenWeight = Math.min(0.6, Math.max(0.1, greenVariability / totalVariability));
      const blueWeight = Math.min(0.3, Math.max(0.05, blueVariability / totalVariability));
      
      // Normalizar pesos
      const totalWeight = redWeight + greenWeight + blueWeight;
      
      this.channelWeights = {
        red: redWeight / totalWeight,
        green: greenWeight / totalWeight,
        blue: blueWeight / totalWeight
      };
    }
  }
  
  /**
   * Calcula variabilidad en un conjunto de valores
   */
  private calculateVariability(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Calcular diferencias entre valores adyacentes
    let variabilitySum = 0;
    
    for (let i = 1; i < values.length; i++) {
      variabilitySum += Math.abs(values[i] - values[i-1]);
    }
    
    return variabilitySum / (values.length - 1);
  }
  
  /**
   * Obtiene los pesos actuales de los canales
   */
  public getChannelWeights(): { red: number, green: number, blue: number } {
    return { ...this.channelWeights };
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(): void {
    this.redValues = [];
    this.greenValues = [];
    this.blueValues = [];
    this.redGain = 1.0;
    this.greenGain = 0.8;
    this.blueGain = 0.7;
    this.channelWeights = { red: 0.7, green: 0.25, blue: 0.05 };
  }
}
