
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Procesador de Señal
 * Módulo central de procesamiento con algoritmos avanzados para procesamiento de señal
 */

import { EventType, eventBus } from '../events/EventBus';
import { HeartBeatData } from '../extraction/HeartBeatExtractor';
import { PPGSignalData } from '../extraction/PPGSignalExtractor';
import { CombinedSignalData } from '../extraction/CombinedSignalProvider';
import { calculateVariance } from '../vital-signs/utils';

export interface ProcessedHeartbeatData {
  timestamp: number;
  intervals: number[];
  filteredPeaks: number[];
  bpm: number;
  confidence: number;
}

export interface ProcessedPPGData {
  timestamp: number;
  filteredValue: number;
  normalizedValue: number;
  amplifiedValue: number;
  perfusionIndex: number;
  quality: number;
}

export interface FingerDetectionResult {
  detected: boolean;
  quality: number;
  confidence: number;
  timestamp: number;
}

export class SignalProcessor {
  // Procesadores específicos de señal
  private medianBufferPPG: number[] = [];
  private medianBufferHB: number[] = [];
  private movingAvgBufferPPG: number[] = [];
  private movingAvgBufferHB: number[] = [];
  
  // Buffers para procesamiento
  private heartbeatValues: number[] = [];
  private ppgValues: number[] = [];
  private lastBPM: number = 0;
  private lastPerfusionIndex: number = 0;
  
  // Detección de dedo
  private fingerDetectionBuffer: boolean[] = [];
  private qualityBuffer: number[] = [];
  private isProcessing: boolean = false;
  
  // Configuración
  private readonly BPM_SMA_WINDOW = 5;
  private readonly FINGER_DETECTION_WINDOW = 10;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly MEDIAN_WINDOW_SIZE = 5;
  private readonly MOVING_AVG_WINDOW_SIZE = 7;
  
  /**
   * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
   * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
   * 
   * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
   * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
   * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
   */
  
  /**
   * Iniciar procesamiento
   */
  startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.reset();
    
    // Suscribirse a señales extraídas
    eventBus.subscribe(EventType.HEARTBEAT_DATA, this.processHeartbeat.bind(this));
    eventBus.subscribe(EventType.PPG_SIGNAL_EXTRACTED, this.processPPG.bind(this));
    eventBus.subscribe(EventType.COMBINED_SIGNAL_DATA, this.processFingerDetection.bind(this));
    
