
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Calculates Perfusion Index (PI) from genuine PPG signal
 * PI is a relative assessment of real pulse strength at the monitoring site
 * with no data simulation or manipulation
 */
export class PerfusionIndexCalculator {
  private readonly WINDOW_SIZE = 5;
  private valueBuffer: number[] = [];
  
  /**
   * Calculate the real perfusion index from genuine signal values
   * @param value - The current signal value to add to calculations
   * @returns The calculated perfusion index (0-1 range)
   */
  public calculatePI(value: number): number {
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > this.WINDOW_SIZE) {
      this.valueBuffer.shift();
    }
    
    if (this.valueBuffer.length < 3) return 0;
    
    const min = Math.min(...this.valueBuffer);
    const max = Math.max(...this.valueBuffer);
    
    // PI = (AC/DC) - AC component divided by DC component
    // Based on actual measured values only
    const ac = max - min;
    const dc = (max + min) / 2;
    
    return dc > 0 ? Math.min(1, ac / dc) : 0;
  }
  
  /**
   * Reset the calculator state
   */
  public reset(): void {
    this.valueBuffer = [];
  }
}
