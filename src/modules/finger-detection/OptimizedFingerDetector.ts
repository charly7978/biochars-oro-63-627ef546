
import OpenCVService from '../../services/OpenCVService';
import TensorFlowService from '../../services/TensorFlowService';

/**
 * Detector de dedos optimizado que combina enfoque clásico (OpenCV) y ML (TensorFlow)
 * con administración de recursos para evitar sobrecarga de CPU y memoria
 */
export class OptimizedFingerDetector {
  private isInitialized = false;
  private useTensorFlow = false; // Usar solo cuando sea necesario
  private useOpenCV = true; // Más ligero en consumo
  private lastDetectionTime = 0;
  private detectionInterval = 150; // ms entre detecciones para reducir carga
  private consecutiveDetections = 0;
  private detectionThreshold = 3; // Confirmaciones necesarias
  private isFingerDetected = false;
  private lastImageData: ImageData | null = null;
  
  // Configuración para detección por color
  private readonly COLOR_CONFIG = {
    redMin: 150,
    redMax: 240,
    greenMax: 190,
    blueMax: 150,
    saturationMin: 0.15,
    valueMin: 0.4
  };
  
  // Cache para evitar recálculos
  private detectionCache = new Map<string, boolean>();
  private cacheSize = 10;
  
  constructor() {
    // Inicialización asíncrona
    this.initialize();
  }
  
  /**
   * Inicializa los servicios necesarios
   */
  public async initialize(): Promise<void> {
    try {
      if (this.useOpenCV) {
        await OpenCVService.loadOpenCV();
      }
      
      if (this.useTensorFlow) {
        await TensorFlowService.initialize();
      }
      
      this.isInitialized = true;
      console.log('OptimizedFingerDetector: Inicializado correctamente');
    } catch (error) {
      console.error('OptimizedFingerDetector: Error de inicialización', error);
    }
  }
  
  /**
   * Detecta dedo en imagen con técnicas avanzadas pero eficientes
   */
  public async detectFinger(imageData: ImageData): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    // Guardar referencia a la última imagen
    this.lastImageData = imageData;
    
    // Control de frecuencia para reducir sobrecarga
    const now = Date.now();
    if (now - this.lastDetectionTime < this.detectionInterval) {
      return this.isFingerDetected;
    }
    this.lastDetectionTime = now;
    
    // Calcular hash simple de la imagen para cache
    const imageHash = this.calculateSimpleImageHash(imageData);
    if (this.detectionCache.has(imageHash)) {
      return this.detectionCache.get(imageHash) || false;
    }
    
    // Estrategia 1: Detección por color (muy eficiente)
    const isFingerByColor = this.detectFingerByColor(imageData);
    
    // Estrategia 2: Solo si es necesario, usar OpenCV (moderado consumo)
    let isFingerByOpenCV = false;
    if (this.useOpenCV && OpenCVService.isOpenCVLoaded()) {
      isFingerByOpenCV = this.detectFingerByOpenCV(imageData);
    }
    
    // Estrategia 3: Como último recurso, ML (alto consumo)
    let isFingerByML = false;
    if (this.useTensorFlow && !isFingerByColor && !isFingerByOpenCV) {
      try {
        isFingerByML = await TensorFlowService.detectFinger(imageData, 0.7);
      } catch (error) {
        console.error('Error en detección ML:', error);
      }
    }
    
    // Combinar resultados dando prioridad a los métodos más precisos
    const result = isFingerByColor || isFingerByOpenCV || isFingerByML;
    
    // Actualizar caché (limitando tamaño)
    if (this.detectionCache.size >= this.cacheSize) {
      const firstKey = this.detectionCache.keys().next().value;
      this.detectionCache.delete(firstKey);
    }
    this.detectionCache.set(imageHash, result);
    
    // Actualizar detección con histéresis para estabilidad
    if (result) {
      this.consecutiveDetections = Math.min(this.consecutiveDetections + 1, this.detectionThreshold + 2);
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
    }
    
    // Actualizar estado solo cuando haya suficientes confirmaciones
    this.isFingerDetected = this.consecutiveDetections >= this.detectionThreshold;
    