    console.log('Procesador de señal iniciado');
  }
  
  /**
   * Detener procesamiento
   */
  stopProcessing(): void {
    this.isProcessing = false;
    this.reset();
    console.log('Procesador de señal detenido');
  }
  
  /**
   * Reiniciar estado
   */
  reset(): void {
    this.heartbeatValues = [];
    this.ppgValues = [];
    this.fingerDetectionBuffer = [];
    this.qualityBuffer = [];
    this.lastBPM = 0;
    this.lastPerfusionIndex = 0;
    this.medianBufferPPG = [];
    this.medianBufferHB = [];
    this.movingAvgBufferPPG = [];
    this.movingAvgBufferHB = [];
  }
  
  /**
   * Procesar datos de latido
   */
  private processHeartbeat(data: HeartBeatData): void {
    if (!this.isProcessing) return;
    
    try {
      // Aplicar filtrado a la señal de latido
      const filteredValue = this.applyMedianFilter(data.rawValue, this.medianBufferHB);
      const smoothedValue = this.applyMovingAverageFilter(filteredValue, this.movingAvgBufferHB);
      
      // Agregar a buffer
      this.heartbeatValues.push(smoothedValue);
      if (this.heartbeatValues.length > 50) {
        this.heartbeatValues.shift();
      }
      
      // Calcular BPM a partir de intervalos RR
      let bpm = 0;
      let confidence = 0;
      
      if (data.intervals.length >= 2) {
        // Filtrar outliers
        const validIntervals = data.intervals.filter(interval => 
          interval >= 300 && interval <= 1800
        );
        
        if (validIntervals.length >= 2) {
          // Calcular BPM promedio
          const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
          bpm = Math.round(60000 / avgInterval);
          
          // Calcular confianza basada en variabilidad
          const intervalVariation = validIntervals.reduce((acc, interval) => 
            acc + Math.abs(interval - avgInterval), 0
          ) / validIntervals.length;
          
          const relativeVariation = intervalVariation / avgInterval;
          confidence = Math.max(0, Math.min(100, 100 - (relativeVariation * 100)));
          
          // Suavizar BPM
          if (this.lastBPM > 0) {
            bpm = Math.round((this.lastBPM * (this.BPM_SMA_WINDOW - 1) + bpm) / this.BPM_SMA_WINDOW);
          }
          
          this.lastBPM = bpm;
        }
      }
      
      // Crear datos procesados
      const processedData: ProcessedHeartbeatData = {
        timestamp: data.timestamp,
        intervals: data.intervals,
        filteredPeaks: this.heartbeatValues.slice(-10),
        bpm,
        confidence
      };
      
      // Publicar resultados procesados
      eventBus.publish(EventType.PROCESSED_HEARTBEAT, processedData);
      
      // Si tenemos una frecuencia cardíaca válida, publicarla
      if (bpm >= 40 && bpm <= 200) {
        eventBus.publish(EventType.HEARTBEAT_RATE_CHANGED, {
          bpm,
          confidence,
          timestamp: data.timestamp
        });
      }
      
    } catch (error) {
      console.error('Error procesando datos de latido:', error);
    }
  }
  
  /**
   * Procesar datos PPG
   */
  private processPPG(data: PPGSignalData): void {
    if (!this.isProcessing) return;
    
    try {
      // Aplicar filtros a la señal PPG (principalmente canal rojo)
      const filteredValue = this.applyMedianFilter(data.redChannel, this.medianBufferPPG);
      const smoothedValue = this.applyMovingAverageFilter(filteredValue, this.movingAvgBufferPPG);
      
      // Agregar a buffer
      this.ppgValues.push(smoothedValue);
      if (this.ppgValues.length > 50) {
        this.ppgValues.shift();
      }
      
      // Normalizar señal (0-1)
      let normalizedValue = smoothedValue;
      if (this.ppgValues.length >= 10) {
        const recentMin = Math.min(...this.ppgValues.slice(-10));
        const recentMax = Math.max(...this.ppgValues.slice(-10));
        const range = recentMax - recentMin;
        
        if (range > 0) {
          normalizedValue = (smoothedValue - recentMin) / range;
        }
      }
      
      // Amplificar señal para mejorar detección
      const amplificationFactor = 1.5; // Ajustar según necesidad
      const amplifiedValue = ((normalizedValue - 0.5) * amplificationFactor) + 0.5;
      
      // Calcular índice de perfusión (proporción de componente pulsátil a no pulsátil)
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Estimar calidad de señal basada en perfusión y estabilidad
      const quality = this.estimateSignalQuality(smoothedValue, perfusionIndex);
      
      // Crear datos PPG procesados
      const processedData: ProcessedPPGData = {
        timestamp: data.timestamp,
        filteredValue: smoothedValue,
        normalizedValue,
        amplifiedValue,
        perfusionIndex,
        quality
      };
      
      // Publicar resultados procesados
      eventBus.publish(EventType.PROCESSED_PPG, processedData);
      
    } catch (error) {
      console.error('Error procesando datos PPG:', error);
    }
  }
  
  /**
   * Aplicar filtro de mediana
   */
  private applyMedianFilter(value: number, buffer: number[]): number {
    buffer.push(value);
    
    if (buffer.length > this.MEDIAN_WINDOW_SIZE) {
      buffer.shift();
    }
    
    const sorted = [...buffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Aplicar filtro de media móvil
   */
  private applyMovingAverageFilter(value: number, buffer: number[]): number {
    buffer.push(value);
    
    if (buffer.length > this.MOVING_AVG_WINDOW_SIZE) {
      buffer.shift();
    }
    
    return buffer.reduce((a, b) => a + b, 0) / buffer.length;
  }
  
  /**
   * Calcular índice de perfusión
   */
  private calculatePerfusionIndex(): number {
    if (this.ppgValues.length < 10) return 0;
    
    const recent = this.ppgValues.slice(-10);
    const ac = Math.max(...recent) - Math.min(...recent); // Componente AC (pulsátil)
    const dc = recent.reduce((a, b) => a + b, 0) / recent.length; // Componente DC (promedio)
    
    // PI = AC/DC
    const perfusionIndex = dc > 0 ? ac / dc : 0;
    
    // Suavizar
    if (this.lastPerfusionIndex > 0) {
      return (perfusionIndex * 0.3) + (this.lastPerfusionIndex * 0.7);
    }
    
    this.lastPerfusionIndex = perfusionIndex;
    return perfusionIndex;
  }
  
  /**
   * Estimar calidad de señal PPG
   */
  private estimateSignalQuality(value: number, perfusionIndex: number): number {
    // Sin suficientes datos, calidad baja
    if (this.ppgValues.length < 10) return 20;
    
    const recent = this.ppgValues.slice(-10);
    
    // 1. Factor de amplitud
    const amplitude = Math.max(...recent) - Math.min(...recent);
    const amplitudeScore = Math.min(100, amplitude * 200);
    
    // 2. Factor de estabilidad (variación)
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = calculateVariance(recent);
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / mean : 1; // Coeficiente de variación
    
    // Menor CV = mayor estabilidad. Queremos algo de variación pero no demasiada.
    const stabilityScore = cv > 0.01 && cv < 0.2 ? 100 : Math.max(0, 100 - Math.abs(cv - 0.1) * 500);
    
    // 3. Factor de perfusión
    const perfusionScore = perfusionIndex > this.PERFUSION_INDEX_THRESHOLD ? 
                          100 : 
                          (perfusionIndex / this.PERFUSION_INDEX_THRESHOLD) * 100;
    
    // Combinar factores con pesos
    const quality = (amplitudeScore * 0.4) + (stabilityScore * 0.3) + (perfusionScore * 0.3);
    
    return Math.max(0, Math.min(100, quality));
  }
  
  /**
   * Procesar detección de dedo
   */
  private processFingerDetection(data: CombinedSignalData): void {
    if (!this.isProcessing) return;
    
    // Añadir a buffer
    this.fingerDetectionBuffer.push(data.fingerDetected);
    this.qualityBuffer.push(data.quality);
    
    // Mantener tamaño de buffer
    if (this.fingerDetectionBuffer.length > this.FINGER_DETECTION_WINDOW) {
      this.fingerDetectionBuffer.shift();
      this.qualityBuffer.shift();
    }
    
    // Aplicar lógica de "mayoría con histéresis" para evitar falsos cambios
    let detectionCount = 0;
    for (const detection of this.fingerDetectionBuffer) {
      if (detection) detectionCount++;
    }
    
    // Calcular confianza y mayoría
    const detectionRatio = detectionCount / this.fingerDetectionBuffer.length;
    const currentlyDetected = detectionRatio >= 0.6; // 60% o más detecciones positivas
    
    // Calcular calidad promedio
    const avgQuality = this.qualityBuffer.reduce((a, b) => a + b, 0) / 
                      Math.max(1, this.qualityBuffer.length);
    
    // Calcular confianza basada en consistencia y calidad
    const consistencyFactor = Math.abs(detectionRatio - 0.5) * 2; // 0-1, mayor cuando más consistente
    const confidence = (consistencyFactor * 50) + (avgQuality * 0.5);
    
    // Crear resultado
    const result: FingerDetectionResult = {
      detected: currentlyDetected,
      quality: avgQuality,
      confidence,
      timestamp: data.timestamp
    };
    
    // Publicar resultado final de detección de dedo
    eventBus.publish(EventType.FINGER_DETECTION_RESULT, result);
    
    // También publicar cambio de estado si es necesario
    if (currentlyDetected) {
      eventBus.publish(EventType.FINGER_DETECTED, result);
    } else {
      eventBus.publish(EventType.FINGER_LOST, result);
    }
  }
  
  /**
   * Obtener estado actual del procesador
   */
  getProcessorStatus(): {
    isProcessing: boolean;
    currentBPM: number;
    currentPerfusionIndex: number;
    fingerDetected: boolean;
    signalQuality: number;
  } {
    // Calcular detección actual de dedo
    const detectionCount = this.fingerDetectionBuffer.filter(d => d).length;
    const fingerDetected = detectionCount > this.fingerDetectionBuffer.length / 2;
    
    // Calcular calidad actual
    const signalQuality = this.qualityBuffer.length > 0 ? 
                        this.qualityBuffer.reduce((a, b) => a + b, 0) / this.qualityBuffer.length : 
                        0;
    
    return {
      isProcessing: this.isProcessing,
      currentBPM: this.lastBPM,
      currentPerfusionIndex: this.lastPerfusionIndex,
      fingerDetected,
      signalQuality
    };
  }
}

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

// Exportar instancia singleton
export const signalProcessor = new SignalProcessor();
