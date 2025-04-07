
/**
 * Implementación de Separación Ciega de Fuentes (BSS)
 * Utiliza Análisis de Componentes Independientes (ICA) para separar 
 * la señal cardíaca de otras fuentes de ruido
 */
export class BlindSourceSeparation {
  private signals: number[][] = [];
  private readonly BUFFER_SIZE = 200;
  private readonly MAX_ITERATIONS = 1000;
  private readonly CONVERGENCE_THRESHOLD = 1e-6;
  private mixingMatrix: number[][] | null = null;
  private unmixingMatrix: number[][] | null = null;
  private dominantSourceIndex: number = 0;
  
  /**
   * Añade una nueva muestra de señales a analizar
   * @param channels Array con valores de diferentes canales (RGB, por ejemplo)
   */
  public addSample(channels: number[]): void {
    if (this.signals.length === 0) {
      // Inicializar arrays para cada canal
      for (let i = 0; i < channels.length; i++) {
        this.signals.push([]);
      }
    }
    
    // Añadir valor a cada canal
    for (let i = 0; i < Math.min(channels.length, this.signals.length); i++) {
      this.signals[i].push(channels[i]);
      
      // Mantener tamaño de buffer
      if (this.signals[i].length > this.BUFFER_SIZE) {
        this.signals[i].shift();
      }
    }
  }
  
  /**
   * Realiza separación de fuentes cuando hay suficientes datos
   * @returns Objecto con fuentes separadas y matrices de mezcla
   */
  public performICA(): {
    success: boolean;
    sources: number[][];
    mixingMatrix: number[][] | null;
    unmixingMatrix: number[][] | null;
    dominantSourceIndex: number;
  } {
    // Verificar que tenemos suficientes datos
    if (this.signals.length < 2 || this.signals[0].length < 50) {
      return {
        success: false,
        sources: [],
        mixingMatrix: null,
        unmixingMatrix: null,
        dominantSourceIndex: 0
      };
    }
    
    try {
      // Paso 1: Centrar los datos
      const centeredSignals = this.centerData(this.signals);
      
      // Paso 2: Blanqueamiento (whitening)
      const { whitenedData, whiteningMatrix } = this.whitenData(centeredSignals);
      
      // Paso 3: Estimación de componentes independientes
      const { W, S } = this.fastICA(whitenedData);
      
      // Paso 4: Determinar la fuente dominante (probable señal cardíaca)
      this.dominantSourceIndex = this.findDominantSource(S);
      
      // Paso 5: Reconstrucción de matrices
      this.unmixingMatrix = this.multiplyMatrices(W, whiteningMatrix);
      this.mixingMatrix = this.invertMatrix(this.unmixingMatrix);
      
      return {
        success: true,
        sources: S,
        mixingMatrix: this.mixingMatrix,
        unmixingMatrix: this.unmixingMatrix,
        dominantSourceIndex: this.dominantSourceIndex
      };
    } catch (error) {
      console.error("BlindSourceSeparation: Error en ICA", error);
      return {
        success: false,
        sources: [],
        mixingMatrix: null,
        unmixingMatrix: null,
        dominantSourceIndex: 0
      };
    }
  }
  
  /**
   * Aplica la separación para obtener la señal cardíaca limpia
   * @param newSample Nueva muestra de señales (RGB)
   * @returns Señal cardíaca separada
   */
  public extractCardiacSignal(newSample: number[]): number | null {
    this.addSample(newSample);
    
    // Si no tenemos matriz de separación, intentar calcularla
    if (!this.unmixingMatrix) {
      const result = this.performICA();
      if (!result.success) return null;
    }
    
    // Si tenemos matriz, aplicarla a la muestra más reciente
    if (this.unmixingMatrix) {
      // Obtener última muestra
      const sample = newSample.map(v => v);
      
      // Aplicar transformación
      const sources: number[] = Array(this.unmixingMatrix.length).fill(0);
      
      for (let i = 0; i < sources.length; i++) {
        for (let j = 0; j < sample.length; j++) {
          sources[i] += this.unmixingMatrix[i][j] * sample[j];
        }
      }
      
      // Devolver componente dominante (señal cardíaca)
      return sources[this.dominantSourceIndex];
    }
    
    return null;
  }
  
  /**
   * Centra los datos restando la media
   */
  private centerData(data: number[][]): number[][] {
    const numChannels = data.length;
    const numSamples = data[0].length;
    const centeredData = Array(numChannels).fill(0).map(() => Array(numSamples).fill(0));
    
    // Calcular media para cada canal
    const means = data.map(channel => 
      channel.reduce((sum, val) => sum + val, 0) / numSamples
    );
    
    // Restar media
    for (let i = 0; i < numChannels; i++) {
      for (let j = 0; j < numSamples; j++) {
        centeredData[i][j] = data[i][j] - means[i];
      }
    }
    
    return centeredData;
  }
  
