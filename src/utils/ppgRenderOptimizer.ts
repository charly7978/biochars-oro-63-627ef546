
/**
 * Utilidades específicas para optimizar el renderizado de señales PPG
 */

/**
 * Clase para el manejo optimizado del renderizado PPG
 */
export class PPGRenderOptimizer {
  private lastRenderTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateInterval: number = 1000; // Intervalo para actualizar FPS (ms)
  private lastFpsUpdateTime: number = 0;
  private currentFps: number = 0;
  private targetFps: number = 60;
  private adaptiveSkipCounter: number = 0;
  private skipThreshold: number = 2; // Cuántos frames saltar cuando estamos bajo presión
  
  constructor(targetFps: number = 60) {
    this.targetFps = targetFps;
    this.lastFpsUpdateTime = performance.now();
  }
  
  /**
   * Verifica si debemos renderizar este frame basado en rendimiento
   * @param now Tiempo actual
   * @returns true si debemos renderizar
   */
  public shouldRenderFrame(now: number = performance.now()): boolean {
    const timeSinceLastRender = now - this.lastRenderTime;
    const minFrameTime = 1000 / this.targetFps;
    
    // Actualizar contador de frames
    this.frameCount++;
    
    // Calcular FPS actual
    if (now - this.lastFpsUpdateTime > this.fpsUpdateInterval) {
      this.currentFps = (this.frameCount * 1000) / (now - this.lastFpsUpdateTime);
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
      
      // Adaptar el objetivo de FPS basado en rendimiento
      this.adaptTargetFps();
    }
    
    // Determinar si hay presión de rendimiento
    const isUnderPressure = this.currentFps > 0 && this.currentFps < this.targetFps * 0.7;
    
    if (isUnderPressure) {
      // Saltar frames bajo presión
      this.adaptiveSkipCounter = (this.adaptiveSkipCounter + 1) % (this.skipThreshold + 1);
      if (this.adaptiveSkipCounter !== 0) {
        return false;
      }
    }
    
    // Verificar si ha pasado suficiente tiempo desde el último render
    if (timeSinceLastRender < minFrameTime * 0.8) {
      return false;
    }
    
    this.lastRenderTime = now;
    return true;
  }
  
  /**
   * Adapta el target FPS basado en el rendimiento
   */
  private adaptTargetFps(): void {
    // Si estamos muy por debajo del objetivo, reducir el target
    if (this.currentFps < this.targetFps * 0.6) {
      this.targetFps = Math.max(30, this.targetFps * 0.9);
      this.skipThreshold = Math.min(4, this.skipThreshold + 1);
    } 
    // Si estamos por encima, podemos incrementar gradualmente
    else if (this.currentFps > this.targetFps * 1.2) {
      this.targetFps = Math.min(60, this.targetFps * 1.05);
      this.skipThreshold = Math.max(1, this.skipThreshold - 1);
    }
  }
  
  /**
   * Obtiene el FPS actual
   */
  public getCurrentFps(): number {
    return this.currentFps;
  }
  
  /**
   * Reinicia los contadores de optimización
   */
  public reset(): void {
    this.lastRenderTime = 0;
    this.frameCount = 0;
    this.lastFpsUpdateTime = performance.now();
    this.currentFps = 0;
    this.adaptiveSkipCounter = 0;
  }
  
  /**
   * Obtiene un factor de skip adaptativo basado en el número de puntos
   * @param pointCount Número de puntos a renderizar
   * @returns Factor para saltar puntos
   */
  public getAdaptiveSkipFactor(pointCount: number): number {
    if (this.currentFps < this.targetFps * 0.7) {
      // Bajo rendimiento, incrementar skip factor
      return Math.max(1, Math.floor(pointCount / 200));
    } else if (pointCount > 500) {
      return Math.max(1, Math.floor(pointCount / 400));
    } else if (pointCount > 300) {
      return Math.max(1, Math.floor(pointCount / 300));
    }
    
    return 1; // No saltar puntos para pocas cantidades
  }
}

/**
 * Optimiza los tamaños de buffer para mejorar rendimiento
 * @param currentSize Tamaño actual del buffer
 * @param performanceLevel Nivel de rendimiento (0-1)
 * @returns Tamaño optimizado
 */
export function getOptimalBufferSize(currentSize: number, performanceLevel: number): number {
  if (performanceLevel < 0.3) {
    return Math.min(150, currentSize);
  } else if (performanceLevel < 0.7) {
    return Math.min(300, currentSize);
  }
  
  return currentSize;
}

/**
 * Comprime datos para optimizar renderizado
 * @param data Datos a comprimir
 * @param maxSize Tamaño máximo deseado
 * @returns Datos comprimidos
 */
export function compressRenderData<T>(data: T[], maxSize: number): T[] {
  if (data.length <= maxSize) return data;
  
  const step = Math.ceil(data.length / maxSize);
  const result: T[] = [];
  
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  
  return result;
}
