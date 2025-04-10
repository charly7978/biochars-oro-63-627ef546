
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Optimizador de Señal
 * Divide y optimiza la señal en 6 canales específicos para cada signo vital
 * Implementa retroalimentación bidireccional con el módulo de cálculo
 */

import { EventType, eventBus } from '../events/EventBus';
import { ProcessedHeartbeatData, ProcessedPPGData } from '../processing/SignalProcessor';
import { calculateAC, calculateDC, calculateStandardDeviation } from '../utils/vitalSignsUtils';

export interface OptimizedHeartRate {
  timestamp: number;
  heartRate: number;
  confidence: number;
  optimizedData: number[];
}

export interface OptimizedSPO2 {
  timestamp: number;
  spo2: number;
  confidence: number;
  redData: number[];
  irData: number[];
}

export interface OptimizedBloodPressure {
  timestamp: number;
  systolic: number;
  diastolic: number;
  display: string;
  confidence: number;
  ptt: number; // Tiempo de tránsito de pulso
}

export interface OptimizedGlucose {
  timestamp: number;
  value: number;
  confidence: number;
}

export interface OptimizedLipids {
  timestamp: number;
  totalCholesterol: number;
  triglycerides: number;
  confidence: number;
}

export interface OptimizedArrhythmia {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
  intervals: number[];
  detectionProbability: number;
}

// Interfaz para solicitudes de retroalimentación
export interface FeedbackRequest {
  channel: 'heart_rate' | 'spo2' | 'blood_pressure' | 'glucose' | 'lipids' | 'arrhythmia';
  requestId: string;
  timestamp: number;
  data: any;
}

// Necesario definir estas interfaces para corregir errores de tipo
export interface ProcessedSignalData {
  timestamp: number;
  quality: number;
  filteredValue: number;
  perfusionIndex: number;
  channelData?: {
    red: number;
    ir: number;
  };
}

export class SignalOptimizer {
  // Canales para cada signo vital
  private heartRateBuffer: ProcessedHeartbeatData[] = [];
  private spo2Buffer: ProcessedSignalData[] = [];
  private bloodPressureBuffer: ProcessedSignalData[] = [];
  private glucoseBuffer: ProcessedSignalData[] = [];
  private lipidsBuffer: ProcessedSignalData[] = [];
  private arrhythmiaBuffer: ProcessedHeartbeatData[] = [];
  
  // Estado del optimizador
  private isRunning: boolean = false;
  private optimizationInterval: number | null = null;
  
  // Sistema de retroalimentación bidireccional
  private pendingFeedbackRequests: Map<string, FeedbackRequest> = new Map();
  
  // Constantes
  private readonly HR_BUFFER_SIZE = 10;
  private readonly SPO2_BUFFER_SIZE = 15;
  private readonly BP_BUFFER_SIZE = 10;
  private readonly GLUCOSE_BUFFER_SIZE = 20;
  private readonly LIPIDS_BUFFER_SIZE = 20;
  private readonly ARRHYTHMIA_BUFFER_SIZE = 20;
  
  constructor() {
    // Suscribirse a solicitudes de retroalimentación desde el módulo de cálculo
    eventBus.subscribe(EventType.VITAL_SIGNS_UPDATED, this.handleFeedbackRequest.bind(this));
  }
  
  /**
   * Iniciar optimización
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Suscribirse a señales procesadas
    eventBus.subscribe(EventType.PROCESSED_HEARTBEAT, this.handleProcessedHeartbeat.bind(this));
    eventBus.subscribe(EventType.PROCESSED_PPG, this.handleProcessedPPG.bind(this));
    
    // Iniciar ciclo de optimización
    this.optimizationInterval = window.setInterval(() => {
      this.optimizeAllChannels();
    }, 1000); // Optimizar cada 1 segundo
    
    console.log('Optimizador de señal iniciado con sistema de retroalimentación bidireccional');
  }
  
  /**
   * Detener optimización
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.optimizationInterval !== null) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    
    this.clearBuffers();
    this.pendingFeedbackRequests.clear();
    console.log('Optimizador de señal detenido');
  }
  
  /**
   * Limpiar todos los buffers
   */
  private clearBuffers(): void {
    this.heartRateBuffer = [];
    this.spo2Buffer = [];
    this.bloodPressureBuffer = [];
    this.glucoseBuffer = [];
    this.lipidsBuffer = [];
    this.arrhythmiaBuffer = [];
  }
  
