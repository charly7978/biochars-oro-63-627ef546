
/**
 * Extractor de Latidos
 * Se enfoca exclusivamente en la extracción de picos cardíacos sin procesamiento complejo
 */

import { EventType, eventBus } from '../events/EventBus';
import { RawFrame } from '../camera/CameraFrameReader';

export interface HeartBeatData {
  peaks: number[];
  peakTimes: number[];
  lastPeakTime: number | null;
  intervals: number[];
  timestamp: number;
  rawValue: number;
}

export class HeartBeatExtractor {
  private recentValues: number[] = [];
  private lastPeakTime: number | null = null;
  private peakThreshold: number = 0.3;
  private lastPeaks: number[] = [];
  private intervals: number[] = [];
  private isExtracting: boolean = false;
  private readonly BUFFER_SIZE = 30;
  private readonly MIN_PEAK_DISTANCE_MS = 300; // Mínima distancia entre picos (ms)
  
  /**
   * Iniciar extracción
   */
  startExtraction(): void {
    if (this.isExtracting) return;
    
    this.isExtracting = true;
    this.reset();
    
    // Suscribirse a frames de cámara
    eventBus.subscribe(EventType.CAMERA_FRAME, this.processFrame.bind(this));
    console.log('Extracción de latidos iniciada');
  }
  
  /**
   * Detener extracción
   */
  stopExtraction(): void {
    this.isExtracting = false;
    this.reset();
    console.log('Extracción de latidos detenida');
  }
  
  /**
   * Reiniciar buffers y estados
   */
  reset(): void {
    this.recentValues = [];
    this.lastPeakTime = null;
    this.lastPeaks = [];
    this.intervals = [];
  }
  
  /**
   * Procesar un frame para extraer datos de latido
   */
  private processFrame(frame: RawFrame): void {
    if (!this.isExtracting) return;
    
    try {
      // Extraer valor de canal rojo (principal para PPG)
      const redValue = this.extractRedValue(frame.imageData);
      
      // Añadir a buffer
      this.recentValues.push(redValue);
      if (this.recentValues.length > this.BUFFER_SIZE) {
        this.recentValues.shift();
      }
      
      // Buscar picos (básico, sin procesamiento avanzado)
      this.detectPeaks(redValue, frame.timestamp);
      
      // Crear datos de latido
      const heartBeatData: HeartBeatData = {
        peaks: this.lastPeaks,
        peakTimes: [],  // Tiempos de los picos detectados
        lastPeakTime: this.lastPeakTime,
        intervals: this.intervals,
        timestamp: frame.timestamp,
        rawValue: redValue
      };
      
      // Publicar datos para que otros módulos los procesen
      eventBus.publish(EventType.HEARTBEAT_DATA, heartBeatData);
      
    } catch (error) {
      console.error('Error en extracción de latidos:', error);
    }
  }
  
  /**
   * Extraer valor promedio de canal rojo
   */
  private extractRedValue(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Extraer del centro de la imagen (30%)
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i]; // Canal rojo
        count++;
      }
    }
    
    const avgRed = count > 0 ? (redSum / count) / 255 : 0; // Normalizado a 0-1
    return avgRed;
  }
  
  /**
   * Detección básica de picos (sin procesamiento complejo)
   * "Pescar los peces y llevarlos a la orilla"
   */
  private detectPeaks(value: number, timestamp: number): void {
    // Necesitamos al menos 3 valores para detectar un pico
    if (this.recentValues.length < 3) return;
    
    // Considerar un valor como pico si es mayor que los valores adyacentes
    // y supera un umbral mínimo
    const n = this.recentValues.length;
    const current = this.recentValues[n-1];
    const prev = this.recentValues[n-2];
    const prevPrev = this.recentValues[n-3];
    
    const isPeak = current < prev && 
                  prev > prevPrev && 
                  prev > this.peakThreshold;
    
    if (isPeak) {
      const now = timestamp;
      
      // Verificar distancia mínima entre picos
      if (this.lastPeakTime === null || now - this.lastPeakTime > this.MIN_PEAK_DISTANCE_MS) {
        // Añadir a picos detectados
        this.lastPeaks.push(prev);
        if (this.lastPeaks.length > 10) {
          this.lastPeaks.shift();
        }
        
        // Calcular intervalo RR
        if (this.lastPeakTime !== null) {
          const interval = now - this.lastPeakTime;
          this.intervals.push(interval);
          if (this.intervals.length > 8) {
            this.intervals.shift();
          }
          
          // Notificar latido detectado
          eventBus.publish(EventType.HEARTBEAT_DETECTED, {
            timestamp: now,
            interval: interval
          });
        }
        
        this.lastPeakTime = now;
      }
    }
  }
  
  /**
   * Actualizar umbral de detección de picos
   */
  updatePeakThreshold(threshold: number): void {
    this.peakThreshold = Math.max(0.1, Math.min(0.5, threshold));
  }
  
  /**
   * Obtener dato actual
   */
  getCurrentData(): {
    intervals: number[];
    lastPeakTime: number | null;
  } {
    return {
      intervals: [...this.intervals],
      lastPeakTime: this.lastPeakTime
    };
  }
}

// Exportar instancia singleton
export const heartBeatExtractor = new HeartBeatExtractor();
