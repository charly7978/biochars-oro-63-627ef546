
import { ArrhythmiaDetectionResult, ArrhythmiaListener, ArrhythmiaStatus, UserProfile } from './types';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';

/**
 * Servicio de detección de arritmias basado en análisis de PPG
 */
export class ArrhythmiaDetectionService {
  private listeners: ArrhythmiaListener[] = [];
  private lastResult: ArrhythmiaDetectionResult | null = null;
  private rrIntervals: number[] = [];
  private windowManager: ArrhythmiaWindowManager;
  private lastBpmTimestamp = 0;
  private userProfile: UserProfile | null = null;
  private isInitialized = false;
  private warningThreshold = 0.7;
  private alertThreshold = 0.9;
  private arrhythmiaDetected = false;
  private signalQualityThreshold = 70;
  private lastArrhythmiaTimestamp = 0;
  private arrhythmiaCooldown = 10000; // 10 segundos entre alertas

  constructor() {
    this.windowManager = new ArrhythmiaWindowManager();
    this.initialize();
  }

  /**
   * Inicializa el servicio
   */
  private initialize(): void {
    this.reset();
    
    // Configuración predeterminada
    this.warningThreshold = 0.7;
    this.alertThreshold = 0.9;
    this.signalQualityThreshold = 70;
    
    this.isInitialized = true;
    console.log("ArrhythmiaDetectionService inicializado.");
  }

  /**
   * Establece el perfil del usuario
   */
  setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    console.log("Perfil de usuario establecido:", profile);
    
    // Ajustar umbrales basados en el perfil
    if (profile.age > 65) {
      this.warningThreshold = 0.65;
      this.alertThreshold = 0.85;
    }
    
