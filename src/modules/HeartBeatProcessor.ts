
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatResult } from "../core/types";
import FeedbackService from "../services/FeedbackService";

/**
 * Procesador de latidos cardíacos optimizado
 * Implementa detección de picos y análisis de patrones
 * Solo utiliza datos reales, sin simulación
 */
export class HeartBeatProcessor {
  // Buffer de procesamiento
  private ppgBuffer: number[] = [];
  private readonly BUFFER_SIZE = 150;
  
  // Detección de picos
  private peakTimes: number[] = [];
  private readonly MAX_PEAKS = 20;
  private lastPeakTime: number | null = null;
  
  // Análisis de BPM
  private bpmHistory: number[] = [];
  private readonly BPM_HISTORY_SIZE = 5;
  
  // Análisis de arritmias
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 10;
  private arrhythmiaCounter: number = 0;
  private lastArrhythmiaTime: number = 0;
  
  // Retroalimentación y calidad
  private audioContext: AudioContext | null = null;
  private lastGoodReading: number = 0;
  
  constructor(audioContext: AudioContext | null = null) {
    this.audioContext = audioContext;
  }
  
  /**
   * Procesa un nuevo valor PPG
   * @param value Valor PPG filtrado
   * @param timestamp Marca de tiempo del valor
   * @returns Resultado del procesamiento o null si no hay suficientes datos
   */
  public processValue(value: number, timestamp: number = Date.now()): HeartBeatResult | null {
    // Añadir valor al buffer
    this.ppgBuffer.push(value);
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Si no hay suficientes valores, no hay resultado
    if (this.ppgBuffer.length < 30) {
      return null;
    }
    
    // Detectar picos con umbral adaptativo
    this.detectPeak(value, timestamp);
    
    // Calcular BPM basado en intervalos R-R
    const bpm = this.calculateBPM();
    
    // Detectar arritmias
    const { isArrhythmia, confidence } = this.detectArrhythmia();
    
    // Si detectamos arritmia y ha pasado suficiente tiempo desde la última vez
    if (isArrhythmia && timestamp - this.lastArrhythmiaTime > 2000) {
      this.arrhythmiaCounter++;
      this.lastArrhythmiaTime = timestamp;
      
      // Activar retroalimentación de arritmia usando el servicio centralizado
      FeedbackService.triggerHeartbeat(this.audioContext, 'arrhythmia');
    } else if (bpm > 0 && confidence > 0.5 && timestamp - this.lastGoodReading > 60000 / bpm) {
      // Activar retroalimentación normal para latidos regulares
      FeedbackService.triggerHeartbeat(this.audioContext, 'normal');
      this.lastGoodReading = timestamp;
    }
    
    // Crear resultado
    return {
      bpm: bpm > 0 ? bpm : 0,
      confidence,
      isArrhythmia,
      arrhythmiaCount: this.arrhythmiaCounter,
      time: timestamp
    };
  }
  
  /**
   * Detecta picos en la señal PPG
   * Utiliza umbral adaptativo y validación temporal
   */
  private detectPeak(value: number, timestamp: number): boolean {
    // Necesitamos al menos 3 valores para detectar picos
    if (this.ppgBuffer.length < 3) {
      return false;
    }
    
    // Obtener valores recientes
    const recentValues = this.ppgBuffer.slice(-3);
    
    // Un pico debe ser mayor que sus vecinos
    const isPeak = value > recentValues[recentValues.length - 2] && 
                  recentValues[recentValues.length - 2] > recentValues[recentValues.length - 3];
    
    // Validar que ha pasado suficiente tiempo desde el último pico (evitar dobles detecciones)
    const MIN_PEAK_DISTANCE = 250; // 250ms = 240bpm máx, fisiológicamente razonable
    const timeSinceLastPeak = this.lastPeakTime ? timestamp - this.lastPeakTime : Infinity;
    
    if (isPeak && timeSinceLastPeak > MIN_PEAK_DISTANCE) {
      // Registrar tiempo de pico
      this.peakTimes.push(timestamp);
      if (this.peakTimes.length > this.MAX_PEAKS) {
        this.peakTimes.shift();
      }
      
      // Actualizar intervalo R-R
      if (this.lastPeakTime) {
        const rrInterval = timestamp - this.lastPeakTime;
        
        // Solo aceptar intervalos fisiológicamente posibles
        if (rrInterval >= 250 && rrInterval <= 1500) {
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
            this.rrIntervals.shift();
          }
        }
      }
      
      this.lastPeakTime = timestamp;
      return true;
    }
    
