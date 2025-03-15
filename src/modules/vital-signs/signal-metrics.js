
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

/**
 * Clase para el cálculo y administración de métricas de la señal PPG
 */
export class SignalMetrics {
  private readonly WINDOW_SIZE = 300;
  private readonly PEAK_THRESHOLD = 0.3;
  
  private ppgValues = [];
  private lastValue = 0;
  
  /**
   * Almacena un nuevo valor PPG en el buffer
   * @param value Valor PPG procesado
   */
  storeValue(value) {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    this.lastValue = value;
  }
  
  /**
   * Obtiene los valores más recientes de la señal
   * @param count Cantidad de valores a obtener
   * @returns Arreglo con los valores más recientes
   */
  getRecentValues(count = 60) {
    return this.ppgValues.slice(-count);
  }
  
  /**
   * Detecta un pico en la señal PPG
   * @param value Valor actual de la señal
   * @param lastPeakTime Timestamp del último pico detectado
   * @returns Si se detectó un pico
   */
  detectPeak(value, lastPeakTime) {
    const currentTime = Date.now();
    if (lastPeakTime === null) {
      if (value > this.PEAK_THRESHOLD) {
        return { detected: true, timestamp: currentTime };
      }
      return { detected: false, timestamp: null };
    }

    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (value > this.PEAK_THRESHOLD && timeSinceLastPeak > 500) {
      return { detected: true, timestamp: currentTime };
    }
    return { detected: false, timestamp: null };
  }
  
  /**
   * Calcula la desviación estándar de un conjunto de valores
   * @param values Valores para calcular la desviación
   * @returns Desviación estándar
   */
  calculateStandardDeviation(values) {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSqDiff);
  }
  
  /**
   * Reinicia las métricas de señal
   */
  reset() {
    this.ppgValues = [];
    this.lastValue = 0;
  }
}
