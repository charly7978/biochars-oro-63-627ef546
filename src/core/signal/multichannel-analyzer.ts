
/**
 * Analizador multicanal para señales PPG
 * Procesa los canales RGB para obtener una mejor relación señal-ruido
 */
export class MultichannelAnalyzer {
  // Pesos iniciales para cada canal
  private channelWeights = {
    red: 0.7,
    green: 0.25,
    blue: 0.05
  };
  
  // Historial de valores por canal para análisis de calidad
  private redValues: number[] = [];
  private greenValues: number[] = [];
  private blueValues: number[] = [];
  
  // Tamaño de buffer para análisis de calidad
  private readonly ANALYSIS_BUFFER_SIZE = 50;
  
  // Factor de adaptación para pesos de canales
  private readonly ADAPTATION_RATE = 0.05;
  
  // Última evaluación de SNR por canal
  private lastSNR = {
    red: 0,
    green: 0,
    blue: 0
  };
  
  /**
   * Extrae y analiza los canales RGB de la región de interés
   * @param imageData Datos de la imagen
   * @param roi Región de interés a analizar
   * @returns Valores procesados por canal y valor ponderado
   */
  public processROI(
    imageData: ImageData, 
    roi: {x: number, y: number, width: number, height: number}
  ): {
    redValue: number,
    greenValue: number,
    blueValue: number,
    weightedValue: number,
    perfusionIndex: number
  } {
    const { x, y, width, height } = roi;
    const { data } = imageData;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    
    // Extraer valores de canales RGB de la ROI
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const imgX = x + dx;
        const imgY = y + dy;
        
        // Verificar límites de la imagen
        if (imgX >= 0 && imgX < imageData.width && imgY >= 0 && imgY < imageData.height) {
          const i = (imgY * imageData.width + imgX) * 4;
          
          redSum += data[i];
          greenSum += data[i + 1];
          blueSum += data[i + 2];
          pixelCount++;
        }
      }
    }
    
    // Calcular valores promedio por canal
    const redValue = pixelCount > 0 ? redSum / pixelCount : 0;
    const greenValue = pixelCount > 0 ? greenSum / pixelCount : 0;
    const blueValue = pixelCount > 0 ? blueSum / pixelCount : 0;
    
    // Actualizar historial de valores
    this.updateChannelHistory(redValue, greenValue, blueValue);
    
    // Adaptar pesos de canales basados en la calidad de la señal
    this.adaptChannelWeights();
    
    // Calcular valor ponderado usando los pesos adaptados
    const weightedValue = 
      (redValue * this.channelWeights.red) + 
      (greenValue * this.channelWeights.green) + 
      (blueValue * this.channelWeights.blue);
    
    // Calcular índice de perfusión multicanal
    const perfusionIndex = this.calculateMultichannelPerfusionIndex();
    
    return {
      redValue,
      greenValue,
      blueValue,
      weightedValue,
      perfusionIndex
    };
  }
  
  /**
   * Actualiza el historial de valores por canal
   */
  private updateChannelHistory(red: number, green: number, blue: number): void {
    this.redValues.push(red);
    this.greenValues.push(green);
    this.blueValues.push(blue);
    
    // Mantener tamaño de buffer limitado
    if (this.redValues.length > this.ANALYSIS_BUFFER_SIZE) {
      this.redValues.shift();
      this.greenValues.shift();
      this.blueValues.shift();
    }
  }
  
  /**
   * Adapta los pesos de los canales basados en la calidad de la señal (SNR)
   */
  private adaptChannelWeights(): void {
    // Solo adaptar si tenemos suficientes muestras
    if (this.redValues.length < 20) return;
    
    // Calcular SNR para cada canal
    const redSNR = this.calculateChannelSNR(this.redValues);
    const greenSNR = this.calculateChannelSNR(this.greenValues);
    const blueSNR = this.calculateChannelSNR(this.blueValues);
    
    // Actualizar últimos valores de SNR
    this.lastSNR = { red: redSNR, green: greenSNR, blue: blueSNR };
    
    // Calcular suma total de SNR
    const totalSNR = redSNR + greenSNR + blueSNR;
    
    // Si tenemos señales válidas, ajustar pesos
    if (totalSNR > 0) {
      // Calcular nuevos pesos basados en SNR relativo
      const newWeights = {
        red: redSNR / totalSNR,
        green: greenSNR / totalSNR,
        blue: blueSNR / totalSNR
      };
      
      // Adaptar gradualmente los pesos para evitar cambios bruscos
      this.channelWeights = {
        red: (1 - this.ADAPTATION_RATE) * this.channelWeights.red + this.ADAPTATION_RATE * newWeights.red,
        green: (1 - this.ADAPTATION_RATE) * this.channelWeights.green + this.ADAPTATION_RATE * newWeights.green,
        blue: (1 - this.ADAPTATION_RATE) * this.channelWeights.blue + this.ADAPTATION_RATE * newWeights.blue
      };
    }
  }
  
  /**
   * Calcula la relación señal-ruido para un canal
   * @param values Valores del canal
   * @returns SNR estimado
   */
  private calculateChannelSNR(values: number[]): number {
    if (values.length < 10) return 0;
    
    // Usar ventana de análisis reciente
    const recentValues = values.slice(-20);
    
    // Calcular la media
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular la varianza (componente de ruido)
    let variance = 0;
    for (const val of recentValues) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= recentValues.length;
    
    // Calcular autocorrelación con retardo de 1 (componente de señal)
    let autoCorr = 0;
    for (let i = 1; i < recentValues.length; i++) {
      autoCorr += (recentValues[i] - mean) * (recentValues[i-1] - mean);
    }
    autoCorr /= (recentValues.length - 1);
    
    // SNR estimado
    return variance > 0 ? Math.abs(autoCorr) / variance : 0;
  }
  
  /**
   * Calcula un índice de perfusión basado en múltiples canales
   * @returns Índice de perfusión mejorado
   */
  private calculateMultichannelPerfusionIndex(): number {
    // Verificar si tenemos suficientes datos
    if (this.redValues.length < 10) return 0;
    
    // Calcular índices de perfusión por canal
    const redPI = this.calculateChannelPerfusionIndex(this.redValues);
    const greenPI = this.calculateChannelPerfusionIndex(this.greenValues);
    const bluePI = this.calculateChannelPerfusionIndex(this.blueValues);
    
    // Combinar índices ponderados por calidad de señal (SNR)
    const combinedPI = 
      (redPI * this.lastSNR.red) + 
      (greenPI * this.lastSNR.green) + 
      (bluePI * this.lastSNR.blue);
    
    const totalSNR = this.lastSNR.red + this.lastSNR.green + this.lastSNR.blue;
    
    return totalSNR > 0 ? combinedPI / totalSNR : redPI; // Usar red como fallback si no hay SNR
  }
  
  /**
   * Calcula el índice de perfusión para un canal específico
   */
  private calculateChannelPerfusionIndex(values: number[]): number {
    if (values.length < 10) return 0;
    
    const recentValues = values.slice(-10);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    
    // PI = (AC/DC)
    const ac = max - min;
    const dc = (max + min) / 2;
    
    return dc > 0 ? ac / dc : 0;
  }
  
  /**
   * Obtiene los pesos actuales de los canales
   */
  public getChannelWeights(): {red: number, green: number, blue: number} {
    return {...this.channelWeights};
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(): void {
    this.redValues = [];
    this.greenValues = [];
    this.blueValues = [];
    
    // Restaurar pesos por defecto
    this.channelWeights = {
      red: 0.7,
      green: 0.25,
      blue: 0.05
    };
    
    this.lastSNR = {
      red: 0,
      green: 0,
      blue: 0
    };
  }
}