    return false;
  }
  
  /**
   * Calcula BPM basado en intervalos R-R
   * Utiliza técnicas de filtrado para valores estables
   */
  private calculateBPM(): number {
    // Necesitamos al menos 2 intervalos para calcular BPM
    if (this.rrIntervals.length < 2) {
      return 0;
    }
    
    // Calcular mediana de intervalos para evitar outliers
    const sortedIntervals = [...this.rrIntervals].sort((a, b) => a - b);
    const medianRR = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    
    // Convertir a BPM
    const instantBPM = 60000 / medianRR;
    
    // Solo aceptar valores fisiológicamente posibles
    if (instantBPM >= 40 && instantBPM <= 220) {
      // Añadir a historial
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > this.BPM_HISTORY_SIZE) {
        this.bpmHistory.shift();
      }
      
      // Calcular promedio para suavizar
      const avgBPM = this.bpmHistory.reduce((sum, bpm) => sum + bpm, 0) / this.bpmHistory.length;
      return Math.round(avgBPM);
    }
    
    return 0;
  }
  
  /**
   * Detecta arritmias basado en variabilidad de intervalos R-R
   */
  private detectArrhythmia(): { isArrhythmia: boolean, confidence: number } {
    // Necesitamos al menos 3 intervalos para detectar arritmias
    if (this.rrIntervals.length < 3) {
      return { isArrhythmia: false, confidence: 0 };
    }
    
    // Calcular variabilidad R-R
    const rrStdDev = this.calculateRRStdDev();
    const rrAvg = this.rrIntervals.reduce((sum, rr) => sum + rr, 0) / this.rrIntervals.length;
    
    // Calcular coeficiente de variación (normaliza por frecuencia cardíaca)
    const rrCV = rrStdDev / rrAvg;
    
    // Determinar si hay arritmia basado en umbral adaptativo
    // Umbral típico para arritmia significativa es CV > 0.1 (10%)
    const isArrhythmia = rrCV > 0.12; // Ligeramente más alto para evitar falsos positivos
    
    // Calcular confianza basado en número de intervalos y magnitud de variación
    const confidence = Math.min(
      0.95,
      0.5 + Math.min(0.45, this.rrIntervals.length * 0.05) * (isArrhythmia ? rrCV / 0.12 : 1)
    );
    
    return { isArrhythmia, confidence };
  }
  
  /**
   * Calcula desviación estándar de intervalos R-R
   */
  private calculateRRStdDev(): number {
    const mean = this.rrIntervals.reduce((sum, rr) => sum + rr, 0) / this.rrIntervals.length;
    const variance = this.rrIntervals.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0) / this.rrIntervals.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Obtiene los intervalos RR y último tiempo de pico
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }
  
  /**
   * Obtiene tiempos de picos detectados
   */
  public getPeakTimes(): number[] {
    return [...this.peakTimes];
  }
  
  /**
   * Obtiene contador de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Configura el contexto de audio para retroalimentación
   */
  public setAudioContext(context: AudioContext | null): void {
    this.audioContext = context;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.peakTimes = [];
    this.lastPeakTime = null;
    this.bpmHistory = [];
    this.rrIntervals = [];
    this.lastGoodReading = 0;
  }
  
  /**
   * Reinicio completo incluyendo contador de arritmias
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCounter = 0;
    this.lastArrhythmiaTime = 0;
  }
}
