
/**
 * Detector de Región de Interés (ROI) dinámico
 * Implementa análisis multicanal y detección automática de regiones con mayor intensidad de señal
 * Optimizado para rendimiento
 */
export class ROIDetector {
  // Historial de regiones para suavizado de transiciones
  private lastROIs: Array<{x: number, y: number, width: number, height: number}> = [];
  private readonly ROI_HISTORY_SIZE = 3; // Reduced from 5 for better performance
  
  // Umbral mínimo para considerar una región como válida
  private readonly MIN_INTENSITY_THRESHOLD = 70;
  // Tamaño mínimo de ROI como porcentaje de la imagen
  private readonly MIN_ROI_SIZE_PERCENT = 0.25;
  
  // Performance optimization
  private lastProcessedWidth: number = 0;
  private lastProcessedHeight: number = 0;
  private processEveryNthPixel: number = 2; // Process fewer pixels for better performance
  private skipFrameCounter: number = 0;
  private readonly PROCESS_EVERY_N_FRAMES: number = 2; // Only process every 2nd frame
  private cachedROI: {x: number, y: number, width: number, height: number} | null = null;
  
  /**
   * Detecta la región de mayor intensidad para el canal rojo
   * Optimizado para rendimiento con detección adaptativa
   * @param imageData Datos de la imagen a analizar
   * @returns Objeto con las coordenadas de la ROI óptima
   */
  public detectOptimalROI(imageData: ImageData): {x: number, y: number, width: number, height: number} {
    // Optimize by only processing every N frames
    this.skipFrameCounter = (this.skipFrameCounter + 1) % this.PROCESS_EVERY_N_FRAMES;
    
    // Use cached ROI for skipped frames
    if (this.skipFrameCounter !== 0 && this.cachedROI) {
      return this.cachedROI;
    }
    
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
      
      this.cachedROI = initialROI;
      return initialROI;
    }
    
    // Adapt processing resolution based on image size
    if (this.lastProcessedWidth !== imageData.width || this.lastProcessedHeight !== imageData.height) {
      this.lastProcessedWidth = imageData.width;
      this.lastProcessedHeight = imageData.height;
      
      // Adjust processing density based on resolution
      if (imageData.width * imageData.height > 307200) { // > 640x480
        this.processEveryNthPixel = 4; // Process 1/16 of pixels
      } else if (imageData.width * imageData.height > 153600) { // > 480x320
        this.processEveryNthPixel = 3; // Process 1/9 of pixels
      } else {
        this.processEveryNthPixel = 2; // Process 1/4 of pixels
      }
    }
    
    // Crear mapa de intensidad para buscar áreas de mayor señal
    const intensityMap = this.createIntensityMap(imageData);
    
    // Encontrar la región con mayor intensidad (optimizado)
    const newROI = this.findHighestIntensityRegion(intensityMap, imageData.width, imageData.height);
    
    // Aplicar restricciones y suavizado
    const smoothedROI = this.smoothROITransition(newROI);
    
    // Cache result for skipped frames
    this.cachedROI = smoothedROI;
    
