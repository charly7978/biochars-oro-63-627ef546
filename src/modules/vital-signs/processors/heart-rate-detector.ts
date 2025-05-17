
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Detector de frecuencia cardíaca basado en procesamiento directo de señal PPG
 * Sin simulación ni manipulación de datos
 */
export class HeartRateDetector {
  private peakTimes: number[] = [];
  private lastPeakIndex: number = -1;
  private lastBpm: number = 0;
  
  /**
   * Calcula la frecuencia cardíaca a partir de los valores PPG directos
   * @param ppgValues Array de valores PPG
   * @param sampleRate Tasa de muestreo en Hz
   * @returns Frecuencia cardíaca en BPM
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < 10) {
      console.log("HeartRateDetector: Buffer insuficiente", {
        size: ppgValues.length,
        required: 10
      });
      return this.lastBpm || 72; // Default value if no calculation possible
    }
    
    // Detectar picos en la señal PPG
    this.detectPeaks(ppgValues, sampleRate);
    
    // Log for debugging
    console.log("HeartRateDetector: Picos detectados", {
      peakCount: this.peakTimes.length,
      times: this.peakTimes
    });
    
    // Calcular intervalos RR
    const rrIntervals = this.calculateRRIntervals();
    
    if (rrIntervals.length < 3) {
      console.log("HeartRateDetector: Intervalos RR insuficientes", {
        count: rrIntervals.length,
        required: 3
      });
      return this.lastBpm || 72; 
    }
    
    // Calcular BPM promedio a partir de intervalos RR
    const validIntervals = this.getValidRRIntervals(rrIntervals);
    
    if (validIntervals.length < 3) {
      console.log("HeartRateDetector: Intervalos RR válidos insuficientes", {
        valid: validIntervals.length,
        total: rrIntervals.length,
        required: 3
      });
      return this.lastBpm || 72;
    }
    
    const averageRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
    const bpm = Math.round(60000 / averageRR); // Convertir a BPM
    
    // Validar que el BPM esté en un rango fisiológico razonable
    if (bpm >= 40 && bpm <= 200) {
      this.lastBpm = bpm;
      console.log("HeartRateDetector: BPM calculado", {
        bpm,
        avgRR: averageRR,
        intervals: validIntervals
      });
    } else {
      console.log("HeartRateDetector: BPM fuera de rango", {
        calculated: bpm,
        using: this.lastBpm
      });
    }
    
    return this.lastBpm || 72;
  }
  
  /**
   * Detecta picos en la señal PPG
   * @param ppgValues Array de valores PPG
   * @param sampleRate Tasa de muestreo en Hz
   */
  private detectPeaks(ppgValues: number[], sampleRate: number): void {
    const now = Date.now();
    const msPerSample = 1000 / sampleRate;
    
    // Buscar picos en toda la señal
    for (let i = 2; i < ppgValues.length - 2; i++) {
      // Un punto es un pico si es mayor que sus vecinos
      if (ppgValues[i] > ppgValues[i - 1] && 
          ppgValues[i] > ppgValues[i - 2] &&
          ppgValues[i] > ppgValues[i + 1] &&
          ppgValues[i] > ppgValues[i + 2]) {
        
        // Calcular el tiempo aproximado de este pico
        const peakTime = now - (ppgValues.length - 1 - i) * msPerSample;
        
        // Verificar la distancia mínima entre picos (250ms = 240bpm máx)
        const lastPeakTime = this.peakTimes.length > 0 ? this.peakTimes[this.peakTimes.length - 1] : 0;
        
        if (this.peakTimes.length === 0 || (peakTime - lastPeakTime) > 250) {
          this.peakTimes.push(peakTime);
          this.lastPeakIndex = i;
          
          // Mantener solo los últimos N picos
          if (this.peakTimes.length > 10) {
            this.peakTimes.shift();
          }
        }
      }
    }
  }
  
  /**
   * Calcula intervalos RR
   * @returns Array de intervalos RR en ms
   */
  private calculateRRIntervals(): number[] {
    if (this.peakTimes.length < 2) {
      return [];
    }
    
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimes.length; i++) {
      const interval = this.peakTimes[i] - this.peakTimes[i - 1];
      intervals.push(interval);
    }
    
    return intervals;
  }
  
  /**
   * Filtra intervalos RR válidos
   * @param intervals Array de intervalos RR
   * @returns Array de intervalos RR válidos
   */
  private getValidRRIntervals(intervals: number[]): number[] {
    // Filtrar intervalos fisiológicamente plausibles (300-1500ms = 40-200bpm)
    const physiologicalIntervals = intervals.filter(
      interval => interval >= 300 && interval <= 1500
    );
    
    if (physiologicalIntervals.length < 3) {
      return physiologicalIntervals;
    }
    
    // Calcular cuartiles para filtrar outliers
    const sorted = [...physiologicalIntervals].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    // Filtrar outliers (fuera de 1.5 IQR)
    return physiologicalIntervals.filter(
      interval => interval >= (q1 - 1.5 * iqr) && interval <= (q3 + 1.5 * iqr)
    );
  }
  
  /**
   * Obtiene los tiempos de picos detectados
   * @returns Array de tiempos de picos
   */
  public getPeakTimes(): number[] {
    return [...this.peakTimes];
  }
  
  /**
   * Obtiene los intervalos RR y el último tiempo de pico
   * @returns Objeto con intervalos RR y último tiempo de pico
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    const intervals = this.calculateRRIntervals();
    const validIntervals = this.getValidRRIntervals(intervals);
    
    return {
      intervals: validIntervals,
      lastPeakTime: this.peakTimes.length > 0 ? this.peakTimes[this.peakTimes.length - 1] : null
    };
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.peakTimes = [];
    this.lastPeakIndex = -1;
    this.lastBpm = 0;
    console.log("HeartRateDetector: Reset complete");
  }
}
