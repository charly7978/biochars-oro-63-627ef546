
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { 
  ArrhythmiaDetectionResult, 
  ArrhythmiaData, 
  ArrhythmiaStatus, 
  ArrhythmiaListener,
  UserProfile,
  ArrhythmiaCategory
} from './types';

import { 
  calculateRMSSD, 
  calculateRRVariation, 
  categorizeArrhythmia 
} from './ArrhythmiaUtils';

/**
 * Servicio dedicado a la detección de arritmias usando datos REALES
 * Procesa intervalos RR para identificar patrones anormales
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  
  // Configuración estándar basada en investigación científica y no ajustada
  private readonly RMSSD_THRESHOLD = 30;  // ms
  private readonly RR_VARIATION_THRESHOLD = 15;  // %
  private readonly MIN_RR_COUNT = 4;
  
  // Estados de detección
  private arrhythmiaCount: number = 0;
  private lastDetectionResult: ArrhythmiaDetectionResult | null = null;
  private listeners: Set<ArrhythmiaListener> = new Set();
  private lastRRIntervals: number[] = [];
  private currentlyInArrhythmia: boolean = false;
  private buffer: number[] = [];
  private bufferMaxSize: number = 20;
  
  // Perfil de usuario
  private userProfile: UserProfile = {};
  
  /**
   * Constructor privado para implementar singleton
   */
  private constructor() {
    console.log("ArrhythmiaDetectionService: Inicializado con datos completamente reales");
  }
  
  /**
   * Método estático para obtener la instancia singleton
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }
  
  /**
   * Actualiza los intervalos RR para ser analizados
   * Solo procesa datos reales obtenidos de mediciones
   */
  public updateRRIntervals(intervals: number[]): void {
    if (!intervals || intervals.length === 0) {
      return;
    }
    
    // Añadir nuevos intervalos al buffer
    this.buffer = [...this.buffer, ...intervals];
    
    // Mantener el tamaño del buffer limitado
    if (this.buffer.length > this.bufferMaxSize) {
      this.buffer = this.buffer.slice(this.buffer.length - this.bufferMaxSize);
    }
    
    // Guardar los intervalos más recientes para referencias futuras
    this.lastRRIntervals = [...this.buffer];
    
    // Analizar los intervalos si hay suficientes
    if (this.buffer.length >= this.MIN_RR_COUNT) {
      this.detectArrhythmia(this.buffer);
    }
  }
  
  /**
   * Realiza la detección de arritmias sobre los intervalos RR proporcionados
   * Solo procesa datos reales sin simulación
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    if (!rrIntervals || rrIntervals.length < this.MIN_RR_COUNT) {
      return this.createResultObject(false, "RR insuficientes", null, "normal");
    }
    
    // Filtrar valores no fisiológicos
    const validRRs = rrIntervals.filter(rr => rr > 300 && rr < 2000);
    
    if (validRRs.length < this.MIN_RR_COUNT) {
      return this.createResultObject(false, "RR válidos insuficientes", null, "normal");
    }
    
    // Calcular métrica RMSSD (raíz cuadrada del promedio de diferencias cuadráticas)
    const rmssd = calculateRMSSD(validRRs);
    
    // Calcular variación de intervalos RR
    const rrVariation = calculateRRVariation(validRRs);
    
    // Determinar categoría de arritmia
    const category = categorizeArrhythmia(validRRs, rmssd, rrVariation);
    
    // Timestamp actual
    const timestamp = Date.now();
    
    // Determinar si hay arritmia basado en los umbrales
    const isArrhythmia = 
      category !== "normal" || 
      rmssd > this.RMSSD_THRESHOLD || 
      rrVariation > this.RR_VARIATION_THRESHOLD;
    
    // Actualizar contador si se detecta una nueva arritmia
    if (isArrhythmia && !this.currentlyInArrhythmia) {
      this.arrhythmiaCount++;
      this.currentlyInArrhythmia = true;
    } else if (!isArrhythmia && this.currentlyInArrhythmia) {
      this.currentlyInArrhythmia = false;
    }
    
    // Crear objeto con datos de la arritmia
    const arrhythmiaData: ArrhythmiaData = {
      timestamp,
      rmssd,
      rrVariation,
      category
    };
    
    // Construir mensaje de estado
    let statusMessage = isArrhythmia 
      ? `ARRITMIA|${this.arrhythmiaCount}` 
      : "RITMO NORMAL|0";
    
    // Crear resultado
    const result = this.createResultObject(
      isArrhythmia,
      statusMessage,
      isArrhythmia ? arrhythmiaData : null,
      category
    );
    
    // Notificar a los listeners si hay arritmia
    if (isArrhythmia) {
      this.notifyListeners(result);
    }
    
    // Guardar el resultado para consulta posterior
    this.lastDetectionResult = result;
    
    return result;
  }
  
  /**
   * Ayudante para crear el objeto resultado
   */
  private createResultObject(
    isArrhythmia: boolean, 
    statusMessage: string, 
    lastArrhythmiaData: ArrhythmiaData | null,
    category: ArrhythmiaCategory
  ): ArrhythmiaDetectionResult {
    return {
      isArrhythmia,
      statusMessage,
      lastArrhythmiaData,
      arrhythmiaCount: this.arrhythmiaCount,
      category
    };
  }
  
  /**
   * Notifica a todos los listeners sobre una arritmia detectada
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error("ArrhythmiaDetectionService: Error al notificar listener", error);
      }
    });
  }
  
  /**
   * Registra un listener para ser notificado cuando se detecte una arritmia
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners.add(listener);
  }
  
  /**
   * Elimina un listener previamente registrado
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners.delete(listener);
  }
  
  /**
   * Retorna si actualmente se está en estado de arritmia
   */
  public isArrhythmia(): boolean {
    return this.currentlyInArrhythmia;
  }
  
  /**
   * Retorna el contador de arritmias detectadas
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Retorna el último estado de arritmia
   */
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    if (!this.lastDetectionResult) {
      return {
        statusMessage: "NO DATA|0",
        lastArrhythmiaData: null,
        category: "normal"
      };
    }
    
    return {
      statusMessage: this.lastDetectionResult.statusMessage,
      lastArrhythmiaData: this.lastDetectionResult.lastArrhythmiaData,
      category: this.lastDetectionResult.category
    };
  }
  
  /**
   * Establece el perfil del usuario para personalizar la detección
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    console.log("ArrhythmiaDetectionService: Perfil de usuario actualizado", this.userProfile);
  }
  
  /**
   * Obtiene los intervalos RR actuales
   */
  public getRRIntervals(): number[] {
    return [...this.lastRRIntervals];
  }
  
  /**
   * Resetea el servicio, eliminando todo historial de detecciones
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.lastDetectionResult = null;
    this.lastRRIntervals = [];
    this.buffer = [];
    this.currentlyInArrhythmia = false;
    console.log("ArrhythmiaDetectionService: Reset completo");
  }
}

// Singleton instance export
export default ArrhythmiaDetectionService.getInstance();
