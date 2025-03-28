
/**
 * Optimizador de Señal
 * Aplica mejoras específicas para cada tipo de señal vital
 */

import { EventType, eventBus } from '../events/EventBus';
import { ProcessedHeartbeatData, ProcessedPPGData } from '../processing/SignalProcessor';
import { KalmanFilter, applyBandpassFilter } from '../utils/SignalProcessingFilters';

// Interfaces para canales de optimización
export interface OptimizedHeartRateData {
  timestamp: number;
  value: number;
  optimizedValue: number;
  confidence: number;
}

export interface OptimizedSpO2Data {
  timestamp: number;
  value: number;
  optimizedValue: number;
  confidence: number;
}

export interface OptimizedBloodPressureData {
  timestamp: number;
  systolic: number;
  diastolic: number;
  optimizedSystolic: number;
  optimizedDiastolic: number;
  confidence: number;
}

export interface OptimizedGlucoseData {
  timestamp: number;
  value: number;
  optimizedValue: number;
  confidence: number;
}

export interface OptimizedLipidData {
  timestamp: number;
  cholesterol: number;
  triglycerides: number;
  optimizedCholesterol: number;
  optimizedTriglycerides: number;
  confidence: number;
}

export interface OptimizedArrhythmiaData {
  timestamp: number;
  detected: boolean;
  confidence: number;
  windows: { start: number; end: number; }[];
  rmssd: number;
  rrVariation: number;
}

export class SignalOptimizer {
  // Estado de activación de canales
  private isActive: boolean = false;
  private channels: {
    heartRate: boolean;
    spo2: boolean;
    bloodPressure: boolean;
    glucose: boolean;
    lipids: boolean;
    arrhythmia: boolean;
  } = {
    heartRate: false,
    spo2: false,
    bloodPressure: false,
    glucose: false,
    lipids: false,
    arrhythmia: false
  };
  
  // Filtros específicos por canal
  private heartRateFilter: KalmanFilter = new KalmanFilter(0.05, 0.2);
  private spo2Filter: KalmanFilter = new KalmanFilter(0.03, 0.1);
  private systolicFilter: KalmanFilter = new KalmanFilter(0.05, 0.1);
  private diastolicFilter: KalmanFilter = new KalmanFilter(0.05, 0.1);
  private glucoseFilter: KalmanFilter = new KalmanFilter(0.02, 0.05);
  private cholesterolFilter: KalmanFilter = new KalmanFilter(0.01, 0.03);
  private triglyceridesFilter: KalmanFilter = new KalmanFilter(0.01, 0.03);
  
  // Buffers para filtros de pasa banda
  private heartRateBandpassBuffer: { input: number[]; output: number[] } = { input: [], output: [] };
  private spo2BandpassBuffer: { input: number[]; output: number[] } = { input: [], output: [] };
  
  // Procesamiento avanzado de arritmias
  private rrIntervals: number[] = [];
  private arrhythmiaWindows: { start: number; end: number; }[] = [];
  
  // Retención de últimos valores para feedback
  private lastHeartRate: number = 0;
  private lastSpO2: number = 0;
  private lastSystolic: number = 0;
  private lastDiastolic: number = 0;
  private lastGlucose: number = 0;
  private lastCholesterol: number = 0;
  private lastTriglycerides: number = 0;
  
  /**
   * Iniciar optimizador
   */
  start(enabledChannels?: Partial<typeof this.channels>): void {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Activar canales especificados (o todos si no se especifica)
    if (enabledChannels) {
      this.channels = { ...this.channels, ...enabledChannels };
    } else {
      // Por defecto, activar todos los canales
      Object.keys(this.channels).forEach(key => {
        this.channels[key as keyof typeof this.channels] = true;
      });
    }
    
    // Suscribirse a eventos de procesamiento
    eventBus.subscribe(EventType.PROCESSED_HEARTBEAT, this.optimizeHeartRate.bind(this));
    eventBus.subscribe(EventType.PROCESSED_PPG, this.optimizeSpO2.bind(this));
    
    // También escuchar eventos de resultados para feedback bidireccional
    eventBus.subscribe(EventType.VITAL_SIGNS_UPDATED, this.handleVitalSignsFeedback.bind(this));
    
    // Reiniciar filtros
    this.resetFilters();
    
    console.log('Optimizador de señal iniciado', { canales: this.channels });
  }
  
  /**
   * Detener optimizador
   */
  stop(): void {
    this.isActive = false;
    this.resetFilters();
    console.log('Optimizador de señal detenido');
  }
  
