
/**
 * Detector de Región de Interés (ROI) dinámico
 * Implementa análisis multicanal y detección automática de regiones con mayor intensidad de señal
 */
export class ROIDetector {
  // Historial de regiones para suavizado de transiciones
  private lastROIs: Array<{x: number, y: number, width: number, height: number}> = [];
  private readonly ROI_HISTORY_SIZE = 5;
  
  // Umbral mínimo para considerar una región como válida
  private readonly MIN_INTENSITY_THRESHOLD = 70;
  // Tamaño mínimo de ROI como porcentaje de la imagen
  private readonly MIN_ROI_SIZE_PERCENT = 0.25;
  
  /**
   * Detecta la región de mayor intensidad para el canal rojo
   * @param imageData Datos de la imagen a analizar
   * @returns Objeto con las coordenadas de la ROI óptima
   */
  public detectOptimalROI(imageData: ImageData): {x: number, y: number, width: number, height: number} {
    // Si no hay datos previos, iniciar con región central
    if (this.lastROIs.length === 0) {
      const initialROI = {
        x: Math.floor(imageData.width * 0.3),
        y: Math.floor(imageData.height * 0.3),
        width: Math.floor(imageData.width * 0.4),
        height: Math.floor(imageData.height * 0.4)
      };
      
      // Llenar el historial con la ROI inicial
      for (let i = 0; i < this.ROI_HISTORY_SIZE; i++) {
        this.lastROIs.push({...initialROI});
      }
      
      return initialROI;
    }
    
    // Crear mapa de intensidad para buscar áreas de mayor señal
    const intensityMap = this.createIntensityMap(imageData);
    
    // Encontrar la región con mayor intensidad
    const newROI = this.findHighestIntensityRegion(intensityMap, imageData.width, imageData.height);
    
    // Aplicar restricciones y suavizado
    const smoothedROI = this.smoothROITransition(newROI);
    
    return smoothedROI;
  }
  
  /**
   * Crea un mapa de intensidad basado en los tres canales (RGB)
   * con mayor peso en el canal rojo para análisis PPG
   */
  private createIntensityMap(imageData: ImageData): number[][] {
    const { width, height, data } = imageData;
    const intensityMap: number[][] = [];
    
    // Inicializar matriz de intensidad
    for (let y = 0; y < height; y++) {
      intensityMap[y] = [];
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        
        // Extraer valores RGB
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        
        // Calcular intensidad ponderada (mayor peso al rojo para PPG)
        // 60% rojo, 30% verde, 10% azul
        const weightedIntensity = (red * 0.6) + (green * 0.3) + (blue * 0.1);
        
        intensityMap[y][x] = weightedIntensity;
      }
    }
    
    return intensityMap;
  }
  
  /**
   * Encuentra la región con mayor intensidad promedio usando un algoritmo
   * de ventana deslizante con tamaño adaptativo
   */
  private findHighestIntensityRegion(
    intensityMap: number[][], 
    imageWidth: number, 
    imageHeight: number
  ): {x: number, y: number, width: number, height: number} {
    // Calcular tamaño mínimo de ROI
    const minROIWidth = Math.floor(imageWidth * this.MIN_ROI_SIZE_PERCENT);
    const minROIHeight = Math.floor(imageHeight * this.MIN_ROI_SIZE_PERCENT);
    
    // Calcular diferentes tamaños de ROI para probar
    const roiSizes = [
      { width: minROIWidth, height: minROIHeight },
      { width: Math.floor(imageWidth * 0.3), height: Math.floor(imageHeight * 0.3) },
      { width: Math.floor(imageWidth * 0.4), height: Math.floor(imageHeight * 0.4) }
    ];
    
    let bestROI = {
      x: Math.floor(imageWidth * 0.3),
      y: Math.floor(imageHeight * 0.3),
      width: Math.floor(imageWidth * 0.4),
      height: Math.floor(imageHeight * 0.4),
      intensity: 0
    };
    
    // Probar diferentes tamaños de ROI
    for (const size of roiSizes) {
      // Calcular paso para la ventana deslizante (25% de solapamiento)
      const stepX = Math.floor(size.width * 0.25);
      const stepY = Math.floor(size.height * 0.25);
      
      // Deslizar ventana a través de la imagen
      for (let y = 0; y <= imageHeight - size.height; y += stepY) {
        for (let x = 0; x <= imageWidth - size.width; x += stepX) {
          // Calcular intensidad promedio en esta región
          let totalIntensity = 0;
          let pixelCount = 0;
          
          for (let dy = 0; dy < size.height; dy++) {
            for (let dx = 0; dx < size.width; dx++) {
              if (y + dy < imageHeight && x + dx < imageWidth) {
                totalIntensity += intensityMap[y + dy][x + dx];
                pixelCount++;
              }
            }
          }
          
          const avgIntensity = pixelCount > 0 ? totalIntensity / pixelCount : 0;
          
          // Si esta región tiene mayor intensidad promedio, actualizar mejor ROI
          if (avgIntensity > bestROI.intensity && avgIntensity > this.MIN_INTENSITY_THRESHOLD) {
            bestROI = {
              x, y, 
              width: size.width, 
              height: size.height,
              intensity: avgIntensity
            };
          }
        }
      }
    }
    
    // Si no se encontró una región con suficiente intensidad, usar región central
    if (bestROI.intensity < this.MIN_INTENSITY_THRESHOLD) {
      return {
        x: Math.floor(imageWidth * 0.3),
        y: Math.floor(imageHeight * 0.3),
        width: Math.floor(imageWidth * 0.4),
        height: Math.floor(imageHeight * 0.4)
      };
    }
    
    return {
      x: bestROI.x,
      y: bestROI.y,
      width: bestROI.width,
      height: bestROI.height
    };
  }
  
  /**
   * Suaviza la transición entre diferentes regiones de interés
   * para evitar saltos bruscos que afecten la calidad de la señal
   */
  private smoothROITransition(newROI: {x: number, y: number, width: number, height: number}): 
    {x: number, y: number, width: number, height: number} {
    
    // Actualizar historial de ROIs
    this.lastROIs.push(newROI);
    if (this.lastROIs.length > this.ROI_HISTORY_SIZE) {
      this.lastROIs.shift();
    }
    
    // Calcular ROI promedio para suavizado
    let sumX = 0, sumY = 0, sumWidth = 0, sumHeight = 0;
    
    for (const roi of this.lastROIs) {
      sumX += roi.x;
      sumY += roi.y;
      sumWidth += roi.width;
      sumHeight += roi.height;
    }
    
    return {
      x: Math.round(sumX / this.lastROIs.length),
      y: Math.round(sumY / this.lastROIs.length),
      width: Math.round(sumWidth / this.lastROIs.length),
      height: Math.round(sumHeight / this.lastROIs.length)
    };
  }
  
  /**
   * Reinicia el detector de ROI
   */
  public reset(): void {
    this.lastROIs = [];
  }
}
