
import { RRData } from '../signal/PeakDetector';

export interface ArrhythmiaResult {
  arrhythmiaStatus: 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia';
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: string;
  } | null;
  count: number;
  debugLog?: string[];
}

interface UserProfile {
  age: number;
  condition?: 'athlete' | 'hypertension' | 'diabetes';
}

export class ArrhythmiaDetector {
  private RMSSD_THRESHOLD = 35;
  private RR_VARIATION_THRESHOLD = 0.15; // Reducido para detectar más fácilmente
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 2000; // Reducido para detectar más frecuentemente
  private readonly MAX_ARRHYTHMIAS_PER_SESSION = 10;
  private readonly REQUIRED_RR_INTERVALS = 4; // Reducido para detectar con menos datos
  private readonly LEARNING_PERIOD = 3000; // Reducido para empezar a detectar antes

  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private isLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaData: ArrhythmiaResult['lastArrhythmiaData'] = null;
  private debugLog: string[] = [];

  constructor(private userProfile: UserProfile = { age: 30 }) {
    this.adjustThresholds();
    this.reset();
  }

  private adjustThresholds() {
    const { age, condition } = this.userProfile;

    if (age > 60) {
      this.RMSSD_THRESHOLD *= 0.85;
      this.RR_VARIATION_THRESHOLD *= 0.9;
    }
    if (condition === 'athlete') {
      this.RMSSD_THRESHOLD *= 1.1;
    }
    if (condition === 'hypertension') {
      this.RR_VARIATION_THRESHOLD *= 0.95;
    }
  }

  public processRRData(rrData?: RRData): ArrhythmiaResult {
    const currentTime = Date.now();
    
    // Log para depuración
    console.log("ArrhythmiaDetector: procesando datos RR", {
      tieneRRData: !!rrData, 
      intervalos: rrData?.intervals?.length || 0,
      aprendizaje: this.isLearningPhase,
      umbralRMSSD: this.RMSSD_THRESHOLD,
      umbralRRVariation: this.RR_VARIATION_THRESHOLD
    });
    
    if (this.isLearningPhase && currentTime - this.measurementStartTime > this.LEARNING_PERIOD) {
      this.isLearningPhase = false;
      console.log("ArrhythmiaDetector: Fase de aprendizaje completada");
    }

    if (!rrData || !rrData.intervals || rrData.intervals.length < this.REQUIRED_RR_INTERVALS) {
      return this.buildResult('normal');
    }

    const rmssd = this.calculateRMSSD(rrData.intervals);
    const avgRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
    const rrVariation = this.calculateRRVariation(rrData.intervals, avgRR);

    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    console.log("ArrhythmiaDetector: Métricas calculadas", {
      rmssd, 
      avgRR, 
      rrVariation, 
      umbralRMSSD: this.RMSSD_THRESHOLD,
      umbralRRVariation: this.RR_VARIATION_THRESHOLD
    });

    let hasArrhythmia = false;
    let category: ArrhythmiaResult['arrhythmiaStatus'] = 'normal';

    if (!this.isLearningPhase &&
        rmssd > this.RMSSD_THRESHOLD &&
        rrVariation > this.RR_VARIATION_THRESHOLD) {

      const timeSinceLast = currentTime - this.lastArrhythmiaTime;
      if (timeSinceLast > this.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
          this.arrhythmiaCounter < this.MAX_ARRHYTHMIAS_PER_SESSION) {

        hasArrhythmia = true;
        category = this.categorizeArrhythmia(rrData.intervals, avgRR);
        this.lastArrhythmiaTime = currentTime;
        this.arrhythmiaCounter++;

        this.lastArrhythmiaData = {
          timestamp: currentTime,
          rmssd,
          rrVariation,
          category
        };
        this.debugLog.push(`Arrhythmia detected at ${currentTime} - ${category}`);
        
        console.log("ArrhythmiaDetector: ¡ARRITMIA DETECTADA!", {
          tipo: category,
          tiempo: new Date(currentTime).toISOString(),
          contadorArritmias: this.arrhythmiaCounter
        });
      }
    }

    return this.buildResult(category);
  }

  private categorizeArrhythmia(intervals: number[], avgRR: number): ArrhythmiaResult['arrhythmiaStatus'] {
    const lastInterval = intervals[intervals.length - 1];
    
    // Clasificar basado en el último intervalo
    if (lastInterval < 500) return 'tachycardia';
    if (lastInterval > 1200) return 'bradycardia';

    // Verificar variación significativa (posible arritmia)
    if (intervals.length >= 2) {
      const variation = Math.abs(intervals[intervals.length - 1] - intervals[intervals.length - 2]);
      if (variation > avgRR * 0.2) return 'bigeminy';
    }

    return 'possible-arrhythmia';
  }

  private buildResult(category: ArrhythmiaResult['arrhythmiaStatus']): ArrhythmiaResult {
    return {
      arrhythmiaStatus: category,
      lastArrhythmiaData: this.lastArrhythmiaData,
      count: this.arrhythmiaCounter,
      debugLog: [...this.debugLog]
    };
  }

  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    // Calcular diferencias entre intervalos consecutivos
    const diffs = [];
    for (let i = 1; i < intervals.length; i++) {
      diffs.push(intervals[i] - intervals[i-1]);
    }
    
    // Calcular cuadrados de diferencias
    const squared = diffs.map(d => d * d);
    
    // Calcular media y raíz cuadrada
    const mean = squared.reduce((sum, val) => sum + val, 0) / squared.length;
    return Math.sqrt(mean);
  }

  private calculateRRVariation(intervals: number[], avg: number): number {
    const deviations = intervals.map(i => Math.abs(i - avg));
    const meanDev = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
    return meanDev / avg;
  }

  public getArrhythmiaCounter(): number {
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
    this.debugLog = [];
    
    console.log("ArrhythmiaDetector: Reset completo");
  }

  public getDebugLog(): string[] {
    return [...this.debugLog];
  }
}
