
/**
 * Base signal processor with common functionality
 * Provides core methods for all specialized processors
 * ÚNICAMENTE PARA PROCESAMIENTO DE DATOS REALES DE PPG
 */
import { CombinedExtractionResult } from '../../extraction/CombinedExtractor';

export class BaseProcessor {
  protected ppgValues: number[] = [];
  protected lastResults: CombinedExtractionResult[] = [];
  
  /**
   * Get current PPG values buffer with real data only
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Get last processing results
   */
  public getLastResults(): CombinedExtractionResult[] {
    return this.lastResults;
  }
  
  /**
   * Add a new PPG value to the buffer
   */
  public addPPGValue(value: number): void {
    this.ppgValues.push(value);
    if (this.ppgValues.length > 100) {
      this.ppgValues.shift();
    }
  }
  
  /**
   * Add a new extraction result to the buffer
   */
  public addExtractionResult(result: CombinedExtractionResult): void {
    this.lastResults.push(result);
    if (this.lastResults.length > 100) {
      this.lastResults.shift();
    }
    
    // Also add the filtered value to PPG values
    this.addPPGValue(result.filteredValue);
  }
  
  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.ppgValues = [];
    this.lastResults = [];
  }
}
