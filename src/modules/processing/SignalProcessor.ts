
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
 * Procesa y filtra las señales extraídas para obtener mediciones precisas
 */

import { EventType, eventBus } from '../events/EventBus';
import { HeartBeatData, PPGSignalData, ChannelData } from '../types/signal';

// Tipo para datos de latido procesados
export interface ProcessedHeartbeatData {
  timestamp: number;
  bpm: number;
  quality: number;
  intervals?: number[];
}

// Tipo para datos PPG procesados
export interface ProcessedPPGData {
  timestamp: number;
  filteredValue: number;
  quality: number;
  perfusionIndex: number;
  channelData?: ChannelData;
}

export class SignalProcessor {
  private isRunning: boolean = false;
  private heartbeatBuffer: HeartBeatData[] = [];
  private ppgBuffer: PPGSignalData[] = [];
  private lastProcessedHeartbeat: ProcessedHeartbeatData | null = null;
  private lastProcessedPPG: ProcessedPPGData | null = null;
  
  // Parámetros de filtros
  private readonly HEARTBEAT_WINDOW_SIZE = 10;
  private readonly PPG_WINDOW_SIZE = 15;
  private readonly QUALITY_THRESHOLD = 50;
  
  /**
   * Iniciar procesamiento
   */
  startProcessing(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Suscribirse a eventos de extracción
    eventBus.subscribe(EventType.HEARTBEAT_PEAK_DETECTED, this.handleHeartbeatData.bind(this));
    eventBus.subscribe(EventType.PPG_SIGNAL_EXTRACTED, this.handlePPGData.bind(this));
    
    // Iniciar ciclo de procesamiento
    this.processingLoop();
    
    console.log('Procesador de señal iniciado');
  }
  
  /**
   * Detener procesamiento
   */
  stopProcessing(): void {
    this.isRunning = false;
    this.heartbeatBuffer = [];
    this.ppgBuffer = [];
    this.lastProcessedHeartbeat = null;
    this.lastProcessedPPG = null;
    console.log('Procesador de señal detenido');
  }
  
  /**
   * Resetear procesador
   */
  reset(): void {
    this.heartbeatBuffer = [];
    this.ppgBuffer = [];
    this.lastProcessedHeartbeat = null;
    this.lastProcessedPPG = null;
  }
  
  /**
   * Manejar datos de latidos
   */
  private handleHeartbeatData(data: HeartBeatData): void {
    if (!this.isRunning) return;
    
    // Añadir datos a buffer (con límite)
    this.heartbeatBuffer.push(data);
    if (this.heartbeatBuffer.length > this.HEARTBEAT_WINDOW_SIZE) {
      this.heartbeatBuffer.shift();
    }
  }
  
  /**
   * Manejar datos PPG
   */
  private handlePPGData(data: PPGSignalData): void {
    if (!this.isRunning) return;
    
    // Añadir datos a buffer (con límite)
    this.ppgBuffer.push(data);
    if (this.ppgBuffer.length > this.PPG_WINDOW_SIZE) {
      this.ppgBuffer.shift();
    }
  }
  
  /**
   * Bucle principal de procesamiento (ejecutado periódicamente)
   */
  private processingLoop(): void {
    if (!this.isRunning) return;
    
    // Procesar latidos si hay suficientes datos
    if (this.heartbeatBuffer.length >= 3) {
      this.processHeartbeatData();
    }
    
    // Procesar PPG si hay suficientes datos
    if (this.ppgBuffer.length >= 5) {
      this.processPPGData();
    }
    
    // Programar próxima iteración
    setTimeout(() => this.processingLoop(), 500); // Procesar cada 500ms
  }
  
