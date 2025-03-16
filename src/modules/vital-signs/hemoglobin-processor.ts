
import { 
  normalizeValues, 
  SIGNAL_CONSTANTS
} from './shared-signal-utils';

/**
 * Procesador para el cálculo estimado de hemoglobina basado en señal PPG
 */
export class HemoglobinProcessor {
  private readonly MIN_VALID_VALUES = SIGNAL_CONSTANTS.MIN_VALID_VALUES;
  private readonly MIN_AMPLITUDE = SIGNAL_CONSTANTS.MIN_AMPLITUDE;
  private readonly BASE_HEMOGLOBIN = 14.5; // g/dL (valor promedio normal)
  
  /**
   * Calcula nivel de hemoglobina estimado basado en características de la señal PPG
   * Implementa un enfoque conservador basado en múltiples estudios
   */
  public calculateHemoglobin(ppgValues: number[]): number {
    if (ppgValues.length < this.MIN_VALID_VALUES) return 0;
    
    // Normalizar valores usando la utilidad compartida
    const normalized = normalizeValues(ppgValues);
    
    // Verificar si la normalización fue exitosa
    if (normalized.every(v => v === 0)) return 0;
    
    // Calcular área bajo la curva como indicador de contenido de hemoglobina
    const auc = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
    
    // Aplicar modelo conservador basado en investigación óptica
    const hemoglobin = this.BASE_HEMOGLOBIN - ((0.6 - auc) * 8);
    
    // Limitar a rango fisiológico normal
    return Math.max(10, Math.min(17, hemoglobin));
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    // No tiene estado interno que reiniciar
  }
}