  /**
   * Blanquea los datos para decorrelacionarlos
   */
  private whitenData(data: number[][]): {
    whitenedData: number[][];
    whiteningMatrix: number[][];
  } {
    const numChannels = data.length;
    const numSamples = data[0].length;
    
    // Calcular matriz de covarianza
    const covMatrix = Array(numChannels).fill(0).map(() => Array(numChannels).fill(0));
    
    for (let i = 0; i < numChannels; i++) {
      for (let j = 0; j < numChannels; j++) {
        let sum = 0;
        for (let k = 0; k < numSamples; k++) {
          sum += data[i][k] * data[j][k];
        }
        covMatrix[i][j] = sum / numSamples;
      }
    }
    
    // Descomposición de autovalores simplificada
    // Nota: En una implementación real, esto debería usar SVD o eigendecomposition
    // Esta es una aproximación simple para demostración
    const eigenValues = [covMatrix[0][0], covMatrix[1][1]];
    const eigenVectors = [[1, 0], [0, 1]];
    
    // Matriz de blanqueamiento
    const whiteningMatrix = Array(numChannels).fill(0).map(() => Array(numChannels).fill(0));
    for (let i = 0; i < numChannels; i++) {
      for (let j = 0; j < numChannels; j++) {
        whiteningMatrix[i][j] = eigenVectors[i][j] / Math.sqrt(eigenValues[j]);
      }
    }
    
    // Aplicar blanqueamiento
    const whitenedData = Array(numChannels).fill(0).map(() => Array(numSamples).fill(0));
    
    for (let i = 0; i < numChannels; i++) {
      for (let j = 0; j < numSamples; j++) {
        for (let k = 0; k < numChannels; k++) {
          whitenedData[i][j] += whiteningMatrix[i][k] * data[k][j];
        }
      }
    }
    
    return { whitenedData, whiteningMatrix };
  }
  
