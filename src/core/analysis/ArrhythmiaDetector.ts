
import { RRData } from '../signal/PeakDetector';

export interface ArrhythmiaResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  count: number;
}

export class ArrhythmiaDetector {
  // Parámetros unificados basados en literatura médica
  private readonly RMSSD_THRESHOLD = 35; // Umbral intermedio entre ambas implementaciones
  private readonly RR_VARIATION_THRESHOLD = 0.17; // Valor medio ajustado
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 3000; // ms
  private readonly MAX_ARRHYTHMIAS_PER_SESSION = 10;
  private readonly REQUIRED_RR_INTERVALS = 5;
  private readonly LEARNING_PERIOD = 4000; // ms, valor intermedio

  // Estado
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private isLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;

  constructor() {
    this.reset();
  }

  public processRRData(rrData?: RRData): ArrhythmiaResult {
    const currentTime = Date.now();
    
    // Verificar si estamos en fase de aprendizaje
    if (this.isLearningPhase && 
        currentTime - this.measurementStartTime > this.LEARNING_PERIOD) {
      this.isLearningPhase = false;
    }
    
    // Validar datos de entrada
    if (!rrData || !rrData.intervals || rrData.intervals.length < this.REQUIRED_RR_INTERVALS) {
      return {
        arrhythmiaStatus: "normal",
        lastArrhythmiaData: this.lastArrhythmiaData,
        count: this.arrhythmiaCounter
      };
    }
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    const rmssd = this.calculateRMSSD(rrData.intervals);
    
    // Calcular variación RR normalizada
    const avgRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
    const rrVariation = this.calculateRRVariation(rrData.intervals, avgRR);
    
    // Actualizar métricas
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    // Determinar si hay arritmia
    let hasArrhythmia = false;
    if (!this.isLearningPhase && 
        rmssd > this.RMSSD_THRESHOLD && 
        rrVariation > this.RR_VARIATION_THRESHOLD) {
      
      // Verificar tiempo desde última arritmia para evitar detecciones duplicadas
      const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
      
      if (timeSinceLastArrhythmia > this.MIN_TIME_BETWEEN_ARRHYTHMIAS && 
          this.arrhythmiaCounter < this.MAX_ARRHYTHMIAS_PER_SESSION) {
        
        hasArrhythmia = true;
        this.lastArrhythmiaTime = currentTime;
        this.arrhythmiaCounter++;
        
        this.lastArrhythmiaData = {
          timestamp: currentTime,
          rmssd,
          rrVariation
        };
      }
    }
    
    return {
      arrhythmiaStatus: hasArrhythmia ? "irregular" : "normal",
      lastArrhythmiaData: this.lastArrhythmiaData,
      count: this.arrhythmiaCounter
    };
  }
  
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i - 1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  }
  
  private calculateRRVariation(intervals: number[], avgRR: number): number {
    if (intervals.length < 2 || avgRR === 0) return 0;
    
    const variations = intervals.map(interval => Math.abs(interval - avgRR) / avgRR);
    return variations.reduce((sum, val) => sum + val, 0) / variations.length;
  }
  
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
  
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaCounter = 0;
    this.isLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaData = null;
  }
}