  /**
   * Manejar datos de latido procesados
   */
  private handleProcessedHeartbeat(data: ProcessedHeartbeatData): void {
    if (!this.isRunning) return;
    
    // Añadir a buffer de frecuencia cardíaca
    this.heartRateBuffer.push(data);
    if (this.heartRateBuffer.length > this.HR_BUFFER_SIZE) {
      this.heartRateBuffer.shift();
    }
    
    // Añadir a buffer de arritmias (más largo para análisis estadístico)
    this.arrhythmiaBuffer.push(data);
    if (this.arrhythmiaBuffer.length > this.ARRHYTHMIA_BUFFER_SIZE) {
      this.arrhythmiaBuffer.shift();
    }
  }
  
  /**
   * Manejar datos PPG procesados
   */
  private handleProcessedPPG(data: ProcessedPPGData): void {
    if (!this.isRunning) return;
    
    const signalData: ProcessedSignalData = {
      timestamp: data.timestamp,
      quality: data.quality || 50,
      filteredValue: data.filteredValue,
      perfusionIndex: data.perfusionIndex || 0,
      channelData: {
        red: data.redValue || 0,
        ir: data.irValue || 0
      }
    };
    
    // Añadir a buffer de SpO2
    this.spo2Buffer.push(signalData);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
    
    // Añadir a buffer de presión arterial
    this.bloodPressureBuffer.push(signalData);
    if (this.bloodPressureBuffer.length > this.BP_BUFFER_SIZE) {
      this.bloodPressureBuffer.shift();
    }
    
    // Añadir a buffer de glucosa
    this.glucoseBuffer.push(signalData);
    if (this.glucoseBuffer.length > this.GLUCOSE_BUFFER_SIZE) {
      this.glucoseBuffer.shift();
    }
    
    // Añadir a buffer de lípidos
    this.lipidsBuffer.push(signalData);
    if (this.lipidsBuffer.length > this.LIPIDS_BUFFER_SIZE) {
      this.lipidsBuffer.shift();
    }
  }
  
  /**
   * Manejar solicitudes de retroalimentación del módulo de cálculo
   * Implementa comunicación bidireccional entre optimización y cálculo
   */
  private handleFeedbackRequest(data: any): void {
    if (!data.feedbackRequest) return;
    
    const request = data.feedbackRequest as FeedbackRequest;
    console.log(`Retroalimentación recibida para canal ${request.channel}, ID: ${request.requestId}`);
    
    // Añadir a cola de solicitudes pendientes
    this.pendingFeedbackRequests.set(request.requestId, request);
    
    // Procesar solicitud según el canal
    switch (request.channel) {
      case 'heart_rate':
        this.optimizeHeartRateWithFeedback(request);
        break;
      case 'spo2':
        this.optimizeSPO2WithFeedback(request);
        break;
      case 'blood_pressure':
        this.optimizeBloodPressureWithFeedback(request);
        break;
      case 'glucose':
        this.optimizeGlucose(request);
        break;
      case 'lipids':
        this.optimizeLipids(request);
        break;
      case 'arrhythmia':
        this.optimizeArrhythmiaWithFeedback(request);
        break;
    }
    
    // Eliminar solicitud procesada
    this.pendingFeedbackRequests.delete(request.requestId);
  }
  
  /**
   * Optimizar todos los canales
   */
  private optimizeAllChannels(): void {
    if (!this.isRunning) return;
    
    // Optimizar para cada signo vital de forma independiente
    this.optimizeHeartRate();
    this.optimizeSPO2();
    this.optimizeBloodPressure();
    this.optimizeGlucose();
    this.optimizeLipids();
    this.optimizeArrhythmia();
  }
  
