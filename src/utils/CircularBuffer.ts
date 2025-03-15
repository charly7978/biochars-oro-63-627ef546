
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

export interface PPGDataPoint {
  time: number;
  value: number;
  isArrhythmia: boolean;
}

export class CircularBuffer {
  private buffer: PPGDataPoint[];
  private size: number;
  private head: number;
  private tail: number;
  private count: number;
  private readonly DROPPED_FRAME_TIMEOUT = 400; // Umbral de tiempo para considerar un frame perdido (ms) - Reducido para mayor sensibilidad

  constructor(size: number) {
    this.buffer = new Array(size);
    this.size = size;
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  push(item: PPGDataPoint): void {
    // Verificar si hay un gap temporal grande que pueda indicar frames perdidos
    if (this.count > 0) {
      const lastTime = this.buffer[(this.head - 1 + this.size) % this.size]?.time || 0;
      const timeDiff = item.time - lastTime;
      
      // Si hay un gap grande (posibles frames perdidos), insertar puntos interpolados
      if (timeDiff > this.DROPPED_FRAME_TIMEOUT && lastTime > 0) {
        const steps = Math.min(5, Math.ceil(timeDiff / 100)); // Máximo 5 puntos interpolados
        const stepTime = timeDiff / (steps + 1);
        const lastValue = this.buffer[(this.head - 1 + this.size) % this.size]?.value || 0;
        
        for (let i = 1; i <= steps; i++) {
          const interpolatedTime = lastTime + (stepTime * i);
          // Interpolación lineal simple para el valor
          const progress = i / (steps + 1);
          const interpolatedValue = lastValue + ((item.value - lastValue) * progress);
          
          this.buffer[this.head] = {
            time: interpolatedTime,
            value: interpolatedValue,
            isArrhythmia: false
          };
          
          this.head = (this.head + 1) % this.size;
          if (this.count === this.size) {
            this.tail = (this.tail + 1) % this.size;
          } else {
            this.count++;
          }
        }
      }
    }
    
    // Agregar el punto actual
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
    
    if (this.count === this.size) {
      this.tail = (this.tail + 1) % this.size;
    } else {
      this.count++;
    }
  }

  pop(): PPGDataPoint | undefined {
    if (this.count === 0) {
      return undefined;
    }
    
    const item = this.buffer[this.tail];
    this.tail = (this.tail + 1) % this.size;
    this.count--;
    
    return item;
  }

  getPoints(): PPGDataPoint[] {
    const result: PPGDataPoint[] = [];
    
    if (this.count === 0) {
      return result;
    }
    
    let currentIndex = this.tail;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[currentIndex]);
      currentIndex = (currentIndex + 1) % this.size;
    }
    
    return result;
  }

  // Obtener los últimos N puntos, útil para análisis reciente
  getLastPoints(n: number): PPGDataPoint[] {
    if (this.count === 0 || n <= 0) {
      return [];
    }
    
    const numPoints = Math.min(n, this.count);
    const result: PPGDataPoint[] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const index = (this.head - i - 1 + this.size) % this.size;
      result.unshift(this.buffer[index]);
    }
    
    return result;
  }

  // Agregar método para verificar estabilidad en la señal
  getSignalStability(): number {
    if (this.count < 5) return 0;
    
    const recentPoints = this.getLastPoints(10);
    if (recentPoints.length < 5) return 0;
    
    // Calcular varianza de los valores recientes
    const values = recentPoints.map(p => p.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Normalizar estabilidad a un valor entre 0-100
    // Menor varianza = mayor estabilidad
    const maxVariance = 80; // Umbral de máxima varianza esperada - Reducido para mayor sensibilidad
    const stability = Math.max(0, 100 * (1 - Math.min(variance / maxVariance, 1)));
    
    return stability;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }
}