  /**
   * Implementación FastICA para separación de fuentes
   */
  private fastICA(X: number[][]): { W: number[][], S: number[][] } {
    const m = X.length; // Número de canales
    const n = X[0].length; // Número de muestras
    
    // Inicializar matriz de separación con valores aleatorios
    const W = Array(m).fill(0).map(() => 
      Array(m).fill(0).map(() => Math.random() - 0.5)
    );
    
    // Ortonormalizar W
    this.orthogonalizeMatrix(W);
    
    // Matriz para almacenar las fuentes resultantes
    const S = Array(m).fill(0).map(() => Array(n).fill(0));
    
    // Algoritmo de punto fijo para cada componente
    for (let p = 0; p < this.MAX_ITERATIONS; p++) {
      const Wold = W.map(row => [...row]);
      
      // Actualizar cada vector de peso
      for (let i = 0; i < m; i++) {
        // Calcular g(WX) y g'(WX)
        let gWX = Array(n).fill(0);
        let gPrimeSum = 0;
        
        for (let j = 0; j < n; j++) {
          let dot = 0;
          for (let k = 0; k < m; k++) {
            dot += W[i][k] * X[k][j];
          }
          
          // Función g(x) = tanh(x)
          gWX[j] = Math.tanh(dot);
          // Derivada g'(x) = 1 - tanh^2(x)
          gPrimeSum += 1 - gWX[j] * gWX[j];
        }
        gPrimeSum /= n;
        
        // Actualizar vector de pesos
        for (let j = 0; j < m; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            let dot = 0;
            for (let l = 0; l < m; l++) {
              dot += W[i][l] * X[l][k];
            }
            sum += gWX[k] * X[j][k];
          }
          W[i][j] = sum / n - gPrimeSum * W[i][j];
        }
      }
      
      // Ortonormalizar W
      this.orthogonalizeMatrix(W);
      
      // Verificar convergencia
      let maxDiff = 0;
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          maxDiff = Math.max(maxDiff, Math.abs(W[i][j] - Wold[i][j]));
        }
      }
      
      if (maxDiff < this.CONVERGENCE_THRESHOLD) {
        break;
      }
    }
    
    // Calcular fuentes S = WX
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < m; k++) {
          S[i][j] += W[i][k] * X[k][j];
        }
      }
    }
    
    return { W, S };
  }
  
  /**
   * Ortonormaliza una matriz usando el método de Gram-Schmidt
   */
  private orthogonalizeMatrix(W: number[][]): void {
    const m = W.length;
    
    for (let i = 0; i < m; i++) {
      // Normalizar vector i
      let norm = 0;
      for (let j = 0; j < m; j++) {
        norm += W[i][j] * W[i][j];
      }
      norm = Math.sqrt(norm);
      
      for (let j = 0; j < m; j++) {
        W[i][j] /= norm;
      }
      
      // Ortogonalizar respecto a vectores previos
      for (let j = i + 1; j < m; j++) {
        let dot = 0;
        for (let k = 0; k < m; k++) {
          dot += W[i][k] * W[j][k];
        }
        
        for (let k = 0; k < m; k++) {
          W[j][k] -= dot * W[i][k];
        }
      }
    }
  }
  
  /**
   * Encuentra el índice de la fuente dominante (probable señal cardíaca)
   * basado en periodicidad y otras características fisiológicas
   */
  private findDominantSource(sources: number[][]): number {
    const m = sources.length;
    
    // Puntuaciones para cada fuente
    const scores = Array(m).fill(0);
    
    for (let i = 0; i < m; i++) {
      // Calcular autocorrelación para detectar periodicidad
      const autocorr = this.calculateAutocorrelation(sources[i]);
      
      // Buscar picos en la autocorrelación (indica periodicidad)
      const peaks = this.findPeaks(autocorr);
      
      // Calcular distancia entre picos (período)
      if (peaks.length >= 2) {
        const avgPeriod = this.calculateAveragePeriod(peaks);
        
        // Verificar si el período está en rango fisiológico (40-180 BPM)
        // Para una ventana de 200 samples a 30Hz, un período de 10-45 samples
        if (avgPeriod >= 10 && avgPeriod <= 45) {
          scores[i] += 1;
        }
        
        // Más regularidad en períodos = mejor puntuación
        const periodVariability = this.calculatePeriodVariability(peaks);
        scores[i] += 1 / (1 + periodVariability);
      }
      
      // Calcular curtosis (valores altos indican no-gaussianidad, característica de ICA)
      const kurtosis = this.calculateKurtosis(sources[i]);
      if (kurtosis > 0) {
        scores[i] += 0.5;
      }
    }
    
    // Devolver índice de la fuente con mayor puntuación
    let maxScore = -1;
    let maxIndex = 0;
    
    for (let i = 0; i < m; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i];
        maxIndex = i;
      }
    }
    
    return maxIndex;
  }
  
  /**
   * Calcula la autocorrelación de una señal
   */
  private calculateAutocorrelation(signal: number[]): number[] {
    const n = signal.length;
    const result = Array(n).fill(0);
    
    // Calcular media
    const mean = signal.reduce((sum, val) => sum + val, 0) / n;
    
    // Señal centrada
    const centered = signal.map(val => val - mean);
    
    // Calcular autocorrelación
    for (let lag = 0; lag < n; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += centered[i] * centered[i + lag];
      }
      result[lag] = sum;
    }
    
    // Normalizar
    const norm = result[0];
    return result.map(val => val / norm);
  }
  
  /**
   * Encuentra picos en una señal
   */
  private findPeaks(signal: number[]): number[] {
    const n = signal.length;
    const peaks: number[] = [];
    
    // Ignorar los primeros valores de autocorrelación (sesgo)
    for (let i = 5; i < n - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > 0.2) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcula período promedio entre picos
   */
  private calculateAveragePeriod(peaks: number[]): number {
    if (peaks.length < 2) return 0;
    
    let sum = 0;
    for (let i = 1; i < peaks.length; i++) {
      sum += peaks[i] - peaks[i - 1];
    }
    
    return sum / (peaks.length - 1);
  }
  
  /**
   * Calcula variabilidad de períodos
   */
  private calculatePeriodVariability(peaks: number[]): number {
    if (peaks.length < 3) return Infinity;
    
    const periods: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      periods.push(peaks[i] - peaks[i - 1]);
    }
    
    const mean = periods.reduce((sum, val) => sum + val, 0) / periods.length;
    const variance = periods.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / periods.length;
    
    return Math.sqrt(variance) / mean; // Coeficiente de variación
  }
  
  /**
   * Calcula curtosis (medida de no-gaussianidad)
   */
  private calculateKurtosis(signal: number[]): number {
    const n = signal.length;
    
    // Calcular media
    const mean = signal.reduce((sum, val) => sum + val, 0) / n;
    
    // Calcular varianza
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    
    // Calcular curtosis
    const kurtosis = signal.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / n / Math.pow(variance, 2) - 3;
    
    return kurtosis;
  }
  
  /**
   * Multiplica dos matrices
   */
  private multiplyMatrices(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = B[0].length;
    const p = B.length;
    
    const C = Array(m).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < p; k++) {
          C[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    
    return C;
  }
  
  /**
   * Invierte una matriz 2x2
   */
  private invertMatrix(A: number[][]): number[][] {
    // Implementación simple para matrices 2x2
    if (A.length !== 2 || A[0].length !== 2) {
      throw new Error("Solo se soportan matrices 2x2");
    }
    
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    
    if (Math.abs(det) < 1e-10) {
      throw new Error("Matriz singular, no invertible");
    }
    
    const B = [
      [A[1][1] / det, -A[0][1] / det],
      [-A[1][0] / det, A[0][0] / det]
    ];
    
    return B;
  }
  
  /**
   * Reinicia el estado
   */
  public reset(): void {
    this.signals = [];
    this.mixingMatrix = null;
    this.unmixingMatrix = null;
    this.dominantSourceIndex = 0;
  }
}
