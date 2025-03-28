
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Procesador Central de Señal
 * Procesa y refina la señal PPG y cardíaca con algoritmos avanzados
 */

import { EventType, eventBus } from '../events/EventBus';
import { HeartBeatData } from '../extraction/HeartBeatExtractor';
import { PPGSignalData } from '../extraction/PPGSignalExtractor';
import { CombinedSignalData } from '../extraction/CombinedSignalProvider';
import { calculateAC, calculateDC, calculateStandardDeviation } from '../vital-signs/utils';

// Datos procesados de latidos cardíacos
export interface ProcessedHeartbeatData {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  bpm: number;
  confidence: number;
  intervals: number[];
  lastPeakTime: number | null;
}

// Datos procesados de señal PPG
export interface ProcessedPPGData {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  quality: number;
  fingerDetected: boolean;
  perfusionIndex: number;
  frequency: number | null;
}

export class SignalProcessor {
  // Estado del procesador
  private isProcessing: boolean = false;
  private processingInterval: number | null = null;
  
  // Buffers para cada tipo de señal
  private heartbeatBuffer: HeartBeatData[] = [];
  private ppgBuffer: PPGSignalData[] = [];
  private combinedBuffer: CombinedSignalData[] = [];
  
  // Estado de detección de dedo
  private fingerDetected: boolean = false;
  private fingerDetectionConfidence: number = 0;
  private consecutiveDetections: number = 0;
  private consecutiveNonDetections: number = 0;
  
  // Calidad de señal
  private signalQuality: number = 0;
  
  // Procesamiento de picos cardíacos
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 20;
  
  // Constantes de filtrado
  private readonly ALPHA_HEARTBEAT = 0.2; // Filtro EMA para heartbeat
  private readonly ALPHA_PPG = 0.3; // Filtro EMA para PPG
  private readonly MIN_PEAK_DISTANCE = 300; // Distancia mínima entre picos (ms)
  private readonly QUALITY_THRESHOLD = 40; // Umbral mínimo de calidad para procesar
  private readonly FINGER_DETECTION_THRESHOLD = 3; // Detecciones consecutivas para confirmar dedo
  private readonly FINGER_LOSS_THRESHOLD = 5; // No detecciones para confirmar pérdida
  
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
    
    // Suscribirse a señales extraídas
    eventBus.subscribe(EventType.HEARTBEAT_DATA, this.handleHeartbeatData.bind(this));
    eventBus.subscribe(EventType.PPG_SIGNAL_EXTRACTED, this.handlePPGData.bind(this));
    eventBus.subscribe(EventType.COMBINED_SIGNAL_DATA, this.handleCombinedData.bind(this));
    
    // Iniciar ciclo de procesamiento
    this.processingInterval = window.setInterval(() => {
      this.processAllSignals();
    }, 100); // Procesar cada 100ms
    
