
import OpenCVService from "../../services/OpenCVService";

export interface ProcessedFrame {
  rawValue: number;
  processedValue: number;
  quality: number;
  fingerDetected: boolean;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Procesador de señales PPG avanzado utilizando OpenCV.js
 * Implementa técnicas avanzadas de procesamiento de imágenes
 * para una detección de señal de mayor calidad
 */
export class OpenCVSignalProcessor {
  private isInitialized: boolean = false;
  private roiHistory: { x: number, y: number, width: number, height: number }[] = [];
  private readonly ROI_HISTORY_SIZE = 10;
  private frameCount = 0;
  private readonly SKIN_COLOR_LOWER = [0, 20, 70]; // HSV, valores adaptados para detección de piel
  private readonly SKIN_COLOR_UPPER = [25, 255, 255]; // HSV
  
  /**
   * Inicializa el procesador y carga OpenCV si es necesario
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await OpenCVService.loadOpenCV();
      this.isInitialized = true;
      console.log('OpenCVSignalProcessor inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando OpenCVSignalProcessor:', error);
      throw error;
    }
  }
  
  /**
   * Procesa un frame de la cámara usando técnicas avanzadas de OpenCV
   */
  public processFrame(imageData: ImageData): ProcessedFrame {
    if (!this.isInitialized) {
      throw new Error('OpenCVSignalProcessor no está inicializado');
    }
    
    const cv = OpenCVService.getCV();
    let processedValue = 0;
    let quality = 0;
    let fingerDetected = false;
    let roi = { x: 0, y: 0, width: 0, height: 0 };
    
    try {
      // Convertir ImageData a Mat (formato de OpenCV)
      const src = cv.matFromImageData(imageData);
      
      // Crear matrices auxiliares
      const rgbMat = new cv.Mat();
      const hsvMat = new cv.Mat();
      const maskMat = new cv.Mat();
      const blurredMat = new cv.Mat();
      
      // Convertir a RGB (OpenCV usa BGR por defecto)
      cv.cvtColor(src, rgbMat, cv.COLOR_RGBA2RGB);
      
      // Aplicar desenfoque gaussiano para reducir ruido
      cv.GaussianBlur(rgbMat, blurredMat, new cv.Size(5, 5), 0);
      
      // Convertir a HSV para mejor detección de color de piel
      cv.cvtColor(blurredMat, hsvMat, cv.COLOR_RGB2HSV);
      
      // Crear máscara para detectar color de piel
      const lowerBound = new cv.Mat(1, 3, cv.CV_8UC1, new Uint8Array(this.SKIN_COLOR_LOWER));
      const upperBound = new cv.Mat(1, 3, cv.CV_8UC1, new Uint8Array(this.SKIN_COLOR_UPPER));
      
      // Aplicar máscara de color
      cv.inRange(hsvMat, lowerBound, upperBound, maskMat);
      
      // Realizar operaciones morfológicas para limpiar la máscara
      const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      const tempMat = new cv.Mat();
      cv.morphologyEx(maskMat, tempMat, cv.MORPH_CLOSE, kernel);
      cv.morphologyEx(tempMat, maskMat, cv.MORPH_OPEN, kernel);
      
      // Encontrar contornos para localizar la región del dedo
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(maskMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Variables para tracking de ROI
      let bestContourIndex = -1;
      let maxArea = 0;
      let isFingerFound = false;
      
      // Buscar el contorno más grande (probablemente el dedo)
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const minFingerArea = (imageData.width * imageData.height) * 0.02; // 2% del área total
        
        if (area > maxArea && area > minFingerArea) {
          maxArea = area;
          bestContourIndex = i;
          isFingerFound = true;
        }
      }
      
      // Si se encontró un contorno de dedo adecuado
      if (isFingerFound && bestContourIndex !== -1) {
        // Obtener rectángulo contenedor
        const contour = contours.get(bestContourIndex);
        const rect = cv.boundingRect(contour);
        
        // Crear ROI
        roi = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
        
        // Añadir al historial para estabilización
        this.roiHistory.push(roi);
        if (this.roiHistory.length > this.ROI_HISTORY_SIZE) {
          this.roiHistory.shift();
        }
        
        // Si tenemos suficiente historial, estabilizar ROI
        if (this.roiHistory.length >= 3) {
          // Promediar las últimas ROIs para mayor estabilidad
          const avgROI = {
            x: Math.round(this.roiHistory.reduce((sum, r) => sum + r.x, 0) / this.roiHistory.length),
            y: Math.round(this.roiHistory.reduce((sum, r) => sum + r.y, 0) / this.roiHistory.length),
            width: Math.round(this.roiHistory.reduce((sum, r) => sum + r.width, 0) / this.roiHistory.length),
            height: Math.round(this.roiHistory.reduce((sum, r) => sum + r.height, 0) / this.roiHistory.length)
          };
          
          // Usar ROI estabilizado
          roi = avgROI;
        }
        
        // Asegurarse de que la ROI está dentro de los límites de la imagen
        roi.x = Math.max(0, roi.x);
        roi.y = Math.max(0, roi.y);
        roi.width = Math.min(roi.width, imageData.width - roi.x);
        roi.height = Math.min(roi.height, imageData.height - roi.y);
        
        // Extraer el valor medio del canal rojo en la ROI
        const roiMat = rgbMat.roi(new cv.Rect(roi.x, roi.y, roi.width, roi.height));
        const channels = new cv.MatVector();
        cv.split(roiMat, channels);
        
        // Canal rojo (índice 0 en RGB)
        const redChannel = channels.get(0);
        const meanMat = new cv.Mat();
        const stdDevMat = new cv.Mat();
        
        // Calcular media y desviación estándar
        cv.meanStdDev(redChannel, meanMat, stdDevMat);
        
        // Obtener valores
        const meanValue = meanMat.data64F[0];
        const stdDev = stdDevMat.data64F[0];
        
        // Establecer valores de salida
        processedValue = meanValue;
        fingerDetected = true;
        
        // Calcular calidad de señal basada en varios factores
        const areaQuality = Math.min(1, maxArea / (imageData.width * imageData.height * 0.2)) * 100;
        const stdDevQuality = (1 - Math.min(1, stdDev / 50)) * 100; // Menos variación = mejor calidad
        quality = Math.round((areaQuality * 0.7 + stdDevQuality * 0.3));
        
        // Liberar recursos OpenCV
        roiMat.delete();
        for (let i = 0; i < channels.size(); ++i) {
          channels.get(i).delete();
        }
        meanMat.delete();
        stdDevMat.delete();
      } else {
        // No se detectó dedo, valores predeterminados
        processedValue = 0;
        fingerDetected = false;
        quality = 0;
        this.roiHistory = []; // Limpiar historial
      }
      
      // Incrementar contador de frames para análisis
      this.frameCount++;
      
      // Liberar recursos OpenCV
      src.delete();
      rgbMat.delete();
      hsvMat.delete();
      blurredMat.delete();
      maskMat.delete();
      tempMat.delete();
      lowerBound.delete();
      upperBound.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();
      
    } catch (error) {
      console.error('Error en el procesamiento OpenCV:', error);
      // Valores predeterminados en caso de error
      processedValue = 0;
      quality = 0;
      fingerDetected = false;
    }
    
    // Extraer el valor medio de rojo para compatibilidad con el procesador antiguo
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analizar el centro de la imagen si no se detectó un dedo específicamente
    if (!fingerDetected) {
      const startX = Math.floor(imageData.width * 0.4);
      const endX = Math.floor(imageData.width * 0.6);
      const startY = Math.floor(imageData.height * 0.4);
      const endY = Math.floor(imageData.height * 0.6);
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * imageData.width + x) * 4;
          redSum += data[i]; // Canal rojo (índice 0)
          count++;
        }
      }
    }
    
    const rawValue = count > 0 ? redSum / count : 0;
    
    return {
      rawValue,
      processedValue: fingerDetected ? processedValue : rawValue,
      quality,
      fingerDetected,
      roi: fingerDetected ? roi : undefined
    };
  }
  
  /**
   * Libera recursos cuando el procesador ya no es necesario
   */
  public dispose(): void {
    this.isInitialized = false;
    this.roiHistory = [];
    console.log('OpenCVSignalProcessor: recursos liberados');
  }
}
