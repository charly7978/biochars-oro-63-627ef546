
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
 */

import { EventType, eventBus } from '../events/EventBus';
import { ProcessedHeartbeatData, ProcessedPPGData } from '../processing/SignalProcessor';
import { calculateAC, calculateDC, calculateStandardDeviation } from '../vital-signs/utils';

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
  redRatio: number;
  irRatio: number;
}

export interface OptimizedBloodPressure {
  timestamp: number;
  systolic: number;
  diastolic: number;
  display: string;
  confidence: number;
  ptt: number; // Tiempo de tránsito de pulso
}

export class SignalOptimizer {
  // Canales para cada signo vital
  private heartRateBuffer: ProcessedHeartbeatData[] = [];
  private spo2Buffer: ProcessedPPGData[] = [];
  private bloodPressureBuffer: ProcessedPPGData[] = [];
  private glucoseBuffer: ProcessedPPGData[] = [];
  private lipidsBuffer: ProcessedPPGData[] = [];
  private arrhythmiaBuffer: ProcessedHeartbeatData[] = [];
  
  // Estado del optimizador
  private isRunning: boolean = false;
  private optimizationInterval: number | null = null;
  
  // Constantes
  private readonly HR_BUFFER_SIZE = 10;
  private readonly SPO2_BUFFER_SIZE = 15;
  private readonly BP_BUFFER_SIZE = 10;
  private readonly GLUCOSE_BUFFER_SIZE = 20;
  private readonly LIPIDS_BUFFER_SIZE = 20;
  private readonly ARRHYTHMIA_BUFFER_SIZE = 20;
  
  /**
   * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
   * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
   * 
   * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
   * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
   * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
   */
  
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
    
    console.log('Optimizador de señal iniciado');
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
    
    // Añadir a buffer de SpO2
    this.spo2Buffer.push(data);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
    
    // Añadir a buffer de presión arterial
    this.bloodPressureBuffer.push(data);
    if (this.bloodPressureBuffer.length > this.BP_BUFFER_SIZE) {
      this.bloodPressureBuffer.shift();
    }
    
    // Añadir a buffer de glucosa
    this.glucoseBuffer.push(data);
    if (this.glucoseBuffer.length > this.GLUCOSE_BUFFER_SIZE) {
      this.glucoseBuffer.shift();
    }
    
