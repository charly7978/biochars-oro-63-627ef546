
/**
 * Base signal processor with common functionality
 * Provides core methods for all specialized processors
 * ÚNICAMENTE PARA PROCESAMIENTO DE DATOS REALES DE PPG
 */
export class BaseProcessor {
  protected ppgValues: number[] = [];
  
  /**
   * Get current PPG values buffer with real data only
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.ppgValues = [];
  }
}
