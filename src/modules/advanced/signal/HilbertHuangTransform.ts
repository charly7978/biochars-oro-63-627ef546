
/**
 * Implementación de la Transformada Hilbert-Huang para análisis
 * de señales no lineales y no estacionarias como el PPG.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

import { IMF, HilbertHuangResult } from '../types/HilbertHuangTypes';
import { normalizeSignal } from './utils/SignalUtils';
import { EmpiricalModeDecomposition } from './EmpiricalModeDecomposition';
import { HilbertTransformer } from './HilbertTransformer';

export { IMF };

export class HilbertHuangTransform {
  // Configuración
  private readonly MAX_IMF = 3;        // Número máximo de IMFs a extraer
  
  // Componentes
  private emd: EmpiricalModeDecomposition;
  private hilbertTransformer: HilbertTransformer;
  
  // Estado
  private enabled: boolean = true;
  private lastImfs: IMF[] = [];
  
  constructor() {
    this.emd = new EmpiricalModeDecomposition();
    this.hilbertTransformer = new HilbertTransformer();
    console.log('Transformada Hilbert-Huang inicializada');
  }
  
  /**
   * Analiza una señal PPG utilizando la transformada Hilbert-Huang
   * para extraer componentes no lineales y no estacionarios
   */
  public analyze(values: number[]): HilbertHuangResult | null {
    // Si está desactivado o no hay suficientes datos, no procesar
    if (!this.enabled || values.length < 30) {
      return null;
    }
    
    // Normalizar señal
    const normalizedValues = normalizeSignal(values);
    
    // Aplicar descomposición en modos empíricos (EMD)
    const imfs = this.emd.performEMD(normalizedValues, this.MAX_IMF);
    this.lastImfs = imfs;
    
    // Aplicar transformada de Hilbert a cada IMF
    const hilbertResults = imfs.map(imf => 
      this.hilbertTransformer.applyHilbert(imf.values)
    );
    
    // Calcular frecuencia instantánea para el primer IMF (más relevante)
    const instantaneousFrequency = this.hilbertTransformer.calculateInstantaneousFrequency(
      hilbertResults[0]?.phase || []
    );
    
    // Estimar frecuencia dominante
    const dominantFrequency = this.hilbertTransformer.estimateDominantFrequency(
      instantaneousFrequency
    );
    
    return {
      imfs,
      instantaneousFrequency,
      dominantFrequency
    };
  }
  
  /**
   * Activa o desactiva el procesamiento
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Reinicia el estado del procesador
   */
  public reset(): void {
    this.lastImfs = [];
  }
}
