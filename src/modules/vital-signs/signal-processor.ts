
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SignalFilter } from '../../core/signal-processing/filters/SignalFilter';
import { WaveletDenoiser } from '../../core/signal/filters/WaveletDenoiser';

/**
 * Procesador de señales PPG real sin simulaciones
 * Este procesador SOLO utiliza datos reales de cámara,
 * sin ningún tipo de generación sintética o simulación.
 */
export class SignalProcessor {
  private readonly ppgValues: number[] = [];
  private readonly signalFilter: SignalFilter;
  private readonly waveletDenoiser: WaveletDenoiser;
  
  // Buffers para filtrado adaptativo
  private readonly bufferSize = 200;
  private readonly smaBuffer: number[] = [];
  private readonly emaBuffer: number[] = [];
  
  constructor() {
    this.signalFilter = new SignalFilter();
    this.waveletDenoiser = new WaveletDenoiser();
  }
  
  /**
   * Procesa el valor PPG con filtros adaptativos
   * Solo utiliza datos reales sin simulación
   */
  public processPPG(value: number): number {
    // 1. Aplicar denoising wavelet para preservar componentes importantes
    const denoisedValue = this.waveletDenoiser.denoise(value);
    
    // 2. Aplicar filtro SMA para estabilizar señal real
    this.smaBuffer.push(denoisedValue);
    if (this.smaBuffer.length > 10) {
      this.smaBuffer.shift();
    }
    
    const smaFiltered = this.signalFilter.applySMAFilter(denoisedValue, this.smaBuffer);
    
    // 3. Aplicar filtro EMA para suavizado final preservando la forma de onda real
    this.emaBuffer.push(smaFiltered);
    if (this.emaBuffer.length > 10) {
      this.emaBuffer.shift();
    }
    
    // Determinar alpha basado en la calidad de señal real
    let alpha = 0.3;
    
    // Si hay datos suficientes, calcular varianza para adaptar alpha
    if (this.emaBuffer.length > 5) {
      const mean = this.emaBuffer.reduce((sum, val) => sum + val, 0) / this.emaBuffer.length;
      let variance = 0;
      for (let i = 0; i < this.emaBuffer.length; i++) {
        const diff = this.emaBuffer[i] - mean;
        variance += diff * diff;
      }
      variance /= this.emaBuffer.length;
      
      // Adaptar alpha basado en varianza real de la señal
      if (variance < 0.0001) alpha = 0.15;       // Señal muy estable
      else if (variance < 0.001) alpha = 0.2;    // Señal estable
      else if (variance < 0.01) alpha = 0.3;     // Señal normal
      else alpha = 0.5;                          // Señal con cambios rápidos
    }
    
    const emaFiltered = this.signalFilter.applyEMAFilter(smaFiltered, alpha);
    
    // Actualizar buffer principal de valores PPG
    this.ppgValues.push(emaFiltered);
    if (this.ppgValues.length > this.bufferSize) {
      this.ppgValues.shift();
    }
    
    return emaFiltered;
  }
  
  /**
   * Aplica filtro SMA directamente a un valor
   */
  public applySMAFilter(value: number): number {
    return this.signalFilter.applySMAFilter(value, this.smaBuffer);
  }
  
  /**
   * Obtiene todos los valores PPG procesados
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Resetea todos los buffers y estados
   */
  public reset(): void {
    this.ppgValues.length = 0;
    this.smaBuffer.length = 0;
    this.emaBuffer.length = 0;
    this.signalFilter.reset();
    this.waveletDenoiser.reset();
  }
}