  /**
   * Reiniciar filtros
   */
  private resetFilters(): void {
    this.heartRateFilter.reset();
    this.spo2Filter.reset();
    this.systolicFilter.reset();
    this.diastolicFilter.reset();
    this.glucoseFilter.reset();
    this.cholesterolFilter.reset();
    this.triglyceridesFilter.reset();
    
    this.heartRateBandpassBuffer = { input: [], output: [] };
    this.spo2BandpassBuffer = { input: [], output: [] };
    
    this.rrIntervals = [];
    this.arrhythmiaWindows = [];
    
    this.lastHeartRate = 0;
    this.lastSpO2 = 0;
    this.lastSystolic = 0;
    this.lastDiastolic = 0;
    this.lastGlucose = 0;
    this.lastCholesterol = 0;
    this.lastTriglycerides = 0;
  }
  
  /**
   * Optimizar datos de frecuencia cardíaca
   */
  private optimizeHeartRate(data: ProcessedHeartbeatData): void {
    if (!this.isActive || !this.channels.heartRate) return;
    
    try {
      // Solo procesar si tenemos un BPM válido
      if (data.bpm >= 40 && data.bpm <= 200) {
        // 1. Aplicar filtro Kalman para suavizado
        let optimizedValue = this.heartRateFilter.filter(data.bpm);
        
        // 2. Aplicar filtro de pasa banda para eliminar componentes no fisiológicas
        const { filteredValue, updatedBuffer } = applyBandpassFilter(
          optimizedValue, 
          this.heartRateBandpassBuffer,
          0.1, // Frecuencia de corte baja (variaciones muy lentas)
          3.0, // Frecuencia de corte alta (variaciones muy rápidas)
          10   // Tasa de muestreo estimada (Hz)
        );
        
        this.heartRateBandpassBuffer = updatedBuffer;
        optimizedValue = filteredValue;
        
        // 3. Redondear al entero más cercano
        optimizedValue = Math.round(optimizedValue);
        
        // 4. Calcular confianza basada en la entrada y la estabilidad
        const confidence = data.confidence * 0.8 + 
                        (this.lastHeartRate > 0 ? 
                        Math.max(0, 100 - Math.abs(optimizedValue - this.lastHeartRate) * 2) : 
                        60) * 0.2;
        
        // Guardar para feedback
        this.lastHeartRate = optimizedValue;
        
        // Crear datos optimizados
        const optimizedData: OptimizedHeartRateData = {
          timestamp: data.timestamp,
          value: data.bpm,
          optimizedValue,
          confidence
        };
        
        // Publicar datos optimizados
        eventBus.publish(EventType.OPTIMIZED_HEART_RATE, optimizedData);
        
        // Si el canal de arritmias está activo, procesar datos de intervalos
        if (this.channels.arrhythmia && data.intervals.length > 0) {
          this.analyzeArrhythmia(data.intervals, data.timestamp);
        }
      }
    } catch (error) {
      console.error('Error optimizando frecuencia cardíaca:', error);
    }
  }
  
  /**
   * Analizar arritmias a partir de intervalos RR
   */
  private analyzeArrhythmia(intervals: number[], timestamp: number): void {
    // Actualizar buffer de intervalos RR
    this.rrIntervals = [...this.rrIntervals, ...intervals].slice(-20);
    
    if (this.rrIntervals.length < 5) return;
    
    try {
      // 1. Calcular RMSSD (Root Mean Square of Successive Differences)
      let rmssd = 0;
      let successiveDiffs = 0;
      
      for (let i = 1; i < this.rrIntervals.length; i++) {
        successiveDiffs += Math.pow(this.rrIntervals[i] - this.rrIntervals[i-1], 2);
      }
      
      rmssd = Math.sqrt(successiveDiffs / (this.rrIntervals.length - 1));
      
      // 2. Calcular variación porcentual de intervalos RR
      const avgInterval = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
      const rrVariation = this.rrIntervals.reduce((acc, interval) => 
        acc + Math.abs(interval - avgInterval) / avgInterval, 0
      ) / this.rrIntervals.length * 100;
      
      // 3. Detección de arritmia basada en umbrales
      // RMSSD > 30ms y variación RR > 15% son indicadores potenciales de arritmia
      const isArrhythmia = rmssd > 30 && rrVariation > 15;
      
      // 4. Si se detecta arritmia, crear una ventana
      if (isArrhythmia) {
        // Añadir ventana de arritmia (5 segundos)
        const newWindow = {
          start: timestamp - 2500, // 2.5 segundos antes
          end: timestamp + 2500    // 2.5 segundos después
        };
        
        // Eliminar ventanas antiguas (más de 30 segundos)
        const currentTime = timestamp;
        this.arrhythmiaWindows = this.arrhythmiaWindows
          .filter(window => currentTime - window.end < 30000)
          .concat([newWindow]);
      }
      
      // 5. Crear datos optimizados de arritmia
      const optimizedData: OptimizedArrhythmiaData = {
        timestamp,
        detected: isArrhythmia,
        confidence: Math.min(100, Math.max(0, 50 + (rrVariation - 10) * 5)),
        windows: this.arrhythmiaWindows,
        rmssd,
        rrVariation
      };
      
      // Publicar datos optimizados
      eventBus.publish(EventType.OPTIMIZED_ARRHYTHMIA, optimizedData);
      
    } catch (error) {
      console.error('Error analizando arritmia:', error);
    }
  }
  