  /**
   * Procesar datos de latidos
   */
  private processHeartbeatData(): void {
    // Obtener solo datos por encima del umbral de calidad
    const qualityData = this.heartbeatBuffer.filter(data => data.quality >= this.QUALITY_THRESHOLD);
    
    if (qualityData.length < 2) return;
    
    // Calcular BPM promedio ponderado por calidad
    let totalQuality = 0;
    let weightedBpm = 0;
    
    for (const data of qualityData) {
      const weight = data.quality / 100; // Normalizado a [0,1]
      weightedBpm += data.bpm * weight;
      totalQuality += weight;
    }
    
    const averageBpm = totalQuality > 0
      ? Math.round(weightedBpm / totalQuality)
      : 0;
    
    // Recopilar todos los intervalos RR para análisis 
    const allIntervals: number[] = [];
    qualityData.forEach(data => {
      if (data.intervals && data.intervals.length > 0) {
        allIntervals.push(...data.intervals);
      }
    });
    
    // Crear datos procesados
    const processedData: ProcessedHeartbeatData = {
      timestamp: Date.now(),
      bpm: averageBpm,
      quality: totalQuality > 0 ? (totalQuality / qualityData.length) * 100 : 0,
      intervals: allIntervals.slice(-20) // Guardar los últimos 20 intervalos
    };
    
    this.lastProcessedHeartbeat = processedData;
    
    // Publicar datos procesados
    eventBus.publish(EventType.PROCESSED_HEARTBEAT, processedData);
  }
  
  /**
   * Procesar datos PPG
   */
  private processPPGData(): void {
    // Filtrar datos de baja calidad
    const qualityData = this.ppgBuffer.filter(data => data.quality >= this.QUALITY_THRESHOLD);
    
    if (qualityData.length < 3) return;
    
    // Extraer valores
    const values = qualityData.map(data => data.filteredValue);
    
    // Aplicar filtro de suavizado simple (promedio móvil)
    const smoothedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calcular índice de perfusión de los últimos datos
    const recentPPG = this.ppgBuffer.slice(-5);
    const perfusionIndex = this.calculatePerfusionIndex(recentPPG);
    
    // Extraer datos de los canales rojo e IR
    const channelData: ChannelData = {
      red: 0,
      ir: 0
    };
    
    // Promediar los valores de canales disponibles
    let redTotal = 0;
    let irTotal = 0;
    let channelCount = 0;
    
    for (const data of qualityData) {
      if (data.channelData) {
        redTotal += data.channelData.red;
        irTotal += data.channelData.ir;
        channelCount++;
      }
    }
    
    if (channelCount > 0) {
      channelData.red = redTotal / channelCount;
      channelData.ir = irTotal / channelCount;
      channelData.ratio = channelData.red / (channelData.ir > 0 ? channelData.ir : 1);
    }
    
    // Crear datos procesados
    const processedData: ProcessedPPGData = {
      timestamp: Date.now(),
      filteredValue: smoothedValue,
      quality: qualityData.reduce((sum, data) => sum + data.quality, 0) / qualityData.length,
      perfusionIndex,
      channelData
    };
    
    this.lastProcessedPPG = processedData;
    
    // Publicar datos procesados
    eventBus.publish(EventType.PROCESSED_PPG, processedData);
  }
  
  /**
   * Calcular índice de perfusión (PI)
   */
  private calculatePerfusionIndex(ppgData: PPGSignalData[]): number {
    if (ppgData.length === 0) return 0;
    
    // Extraer valores de señal
    let acSum = 0; // Componente AC (variación)
    let dcSum = 0; // Componente DC (promedio)
    
    for (const data of ppgData) {
      // Para el componente AC necesitamos la variación pico a pico
      const values = data.rawValues;
      if (values && values.length > 1) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        acSum += (max - min);
      }
      
      // Para DC usamos el valor promedio
      dcSum += data.combinedValue;
    }
    
    const ac = acSum / ppgData.length;
    const dc = dcSum / ppgData.length;
    
    // PI = (AC/DC) * 100%
    return dc > 0 ? (ac / dc) : 0;
  }
  
  /**
   * Obtener últimos datos procesados
   */
  getProcessedData(): {
    heartbeat: ProcessedHeartbeatData | null;
    ppg: ProcessedPPGData | null;
  } {
    return {
      heartbeat: this.lastProcessedHeartbeat,
      ppg: this.lastProcessedPPG
    };
  }
}

// Exportar instancia singleton
export const signalProcessor = new SignalProcessor();

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
