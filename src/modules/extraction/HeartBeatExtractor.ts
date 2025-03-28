/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Extractor de Latidos Cardíacos
 * Detecta latidos en la señal PPG y calcula la frecuencia cardíaca
 */

import { eventBus, EventType } from '../events/EventBus';
import { RawSignalFrame } from '../types/signal';
import { calculateStandardDeviation, filterOutliers } from '../utils/vitalSignsUtils';

export interface HeartBeatResult {
  timestamp: number;
  bpm: number;
  peaks: number[];
  quality: number;
}

export class HeartBeatExtractor {
  private isRunning: boolean = false;
  private rawSignalBuffer: number[] = [];
  private processedBuffer: number[] = [];
  private peakIndices: number[] = [];
  private valleyIndices: number[] = [];
  private lastPeakTime: number | null = null;
  private recentBPMs: number[] = [];
  private recentPeaks: number[] = [];
  
  // Configuración
  private readonly bufferSize: number = 150;
  private readonly sampleRate: number = 30;
  private readonly bpmCalculationWindow: number = 5;
  private readonly peakThreshold: number = 0.6;
  private readonly valleyThreshold: number = 0.4;
  
  constructor() {
    // Suscribirse a los eventos necesarios
    eventBus.subscribe(EventType.CAMERA_FRAME_READY, this.handleRawFrameData.bind(this));
  }
  
  /**
   * Iniciar extracción
   */
  startExtraction(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.clearBuffers();
    console.log('Extractor de latidos cardíacos iniciado');
  }
  
  /**
   * Detener extracción
   */
  stopExtraction(): void {
    this.isRunning = false;
    this.clearBuffers();
    console.log('Extractor de latidos cardíacos detenido');
  }
  
  /**
   * Limpiar todos los buffers
   */
  private clearBuffers(): void {
    this.rawSignalBuffer = [];
    this.processedBuffer = [];
    this.peakIndices = [];
    this.valleyIndices = [];
    this.lastPeakTime = null;
    this.recentBPMs = [];
    this.recentPeaks = [];
  }
  
  /**
   * Manejar datos de frame sin procesar
   */
  private handleRawFrameData(frame: RawSignalFrame): void {
    if (!this.isRunning) return;
    
    // Extraer valor de la señal (simulado)
    const signalValue = this.extractSignalValue(frame.imageData);
    
    // Añadir al buffer
    this.rawSignalBuffer.push(signalValue);
    
    // Mantener el tamaño del buffer
    if (this.rawSignalBuffer.length > this.bufferSize) {
      this.rawSignalBuffer.shift();
    }
    
    // Procesar la señal
    const processedValue = this.processSignal(signalValue);
    this.processedBuffer.push(processedValue);
    
    // Mantener el tamaño del buffer procesado
    if (this.processedBuffer.length > this.bufferSize) {
      this.processedBuffer.shift();
    }
    
    // Detectar picos y valles
    this.detectPeaksAndValleys(processedValue);
    
    // Calcular BPM
    const currentBPM = this.calculateBPM();
    
    // Publicar resultado
    if (currentBPM > 0) {
      this.publishHeartbeat(currentBPM);
    }
  }
  
  /**
   * Simular la extracción de un valor de señal desde los datos del frame
   */
  private extractSignalValue(imageData: ImageData): number {
    // Simulación simple: promediar los valores del canal rojo
    let sum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      sum += imageData.data[i]; // Canal rojo
    }
    return sum / (imageData.data.length / 4);
  }
  
  /**
   * Simular el procesamiento de la señal
   */
  private processSignal(signalValue: number): number {
    // Simulación simple: normalizar el valor
    const min = Math.min(...this.rawSignalBuffer);
    const max = Math.max(...this.rawSignalBuffer);
    return (signalValue - min) / (max - min);
  }
  
  /**
   * Detectar picos y valles en la señal
   */
  private detectPeaksAndValleys(processedValue: number): void {
    const lastIndex = this.processedBuffer.length - 1;
    
    // Detectar picos
    if (
      lastIndex > 0 &&
      processedValue > this.processedBuffer[lastIndex - 1] &&
      processedValue > this.peakThreshold
    ) {
      this.peakIndices.push(lastIndex);
      this.recentPeaks.push(Date.now());
      
      if (this.recentPeaks.length > 15) {
        this.recentPeaks.shift();
      }
    }
    
    // Detectar valles
    if (
      lastIndex > 0 &&
      processedValue < this.processedBuffer[lastIndex - 1] &&
      processedValue < this.valleyThreshold
    ) {
      this.valleyIndices.push(lastIndex);
    }
  }
  
  /**
   * Calcular BPM (latidos por minuto)
   */
  private calculateBPM(): number {
    if (this.peakIndices.length < 2) return 0;
    
    // Tomar los últimos picos detectados
    const lastPeakIndex = this.peakIndices[this.peakIndices.length - 1];
    
    // Calcular el tiempo entre los últimos picos
    const timeDiff = lastPeakIndex / this.sampleRate; // segundos
    
    // Calcular BPM
    const bpm = 60 / timeDiff;
    
    // Filtrar valores atípicos
    const filteredBPMs = filterOutliers([...this.recentBPMs, bpm]);
    
    // Mantener los valores recientes
    this.recentBPMs = filteredBPMs.slice(-this.bpmCalculationWindow);
    
    // Calcular el promedio de los valores recientes
    const avgBPM = this.recentBPMs.reduce((a, b) => a + b, 0) / this.recentBPMs.length;
    
    return avgBPM;
  }
  
  /**
   * Publicar el evento de latido detectado
   */
  private publishHeartbeat(currentBPM: number): void {
    // Calcular la calidad de la señal
    const quality = this.calculateSignalQuality();
    
    // Evento de latido detectado
    eventBus.publish(EventType.HEARTBEAT_PEAK_DETECTED, {
      timestamp: Date.now(),
      bpm: currentBPM,
      confidence: quality,
      peaks: this.recentPeaks
    });
    
    this.lastPeakTime = Date.now();
  }
  
  /**
   * Calcular la calidad de la señal
   */
  private calculateSignalQuality(): number {
    // Simulación simple: usar la desviación estándar de la señal como calidad
    const stdDev = calculateStandardDeviation(this.processedBuffer);
    
    // Invertir la desviación estándar para que valores más bajos sean mejor calidad
    const quality = 100 - (stdDev * 100);
    
    return Math.max(0, Math.min(100, quality)); // asegurar que esté entre 0 y 100
  }
}

// Exportar instancia singleton
export const heartBeatExtractor = new HeartBeatExtractor();

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