    return smoothedROI;
  }
  
  /**
   * Crea un mapa de intensidad basado en los tres canales (RGB)
   * con mayor peso en el canal rojo para análisis PPG
   * Optimizado para rendimiento
   */
  private createIntensityMap(imageData: ImageData): number[][] {
    const { width, height, data } = imageData;
    const intensityMap: number[][] = [];
    
    // Procesamiento optimizado: solo analizar una fracción de los píxeles
    const step = this.processEveryNthPixel;
    
    // Inicializar matriz de intensidad (sparse)
    for (let y = 0; y < height; y += step) {
      intensityMap[y] = [];
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        
        // Extraer valores RGB (solo para los píxeles seleccionados)
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        
        // Calcular intensidad ponderada (mayor peso al rojo para PPG)
        // 65% rojo, 25% verde, 10% azul - ajustado para mejor detección de dedos
        const weightedIntensity = (red * 0.65) + (green * 0.25) + (blue * 0.1);
        
        intensityMap[y][x] = weightedIntensity;
      }
    }
    
    return intensityMap;
  }
  
  /**
   * Encuentra la región con mayor intensidad promedio usando un algoritmo
   * de ventana deslizante con tamaño adaptativo
   * Optimizado para rendimiento
   */
  private findHighestIntensityRegion(
    intensityMap: number[][], 
    imageWidth: number, 
    imageHeight: number
  ): {x: number, y: number, width: number, height: number} {
    // Calcular tamaño mínimo de ROI
    const minROIWidth = Math.floor(imageWidth * this.MIN_ROI_SIZE_PERCENT);
    const minROIHeight = Math.floor(imageHeight * this.MIN_ROI_SIZE_PERCENT);
    
    // Calcular diferentes tamaños de ROI para probar (reducido para mejor rendimiento)
    const roiSizes = [
      { width: minROIWidth, height: minROIHeight },
      { width: Math.floor(imageWidth * 0.4), height: Math.floor(imageHeight * 0.4) }
    ];
    
    let bestROI = {
      x: Math.floor(imageWidth * 0.3),
      y: Math.floor(imageHeight * 0.3),
      width: Math.floor(imageWidth * 0.4),
      height: Math.floor(imageHeight * 0.4),
      intensity: 0
    };
    
    // Use last known good ROI as a hint for optimization
    const lastROI = this.lastROIs[this.lastROIs.length - 1];
    
    // Probar diferentes tamaños de ROI
    for (const size of roiSizes) {
      // Calcular paso para la ventana deslizante (optimizado: 33% de solapamiento)
      const stepX = Math.floor(size.width * 0.33);
      const stepY = Math.floor(size.height * 0.33);
      
      // Start search near last known good ROI first
      const searchOrder = [];
      if (lastROI) {
        // First search near last ROI position
        const lastCenter = {
          x: lastROI.x + lastROI.width / 2,
          y: lastROI.y + lastROI.height / 2
        };
        
        // Add positions centered around last known good position
        for (let offsetY = -stepY; offsetY <= stepY; offsetY += stepY) {
          for (let offsetX = -stepX; offsetX <= stepX; offsetX += stepX) {
            const x = Math.max(0, Math.min(imageWidth - size.width, lastCenter.x - size.width/2 + offsetX));
            const y = Math.max(0, Math.min(imageHeight - size.height, lastCenter.y - size.height/2 + offsetY));
            searchOrder.push({x: Math.floor(x), y: Math.floor(y)});
          }
        }
      }
      
      // Then add a sparse grid of additional positions
      const sparseStepX = stepX * 3;
      const sparseStepY = stepY * 3;
      
      for (let y = 0; y <= imageHeight - size.height; y += sparseStepY) {
        for (let x = 0; x <= imageWidth - size.width; x += sparseStepX) {
          // Don't add duplicates
          if (!searchOrder.some(pos => Math.abs(pos.x - x) < 5 && Math.abs(pos.y - y) < 5)) {
            searchOrder.push({x, y});
          }
        }
      }
      
      // Search using optimized order
      for (const position of searchOrder) {
        const {x, y} = position;
        
        // Skip if position is out of bounds
        if (x < 0 || y < 0 || x > imageWidth - size.width || y > imageHeight - size.height) {
          continue;
        }
        
        // Calcular intensidad promedio en esta región (optimizado)
        let totalIntensity = 0;
        let pixelCount = 0;
        
        // Sample sparse points within this region for better performance
        const sampleStep = this.processEveryNthPixel;
        
        for (let dy = 0; dy < size.height; dy += sampleStep) {
          const mapY = y + dy;
          if (!intensityMap[mapY]) continue;
          
          for (let dx = 0; dx < size.width; dx += sampleStep) {
            const mapX = x + dx;
            if (intensityMap[mapY][mapX] !== undefined) {
              totalIntensity += intensityMap[mapY][mapX];
              pixelCount++;
            }
          }
        }
        
        const avgIntensity = pixelCount > 0 ? totalIntensity / pixelCount : 0;
        
        // Si esta región tiene mayor intensidad promedio y suficiente brillo, actualizar mejor ROI
        if (avgIntensity > bestROI.intensity && avgIntensity > this.MIN_INTENSITY_THRESHOLD) {
          bestROI = {
            x, y, 
            width: size.width, 
            height: size.height,
            intensity: avgIntensity
          };
          
          // Optional early termination if we find a very good region
          if (avgIntensity > this.MIN_INTENSITY_THRESHOLD * 1.5 && 
              lastROI && 
              Math.abs(x - lastROI.x) < stepX * 2 && 
              Math.abs(y - lastROI.y) < stepY * 2) {
            break;
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
   * Optimizado para mejor detección de dedos
   */
  private smoothROITransition(newROI: {x: number, y: number, width: number, height: number}): 
    {x: number, y: number, width: number, height: number} {
    
    // Adaptive smoothing: more smoothing for larger movements
    const lastROI = this.lastROIs[this.lastROIs.length - 1];
    let movementFactor = 0.5; // Default smoothing factor
    
    if (lastROI) {
      // Calculate distance between centers of ROIs
      const lastCenterX = lastROI.x + lastROI.width / 2;
      const lastCenterY = lastROI.y + lastROI.height / 2;
      const newCenterX = newROI.x + newROI.width / 2;
      const newCenterY = newROI.y + newROI.height / 2;
      
      const distance = Math.sqrt(
        Math.pow(newCenterX - lastCenterX, 2) + 
        Math.pow(newCenterY - lastCenterY, 2)
      );
      
      // Adjust smoothing based on movement distance
      if (distance < 10) {
        movementFactor = 0.7; // Less smoothing for small movements (faster response)
      } else if (distance > 50) {
        movementFactor = 0.3; // More smoothing for large movements (stability)
      }
    }
    
    // Actualizar historial de ROIs
    this.lastROIs.push(newROI);
    if (this.lastROIs.length > this.ROI_HISTORY_SIZE) {
      this.lastROIs.shift();
    }
    
    // Weight recent ROIs more heavily
    let sumX = 0, sumY = 0, sumWidth = 0, sumHeight = 0;
    let totalWeight = 0;
    
    this.lastROIs.forEach((roi, index) => {
      // Exponential weighting - newer entries have more influence
      const weight = Math.pow(1.5, index);
      totalWeight += weight;
      
      sumX += roi.x * weight;
      sumY += roi.y * weight;
      sumWidth += roi.width * weight;
      sumHeight += roi.height * weight;
    });
    
    // Create weighted average
    const weightedROI = {
      x: Math.round(sumX / totalWeight),
      y: Math.round(sumY / totalWeight),
      width: Math.round(sumWidth / totalWeight),
      height: Math.round(sumHeight / totalWeight)
    };
    
    // Apply movement factor for actual ROI
    if (lastROI) {
      return {
        x: Math.round(lastROI.x * (1 - movementFactor) + weightedROI.x * movementFactor),
        y: Math.round(lastROI.y * (1 - movementFactor) + weightedROI.y * movementFactor),
        width: Math.round(lastROI.width * (1 - movementFactor) + weightedROI.width * movementFactor),
        height: Math.round(lastROI.height * (1 - movementFactor) + weightedROI.height * movementFactor)
      };
    }
    
    return weightedROI;
  }
  
  /**
   * Reinicia el detector de ROI
   */
  public reset(): void {
    this.lastROIs = [];
    this.cachedROI = null;
    this.skipFrameCounter = 0;
  }
}