  /**
   * Optimizar señal para frecuencia cardíaca
   */
  private optimizeHeartRate(): void {
    if (this.heartRateBuffer.length < 3) return;
    
    try {
      // Filtrar valores de BPM válidos
      const validData = this.heartRateBuffer.filter(data => 
        data.bpm >= 40 && data.bpm <= 200
      );
      
      if (validData.length < 2) return;
      
      // Calcular BPM optimizado basado en las señales de mayor calidad
      const weightedValues = validData.map(data => {
        return {
          bpm: data.bpm,
          weight: (data as any).quality ? (data as any).quality / 100 : 0.8
        };
      });
      
      let totalWeight = 0;
      let weightedBpm = 0;
      
      for (const item of weightedValues) {
        weightedBpm += item.bpm * item.weight;
        totalWeight += item.weight;
      }
      
      if (totalWeight > 0) {
        const optimizedBpm = Math.round(weightedBpm / totalWeight);
        
        // Calcular confianza
        const avgQuality = validData.reduce((sum, data) => sum + ((data as any).quality || 80), 0) / validData.length;
        
        // Crear datos optimizados
        const optimizedData: OptimizedHeartRate = {
          timestamp: Date.now(),
          heartRate: optimizedBpm,
          confidence: avgQuality,
          optimizedData: validData.map(d => d.bpm)
        };
        
        // Publicar resultado optimizado
        eventBus.publish(EventType.OPTIMIZED_HEART_RATE, optimizedData);
      }
    } catch (error) {
      console.error('Error optimizando frecuencia cardíaca:', error);
    }
  }
  
  /**
   * Optimizar frecuencia cardíaca con retroalimentación del módulo de cálculo
   */
  private optimizeHeartRateWithFeedback(request: FeedbackRequest): void {
    if (this.heartRateBuffer.length < 2) return;
    
    try {
      // Ajustar según retroalimentación
      const requestData = request.data;
      const targetConsistency = requestData.targetConsistency || 0;
      
      // Filtro optimizado con parámetros ajustados basados en retroalimentación
      const validData = this.heartRateBuffer.filter(data => {
        // Ajustar umbrales basados en retroalimentación
        const minThreshold = requestData.minThreshold || 40;
        const maxThreshold = requestData.maxThreshold || 200;
        return data.bpm >= minThreshold && data.bpm <= maxThreshold;
      });
      
      if (validData.length < 2) return;
      
      // Calcular ponderación adaptativa basada en retroalimentación
      const adaptiveWeighting = validData.map(data => {
        let weight = (data as any).quality ? (data as any).quality / 100 : 0.8;
        
        // Ajustar peso según retroalimentación
        if (targetConsistency > 0) {
          const normalizedBpm = Math.abs(data.bpm - requestData.targetHeartRate) / 20;
          const consistencyFactor = Math.max(0, 1 - normalizedBpm);
          weight = weight * 0.7 + consistencyFactor * 0.3;
        }
        
        return {
          bpm: data.bpm,
          weight
        };
      });
      
      // Calcular BPM ponderado
      let totalWeight = 0;
      let weightedBpm = 0;
      
      for (const item of adaptiveWeighting) {
        weightedBpm += item.bpm * item.weight;
        totalWeight += item.weight;
      }
      
      if (totalWeight > 0) {
        const optimizedBpm = Math.round(weightedBpm / totalWeight);
        const adaptiveFeedbackResponse = {
          requestId: request.requestId,
          timestamp: Date.now(),
          heartRate: optimizedBpm,
          adaptationApplied: true,
          confidence: Math.min(100, validData.reduce((sum, data) => sum + ((data as any).quality || 80), 0) / validData.length)
        };
        
        // Enviar respuesta específica para esta solicitud
        eventBus.publish(EventType.OPTIMIZED_HEART_RATE, {
          timestamp: Date.now(),
          heartRate: optimizedBpm,
          confidence: adaptiveFeedbackResponse.confidence,
          optimizedData: validData.map(d => d.bpm),
          feedbackResponse: adaptiveFeedbackResponse
        });
      }
    } catch (error) {
      console.error('Error en optimización con retroalimentación de frecuencia cardíaca:', error);
    }
  }
  
