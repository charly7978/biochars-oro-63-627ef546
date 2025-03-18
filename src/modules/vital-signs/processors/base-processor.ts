
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Base processor for all vital signs processors
 * Provides common functionality and data storage
 */
export class BaseProcessor {
  protected ppgValues: number[] = [];
  
  constructor() {
    this.reset();
  }
  
  /**
   * Reset the processor state
   * All measurements will start from zero
   */
  public reset(): void {
    this.ppgValues = [];
  }
  
  /**
   * Get current PPG values
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
}
