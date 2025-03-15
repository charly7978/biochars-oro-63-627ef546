
/**
 * Utilidades para procesamiento de intervalos RR
 */
export class RRIntervalUtils {
  /**
   * Elimina valores atípicos (outliers) de los intervalos RR
   */
  public static removeOutliers(intervals: number[]): number[] {
    if (intervals.length < 5) return intervals;
    
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const q1Index = Math.floor(sortedIntervals.length * 0.25);
    const q3Index = Math.floor(sortedIntervals.length * 0.75);
    
    const q1 = sortedIntervals[q1Index];
    const q3 = sortedIntervals[q3Index];
    
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return intervals.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Filtra intervalos RR por rango fisiológico
   */
  public static filterByPhysiologicalRange(intervals: number[]): number[] {
    return intervals.filter(interval => interval >= 400 && interval <= 1500);
  }
  
  /**
   * Valida si un nuevo intervalo RR está dentro del rango fisiológico
   */
  public static isValidInterval(interval: number): boolean {
    return interval >= 400 && interval <= 1500;
  }
}
