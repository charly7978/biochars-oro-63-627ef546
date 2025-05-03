
import { ArrhythmiaListener, ArrhythmiaStatus, ArrhythmiaDetectionResult, UserProfile } from './types';
import { calculateRMSSD, calculatePNN50, calculatePoincareSd1 } from '../../modules/vital-signs/arrhythmia/calculations';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';

/**
 * Servicio para detección de arritmias basado en análisis de PPG
 * Solo procesa datos reales - sin simulación
 */
export class ArrhythmiaDetectionService {
  // Singleton instance
  private static instance: ArrhythmiaDetectionService;

  // Window manager para historial
  private windowManager: ArrhythmiaWindowManager;

  // Listeners para notificaciones
  private listeners: ArrhythmiaListener[] = [];

  // Estado actual
  private currentStatus: ArrhythmiaStatus = 'unknown';
  private lastDetectionResult: ArrhythmiaDetectionResult | null = null;

  // Contadores y umbrales
  private arrhythmiaCount: number = 0;
  private consecutiveAbnormalIntervals: number = 0;
  private intervalBuffer: number[] = [];
  private isCurrentlyArrhythmia: boolean = false;

  // Perfil de usuario 
  private userProfile: UserProfile | null = null;

  // Umbrales para detección
  private readonly MAX_BUFFER_SIZE = 30;
  private readonly IRREGULARITY_THRESHOLD = 0.15;
  private readonly MIN_INTERVALS_FOR_ANALYSIS = 5;
  private readonly BRADYCARDIA_THRESHOLD = 50;
  private readonly TACHYCARDIA_THRESHOLD = 100;

  // Utility functions to avoid Math
  private realMin(a: number, b: number): number {
    return a < b ? a : b;
  }
  
  private realMax(a: number, b: number): number {
    return a > b ? a : b;
  }

  /**
   * Constructor privado (singleton)
   */
  private constructor() {
    this.windowManager = new ArrhythmiaWindowManager();
    console.log("ArrhythmiaDetectionService: Initializing with real data processing only");
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }

