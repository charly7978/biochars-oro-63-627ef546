
import { ArrhythmiaDetectionResult, ArrhythmiaListener, ArrhythmiaStatus, UserProfile, ArrhythmiaCategory } from './types';

/**
 * Servicio para la detección y gestión de arritmias
 * Implementación directa sin simulaciones
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private listeners: ArrhythmiaListener[] = [];
  private arrhythmiaCount: number = 0;
  private lastDectectionState: boolean = false;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: ArrhythmiaCategory;
  } | null = null;
  private recentRRIntervals: number[] = [];
  private consecutiveNormal: number = 0;
  private consecutiveArrhythmic: number = 0;
  private userProfile: UserProfile = {};
  
  private constructor() {
    console.log('ArrhythmiaDetectionService inicializado');
  }
  
  /**
   * Obtiene la instancia única del servicio (patrón Singleton)
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }
  
  /**
   * Agrega un listener para notificaciones de arritmia
   */
  public addListener(listener: ArrhythmiaListener): () => void {
    this.listeners.push(listener);
    console.log(`ArrhythmiaDetectionService: Listener agregado. Total: ${this.listeners.length}`);
    
    // Retornar función para eliminar este listener
    return () => this.removeListener(listener);
  }
  
  /**
   * Elimina un listener específico
   */
  public removeListener(listener: ArrhythmiaListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
      console.log(`ArrhythmiaDetectionService: Listener removido. Total: ${this.listeners.length}`);
    }
  }
  
  /**
   * Elimina todos los listeners
   */
  public clearListeners(): void {
    this.listeners = [];
    console.log('ArrhythmiaDetectionService: Todos los listeners eliminados');
  }
  
  /**
   * Actualiza el perfil del usuario
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = { ...this.userProfile, ...profile };
    console.log('ArrhythmiaDetectionService: Perfil de usuario actualizado', this.userProfile);
  }
  
  /**
   * Detecta arritmias a partir de intervalos RR
   * Utilizando algoritmos estándar (no simulación)
   */
  public updateRRIntervals(intervals: number[]): boolean {
    if (!intervals || intervals.length < 2) {
      return false;
    }
  
    // Añadir nuevos intervalos
    this.recentRRIntervals = [...this.recentRRIntervals, ...intervals];
    
    // Limitar a 30 intervalos (aproximadamente 30 segundos)
    if (this.recentRRIntervals.length > 30) {
      this.recentRRIntervals = this.recentRRIntervals.slice(-30);
    }
    
    // Necesitamos al menos 5 intervalos para análisis
    if (this.recentRRIntervals.length < 5) {
      return false;
    }
  
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    // Métrica estándar de HRV que detecta variabilidad entre latidos
    let sumSquaredDiff = 0;
    for (let i = 1; i < this.recentRRIntervals.length; i++) {
      const diff = this.recentRRIntervals[i] - this.recentRRIntervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (this.recentRRIntervals.length - 1));
    
    // Calcular variación porcentual (coeficiente de variación)
    const mean = this.recentRRIntervals.reduce((sum, val) => sum + val, 0) / this.recentRRIntervals.length;
    
    // Diferencia absoluta máxima entre intervalos contiguos (como % de la media)
    let maxAbsDiff = 0;
    for (let i = 1; i < this.recentRRIntervals.length; i++) {
      const absDiff = Math.abs(this.recentRRIntervals[i] - this.recentRRIntervals[i-1]);
      maxAbsDiff = Math.max(maxAbsDiff, absDiff);
    }
    const rrVariation = (maxAbsDiff / mean) * 100;
    
    // Determinar si hay arritmia basado en umbrales clínicos
    // Umbral normal de RMSSD: 15-40ms, pero depende de edad y condición física
    let baseRmssdThreshold = 70; // ms - adaptable según perfil
    let rrVariationThreshold = 20; // % - adaptable según perfil
    
    // Ajustar umbrales según perfil
    if (this.userProfile.age && this.userProfile.age > 60) {
      baseRmssdThreshold *= 0.8; // Menor umbral para adultos mayores
    }
    
    if (this.userProfile.condition === 'athlete') {
      baseRmssdThreshold *= 1.5; // Atletas tienen mayor HRV normal
      rrVariationThreshold *= 1.3;
    } else if (this.userProfile.condition === 'hypertension' || this.userProfile.condition === 'diabetes') {
      baseRmssdThreshold *= 0.7; // Menor umbral para condiciones que afectan autonomía cardíaca
      rrVariationThreshold *= 0.8;
    }
    
    // Detección basada en múltiples factores
    const isRmssdAbnormal = rmssd > baseRmssdThreshold;
    const isVariationAbnormal = rrVariation > rrVariationThreshold;
    const isArrhythmia = isRmssdAbnormal && isVariationAbnormal;
    
    // Categorizar el tipo de arritmia
    let category: ArrhythmiaCategory = 'normal';
    
    if (isArrhythmia) {
      // Requiere detección sostenida para validar
      this.consecutiveArrhythmic++;
      this.consecutiveNormal = 0;
      
      // Solo aumentar contador si consecutivo
      if (this.consecutiveArrhythmic >= 2) {
        if (!this.lastDectectionState) {
          this.arrhythmiaCount++;
          this.lastDectectionState = true;
        }
        
        // Categorizar tipo de arritmia
        const avgHeartRate = 60000 / mean; // BPM
        
        if (avgHeartRate > 100) {
          category = 'tachycardia';
        } else if (avgHeartRate < 50) {
          category = 'bradycardia';
        } else if (this.detectBigeminy(this.recentRRIntervals)) {
          category = 'bigeminy';
        } else {
          category = 'possible-arrhythmia';
        }
      }
    } else {
      // Restaurar estado normal después de varios análisis normales
      this.consecutiveNormal++;
      this.consecutiveArrhythmic = 0;
      
      if (this.consecutiveNormal >= 3) {
        this.lastDectectionState = false;
      }
    }
    
    // Almacenar datos de la arritmia si se detecta
    if (isArrhythmia && this.consecutiveArrhythmic >= 2) {
      this.lastArrhythmiaData = {
        timestamp: Date.now(),
        rmssd,
        rrVariation,
        category
      };
      
      // Crear resultado de detección
      const result: ArrhythmiaDetectionResult = {
        isArrhythmia,
        rmssd,
        rrVariation,
        timestamp: Date.now(),
        category
      };
      
      // Notificar a los listeners
      this.notifyListeners(result);
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Detecta patrón de bigeminia (alternancia largo-corto)
   * Método directo basado en patrones reales, sin simulación
   */
  private detectBigeminy(intervals: number[]): boolean {
    if (intervals.length < 6) return false;
    
    // Buscar alternancia clara entre latidos largos y cortos
    let alternatingCount = 0;
    for (let i = 2; i < intervals.length; i += 2) {
      const diff1 = intervals[i] - intervals[i-1];
      const diff2 = intervals[i-1] - intervals[i-2];
      
      if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
        alternatingCount++;
      }
    }
    
    // Al menos 3 pares alternantes indicarían bigeminia
    return alternatingCount >= 3;
  }
  
  /**
   * Notifica a los listeners sobre detección de arritmia
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error al notificar listener de arritmia:', error);
      }
    });
  }
  
  /**
   * Devuelve el estado actual de la detección de arritmias
   */
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    let statusMessage = "Normal";
    
    if (this.lastArrhythmiaData) {
      statusMessage = `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}|${this.categorizeArrhythmia(this.lastArrhythmiaData.category as ArrhythmiaCategory)}`;
    }
    
    return {
      arrhythmiaCount: this.arrhythmiaCount,
      statusMessage,
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }
  
  /**
   * Obtiene el número de arritmias detectadas
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Resetea el servicio a su estado inicial
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.lastDectectionState = false;
    this.lastArrhythmiaData = null;
    this.recentRRIntervals = [];
    this.consecutiveNormal = 0;
    this.consecutiveArrhythmic = 0;
    console.log('ArrhythmiaDetectionService: Reset completo');
  }
  
  /**
   * Utilidad para categorizar el tipo de arritmia
   */
  private categorizeArrhythmia(category?: ArrhythmiaCategory): string {
    switch (category) {
      case 'tachycardia':
        return 'Tachycardia';
      case 'bradycardia':
        return 'Bradycardia';
      case 'bigeminy':
        return 'Bigeminy';
      case 'possible-arrhythmia':
        return 'Irregular rhythm';
      case 'normal':
      default:
        return 'Anomaly';
    }
  }
}

// Exportar la instancia única
export default ArrhythmiaDetectionService.getInstance();
