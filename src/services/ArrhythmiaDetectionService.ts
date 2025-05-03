
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Definición de tipos
interface ArrhythmiaData {
  timestamp: number;
  rrInterval: number;
  heartRate: number;
  type: string;
}

/**
 * Servicio singleton para detección de arritmias
 * Procesa intervalos RR reales para detectar irregularidades
 * Sin simulación, solo procesamiento de señales reales
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  
  // Estado interno
  private rrIntervals: number[] = [];
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTimestamp: number = 0;
  private lastArrhythmiaData: ArrhythmiaData | null = null;
  
  // Configuración
  private readonly MIN_INTERVALS_FOR_DETECTION = 5;
  private readonly MAX_RR_INTERVALS = 50;
  private readonly MAX_HR_THRESHOLD = 180;
  private readonly MIN_HR_THRESHOLD = 40;
  private readonly SEVERE_IRREGULARITY_THRESHOLD = 0.40; // 40% variación
  private readonly MILD_IRREGULARITY_THRESHOLD = 0.20;  // 20% variación
  
  // Constructor privado para singleton
  private constructor() {
    console.log("ArrhythmiaDetectionService: Inicializado");
  }
  
  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }
  
  /**
   * Actualiza los intervalos RR con nuevos datos
   * Sin simulación, procesa datos reales
   */
  public updateRRIntervals(intervals: number[]): void {
    // Si no hay intervalos, no hacemos nada
    if (!intervals || intervals.length === 0) {
      return;
    }
    
    // Añadir solo intervalos fisiológicamente plausibles
    for (const interval of intervals) {
      // Validar que el intervalo está en rango fisiológico (300-2000ms)
      if (interval >= 300 && interval <= 2000) {
        this.rrIntervals.push(interval);
      }
    }
    
    // Mantener un tamaño máximo para el buffer
    if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
      this.rrIntervals = this.rrIntervals.slice(-this.MAX_RR_INTERVALS);
    }
    
    // Analizar arritmias si tenemos suficientes intervalos
    if (this.rrIntervals.length >= this.MIN_INTERVALS_FOR_DETECTION) {
      this.analyzeArrhythmias();
    }
  }
  
  /**
   * Analiza los intervalos RR para detectar arritmias
   * Sin simulación, usa algoritmos reales
   */
  private analyzeArrhythmias(): void {
    if (this.rrIntervals.length < this.MIN_INTERVALS_FOR_DETECTION) {
      return;
    }
    
    // Calcular la media de los intervalos RR
    let sum = 0;
    for (let i = 0; i < this.rrIntervals.length; i++) {
      sum += this.rrIntervals[i];
    }
    const meanRR = sum / this.rrIntervals.length;
    
    // Calcular la frecuencia cardíaca promedio
    const avgHeartRate = 60000 / meanRR;
    
    // Verificar si la frecuencia está fuera del rango fisiológico
    const isHeartRateAbnormal = avgHeartRate > this.MAX_HR_THRESHOLD || avgHeartRate < this.MIN_HR_THRESHOLD;
    
    // Calcular la desviación estándar de los intervalos RR
    let squaredDiffSum = 0;
    for (let i = 0; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - meanRR;
      squaredDiffSum += diff * diff;
    }
    const stdDevRR = Math.sqrt(squaredDiffSum / this.rrIntervals.length);
    
    // Calcular el coeficiente de variación (CV) normalizado
    const coefficientOfVariation = stdDevRR / meanRR;
    
    // Verificar irregularidad patológica en los últimos intervalos
    const recentIntervals = this.rrIntervals.slice(-5);
    let hasPathologicalPattern = false;
    
    // Buscar patrones específicos de arritmia
    if (recentIntervals.length >= 3) {
      // Buscar diferencias grandes entre intervalos consecutivos
      for (let i = 1; i < recentIntervals.length; i++) {
        const diff = recentIntervals[i] > recentIntervals[i-1] ?
          recentIntervals[i] - recentIntervals[i-1] :
          recentIntervals[i-1] - recentIntervals[i];
        
        const relDiff = diff / recentIntervals[i-1];
        
        if (relDiff > this.SEVERE_IRREGULARITY_THRESHOLD) {
          hasPathologicalPattern = true;
          break;
        }
      }
    }
    
    // Determinar el tipo de arritmia
    let arrhythmiaType = "normal";
    
    if (isHeartRateAbnormal) {
      if (avgHeartRate > this.MAX_HR_THRESHOLD) {
        arrhythmiaType = "tachycardia";
      } else {
        arrhythmiaType = "bradycardia";
      }
    } else if (hasPathologicalPattern || coefficientOfVariation > this.SEVERE_IRREGULARITY_THRESHOLD) {
      arrhythmiaType = "severe_irregularity";
    } else if (coefficientOfVariation > this.MILD_IRREGULARITY_THRESHOLD) {
      arrhythmiaType = "mild_irregularity";
    }
    
    // Si detectamos arritmia, actualizamos el contador y la información
    if (arrhythmiaType !== "normal") {
      this.arrhythmiaCount++;
      this.lastArrhythmiaTimestamp = Date.now();
      this.lastArrhythmiaData = {
        timestamp: this.lastArrhythmiaTimestamp,
        rrInterval: meanRR,
        heartRate: avgHeartRate,
        type: arrhythmiaType
      };
      
      console.log(`ArrhythmiaDetectionService: Detectada arritmia #${this.arrhythmiaCount} tipo: ${arrhythmiaType}`);
    }
  }
  
  /**
   * Obtiene el estado actual de arritmia
   * Sin simulación, datos reales
   */
  public getArrhythmiaStatus(): { 
    statusMessage: string; 
    lastArrhythmiaData: ArrhythmiaData | null;
  } {
    // Si no hay suficientes datos, devolver estado indeterminado
    if (this.rrIntervals.length < this.MIN_INTERVALS_FOR_DETECTION) {
      return { statusMessage: "--", lastArrhythmiaData: null };
    }
    
    const now = Date.now();
    const timeSinceLastArrhythmia = now - this.lastArrhythmiaTimestamp;
    
    // Si no hay arritmias o la última fue hace más de 10 segundos
    if (this.arrhythmiaCount === 0 || timeSinceLastArrhythmia > 10000) {
      return { statusMessage: "Normal", lastArrhythmiaData: null };
    }
    
    // Formatear el mensaje de estado
    const statusMessage = `Irregular|${this.arrhythmiaCount}`;
    return { statusMessage, lastArrhythmiaData: this.lastArrhythmiaData };
  }
  
  /**
   * Obtiene el contador de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Resetea el estado del detector
   */
  public reset(): void {
    this.rrIntervals = [];
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTimestamp = 0;
    this.lastArrhythmiaData = null;
  }
}

// Exportar instancia singleton
export default ArrhythmiaDetectionService.getInstance();