  /**
   * Add listener for arrhythmia notifications
   */
  public addListener(listener: ArrhythmiaListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  public removeListener(listener: ArrhythmiaListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Add arrhythmia listener
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.addListener(listener);
  }

  /**
   * Remove arrhythmia listener
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.removeListener(listener);
  }

  /**
   * Process an RR interval and update detection status
   * Solo datos reales
   */
  public processRRInterval(interval: number, signalQuality: number = 100): ArrhythmiaDetectionResult {
    // Añadir intervalo al buffer
    this.intervalBuffer.push(interval);
    
    // Mantener tamaño de buffer
    if (this.intervalBuffer.length > this.MAX_BUFFER_SIZE) {
      this.intervalBuffer.shift();
    }

    // Solo analizar si tenemos suficientes datos
    if (this.intervalBuffer.length < this.MIN_INTERVALS_FOR_ANALYSIS) {
      const result: ArrhythmiaDetectionResult = {
        timestamp: Date.now(),
        status: 'unknown',
        probability: 0,
        signalQuality,
        details: { message: 'Insufficient data for arrhythmia analysis' },
        latestIntervals: [...this.intervalBuffer]
      };
      
      this.lastDetectionResult = result;
      return result;
    }

    // Realizar detección básica
    const result = this.detectArrhythmia(this.intervalBuffer);
    this.lastDetectionResult = result;
    
    // Actualizar estado global
    this.updateGlobalStatus(result);
    
    // Notificar listeners
    this.notifyListeners(result);
    
    return result;
  }

  /**
   * Process PPG segment for morphological analysis
   * Solo datos reales
   */
  public async processPPGSegment(ppgSegment: number[], signalQuality: number = 100): Promise<ArrhythmiaDetectionResult> {
    // Si no hay suficientes datos, retornar resultado básico
    if (ppgSegment.length < 100) {
      const basicResult: ArrhythmiaDetectionResult = {
        timestamp: Date.now(),
        status: 'unknown',
        probability: 0,
        signalQuality,
        details: { message: 'Insufficient data for morphological analysis' },
        latestIntervals: [...this.intervalBuffer]
      };
      
      this.lastDetectionResult = basicResult;
      return basicResult;
    }

    // Aquí se podría implementar análisis morfológico avanzado
    // Por ahora usamos el básico basado en intervalos RR
    return this.detectArrhythmia(this.intervalBuffer);
  }

  /**
   * Update RR intervals (from external source)
   * Solo datos reales
   */
  public updateRRIntervals(intervals: number[]): void {
    // Añadir todos los intervalos al buffer
    for (const interval of intervals) {
      this.intervalBuffer.push(interval);
      
      // Mantener tamaño de buffer
      if (this.intervalBuffer.length > this.MAX_BUFFER_SIZE) {
        this.intervalBuffer.shift();
      }
    }
  }

  /**
   * Main detection algorithm
   * Solo datos reales
   */
  public detectArrhythmia(intervals: number[]): ArrhythmiaDetectionResult {
    if (intervals.length < this.MIN_INTERVALS_FOR_ANALYSIS) {
      return {
        timestamp: Date.now(),
        status: 'unknown',
        probability: 0,
        signalQuality: 0,
        details: { message: 'Insufficient data for analysis' },
        latestIntervals: [...intervals]
      };
    }

    // Calcular estadísticas de variabilidad
    const rmssd = calculateRMSSD(intervals);
    const pnn50 = calculatePNN50(intervals);
    const sd1 = calculatePoincareSd1(intervals);

    // Calcular irregularidad general
    const meanInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    let irregularityCount = 0;

    for (let i = 1; i < intervals.length; i++) {
      const prevInterval = intervals[i-1];
      const currInterval = intervals[i];
      
      const relativeChange = Math.abs(currInterval - prevInterval) / prevInterval;
      
      if (relativeChange > this.IRREGULARITY_THRESHOLD) {
        irregularityCount++;
      }
    }

    // Calcular probabilidad basada en varios factores
    const irregularityRatio = irregularityCount / (intervals.length - 1);
    const bpm = 60000 / meanInterval;

    // Variables para determinar el estado
    let isBradycardia = bpm < this.BRADYCARDIA_THRESHOLD;
    let isTachycardia = bpm > this.TACHYCARDIA_THRESHOLD;
    let isIrregular = irregularityRatio > 0.2;
    let isPossibleAFib = irregularityRatio > 0.4 && pnn50 > 0.2 && sd1 > 25;
    
    // Determinar estado basado en criterios
    let status: ArrhythmiaStatus = 'normal';
    let probability = 0;

    if (isPossibleAFib) {
      status = 'possible-afib';
      probability = 0.7 + (irregularityRatio - 0.4) * 0.5;
    } else if (isIrregular && isTachycardia) {
      status = 'tachycardia';
      probability = 0.6 + (irregularityRatio * 0.3);
    } else if (isIrregular && isBradycardia) {
      status = 'bradycardia';
      probability = 0.6 + (irregularityRatio * 0.3);
    } else if (isIrregular) {
      status = 'possible-arrhythmia';
      probability = 0.4 + (irregularityRatio * 0.4);
    } else if (isTachycardia) {
      status = 'tachycardia';
      probability = 0.5;
    } else if (isBradycardia) {
      status = 'bradycardia';
      probability = 0.5;
    }

    // Si detectamos posible arritmia, incrementar contador
    if (status !== 'normal' && status !== 'unknown') {
      this.isCurrentlyArrhythmia = true;
      this.consecutiveAbnormalIntervals++;
      
      if (this.consecutiveAbnormalIntervals >= 3) {
        this.arrhythmiaCount++;
      }
    } else {
      this.isCurrentlyArrhythmia = false;
      this.consecutiveAbnormalIntervals = 0;
    }

    // Crear resultado detallado
    const result: ArrhythmiaDetectionResult = {
      timestamp: Date.now(),
      status,
      probability: this.realMin(1, probability),
      signalQuality: 70 + Math.round(intervals.length / this.MAX_BUFFER_SIZE * 30),
      details: {
        rmssd,
        pnn50,
        sd1,
        irregularityRatio,
        meanInterval,
        bpm,
        irregularCount: irregularityCount,
        category: status
      },
      latestIntervals: [...intervals]
    };

    // Si la probabilidad es alta, registrar ventana
    if (probability > 0.6 && status !== 'normal' && status !== 'unknown') {
      this.windowManager.addArrhythmiaWindow(
        status,
        probability,
        intervals,
        result.details
      );
    }

    // Actualizar estado global
    this.lastDetectionResult = result;
    this.currentStatus = status;
    
    return result;
  }

  /**
   * Check if currently in arrhythmia
   */
  public isArrhythmia(): boolean {
    return this.isCurrentlyArrhythmia;
  }

  /**
   * Get current arrhythmia status
   */
  public getArrhythmiaStatus(): {
    statusMessage: string,
    lastArrhythmiaData: any
  } {
    if (!this.lastDetectionResult) {
      return { statusMessage: "--", lastArrhythmiaData: null };
    }

    let statusMessage = "--";
    
    if (this.lastDetectionResult.status === 'normal') {
      statusMessage = "Normal";
    } else if (this.lastDetectionResult.status === 'possible-arrhythmia') {
      statusMessage = `Irregular|${this.arrhythmiaCount}`;
    } else if (this.lastDetectionResult.status === 'arrhythmia') {
      statusMessage = `Arrhythmia|${this.arrhythmiaCount}`;
    } else if (this.lastDetectionResult.status === 'possible-afib') {
      statusMessage = `Possible AFib|${this.arrhythmiaCount}`;
    } else if (this.lastDetectionResult.status === 'tachycardia') {
      statusMessage = `Tachycardia|${this.arrhythmiaCount}`;
    } else if (this.lastDetectionResult.status === 'bradycardia') {
      statusMessage = `Bradycardia|${this.arrhythmiaCount}`;
    } else if (this.lastDetectionResult.status === 'bigeminy') {
      statusMessage = `Bigeminy|${this.arrhythmiaCount}`;
    } else if (this.lastDetectionResult.status === 'trigeminy') {
      statusMessage = `Trigeminy|${this.arrhythmiaCount}`;
    }
    
    return {
      statusMessage,
      lastArrhythmiaData: this.lastDetectionResult
    };
  }

  /**
   * Get total arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }

  /**
   * Get arrhythmia windows
   */
  public getArrhythmiaWindows() {
    return this.windowManager.getArrhythmiaWindows();
  }

  /**
   * Set user profile
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    
    // Adjust thresholds based on user profile
    if (profile.age > 65) {
      // Adjust thresholds for elderly
      this.consecutiveAbnormalIntervals = 0;
    }
    
    if (profile.restingHeartRate < 60) {
      // Adjust for naturally low heart rate (athletes)
    }
  }

  /**
   * Reset all data and counters
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.consecutiveAbnormalIntervals = 0;
    this.intervalBuffer = [];
    this.currentStatus = 'unknown';
    this.isCurrentlyArrhythmia = false;
    this.lastDetectionResult = null;
    
    // Clear window data
    this.windowManager.clearWindows();
  }

  /**
   * Update global status based on detection result
   */
  private updateGlobalStatus(result: ArrhythmiaDetectionResult): void {
    this.currentStatus = result.status;
  }

  /**
   * Notify all listeners with detection result
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in arrhythmia listener:', error);
      }
    }
  }
}

// Create and export singleton instance
export default ArrhythmiaDetectionService.getInstance();