  /**
   * Optimizar datos de SpO2
   */
  private optimizeSpO2(data: ProcessedPPGData): void {
    if (!this.isActive || !this.channels.spo2) return;
    
    try {
      // Estimar SpO2 basado en perfusión y calidad
      // NOTA: Esto es una simulación ya que la estimación real requeriría más sensores
      if (data.quality > 30 && data.perfusionIndex > 0.03) {
        // Baseline SpO2 con ligeras variaciones
        const baseSpO2 = 98 - (data.perfusionIndex * 10);
        
        // 1. Aplicar filtro Kalman para suavizado
        const optimizedValue = this.spo2Filter.filter(baseSpO2);
        
        // 2. Limitar a rango fisiológico
        const clampedValue = Math.max(90, Math.min(100, optimizedValue));
        
        // 3. Calcular confianza basada en la calidad de señal y estabilidad
        const confidence = Math.min(100, data.quality * 0.7 + 
                                 (this.lastSpO2 > 0 ? 
                                 Math.max(0, 100 - Math.abs(clampedValue - this.lastSpO2) * 10) : 
                                 70) * 0.3);
        
        // Guardar para feedback
        this.lastSpO2 = clampedValue;
        
        // Crear datos optimizados
        const optimizedData: OptimizedSpO2Data = {
          timestamp: data.timestamp,
          value: baseSpO2,
          optimizedValue: Math.round(clampedValue),
          confidence
        };
        
        // Publicar datos optimizados
        eventBus.publish(EventType.OPTIMIZED_SPO2, optimizedData);
        
        // Si presión arterial está activada, estimar presión basada en PPG
        if (this.channels.bloodPressure) {
          this.estimateBloodPressure(data);
        }
        
        // Si glucosa está activada, estimar glucosa basada en PPG
        if (this.channels.glucose) {
          this.estimateGlucose(data);
        }
        
        // Si lípidos están activados, estimar lípidos basada en PPG
        if (this.channels.lipids) {
          this.estimateLipids(data);
        }
      }
    } catch (error) {
      console.error('Error optimizando SpO2:', error);
    }
  }
  
  /**
   * Estimar presión arterial basada en datos PPG
   */
  private estimateBloodPressure(data: ProcessedPPGData): void {
    // NOTA: Esta es una estimación preliminar para el flujo de datos
    
    // Baselines con factor de perfusión
    const baseSystolic = 120 + (data.perfusionIndex * 50) - 10;
    const baseDiastolic = 80 + (data.perfusionIndex * 30) - 10;
    
    // Aplicar filtros Kalman para suavizado
    const optimizedSystolic = this.systolicFilter.filter(baseSystolic);
    const optimizedDiastolic = this.diastolicFilter.filter(baseDiastolic);
    
    // Limitar a rangos fisiológicos
    const clampedSystolic = Math.max(90, Math.min(160, optimizedSystolic));
    const clampedDiastolic = Math.max(50, Math.min(100, optimizedDiastolic));
    
    // Asegurar que sistólica > diastólica
    const finalSystolic = Math.max(clampedSystolic, clampedDiastolic + 20);
    const finalDiastolic = Math.min(clampedDiastolic, finalSystolic - 20);
    
    // Calcular confianza basada en calidad
    const confidence = Math.min(90, data.quality * 0.6);
    
    // Guardar para feedback
    this.lastSystolic = finalSystolic;
    this.lastDiastolic = finalDiastolic;
    
    // Crear datos optimizados
    const optimizedData: OptimizedBloodPressureData = {
      timestamp: data.timestamp,
      systolic: baseSystolic,
      diastolic: baseDiastolic,
      optimizedSystolic: Math.round(finalSystolic),
      optimizedDiastolic: Math.round(finalDiastolic),
      confidence
    };
    
    // Publicar datos optimizados
    eventBus.publish(EventType.OPTIMIZED_BLOOD_PRESSURE, optimizedData);
  }
  