    console.log('Procesador de señal iniciado');
  }
  
  /**
   * Detener procesamiento
   */
  stopProcessing(): void {
    this.isProcessing = false;
    
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Limpiar buffers
    this.heartbeatBuffer = [];
    this.ppgBuffer = [];
    this.combinedBuffer = [];
    
    // Resetear estado
    this.fingerDetected = false;
    this.fingerDetectionConfidence = 0;
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.signalQuality = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    
    console.log('Procesador de señal detenido');
  }
  
  /**
   * Resetear procesador
   */
  reset(): void {
    // Mantener el estado de procesamiento pero resetear buffers y variables
    this.heartbeatBuffer = [];
    this.ppgBuffer = [];
    this.combinedBuffer = [];
    
    this.fingerDetected = false;
    this.fingerDetectionConfidence = 0;
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.signalQuality = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    
    console.log('Procesador de señal reseteado');
  }
  
  /**
   * Manejar datos de latido
   */
  private handleHeartbeatData(data: HeartBeatData): void {
    if (!this.isProcessing) return;
    
    this.heartbeatBuffer.push(data);
    if (this.heartbeatBuffer.length > 20) {
      this.heartbeatBuffer.shift();
    }
  }
  
  /**
   * Manejar datos PPG
   */
  private handlePPGData(data: PPGSignalData): void {
    if (!this.isProcessing) return;
    
    this.ppgBuffer.push(data);
    if (this.ppgBuffer.length > 20) {
      this.ppgBuffer.shift();
    }
  }
  
  /**
   * Manejar datos combinados
   */
  private handleCombinedData(data: CombinedSignalData): void {
    if (!this.isProcessing) return;
    
    this.combinedBuffer.push(data);
    if (this.combinedBuffer.length > 20) {
      this.combinedBuffer.shift();
    }
    
    // Actualizar detección de dedo
    this.updateFingerDetection(data.fingerDetected, data.quality);
  }
  
  /**
   * Procesar todas las señales disponibles
   */
  private processAllSignals(): void {
    if (!this.isProcessing) return;
    
    // Solo procesar si tenemos datos
    if (this.heartbeatBuffer.length > 0) {
      this.processHeartbeatSignal();
    }
    
    if (this.ppgBuffer.length > 0) {
      this.processPPGSignal();
    }
  }
  
  /**
   * Actualizar el estado de detección de dedo con algoritmo robusto
   */
  private updateFingerDetection(detected: boolean, quality: number): void {
    // Incrementar contadores según detección
    if (detected) {
      this.consecutiveDetections += 1;
      this.consecutiveNonDetections = 0;
    } else {
      this.consecutiveNonDetections += 1;
      this.consecutiveDetections = 0;
    }
    
    // Lógica de estado con histéresis para evitar falsos cambios
    if (!this.fingerDetected && this.consecutiveDetections >= this.FINGER_DETECTION_THRESHOLD) {
      this.fingerDetected = true;
      this.fingerDetectionConfidence = 70;
      console.log('Dedo detectado');
      
      // Notificar detección de dedo
      eventBus.publish(EventType.FINGER_DETECTION_CHANGED, {
        detected: true,
        confidence: this.fingerDetectionConfidence,
        timestamp: Date.now()
      });
      
    } else if (this.fingerDetected && this.consecutiveNonDetections >= this.FINGER_LOSS_THRESHOLD) {
      this.fingerDetected = false;
      this.fingerDetectionConfidence = 0;
      console.log('Dedo perdido');
      
      // Notificar pérdida de dedo
      eventBus.publish(EventType.FINGER_DETECTION_CHANGED, {
        detected: false,
        confidence: 0,
        timestamp: Date.now()
      });
    }
    
    // Actualizar confianza y calidad si el dedo está detectado
    if (this.fingerDetected) {
      // Actualizar confianza basada en calidad y consistencia
      this.fingerDetectionConfidence = Math.min(
        100, 
        this.fingerDetectionConfidence * 0.8 + (quality * 0.2)
      );
      
      // Actualizar calidad de señal general
      this.signalQuality = quality;
    } else {
      this.signalQuality = 0;
    }
  }
  
  /**
   * Procesar señal de latidos cardíacos
   */
  private processHeartbeatSignal(): void {
    // Solo procesar si hay detección de dedo
    if (!this.fingerDetected || this.signalQuality < this.QUALITY_THRESHOLD) {
      return;
    }
    
    // Obtener último dato de heartbeat
    const lastHeartbeat = this.heartbeatBuffer[this.heartbeatBuffer.length - 1];
    
    // Aplicar filtrado EMA para suavizar la señal
    let filteredValue = lastHeartbeat.rawValue;
    if (this.heartbeatBuffer.length > 1) {
      const prevData = this.heartbeatBuffer[this.heartbeatBuffer.length - 2];
      filteredValue = prevData.rawValue * (1 - this.ALPHA_HEARTBEAT) + 
                     lastHeartbeat.rawValue * this.ALPHA_HEARTBEAT;
    }
    
    // Detectar picos (latidos) usando algoritmo adaptativo
    const currentTime = Date.now();
    let detectedPeak = false;
    
    // Si no hay pico anterior o ha pasado suficiente tiempo
    if (this.lastPeakTime === null || (currentTime - this.lastPeakTime > this.MIN_PEAK_DISTANCE)) {
      // Umbral adaptativo basado en señales recientes
      const recentValues = this.heartbeatBuffer.slice(-5).map(h => h.rawValue);
      const avgValue = calculateDC(recentValues);
      const peakThreshold = avgValue + (calculateStandardDeviation(recentValues) * 0.7);
      
      // Detectar pico si supera umbral
      if (filteredValue > peakThreshold) {
        detectedPeak = true;
        
        // Calcular intervalo RR si hay pico anterior
        if (this.lastPeakTime !== null) {
          const rrInterval = currentTime - this.lastPeakTime;
          
          // Solo añadir si es fisiológicamente razonable (300-1500ms)
          if (rrInterval >= 300 && rrInterval <= 1500) {
            this.rrIntervals.push(rrInterval);
            
            // Mantener buffer de tamaño limitado
            if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
              this.rrIntervals.shift();
            }
          }
        }
        
        // Actualizar tiempo de último pico
        this.lastPeakTime = currentTime;
      }
    }
    
    // Calcular BPM a partir de intervalos RR
    let bpm = 0;
    let confidence = 0;
    
    if (this.rrIntervals.length >= 3) {
      // Calcular BPM usando los últimos intervalos
      const validIntervals = this.rrIntervals.filter(rr => rr >= 300 && rr <= 1500);
      
      if (validIntervals.length >= 2) {
        const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        bpm = Math.round(60000 / avgRR);
        
        // Calcular confianza basada en consistencia de intervalos
        const rrVariability = calculateStandardDeviation(validIntervals) / avgRR;
        confidence = Math.max(0, 100 - (rrVariability * 200));
        
        // Ajustar confianza según calidad de señal
        confidence = (confidence * 0.7) + (this.signalQuality * 0.3);
      }
    }
    
    // Restringir a rango fisiológico
    bpm = Math.max(40, Math.min(200, bpm));
    
    // Crear datos procesados
    const processedData: ProcessedHeartbeatData = {
      timestamp: currentTime,
      rawValue: lastHeartbeat.rawValue,
      filteredValue,
      bpm,
      confidence,
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
    
    // Publicar datos procesados
    eventBus.publish(EventType.PROCESSED_HEARTBEAT, processedData);
    
    // Si se detectó un nuevo pico, publicar evento específico
    if (detectedPeak) {
      eventBus.publish(EventType.HEARTBEAT_PEAK_DETECTED, {
        timestamp: currentTime,
        value: filteredValue,
        intervals: [...this.rrIntervals]
      });
    }
  }
  
  /**
   * Procesar señal PPG
   */
  private processPPGSignal(): void {
    // Solo procesar si hay detección de dedo
    if (!this.fingerDetected) {
      return;
    }
    
    // Obtener último dato PPG
    const lastPPG = this.ppgBuffer[this.ppgBuffer.length - 1];
    
    // Aplicar filtrado EMA para suavizar
    let filteredValue = lastPPG.rawValue;
    if (this.ppgBuffer.length > 1) {
      const prevData = this.ppgBuffer[this.ppgBuffer.length - 2];
      filteredValue = prevData.rawValue * (1 - this.ALPHA_PPG) + 
                     lastPPG.rawValue * this.ALPHA_PPG;
    }
    
    // Normalizar señal (0-1)
    let normalizedValue = 0;
    if (this.ppgBuffer.length >= 10) {
      const recentValues = this.ppgBuffer.slice(-10).map(p => p.rawValue);
      const minValue = Math.min(...recentValues);
      const maxValue = Math.max(...recentValues);
      
      if (maxValue > minValue) {
        normalizedValue = (filteredValue - minValue) / (maxValue - minValue);
      }
    }
    
    // Calcular índice de perfusión
    const perfusionIndex = this.calculatePerfusionIndex();
    
    // Estimar frecuencia dominante de la señal PPG
    let frequency = null;
    if (this.ppgBuffer.length >= 10 && this.signalQuality >= this.QUALITY_THRESHOLD) {
      frequency = this.estimateSignalFrequency();
    }
    
    // Crear datos procesados
    const processedData: ProcessedPPGData = {
      timestamp: Date.now(),
      rawValue: lastPPG.rawValue,
      filteredValue,
      normalizedValue,
      quality: this.signalQuality,
      fingerDetected: this.fingerDetected,
      perfusionIndex,
      frequency
    };
    
    // Publicar datos procesados
    eventBus.publish(EventType.PROCESSED_PPG, processedData);
  }
  
  /**
   * Calcular índice de perfusión
   */
  private calculatePerfusionIndex(): number {
    if (this.ppgBuffer.length < 10) return 0;
    
    // Obtener ventana de valores recientes
    const recentValues = this.ppgBuffer.slice(-10).map(p => p.rawValue);
    
    // Calcular componentes AC y DC
    const ac = calculateAC(recentValues);
    const dc = calculateDC(recentValues);
    
    // Calcular PI = AC/DC
    return dc !== 0 ? ac / dc : 0;
  }
  
  /**
   * Estimar frecuencia dominante de la señal
   */
  private estimateSignalFrequency(): number | null {
    if (this.ppgBuffer.length < 20) return null;
    
    // Obtener ventana de valores
    const signalWindow = this.ppgBuffer.slice(-20).map(p => p.rawValue);
    
    // Calcular cruces por cero (simplificado)
    let zeroCrossings = 0;
    const meanValue = calculateDC(signalWindow);
    
    for (let i = 1; i < signalWindow.length; i++) {
      if ((signalWindow[i] > meanValue && signalWindow[i-1] <= meanValue) ||
          (signalWindow[i] < meanValue && signalWindow[i-1] >= meanValue)) {
        zeroCrossings++;
      }
    }
    
    // Convertir a Hz asumiendo 30 fps (33.3ms entre muestras)
    const samplingRate = 30; // Hz
    const windowDuration = signalWindow.length / samplingRate; // segundos
    
    // Frecuencia = cruces / (2 * duración)
    return zeroCrossings > 0 ? zeroCrossings / (2 * windowDuration) : null;
  }
  
  /**
   * Obtener estado actual del procesador
   */
  getStatus(): {
    isProcessing: boolean;
    fingerDetected: boolean;
    signalQuality: number;
    detectionConfidence: number;
    lastHeartRate: number | null;
  } {
    // Obtener último BPM calculado
    let lastHeartRate: number | null = null;
    const processedHeartbeats = this.heartbeatBuffer.filter(h => h.confidence > 0);
    
    if (processedHeartbeats.length > 0) {
      lastHeartRate = processedHeartbeats[processedHeartbeats.length - 1].confidence;
    }
    
    return {
      isProcessing: this.isProcessing,
      fingerDetected: this.fingerDetected,
      signalQuality: this.signalQuality,
      detectionConfidence: this.fingerDetectionConfidence,
      lastHeartRate
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