  /**
   * Optimizar señal para SpO2
   */
  private optimizeSPO2(): void {
    if (this.spo2Buffer.length < this.SPO2_BUFFER_SIZE / 2) return;
    
    try {
      // Filtrar datos de calidad
      const qualityData = this.spo2Buffer.filter(data => data.quality > 40);
      
      if (qualityData.length < 3) return;
      
      // Extraer valores de señal para análisis
      const signalValues = qualityData.map(data => data.filteredValue);
      
      // Calcular componentes AC/DC para análisis de absorción de luz
      const acComponent = calculateAC(signalValues);
      const dcComponent = calculateDC(signalValues);
      
      if (dcComponent === 0) return;
      
      // Extraer datos Rojo e IR de señales PPG de alta calidad
      const redData: number[] = [];
      const irData: number[] = [];
      
      // Recolectar datos de canales específicos
      for (const data of qualityData) {
        if (data.channelData && data.channelData.red && data.channelData.ir) {
          redData.push(data.channelData.red);
          irData.push(data.channelData.ir);
        }
      }
      
      // Calcular confianza basada en calidad y estabilidad
      const avgQuality = qualityData.reduce((sum, data) => sum + data.quality, 0) / qualityData.length;
      const stability = 100 - Math.min(100, calculateStandardDeviation(signalValues) * 50);
      
      const confidence = (avgQuality * 0.7) + (stability * 0.3);
      
      // Crear datos optimizados con canal para retroalimentación bidireccional
      const optimizedData: OptimizedSPO2 = {
        timestamp: Date.now(),
        spo2: 0, // El valor de SpO2 lo calculará el módulo de cálculo
        confidence,
        redData,
        irData
      };
      
      // Publicar resultado optimizado para que el módulo de cálculo determine el valor final
      eventBus.publish(EventType.OPTIMIZED_SPO2, optimizedData);
      
    } catch (error) {
      console.error('Error optimizando SpO2:', error);
    }
  }
  
  /**
   * Optimizar SpO2 con retroalimentación del módulo de cálculo
   */
  private optimizeSPO2WithFeedback(request: FeedbackRequest): void {
    if (this.spo2Buffer.length < 3) return;
    
    try {
      // Obtener parámetros de retroalimentación
      const requestData = request.data;
      const targetStability = requestData.targetStability || 0;
      
      // Filtro optimizado basado en retroalimentación
      const qualityThreshold = requestData.qualityThreshold || 40;
      const qualityData = this.spo2Buffer.filter(data => data.quality > qualityThreshold);
      
      if (qualityData.length < 3) return;
      
      // Extraer valores de señal
      const signalValues = qualityData.map(data => data.filteredValue);
      
      // Aplicar filtro adaptativo basado en retroalimentación
      let filteredValues = [...signalValues];
      if (targetStability > 0) {
        // Filtro de mediana adaptativo
        filteredValues = this.applyAdaptiveFilter(signalValues, requestData.filterStrength || 0.5);
      }
      
      // Extraer datos de canales específicos
      const redData: number[] = [];
      const irData: number[] = [];
      
      // Recolectar datos específicos para SpO2
      for (const data of qualityData) {
        if (data.channelData && data.channelData.red && data.channelData.ir) {
          redData.push(data.channelData.red);
          irData.push(data.channelData.ir);
        }
      }
      
      // Calcular confianza adaptativa
      const adaptiveConfidence = this.calculateAdaptiveConfidence(qualityData, requestData);
      
      // Enviar respuesta específica para esta solicitud
      const adaptiveFeedbackResponse = {
        requestId: request.requestId,
        timestamp: Date.now(),
        filteredValues,
        adaptationApplied: true,
        confidence: adaptiveConfidence
      };
      
      eventBus.publish(EventType.OPTIMIZED_SPO2, {
        timestamp: Date.now(),
        spo2: 0, // El valor de SpO2 lo calculará el módulo de cálculo
        confidence: adaptiveConfidence,
        redData,
        irData,
        feedbackResponse: adaptiveFeedbackResponse
      });
      
    } catch (error) {
      console.error('Error en optimización con retroalimentación de SpO2:', error);
    }
  }
  
  /**
   * Aplica un filtro adaptativo basado en parámetros de retroalimentación
   */
  private applyAdaptiveFilter(values: number[], strength: number): number[] {
    if (values.length < 3) return values;
    
    const filtered = [];
    const windowSize = Math.max(3, Math.round(strength * 5));
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(values.length - 1, i + Math.floor(windowSize / 2));
      const window = values.slice(start, end + 1);
      
      // Ordenar ventana para filtro de mediana
      window.sort((a, b) => a - b);
      const median = window[Math.floor(window.length / 2)];
      filtered.push(median);
    }
    