    return this.isFingerDetected;
  }
  
  /**
   * Detección sencilla por color (muy eficiente, bajo consumo)
   */
  private detectFingerByColor(imageData: ImageData): boolean {
    const { data, width, height } = imageData;
    
    // Analizar solo región central para mejor eficiencia
    const startX = Math.floor(width * 0.4);
    const endX = Math.floor(width * 0.6);
    const startY = Math.floor(height * 0.4);
    const endY = Math.floor(height * 0.6);
    
    let redPixelCount = 0;
    let totalPixels = 0;
    
    // Muestreo cada 2 píxeles para mayor eficiencia
    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Comprobar si es un color similar al dedo humano
        if (r > this.COLOR_CONFIG.redMin && 
            r < this.COLOR_CONFIG.redMax && 
            g < this.COLOR_CONFIG.greenMax && 
            b < this.COLOR_CONFIG.blueMax) {
          
          // Convertir a HSV para verificar saturación/valor
          const { s, v } = this.rgbToHsv(r, g, b);
          
          if (s > this.COLOR_CONFIG.saturationMin && 
              v > this.COLOR_CONFIG.valueMin) {
            redPixelCount++;
          }
        }
        
        totalPixels++;
      }
    }
    
    // Porcentaje de píxeles similares a dedo humano
    const redRatio = redPixelCount / totalPixels;
    return redRatio > 0.5; // 50% de la región central debe ser similar a dedo
  }
  
  /**
   * Detección usando OpenCV (consumo moderado)
   */
  private detectFingerByOpenCV(imageData: ImageData): boolean {
    try {
      if (!OpenCVService.isOpenCVLoaded()) return false;
      
      const cv = OpenCVService.getCV();
      
      // Convertir ImageData a matriz OpenCV
      const src = cv.matFromImageData(imageData);
      
      // Convertir a HSV para mejor detección de piel
      const hsv = new cv.Mat();
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
      
      // Rango de color de piel humana en HSV
      const lowerBound = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 20, 70, 0]);
      const upperBound = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 150, 255, 255]);
      
      // Crear máscara para piel
      const mask = new cv.Mat();
      cv.inRange(hsv, lowerBound, upperBound, mask);
      
      // Contar píxeles de piel
      const pixelCount = cv.countNonZero(mask);
      const totalPixels = mask.rows * mask.cols;
      
      // Liberar memoria
      src.delete();
      hsv.delete();
      lowerBound.delete();
      upperBound.delete();
      mask.delete();
      
      // Si más del 40% son píxeles de piel, probablemente es un dedo
      return pixelCount / totalPixels > 0.4;
    } catch (error) {
      console.error('Error en detectFingerByOpenCV:', error);
      return false;
    }
  }
  
  /**
   * Convertir RGB a HSV (simplificado y optimizado)
   */
  private rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h, s, v };
  }
  
  /**
   * Método simple para generar un hash de imagen para caché
   * Solo usamos una muestra reducida para maximizar eficiencia
   */
  private calculateSimpleImageHash(imageData: ImageData): string {
    const { data, width, height } = imageData;
    let hash = '';
    
    // Tomar 16 puntos de la imagen en ubicaciones estratégicas
    const samplesX = [0.25, 0.5, 0.75];
    const samplesY = [0.25, 0.5, 0.75];
    
    for (const sy of samplesY) {
      for (const sx of samplesX) {
        const x = Math.floor(width * sx);
        const y = Math.floor(height * sy);
        const i = (y * width + x) * 4;
        
        // Usar valores RGB cuantizados para el hash
        const r = Math.floor(data[i] / 32);
        const g = Math.floor(data[i + 1] / 32);
        const b = Math.floor(data[i + 2] / 32);
        
        hash += `${r},${g},${b};`;
      }
    }
    
    return hash;
  }
  
  /**
   * Obtiene el último estado de detección sin procesar nueva imagen
   */
  public getIsFingerDetected(): boolean {
    return this.isFingerDetected;
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.isFingerDetected = false;
    this.consecutiveDetections = 0;
    this.detectionCache.clear();
  }
}