  /**
   * Estimar glucosa basada en datos PPG
   */
  private estimateGlucose(data: ProcessedPPGData): void {
    // NOTA: Esta es una estimación preliminar para el flujo de datos
    
    // Baseline con factores de perfusión y calidad
    const baseGlucose = 90 + (data.perfusionIndex * 40) + (data.quality * 0.1);
    
    // Aplicar filtro Kalman para suavizado
    const optimizedValue = this.glucoseFilter.filter(baseGlucose);
    
    // Limitar a rango fisiológico
    const clampedValue = Math.max(70, Math.min(140, optimizedValue));
    
    // Calcular confianza
    const confidence = Math.min(80, data.quality * 0.5);
    
    // Guardar para feedback
    this.lastGlucose = clampedValue;
    
    // Crear datos optimizados
    const optimizedData: OptimizedGlucoseData = {
      timestamp: data.timestamp,
      value: baseGlucose,
      optimizedValue: Math.round(clampedValue),
      confidence
    };
    
    // Publicar datos optimizados
    eventBus.publish(EventType.OPTIMIZED_GLUCOSE, optimizedData);
  }
  
  /**
   * Estimar lípidos basada en datos PPG
   */
  private estimateLipids(data: ProcessedPPGData): void {
    // NOTA: Esta es una estimación preliminar para el flujo de datos
    
    // Baselines con factores de perfusión y calidad
    const baseCholesterol = 170 + (data.perfusionIndex * 50) + (data.quality * 0.2);
    const baseTriglycerides = 120 + (data.perfusionIndex * 40) + (data.quality * 0.1);
    
    // Aplicar filtros Kalman para suavizado
    const optimizedCholesterol = this.cholesterolFilter.filter(baseCholesterol);
    const optimizedTriglycerides = this.triglyceridesFilter.filter(baseTriglycerides);
    
    // Limitar a rangos fisiológicos
    const clampedCholesterol = Math.max(140, Math.min(240, optimizedCholesterol));
    const clampedTriglycerides = Math.max(80, Math.min(200, optimizedTriglycerides));
    
    // Calcular confianza
    const confidence = Math.min(70, data.quality * 0.4);
    
    // Guardar para feedback
    this.lastCholesterol = clampedCholesterol;
    this.lastTriglycerides = clampedTriglycerides;
    
    // Crear datos optimizados
    const optimizedData: OptimizedLipidData = {
      timestamp: data.timestamp,
      cholesterol: baseCholesterol,
      triglycerides: baseTriglycerides,
      optimizedCholesterol: Math.round(clampedCholesterol),
      optimizedTriglycerides: Math.round(clampedTriglycerides),
      confidence
    };
    
    // Publicar datos optimizados
    eventBus.publish(EventType.OPTIMIZED_LIPIDS, optimizedData);
  }
  
  /**
   * Manejar feedback de cálculos finales para ajustes bidireccionales
   */
  private handleVitalSignsFeedback(vitalSigns: any): void {
    if (!this.isActive) return;
    
    // Ajustar dinámica de filtros basado en feedback recibido
    // Esto permite que el optimizador se adapte a los resultados calculados
    
    try {
      // Ajustar dinámica del filtro Kalman si recibimos feedback
      if (vitalSigns.heartRate) {
        const heartRateDiff = Math.abs(vitalSigns.heartRate - this.lastHeartRate);
        
        // Si hay gran diferencia, ajustar filtro para ser más responsivo
        if (heartRateDiff > 5) {
          this.heartRateFilter.updateParameters({ Q: 0.3 }); // Más responsivo
        } else {
          this.heartRateFilter.updateParameters({ Q: 0.2 }); // Normal
        }
      }
      
      if (vitalSigns.spo2) {
        const spo2Diff = Math.abs(vitalSigns.spo2 - this.lastSpO2);
        
        // Ajustar filtro SpO2
        if (spo2Diff > 2) {
          this.spo2Filter.updateParameters({ Q: 0.2 }); // Más responsivo
        } else {
          this.spo2Filter.updateParameters({ Q: 0.1 }); // Normal
        }
      }
      
      // Similar para otros signos vitales...
      
    } catch (error) {
      console.error('Error procesando feedback de signos vitales:', error);
    }
  }
  
  /**
   * Obtener estado actual del optimizador
   */
  getOptimizerStatus(): {
    isActive: boolean;
    activeChannels: typeof this.channels;
    currentValues: {
      heartRate: number;
      spo2: number;
      bloodPressure: { systolic: number; diastolic: number; };
      glucose: number;
      lipids: { cholesterol: number; triglycerides: number; };
    };
  } {
    return {
      isActive: this.isActive,
      activeChannels: { ...this.channels },
      currentValues: {
        heartRate: this.lastHeartRate,
        spo2: this.lastSpO2,
        bloodPressure: {
          systolic: this.lastSystolic,
          diastolic: this.lastDiastolic
        },
        glucose: this.lastGlucose,
        lipids: {
          cholesterol: this.lastCholesterol,
          triglycerides: this.lastTriglycerides
        }
      }
    };
  }
}

// Exportar instancia singleton
export const signalOptimizer = new SignalOptimizer();