    if (profile.knownConditions.includes('arrhythmia')) {
      this.warningThreshold = 0.80;
      this.alertThreshold = 0.92;
    }
  }

  /**
   * Procesa un nuevo intervalo RR
   */
  processRRInterval(rrInterval: number, signalQuality: number): ArrhythmiaDetectionResult | null {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    // Validación básica del intervalo
    if (rrInterval <= 0 || rrInterval > 2000) {
      console.log("Intervalo RR inválido:", rrInterval);
      return null;
    }
    
    // Verificar calidad de señal
    if (signalQuality < this.signalQualityThreshold) {
      const result: ArrhythmiaDetectionResult = {
        timestamp: Date.now(),
        status: 'unknown',
        probability: 0,
        signalQuality,
        details: { reason: 'Calidad de señal insuficiente' },
        latestIntervals: [...this.rrIntervals],
      };
      this.lastResult = result;
      return result;
    }
    
    // Agregar intervalo a la lista
    this.rrIntervals.push(rrInterval);
    
    // Mantener solo los últimos 20 intervalos
    if (this.rrIntervals.length > 20) {
      this.rrIntervals.shift();
    }
    
    // Analizar si hay suficientes datos
    if (this.rrIntervals.length >= 5) {
      return this.analyzeIntervals(signalQuality);
    }
    
    return null;
  }
  
  /**
   * Analiza los intervalos RR para detectar arritmias
   */
  private analyzeIntervals(signalQuality: number): ArrhythmiaDetectionResult | null {
    if (this.rrIntervals.length < 3) {
      return null;
    }
    
    const now = Date.now();
    
    // Calcular variabilidad (SDNN)
    const mean = this.calculateMean(this.rrIntervals);
    const sdnn = this.calculateSDNN(this.rrIntervals, mean);
    
    // Calcular pNN50
    const pnn50 = this.calculatePNN50(this.rrIntervals);
    
    // Calcular rMSSD (raíz cuadrada del promedio de las diferencias al cuadrado)
    const rmssd = this.calculateRMSSD(this.rrIntervals);
    
    // Detectar si hay arritmia basado en la variabilidad
    let status: ArrhythmiaStatus = 'normal';
    let probability = 0;
    let details: Record<string, any> = {
      sdnn,
      pnn50,
      rmssd,
      mean
    };
    
    // Detección de bradicardia o taquicardia
    const bpm = 60000 / mean;
    if (bpm < 50) {
      status = 'bradycardia';
      probability = 0.9;
      details.bpm = bpm;
    } else if (bpm > 100) {
      status = 'tachycardia';
      probability = 0.85;
      details.bpm = bpm;
    } else if (pnn50 > 30 || sdnn > 100) {
      // Alta variabilidad puede indicar fibrilación auricular
      status = 'possible-afib';
      probability = Math.min(0.7 + (sdnn / 1000), 0.95);
      details.reason = 'Alta variabilidad detectada';
    } else if (this.detectPattern(this.rrIntervals, 2)) {
      // Patrones repetidos cada 2 latidos pueden indicar bigeminismo
      status = 'bigeminy';
      probability = 0.8;
      details.reason = 'Patrón alternante detectado';
    } else if (this.detectPattern(this.rrIntervals, 3)) {
      // Patrones repetidos cada 3 latidos pueden indicar trigeminismo
      status = 'trigeminy';
      probability = 0.75;
      details.reason = 'Patrón cada 3 latidos detectado';
    } else if (sdnn > 50 || rmssd > 50) {
      // Variabilidad moderada
      status = 'possible-arrhythmia';
      probability = 0.6 + (sdnn / 500);
      details.reason = 'Variabilidad moderada';
    }
    
    // Ajustar probabilidad basada en la calidad de la señal
    probability *= signalQuality / 100;
    
    // Actualizar estado de arritmia detectada
    const prevArrhythmiaState = this.arrhythmiaDetected;
    this.arrhythmiaDetected = status !== 'normal' && status !== 'unknown' && probability > this.warningThreshold;
    
    // Si acabamos de detectar una arritmia, guardamos el timestamp
    if (!prevArrhythmiaState && this.arrhythmiaDetected) {
      this.lastArrhythmiaTimestamp = now;
      
      // Registrar ventana de arritmia
      if (this.rrIntervals.length > 0) {
        this.windowManager.addArrhythmiaWindow({
          timestamp: now,
          duration: this.rrIntervals.reduce((sum, i) => sum + i, 0),
          status: status,
          intervals: [...this.rrIntervals],
          probability,
          details: {...details}
        });
      }
    }
    
    // Crear resultado
    const result: ArrhythmiaDetectionResult = {
      timestamp: now,
      status,
      probability,
      signalQuality,
      details,
      latestIntervals: [...this.rrIntervals],
      isArrhythmia: this.arrhythmiaDetected
    };
    
    this.lastResult = result;
    
    // Notificar a los listeners
    if (status !== 'normal' || now - this.lastBpmTimestamp > 5000) {
      this.lastBpmTimestamp = now;
      this.notifyListeners(result);
    }
    
    return result;
  }
  
  /**
   * Calcula la media de un array de números
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }
  
  /**
   * Calcula la desviación estándar (SDNN)
   */
  private calculateSDNN(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squareDiffs = values.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = this.calculateMean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
  
  /**
   * Calcula el porcentaje de intervalos que difieren por más de 50ms
   */
  private calculatePNN50(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let count = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i-1]) > 50) {
        count++;
      }
    }
    
    return (count / (intervals.length - 1)) * 100;
  }
  
  /**
   * Calcula la raíz cuadrada del promedio de las diferencias al cuadrado
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    const avgSquaredDiff = sumSquaredDiffs / (intervals.length - 1);
    return Math.sqrt(avgSquaredDiff);
  }
  
  /**
   * Detecta patrones en los intervalos RR
   */
  private detectPattern(intervals: number[], patternLength: number): boolean {
    if (intervals.length < patternLength * 2) return false;
    
    // Simplificado: buscar alternancia en los valores
    const recentIntervals = intervals.slice(-patternLength * 2);
    
    // Para detección de patrones simples
    if (patternLength === 2) {
      const diffs = [];
      for (let i = 0; i < recentIntervals.length - 1; i++) {
        diffs.push(Math.abs(recentIntervals[i] - recentIntervals[i+1]));
      }
      
      // Verificar si el patrón se repite (corto, largo, corto, largo)
      const threshold = 40; // ms
      for (let i = 0; i < diffs.length - 2; i += 2) {
        if (Math.abs(diffs[i] - diffs[i+2]) < threshold) {
          return true;
        }
      }
    } else if (patternLength === 3) {
      // Implementación simplificada para trigeminismo
      // Verificar si cada tercer intervalo es similar
      const firstGroup = recentIntervals.filter((_, i) => i % 3 === 0);
      const secondGroup = recentIntervals.filter((_, i) => i % 3 === 1);
      const thirdGroup = recentIntervals.filter((_, i) => i % 3 === 2);
      
      if (firstGroup.length > 1 && secondGroup.length > 1 && thirdGroup.length > 1) {
        const stdFirst = this.calculateSDNN(firstGroup, this.calculateMean(firstGroup));
        const stdSecond = this.calculateSDNN(secondGroup, this.calculateMean(secondGroup));
        const stdThird = this.calculateSDNN(thirdGroup, this.calculateMean(thirdGroup));
        
        // Si la variabilidad dentro de cada grupo es baja
        return stdFirst < 20 && stdSecond < 20 && stdThird < 20;
      }
    }
    
    return false;
  }
  
  /**
   * Agrega un listener para las detecciones de arritmia
   */
  addArrhythmiaListener(listener: ArrhythmiaListener): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }
  
  /**
   * Elimina un listener
   */
  removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * Notifica a todos los listeners
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error("Error en listener de arritmia:", error);
      }
    });
  }
  
  /**
   * Obtiene el último resultado de detección
   */
  getLastResult(): ArrhythmiaDetectionResult | null {
    return this.lastResult;
  }
  
  /**
   * Comprueba si hay arritmia detectada actualmente
   */
  isArrhythmia(): boolean {
    return this.arrhythmiaDetected;
  }
  
  /**
   * Comprueba si debe mostrarse una alerta (basado en tiempo transcurrido)
   */
  shouldShowAlert(): boolean {
    if (!this.arrhythmiaDetected) return false;
    
    // Si no hay resultado o no es arritmia, no mostrar alerta
    if (!this.lastResult || this.lastResult.status === 'normal' || this.lastResult.status === 'unknown') {
      return false;
    }

    // Corregir comparación - adding explicit comparison to specific statuses
    // Original line causing error: this.lastResult.status === 'unknown'
    if (this.lastResult.status === 'normal' || this.lastResult.status === 'unknown') {
      return false;
    }
    
    const now = Date.now();
    
    // Solo mostrar alerta si pasó el tiempo de enfriamiento
    return now - this.lastArrhythmiaTimestamp > this.arrhythmiaCooldown;
  }
  
  /**
   * Obtiene el estado actual de arritmia del servicio
   */
  getArrhythmiaStatus(): string {
    if (!this.lastResult) return "--";
    
    if (this.arrhythmiaDetected && this.lastResult.probability > this.alertThreshold) {
      return this.lastResult.status;
    } else if (this.arrhythmiaDetected) {
      return 'possible-arrhythmia';
    } else {
      return 'normal';
    }
  }
  
  /**
   * Reinicia el servicio
   */
  reset(): void {
    this.rrIntervals = [];
    this.lastResult = null;
    this.arrhythmiaDetected = false;
    this.windowManager.clearWindows();
    console.log("ArrhythmiaDetectionService reseteado.");
  }
  
  /**
   * Obtiene las ventanas de arritmia detectadas
   */
  getArrhythmiaWindows(): any[] {
    return this.windowManager.getWindows();
  }
}

// Instancia singleton
const arrhythmiaServiceInstance = new ArrhythmiaDetectionService();
export default arrhythmiaServiceInstance;