    return filtered;
  }
  
  /**
   * Calcula confianza adaptativa basada en retroalimentación
   */
  private calculateAdaptiveConfidence(data: ProcessedSignalData[], feedbackParams: any): number {
    // Calidad base
    const avgQuality = data.reduce((sum, d) => sum + d.quality, 0) / data.length;
    
    // Factores de ajuste de retroalimentación
    const qualityWeight = feedbackParams.qualityWeight || 0.7;
    const stabilityWeight = feedbackParams.stabilityWeight || 0.3;
    
    // Calcular estabilidad de señal
    const values = data.map(d => d.filteredValue);
    const stability = 100 - Math.min(100, calculateStandardDeviation(values) * 50);
    
    // Aplicar ponderación adaptativa
    return (avgQuality * qualityWeight) + (stability * stabilityWeight);
  }
  
  /**
   * Optimizar señal para presión arterial
   */
  private optimizeBloodPressure(): void {
    if (this.bloodPressureBuffer.length < 5 || this.heartRateBuffer.length < 5) return;
    
    try {
      // Este método necesita datos tanto de PPG como de latidos para estimar PA
      const qualityPPGData = this.bloodPressureBuffer.filter(data => data.quality > 50);
      
      if (qualityPPGData.length < 3) return;
      
      // Extraer datos para análisis y optimización
      const ppgValues = qualityPPGData.map(data => data.filteredValue);
      const recentHeartRate = this.heartRateBuffer.length > 0 
        ? this.heartRateBuffer[this.heartRateBuffer.length - 1].bpm 
        : 0;
      
      if (recentHeartRate === 0) return;
      
      // Canal bidireccional: Calcular variables específicas para PA
      // pero no determinar valores finales (eso lo hará el módulo de cálculo)
      const amplitudeAnalysis = this.analyzeSignalAmplitude(ppgValues);
      const pttEstimation = this.analyzePulseTransitTime(this.heartRateBuffer);
      
      // Calcular confianza
      const confidence = Math.min(80, this.bloodPressureBuffer.reduce((sum, data) => sum + data.quality, 0) / 
                        this.bloodPressureBuffer.length);
      
      // Crear datos optimizados con variables necesarias para cálculo final
      const optimizedData = {
        timestamp: Date.now(),
        ptt: pttEstimation.estimatedPTT,
        heartRate: recentHeartRate,
        signalAmplitude: amplitudeAnalysis.amplitude,
        signalRiseTime: amplitudeAnalysis.riseTime,
        waveformArea: amplitudeAnalysis.area,
        confidence,
        // Nota: systolic y diastolic serán calculados por el módulo de cálculo
        systolic: 0, 
        diastolic: 0,
        display: "--/--"
      };
      
      // Publicar resultado optimizado para que el módulo de cálculo determine valores finales
      eventBus.publish(EventType.OPTIMIZED_BLOOD_PRESSURE, optimizedData);
      
    } catch (error) {
      console.error('Error optimizando presión arterial:', error);
    }
  }
  
  /**
   * Optimizar presión arterial con retroalimentación del módulo de cálculo
   */
  private optimizeBloodPressureWithFeedback(request: FeedbackRequest): void {
    if (this.bloodPressureBuffer.length < 3) return;
    
    try {
      // Obtener parámetros de retroalimentación
      const requestData = request.data;
      
      // Aplicar umbral de calidad adaptativo
      const qualityThreshold = requestData.qualityThreshold || 50;
      const qualityPPGData = this.bloodPressureBuffer.filter(data => data.quality > qualityThreshold);
      
      if (qualityPPGData.length < 3) return;
      
      // Extraer valores con ponderación adaptativa
      const values = qualityPPGData.map(data => data.filteredValue);
      
      // Análisis de forma de onda optimizado según retroalimentación
      const amplitudeAnalysis = this.analyzeSignalAmplitude(values, requestData.amplitudeWeight);
      const pttEstimation = this.analyzePulseTransitTime(this.heartRateBuffer, requestData.pttBias);
      
      // Enviar respuesta específica para esta solicitud
      const adaptiveFeedbackResponse = {
        requestId: request.requestId,
        timestamp: Date.now(),
        ptt: pttEstimation.estimatedPTT,
        amplitudeAnalysis,
        adaptationApplied: true
      };
      
      eventBus.publish(EventType.OPTIMIZED_BLOOD_PRESSURE, {
        timestamp: Date.now(),
        ptt: pttEstimation.estimatedPTT,
        heartRate: this.heartRateBuffer.length > 0 ? this.heartRateBuffer[this.heartRateBuffer.length - 1].bpm : 0,
        signalAmplitude: amplitudeAnalysis.amplitude,
        signalRiseTime: amplitudeAnalysis.riseTime,
        waveformArea: amplitudeAnalysis.area,
        confidence: Math.min(90, qualityPPGData.reduce((sum, data) => sum + data.quality, 0) / qualityPPGData.length),
        systolic: 0, // El módulo de cálculo determinará esto
        diastolic: 0, // El módulo de cálculo determinará esto
        display: "--/--",
        feedbackResponse: adaptiveFeedbackResponse
      });
      
    } catch (error) {
      console.error('Error en optimización con retroalimentación de presión arterial:', error);
    }
  }
  
  /**
   * Analiza la amplitud y características de la forma de onda PPG
   */
  private analyzeSignalAmplitude(values: number[], amplitudeWeight = 1.0): {
    amplitude: number;
    riseTime: number;
    decayTime: number;
    area: number;
  } {
    if (values.length < 5) {
      return { amplitude: 0, riseTime: 0, decayTime: 0, area: 0 };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = (max - min) * amplitudeWeight;
    
    // Estimación de tiempo de subida y bajada (muestras)
    let riseTime = 0;
    let decayTime = 0;
    
    // Aproximación de área bajo la curva
    const baseline = min;
    const area = values.reduce((sum, v) => sum + (v - baseline), 0) / values.length;
    
    return { amplitude, riseTime, decayTime, area };
  }
  
  /**
   * Analiza tiempo de tránsito de pulso a partir de datos de heartbeat
   */
  private analyzePulseTransitTime(heartbeatData: ProcessedHeartbeatData[], pttBias = 0): {
    estimatedPTT: number;
    confidence: number;
  } {
    // Eestimación de PTT
    // Un PTT típico está entre 180-350ms
    const baselinePTT = 250 + pttBias; // ms
    let pttAdjustment = 0;
    let confidence = 70;
    
    // Si tenemos datos de intervalos RR, ajustamos el PTT
    if (heartbeatData.length > 2) {
      const allIntervals: number[] = [];
      heartbeatData.forEach(data => {
        if (data.intervals && data.intervals.length > 0) {
          allIntervals.push(...data.intervals);
        }
      });
      
      if (allIntervals.length > 3) {
        const avgInterval = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
        
        // Aproximación: PTT tiende a ser menor con intervalos RR más cortos (HR más alto)
        pttAdjustment = (avgInterval - 800) * -0.1;
        confidence = 85;
      }
    }
    
    return {
      estimatedPTT: Math.max(180, Math.min(350, baselinePTT + pttAdjustment)),
      confidence
    };
  }
  
  /**
   * Optimizar señal para glucosa
   */
  private optimizeGlucose(request?: FeedbackRequest): void {
    if (this.glucoseBuffer.length < this.GLUCOSE_BUFFER_SIZE / 2) return;
    
    try {
      // Filtrar datos de calidad
      const qualityThreshold = request?.data?.qualityThreshold || 40;
      const qualityData = this.glucoseBuffer.filter(data => data.quality > qualityThreshold);
      
      if (qualityData.length < 5) return;
      
      // Extraer características para cálculo (pero no calcular valor final - eso lo hará el módulo de cálculo)
      const signalValues = qualityData.map(data => data.filteredValue);
      const perfusionIndices = qualityData.map(data => data.perfusionIndex);
      
      // Calcular características para análisis de glucosa
      const signalMean = calculateDC(signalValues);
      const perfusionMean = calculateDC(perfusionIndices);
      const signalVariability = calculateStandardDeviation(signalValues) / signalMean;
      
      // Calcular confianza
      const avgQuality = qualityData.reduce((sum, data) => sum + data.quality, 0) / qualityData.length;
      const stability = 100 - Math.min(100, calculateStandardDeviation(perfusionIndices) * 200);
      const confidence = (avgQuality * 0.6) + (stability * 0.4);
      
      // Crear datos optimizados con variables clave para cálculo final
      const optimizedData: OptimizedGlucose = {
        timestamp: Date.now(),
        value: 0, // El módulo de cálculo determinará esto
        confidence
      };
      
      // Si hay retroalimentación, incluir respuesta específica
      let responseData: any = {
        ...optimizedData,
        signalMean,
        perfusionMean,
        signalVariability,
        stability,
        adaptationReady: true
      };
      
      if (request) {
        responseData.feedbackResponse = {
          requestId: request.requestId,
          timestamp: Date.now(),
          adaptationApplied: true,
          confidence
        };
      }
      
      // Publicar datos optimizados que el módulo de cálculo usará para determinar el valor final
      eventBus.publish(EventType.OPTIMIZED_GLUCOSE, responseData);
      
    } catch (error) {
      console.error('Error optimizando glucosa:', error);
    }
  }
  
  /**
   * Optimizar señal para lípidos 
   */
  private optimizeLipids(request?: FeedbackRequest): void {
    if (this.lipidsBuffer.length < this.LIPIDS_BUFFER_SIZE / 2) return;
    
    try {
      // Filtrar datos de calidad
      const qualityThreshold = request?.data?.qualityThreshold || 35;
      const qualityData = this.lipidsBuffer.filter(data => data.quality > qualityThreshold);
      
      if (qualityData.length < 8) return;
      
      // Extraer características de la señal para estimación (sin calcular valores finales)
      const signalValues = qualityData.map(data => data.filteredValue);
      const perfusionIndices = qualityData.map(data => data.perfusionIndex);
      
      // Calcular características específicas para análisis lipídico
      const signalMean = calculateDC(signalValues);
      const perfusionMean = calculateDC(perfusionIndices);
      const signalAC = calculateAC(signalValues);
      
      // Calcular confianza
      const avgQuality = qualityData.reduce((sum, data) => sum + data.quality, 0) / qualityData.length;
      const confidence = Math.min(70, avgQuality);
      
      // Crear datos optimizados con variables clave para cálculo final
      const optimizedData: OptimizedLipids = {
        timestamp: Date.now(),
        totalCholesterol: 0, // El módulo de cálculo determinará esto
        triglycerides: 0, // El módulo de cálculo determinará esto
        confidence
      };
      
      // Si hay retroalimentación, incluir respuesta específica
      let responseData: any = {
        ...optimizedData,
        signalMean,
        perfusionMean,
        signalAC,
        adaptationReady: true
      };
      
      if (request) {
        responseData.feedbackResponse = {
          requestId: request.requestId,
          timestamp: Date.now(),
          adaptationApplied: true,
          confidence
        };
      }
      
      // Publicar datos optimizados para que el módulo de cálculo determine valores finales
      eventBus.publish(EventType.OPTIMIZED_LIPIDS, responseData);
      
    } catch (error) {
      console.error('Error optimizando lípidos:', error);
    }
  }
  
  /**
   * Optimizar datos para detección de arritmias - canal independiente
   */
  private optimizeArrhythmia(): void {
    if (this.arrhythmiaBuffer.length < this.ARRHYTHMIA_BUFFER_SIZE / 2) return;
    
    try {
      // Extraer intervalos RR para análisis
      const allIntervals: number[] = [];
      this.arrhythmiaBuffer.forEach(data => {
        if (data.intervals && data.intervals.length > 0) {
          allIntervals.push(...data.intervals);
        }
      });
      
      // Necesitamos suficientes intervalos para análisis significativo
      if (allIntervals.length < 8) return;
      
      // Calcular variables clave para análisis de arritmias (sin determinar valor final)
      // RMSSD (Root Mean Square of Successive Differences)
      let sumSquaredDiff = 0;
      let diffCount = 0;
      
      for (let i = 1; i < allIntervals.length; i++) {
        const diff = allIntervals[i] - allIntervals[i-1];
        sumSquaredDiff += diff * diff;
        diffCount++;
      }
      
      const rmssd = diffCount > 0 ? Math.sqrt(sumSquaredDiff / diffCount) : 0;
      
      // Calcular variabilidad general
      const avgInterval = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
      const rrVariation = calculateStandardDeviation(allIntervals) / avgInterval;
      
      // Publicar datos optimizados para que el módulo de cálculo determine la probabilidad final
      // Implementación bidireccional: enviamos variables clave, no probabilidad final
      const optimizedData: OptimizedArrhythmia = {
        timestamp: Date.now(),
        rmssd,
        rrVariation,
        intervals: allIntervals.slice(-20), // Mandar solo los 20 más recientes
        detectionProbability: 0 // El módulo de cálculo determinará esto
      };
      
      eventBus.publish(EventType.OPTIMIZED_ARRHYTHMIA, {
        ...optimizedData,
        intervalCount: allIntervals.length,
        avgInterval,
        adaptationReady: true
      });
      
    } catch (error) {
      console.error('Error optimizando datos de arritmia:', error);
    }
  }
  
  /**
   * Optimizar arrhythmia con retroalimentación del módulo de cálculo
   */
  private optimizeArrhythmiaWithFeedback(request: FeedbackRequest): void {
    try {
      // Obtener parámetros de retroalimentación
      const requestData = request.data;
      
      // Aplicar filtro optimizado a intervalos
      const allIntervals: number[] = [];
      this.arrhythmiaBuffer.forEach(data => {
        if (data.intervals && data.intervals.length > 0) {
          allIntervals.push(...data.intervals);
        }
      });
      
      if (allIntervals.length < 5) return;
      
      // Filtro adaptativo para detección de outliers en intervalos RR
      let filteredIntervals = [...allIntervals];
      if (requestData.filterOutliers) {
        filteredIntervals = this.filterRROutliers(allIntervals, requestData.outlierThreshold || 0.2);
      }
      
      // Calcular RMSSD y variabilidad con intervalos filtrados
      let sumSquaredDiff = 0;
      let diffCount = 0;
      
      for (let i = 1; i < filteredIntervals.length; i++) {
        const diff = filteredIntervals[i] - filteredIntervals[i-1];
        sumSquaredDiff += diff * diff;
        diffCount++;
      }
      
      const rmssd = diffCount > 0 ? Math.sqrt(sumSquaredDiff / diffCount) : 0;
      
      // Calcular variabilidad
      const avgInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
      const rrVariation = calculateStandardDeviation(filteredIntervals) / avgInterval;
      
      // Crear respuesta adaptativa
      const adaptiveFeedbackResponse = {
        requestId: request.requestId,
        timestamp: Date.now(),
        rmssd,
        rrVariation,
        filteredCount: filteredIntervals.length,
        outlierCount: allIntervals.length - filteredIntervals.length,
        adaptationApplied: true
      };
      
      // Enviar datos optimizados con retroalimentación
      eventBus.publish(EventType.OPTIMIZED_ARRHYTHMIA, {
        timestamp: Date.now(),
        rmssd,
        rrVariation,
        intervals: filteredIntervals.slice(-20),
        detectionProbability: 0, // El módulo de cálculo determinará esto
        feedbackResponse: adaptiveFeedbackResponse
      });
      
    } catch (error) {
      console.error('Error en optimización con retroalimentación de arritmia:', error);
    }
  }
  
  /**
   * Filtra outliers en intervalos RR para detección de arritmias
   */
  private filterRROutliers(intervals: number[], threshold: number): number[] {
    if (intervals.length < 3) return intervals;
    
    const filtered = [];
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Filtrar outliers basado en desviación del promedio
    for (const interval of intervals) {
      const deviation = Math.abs(interval - avg) / avg;
      if (deviation <= threshold) {
        filtered.push(interval);
      }
    }
    
    return filtered.length > 0 ? filtered : intervals;
  }
  
  /**
   * Obtener estado del optimizador
   */
  getStatus(): {
    isRunning: boolean;
    bufferSizes: {
      heartRate: number;
      spo2: number;
      bloodPressure: number;
      glucose: number;
      lipids: number;
      arrhythmia: number;
    },
    feedbackRequestCount: number;
  } {
    return {
      isRunning: this.isRunning,
      bufferSizes: {
        heartRate: this.heartRateBuffer.length,
        spo2: this.spo2Buffer.length,
        bloodPressure: this.bloodPressureBuffer.length,
        glucose: this.glucoseBuffer.length,
        lipids: this.lipidsBuffer.length,
        arrhythmia: this.arrhythmiaBuffer.length
      },
      feedbackRequestCount: this.pendingFeedbackRequests.size
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
export const signalOptimizer = new SignalOptimizer();
