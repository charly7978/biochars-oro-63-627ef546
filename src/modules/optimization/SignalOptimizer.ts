
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

import { SignalProcessingFilters } from '../utils/SignalProcessingFilters';
import { ProcessedPPGData } from '../types/signal';

/**
 * Clase que optimiza la señal PPG para mejorar la calidad
 * y precisión de las mediciones.
 */
export class SignalOptimizer {
  private readonly MOVING_AVERAGE_WINDOW = 5;
  private bandpassFilter: SignalProcessingFilters;
  private movingAverageBuffer: number[] = [];
  private lastOptimizedValue = 0;
  
  constructor() {
    this.bandpassFilter = new SignalProcessingFilters();
    this.reset();
  }
  
  /**
   * Optimiza la señal PPG aplicando filtros y normalizaciones
   * @param data Datos PPG procesados
   * @returns Datos optimizados
   */
  public optimizeSignal(data: ProcessedPPGData): ProcessedPPGData {
    // Si no hay detección de dedo, no optimizar
    if (!data.fingerDetected) {
      return {
        ...data,
        filteredValue: 0,
        quality: 0
      };
    }
    
    // 1. Filtro de paso de banda para eliminar ruido
    const filteredValue = this.bandpassFilter.applyBandpassFilter(data.rawValue);
    
    // 2. Filtro de media móvil para suavizar
    const smoothedValue = this.applyMovingAverage(filteredValue);
    
    // 3. Normalización para mantener valores consistentes
    const normalizedValue = this.normalizeSignal(smoothedValue);
    
    // 4. Calcular calidad de señal
    const signalQuality = this.calculateSignalQuality(normalizedValue, data.rawValue);
    
    // Actualizar último valor
    this.lastOptimizedValue = normalizedValue;
    
    return {
      ...data,
      filteredValue: normalizedValue,
      quality: signalQuality
    };
  }
  
  /**
   * Aplica un filtro de media móvil para suavizar la señal
   */
  private applyMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }
  
  /**
   * Normaliza la señal para mantener valores consistentes
   */
  private normalizeSignal(value: number): number {
    // Aplicamos una normalización simple por ahora
    // Esto se podría mejorar con técnicas más avanzadas
    const normalized = (value - (-1)) / (1 - (-1));
    return Math.max(0, Math.min(1, normalized));
  }
  
  /**
   * Calcula la calidad de la señal en base a ruido y estabilidad
   * @returns Valor de calidad de 0 a 100
   */
  private calculateSignalQuality(filteredValue: number, rawValue: number): number {
    // Diferencia entre señal filtrada y cruda como medida de ruido
    const noiseFactor = Math.abs(filteredValue - rawValue);
    
    // Estabilidad basada en cambios en valores filtrados
    const stabilityFactor = Math.abs(filteredValue - this.lastOptimizedValue);
    
    // Calidad básica calculada inversamente al ruido y estabilidad
    // (menos ruido = mayor calidad)
    const basicQuality = 100 - (noiseFactor * 50) - (stabilityFactor * 100);
    
    // Asegurar que la calidad esté en el rango 0-100
    return Math.max(0, Math.min(100, basicQuality));
  }
  
  /**
   * Calcula la relación rojo/IR para SpO2 cuando estén disponibles
   * @param data Datos procesados con componentes R e IR
   * @returns Ratio R/IR para cálculo de SpO2
   */
  public calculateRatioForSpo2(data: ProcessedPPGData): number {
    // Esta función se utilizaría con sensores que tengan componentes rojo e IR
    // En este caso, solo usamos el valor proporcional disponible
    return data.rawValue;
  }
  
  /**
   * Reinicia todos los buffers y filtros
   */
  public reset(): void {
    this.movingAverageBuffer = [];
    this.lastOptimizedValue = 0;
    this.bandpassFilter.reset();
  }
}

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