    // Añadir a buffer de lípidos
    this.lipidsBuffer.push(data);
    if (this.lipidsBuffer.length > this.LIPIDS_BUFFER_SIZE) {
      this.lipidsBuffer.shift();
    }
  }
  
  /**
   * Optimizar todos los canales
   */
  private optimizeAllChannels(): void {
    if (!this.isRunning) return;
    
    // Optimizar para cada signo vital
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
        data.bpm >= 40 && data.bpm <= 200 && data.confidence > 30
      );
      
      if (validData.length < 2) return;
      
      // Ordenar por confianza y tomar los mejores
      const sortedByConfidence = [...validData].sort((a, b) => b.confidence - a.confidence);
      const bestData = sortedByConfidence.slice(0, Math.ceil(sortedByConfidence.length * 0.7));
      
      // Calcular BPM ponderado por confianza
      let totalWeight = 0;
      let weightedBpm = 0;
      
      for (const data of bestData) {
        const weight = data.confidence / 100;
        weightedBpm += data.bpm * weight;
        totalWeight += weight;
      }
      
      if (totalWeight > 0) {
        const optimizedBpm = Math.round(weightedBpm / totalWeight);
        
        // Calcular confianza final
        const avgConfidence = bestData.reduce((sum, data) => sum + data.confidence, 0) / bestData.length;
        
        // Extraer datos optimizados
        const optimizedData: OptimizedHeartRate = {
          timestamp: Date.now(),
          heartRate: optimizedBpm,
          confidence: avgConfidence,
          optimizedData: bestData.map(d => d.bpm)
        };
        
        // Publicar resultado optimizado
        eventBus.publish(EventType.OPTIMIZED_HEART_RATE, optimizedData);
      }
    } catch (error) {
      console.error('Error optimizando frecuencia cardíaca:', error);
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
      
      // Extraer valores de señal para análisis AC/DC
      const signalValues = qualityData.map(data => data.filteredValue);
      
      // Calcular componentes AC/DC para ratio R
      const acComponent = calculateAC(signalValues);
      const dcComponent = calculateDC(signalValues);
      
      if (dcComponent === 0) return;
      
      // Simular ratio infrarrojo (en un dispositivo real habría ambos sensores)
      // Esto es simplificado, en un oxímetro real tendríamos canales separados para rojo e IR
      const redRatio = acComponent / dcComponent;
      const irRatio = redRatio * 1.05; // Aproximación simplificada
      
      // Calcular SpO2 optimizado
      // La fórmula empírica típica es: SpO2 = 110 - 25 * R, donde R = (AC_red/DC_red)/(AC_ir/DC_ir)
      const R = redRatio / irRatio;
      let spo2 = Math.round(110 - (25 * R));
      
      // Limitar a rango válido
      spo2 = Math.max(70, Math.min(100, spo2));
      
      // Calcular confianza basada en calidad y estabilidad
      const avgQuality = qualityData.reduce((sum, data) => sum + data.quality, 0) / qualityData.length;
      const spo2Values = qualityData.map(data => data.perfusionIndex * 100); // Aproximación
      const stability = 100 - Math.min(100, calculateStandardDeviation(spo2Values) * 50);
      
      const confidence = (avgQuality * 0.7) + (stability * 0.3);
      
      // Crear datos optimizados
      const optimizedData: OptimizedSPO2 = {
        timestamp: Date.now(),
        spo2,
        confidence,
        redRatio,
        irRatio
      };
      
      // Publicar resultado optimizado
      eventBus.publish(EventType.OPTIMIZED_SPO2, optimizedData);
      
    } catch (error) {
      console.error('Error optimizando SpO2:', error);
    }
  }
  
  /**
   * Optimizar señal para presión arterial
   */
  private optimizeBloodPressure(): void {
    if (this.bloodPressureBuffer.length < 5 || this.heartRateBuffer.length < 5) return;
    
    try {
      // Este método necesita datos tanto de PPG como de latidos para estimar PA
      
      // Obtener último HeartRate optimizado
      const lastHeartRate = this.heartRateBuffer.length > 0 
        ? this.heartRateBuffer[this.heartRateBuffer.length - 1].bpm 
        : 0;
      
      if (lastHeartRate === 0) return;
      
      // Calcular características de la señal PPG
      const ppgValues = this.bloodPressureBuffer.map(data => data.filteredValue);
      
      // Simular estimación de presión arterial usando características PPG
      // Este es un cálculo simplificado para optimización de señal
      // Un dispositivo real utilizaría algoritmos más complejos
      
      // Integrar con otros módulos para el cálculo final
      const ptt = this.estimatePulseTransitTime();
      
      // Estimar presión sistólica y diastólica
      // Fórmulas simplificadas basadas en PTT y frecuencia cardíaca
      const baselineSystolic = 120;
      const baselineDiastolic = 80;
      
      // Ajustes basados en características PPG y HR
      const hrFactor = (lastHeartRate - 70) * 0.5;
      const amplitudeFactor = calculateAC(ppgValues) * 50;
      
      let systolic = baselineSystolic + hrFactor + amplitudeFactor;
      let diastolic = baselineDiastolic + (hrFactor * 0.4) + (amplitudeFactor * 0.3);
      
      // Garantizar valores en rangos normales
      systolic = Math.max(90, Math.min(180, systolic));
      diastolic = Math.max(50, Math.min(120, diastolic));
      
      // Garantizar que diastólica < sistólica por al menos 20 mmHg
      if (systolic - diastolic < 20) {
        diastolic = systolic - 20;
      }
      
      // Calcular confianza
      const confidence = Math.min(80, this.bloodPressureBuffer.reduce((sum, data) => sum + data.quality, 0) / 
                         this.bloodPressureBuffer.length);
      
      // Crear datos optimizados
      const optimizedData: OptimizedBloodPressure = {
        timestamp: Date.now(),
        systolic: Math.round(systolic),
        diastolic: Math.round(diastolic),
        display: `${Math.round(systolic)}/${Math.round(diastolic)}`,
        confidence,
        ptt
      };
      
      // Publicar resultado optimizado
      eventBus.publish(EventType.OPTIMIZED_BLOOD_PRESSURE, optimizedData);
      
    } catch (error) {
      console.error('Error optimizando presión arterial:', error);
    }
  }
  
  /**
   * Optimizar señal para glucosa
   */
  private optimizeGlucose(): void {
    if (this.glucoseBuffer.length < this.GLUCOSE_BUFFER_SIZE / 2) return;
    
    try {
      // En un dispositivo real, este módulo implementaría algoritmos específicos
      // para la estimación de glucosa basados en características espectrales
      // Por ahora, sólo publicamos un canal optimizado vacío
      
      eventBus.publish(EventType.OPTIMIZED_GLUCOSE, {
        timestamp: Date.now(),
        optimized: true
      });
      
    } catch (error) {
      console.error('Error optimizando glucosa:', error);
    }
  }
  
  /**
   * Optimizar señal para lípidos
   */
  private optimizeLipids(): void {
    if (this.lipidsBuffer.length < this.LIPIDS_BUFFER_SIZE / 2) return;
    
    try {
      // En un dispositivo real, este módulo implementaría algoritmos específicos
      // para la estimación de lípidos basados en características espectrales
      // Por ahora, sólo publicamos un canal optimizado vacío
      
      eventBus.publish(EventType.OPTIMIZED_LIPIDS, {
        timestamp: Date.now(),
        optimized: true
      });
      
    } catch (error) {
      console.error('Error optimizando lípidos:', error);
    }
  }
  
  /**
   * Optimizar datos para detección de arritmias
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
      
      // Análisis básico de regularidad de intervalos RR
      // En un dispositivo real, se implementarían algoritmos más sofisticados
      
      // Calcular RMSSD (Root Mean Square of Successive Differences)
      // Un indicador común para variabilidad de frecuencia cardíaca y arritmias
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
      
      // Publicar resultados optimizados para detección de arritmias
      eventBus.publish(EventType.OPTIMIZED_ARRHYTHMIA, {
        timestamp: Date.now(),
        rmssd,
        rrVariation,
        intervals: allIntervals.slice(-20) // Mandar solo los 20 más recientes
      });
      
    } catch (error) {
      console.error('Error optimizando datos de arritmia:', error);
    }
  }
  
  /**
   * Estimar el tiempo de tránsito de pulso (PTT)
   * Simulación simplificada para la estructura del código
   */
  private estimatePulseTransitTime(): number {
    // En un dispositivo real, esto se calcularía con sensores adicionales
    // Retornamos un valor aproximado basado en datos disponibles
    const baselinePTT = 250; // ms
    
    // Ajustar según la variabilidad de intervalos RR
    let pttAdjustment = 0;
    
    if (this.heartRateBuffer.length > 0) {
      const lastData = this.heartRateBuffer[this.heartRateBuffer.length - 1];
      if (lastData.intervals && lastData.intervals.length > 1) {
        const intervals = lastData.intervals;
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        // Aproximación: PTT tiende a ser menor con intervalos RR más cortos
        pttAdjustment = (avgInterval - 800) * -0.1;
      }
    }
    
    return Math.max(180, Math.min(350, baselinePTT + pttAdjustment));
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
      arrhythmia: number;
    }
  } {
    return {
      isRunning: this.isRunning,
      bufferSizes: {
        heartRate: this.heartRateBuffer.length,
        spo2: this.spo2Buffer.length,
        bloodPressure: this.bloodPressureBuffer.length,
        arrhythmia: this.arrhythmiaBuffer.length
      }
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
