
import { ArrhythmiaStatus } from './types';

/**
 * Manages the history of arrhythmia detection windows
 * Solo datos reales - sin simulación
 */
export class ArrhythmiaWindowManager {
  // Ventanas de arritmia detectadas (historial)
  private arrhythmiaWindows: Array<{
    timestamp: number;
    duration: number;
    status: ArrhythmiaStatus;
    intervals: number[];
    probability: number;
    details: Record<string, any>;
  }> = [];

  private readonly MAX_WINDOWS = 50;

  /**
   * Añadir nueva ventana de arritmia
   */
  public addArrhythmiaWindow(
    status: ArrhythmiaStatus,
    probability: number,
    intervals: number[],
    details: Record<string, any> = {}
  ): void {
    const timestamp = Date.now();
    
    // Calcular duración aproximada basada en intervalos
    const duration = intervals.reduce((sum, interval) => sum + interval, 0);
    
    this.arrhythmiaWindows.push({
      timestamp,
      duration,
      status,
      intervals: [...intervals],
      probability,
      details
    });
    
    // Mantener solo las últimas ventanas
    if (this.arrhythmiaWindows.length > this.MAX_WINDOWS) {
      this.arrhythmiaWindows.shift();
    }
  }

  /**
   * Obtener todas las ventanas de arritmia
   */
  public getArrhythmiaWindows() {
    return [...this.arrhythmiaWindows];
  }

  /**
   * Limpiar historial de ventanas
   */
  public clearWindows(): void {
    this.arrhythmiaWindows = [];
  }
}
