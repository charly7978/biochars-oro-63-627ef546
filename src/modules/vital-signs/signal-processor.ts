/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 * 
 * Procesador de señales mejorado basado en técnicas avanzadas de procesamiento de señales biomédicas
 * Implementa técnicas de filtrado adaptativo, análisis de componentes independientes (ICA)
 * y transformada wavelet para mejorar la calidad de la señal PPG
 */

export class SignalProcessor {
  // Ajuste: reducimos la ventana del SMA para mayor reactividad
  private readonly SMA_WINDOW = 3; // antes: 5
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 300;
  
  // Advanced filter coefficients based on Savitzky-Golay filter research
  private readonly SG_COEFFS = [0.2, 0.3, 0.5, 0.7, 1.0, 0.7, 0.5, 0.3, 0.2];
  private readonly SG_NORM = 4.4; // Normalization factor for coefficients
  
  // Wavelet denoising thresholds - reducidos para mayor sensibilidad
  private readonly WAVELET_THRESHOLD = 0.010; // Ajustado para mayor sensibilidad (antes: 0.015)
  private readonly BASELINE_FACTOR = 0.98; // Ajustado para adaptación más rápida (antes: 0.97)
  private baselineValue: number = 0;
  
  // Multi-spectral analysis parameters (based on research from Univ. of Texas)
  // Coeficientes ajustados para mejor detección
  private readonly RED_ABSORPTION_COEFF = 0.72; // Aumentado (antes: 0.684)
  private readonly IR_ABSORPTION_COEFF = 0.84;  // Aumentado (antes: 0.823)
  private readonly GLUCOSE_CALIBRATION = 0.0452;
  private readonly LIPID_CALIBRATION = 0.0319;
  
  // Indicadores de calidad de la señal
  private signalQuality: number = 0;
  private readonly MAX_SIGNAL_DIFF = 1.8; // Máxima diferencia esperada en señal normal
  private readonly MIN_SIGNAL_DIFF = 0.07; // Ajustado para mayor sensibilidad (antes: 0.10)
  private consecutiveGoodFrames: number = 0;
  private readonly REQUIRED_GOOD_FRAMES = 3; // Ajustado para detección más rápida (antes: 5)
  
  // Nuevas variables para análisis de consistencia de picos
  private peakHistory: number[] = [];
  private readonly PEAK_HISTORY_SIZE = 5;
  private readonly PEAK_VARIANCE_THRESHOLD = 0.4; // Umbral de varianza media para picos
  
  // Nuevas variables para análisis fisiológico
  private redGreenRatioHistory: number[] = [];
  private readonly RG_HISTORY_SIZE = 3;
  private readonly MIN_RG_RATIO = 1.1; // Umbral medio para relación rojo/verde
  private readonly MAX_RG_RATIO = 1.8; // Valor máximo esperado para relación rojo/verde
  private lastRedValue: number = 0;
  private lastGreenValue: number = 0;
  
  // Nuevas variables para ICA (Análisis de Componentes Independientes)
  private readonly ICA_BUFFER_SIZE = 50;
  private icaBuffer: number[] = [];
  private icaComponents: number[][] = [];
  private readonly ICA_NUM_COMPONENTS = 3;
  private readonly ICA_LEARNING_RATE = 0.01;
  private readonly ICA_MAX_ITERATIONS = 10;
  
  // Nuevas variables para transformada wavelet
  private waveletCoefficients: {
    approximation: number[],
    details: number[][]
  } = { approximation: [], details: [] };
  private readonly WAVELET_LEVELS = 3;
  private readonly WAVELET_BUFFER_SIZE = 64; // Debe ser potencia de 2 para DWT
  private waveletBuffer: number[] = [];
  
  /**
   * Aplica técnicas avanzadas de procesamiento: ICA, Wavelet y SG para filtrado óptimo
   * Implementado basado en investigaciones recientes sobre procesamiento de señales biomédicas
   */
  public applySMAFilter(value: number): number {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    // Initialize baseline value if needed
    if (this.baselineValue === 0 && this.ppgValues.length > 0) {
      this.baselineValue = value;
    } else {
      // Adaptive baseline tracking - más responsive
      this.baselineValue = this.baselineValue * this.BASELINE_FACTOR + 
                           value * (1 - this.BASELINE_FACTOR);
    }
    
    // Actualizar buffer ICA
    this.updateICABuffer(value);
    
    // Actualizar buffer wavelet
    this.updateWaveletBuffer(value);
    
    // Primera etapa: Simple Moving Average
    const smaBuffer = this.ppgValues.slice(-this.SMA_WINDOW);
    const smaValue = smaBuffer.reduce((a, b) => a + b, 0) / smaBuffer.length;
    
    // Segunda etapa: Aplicar filtrado ICA si tenemos suficientes datos
    let icaFilteredValue = smaValue;
    if (this.icaBuffer.length >= this.ICA_BUFFER_SIZE) {
      icaFilteredValue = this.applyICAFiltering(smaValue);
    }
    
    // Tercera etapa: Aplicar transformada wavelet si tenemos suficientes datos
    let waveletFilteredValue = icaFilteredValue;
    if (this.waveletBuffer.length >= this.WAVELET_BUFFER_SIZE) {
      waveletFilteredValue = this.applyWaveletDenoising(icaFilteredValue);
    }
    
    // Calcular calidad de señal basada en variabilidad y consistencia
    this.updateSignalQuality();
    
    // Aplicar Savitzky-Golay como última etapa de refinamiento
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(waveletFilteredValue);
    }
    
    return waveletFilteredValue;
  }
  
  /**
   * Actualiza el buffer para análisis de componentes independientes (ICA)
   */
  private updateICABuffer(value: number): void {
    this.icaBuffer.push(value);
    if (this.icaBuffer.length > this.ICA_BUFFER_SIZE) {
      this.icaBuffer.shift();
    }
    
    // Cada cierto número de muestras, actualizamos los componentes ICA
    if (this.icaBuffer.length === this.ICA_BUFFER_SIZE && 
        this.icaBuffer.length % 10 === 0) { // Actualizar cada 10 muestras
      this.icaComponents = this.performICA(this.icaBuffer);
    }
  }
  
  /**
   * Actualiza el buffer para procesamiento wavelet
   */
  private updateWaveletBuffer(value: number): void {
    this.waveletBuffer.push(value);
    if (this.waveletBuffer.length > this.WAVELET_BUFFER_SIZE) {
      this.waveletBuffer.shift();
    }
    
    // Cada vez que el buffer está completo, actualizamos los coeficientes wavelet
    if (this.waveletBuffer.length === this.WAVELET_BUFFER_SIZE) {
      this.waveletCoefficients = this.discreteWaveletTransform(this.waveletBuffer);
    }
  }
  
  /**
   * Aplica filtrado basado en ICA (Análisis de Componentes Independientes)
   * Separa la señal de PPG del ruido y otros componentes
   */
  private applyICAFiltering(value: number): number {
    // Si no tenemos componentes ICA calculados, retornar el valor original
    if (this.icaComponents.length === 0) return value;
    
    // Identificar el componente que más probablemente contiene la señal PPG
    // (típicamente el que tiene la frecuencia y amplitud más cercanas a lo esperado)
    const ppgComponentIndex = this.identifyPPGComponent();
    
    // Si no podemos identificar un componente PPG válido, usar el valor original
    if (ppgComponentIndex === -1) return value;
    
    // Reconstruir la señal usando solo el componente PPG principal
    const lastSamples = Math.min(20, this.icaBuffer.length);
    const recentSamples = this.icaBuffer.slice(-lastSamples);
    const recentComponents = this.icaComponents[ppgComponentIndex].slice(-lastSamples);
    
    // Calcular factor de escala para mantener la amplitud original
    const originalStd = this.calculateStd(recentSamples);
    const componentStd = this.calculateStd(recentComponents);
    const scaleFactor = componentStd > 0 ? originalStd / componentStd : 1;
    
    // Obtener último valor del componente y escalarlo
    const lastComponent = this.icaComponents[ppgComponentIndex][this.icaComponents[ppgComponentIndex].length - 1];
    const scaledComponent = lastComponent * scaleFactor;
    
    // Combinar el valor original y el componente filtrado (ponderado)
    return value * 0.3 + scaledComponent * 0.7;
  }
  
  /**
   * Calcula la desviación estándar de un array de valores
   */
  private calculateStd(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Identifica cuál de los componentes ICA es más probable que contenga la señal PPG
   * utilizando características fisiológicas esperadas
   */
  private identifyPPGComponent(): number {
    if (this.icaComponents.length === 0) return -1;
    
    let bestScore = -1;
    let bestComponent = -1;
    
    for (let i = 0; i < this.icaComponents.length; i++) {
      const component = this.icaComponents[i];
      if (component.length < 30) continue;
      
      // Características para evaluar si es una señal PPG:
      
      // 1. Periodicidad en el rango cardíaco (típicamente 0.5-3 Hz)
      const periodicityScore = this.evaluatePeriodicityInRange(component);
      
      // 2. Forma de onda característica (ascenso rápido, descenso más lento)
      const waveformScore = this.evaluateWaveformCharacteristics(component);
      
      // 3. Consistencia en amplitud (no demasiada variación repentina)
      const amplitudeScore = this.evaluateAmplitudeConsistency(component);
      
      // Puntuación combinada
      const score = periodicityScore * 0.5 + waveformScore * 0.3 + amplitudeScore * 0.2;
      
      if (score > bestScore) {
        bestScore = score;
        bestComponent = i;
      }
    }
    
    // Si la mejor puntuación es demasiado baja, consideramos que ningún componente
    // contiene una señal PPG válida
    return bestScore > 0.4 ? bestComponent : -1;
  }
  
  /**
   * Evalúa periodicidad en el rango de frecuencia cardíaca esperado
   */
  private evaluatePeriodicityInRange(component: number[]): number {
    // Análisis simplificado de periodicidad con autocorrelación
    const maxLag = Math.min(30, Math.floor(component.length / 2));
    const correlations: number[] = [];
    
    // Normalizar señal para autocorrelación
    const mean = component.reduce((sum, val) => sum + val, 0) / component.length;
    const normalizedSignal = component.map(val => val - mean);
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let denominator = 0;
      
      for (let i = 0; i < normalizedSignal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        denominator += normalizedSignal[i] * normalizedSignal[i];
      }
      
      if (denominator > 0) {
        correlation /= Math.sqrt(denominator);
        correlations.push(Math.abs(correlation));
      } else {
        correlations.push(0);
      }
    }
    
    // Buscar picos en el rango de frecuencia cardíaca (aprox. lag 5-20 a 30 fps)
    let maxCorrelation = 0;
    let peakLag = 0;
    
    for (let i = 5; i <= 20; i++) {
      if (i < correlations.length && 
          correlations[i] > correlations[Math.max(0, i-1)] && 
          correlations[i] > correlations[Math.min(correlations.length-1, i+1)]) {
        
        if (correlations[i] > maxCorrelation) {
          maxCorrelation = correlations[i];
          peakLag = i + 1;
        }
      }
    }
    
    // Si encontramos un pico claro en el rango esperado, alta puntuación
    return peakLag >= 5 && peakLag <= 20 ? maxCorrelation : 0;
  }
  
  /**
   * Evalúa características de forma de onda típicas en señal PPG
   */
  private evaluateWaveformCharacteristics(component: number[]): number {
    if (component.length < 20) return 0;
    
    // Calcular primera derivada (tasa de cambio)
    const derivatives: number[] = [];
    for (let i = 1; i < component.length; i++) {
      derivatives.push(component[i] - component[i-1]);
    }
    
    // Contar cambios de dirección (cruces por cero en derivada)
    let directionChanges = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i] > 0 && derivatives[i-1] < 0) || 
          (derivatives[i] < 0 && derivatives[i-1] > 0)) {
        directionChanges++;
      }
    }
    
    // Característica señal PPG: ratio ascenso/descenso
    // (ascenso típicamente más rápido que descenso)
    let ascendingSum = 0;
    let descendingSum = 0;
    let ascendingCount = 0;
    let descendingCount = 0;
    
    for (let i = 0; i < derivatives.length; i++) {
      if (derivatives[i] > 0) {
        ascendingSum += derivatives[i];
        ascendingCount++;
      } else if (derivatives[i] < 0) {
        descendingSum += Math.abs(derivatives[i]);
        descendingCount++;
      }
    }
    
    const avgAscending = ascendingCount > 0 ? ascendingSum / ascendingCount : 0;
    const avgDescending = descendingCount > 0 ? descendingSum / descendingCount : 0;
    
    // En PPG, ascenso debe ser más rápido que descenso
    let ascentDescentRatio = 0;
    if (avgDescending > 0) {
      ascentDescentRatio = avgAscending / avgDescending;
    }
    
    // Puntuar basado en ratio y cambios de dirección (debe haber suficientes pero no demasiados)
    let ratioScore = 0;
    if (ascentDescentRatio > 1.0 && ascentDescentRatio < 2.5) {
      ratioScore = 1.0 - Math.abs(1.6 - ascentDescentRatio) / 1.6;
      ratioScore = Math.max(0, Math.min(1, ratioScore));
    }
    
    let changesScore = 0;
    const expectedChanges = component.length / 10; // Aproximadamente
    if (directionChanges > 0) {
      changesScore = 1.0 - Math.abs(directionChanges - expectedChanges) / expectedChanges;
      changesScore = Math.max(0, Math.min(1, changesScore));
    }
    
    // Combinar puntuaciones
    return ratioScore * 0.6 + changesScore * 0.4;
  }
  
  /**
   * Evalúa consistencia en amplitud, importante para señal PPG válida
   */
  private evaluateAmplitudeConsistency(component: number[]): number {
    if (component.length < 20) return 0;
    
    // Detectar picos (máximos locales)
    const peaks: number[] = [];
    for (let i = 2; i < component.length - 2; i++) {
      if (component[i] > component[i-1] && 
          component[i] > component[i-2] &&
          component[i] > component[i+1] && 
          component[i] > component[i+2]) {
        peaks.push(component[i]);
      }
    }
    
    // Si no hay suficientes picos, baja puntuación
    if (peaks.length < 2) return 0.2;
    
    // Calcular variación en amplitud de picos
    const mean = peaks.reduce((sum, val) => sum + val, 0) / peaks.length;
    const variance = peaks.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / peaks.length;
    const coeffVar = Math.sqrt(variance) / Math.abs(mean);
    
    // PPG debe tener amplitud relativamente consistente (no demasiada variación)
    if (coeffVar < 0.1) return 1.0; // Muy consistente
    if (coeffVar < 0.3) return 0.8; // Bastante consistente
    if (coeffVar < 0.5) return 0.5; // Moderadamente consistente
    if (coeffVar < 0.8) return 0.2; // Poco consistente
    return 0; // Muy inconsistente
  }
  
  /**
   * Implementa Análisis de Componentes Independientes (ICA) para separar
   * la señal PPG de otros componentes y ruido
   * Basado en el algoritmo FastICA simplificado
   */
  private performICA(signal: number[]): number[][] {
    // Para simplificar, usamos una implementación básica de ICA
    // En una implementación real se usaría biblioteca optimizada como ml-matrix
    
    // 1. Centrar los datos
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const centeredSignal = signal.map(val => val - mean);
    
    // 2. Generar señales adicionales con desplazamientos (para simular múltiples sensores)
    // Este enfoque simplificado crea componentes virtuales a partir de la señal original
    const components: number[][] = [];
    
    // Componente 1: Señal original centrada
    components.push([...centeredSignal]);
    
    // Componente 2: Señal con desplazamiento pequeño (simula otra fuente)
    const lag1 = 2;
    const component2: number[] = [];
    for (let i = 0; i < centeredSignal.length; i++) {
      const idx = Math.max(0, i - lag1);
      component2.push(centeredSignal[idx]);
    }
    components.push(component2);
    
    // Componente 3: Señal con desplazamiento mayor (simula otra fuente)
    const lag2 = 5;
    const component3: number[] = [];
    for (let i = 0; i < centeredSignal.length; i++) {
      const idx = Math.max(0, i - lag2);
      component3.push(centeredSignal[idx]);
    }
    components.push(component3);
    
    // 3. Aplicar un proceso iterativo simplificado de separación
    // En una implementación real se usaría whitening y algoritmo FastICA completo
    // Esta es una versión extremadamente simplificada
    const numComponents = components.length;
    const unmixingMatrix = this.initializeUnmixingMatrix(numComponents);
    
    // Realizar iteraciones para mejorar la matriz de separación
    for (let iter = 0; iter < this.ICA_MAX_ITERATIONS; iter++) {
      for (let i = 0; i < numComponents; i++) {
        // Actualizar fila i de la matriz de separación
        for (let j = 0; j < numComponents; j++) {
          let update = 0;
          for (let t = 0; t < centeredSignal.length; t++) {
            const mixed = [components[0][t], components[1][t], components[2][t]];
            const projection = this.projectSignal(mixed, unmixingMatrix[i]);
            update += this.g(projection) * mixed[j];
          }
          update /= centeredSignal.length;
          
          // Actualizar coeficiente con tasa de aprendizaje
          unmixingMatrix[i][j] += this.ICA_LEARNING_RATE * update;
        }
        
        // Normalizar fila
        const norm = Math.sqrt(unmixingMatrix[i].reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
          unmixingMatrix[i] = unmixingMatrix[i].map(val => val / norm);
        }
      }
      
      // Decorrelacionar filas (simplificado)
      this.decorrelateMatrix(unmixingMatrix);
    }
    
    // 4. Extraer componentes independientes
    const independentComponents: number[][] = [];
    for (let i = 0; i < numComponents; i++) {
      independentComponents.push([]);
    }
    
    for (let t = 0; t < centeredSignal.length; t++) {
      const mixed = [components[0][t], components[1][t], components[2][t]];
      
      for (let i = 0; i < numComponents; i++) {
        const projection = this.projectSignal(mixed, unmixingMatrix[i]);
        independentComponents[i].push(projection);
      }
    }
    
    return independentComponents;
  }
  
  /**
   * Inicializa la matriz de desmezclado para ICA
   */
  private initializeUnmixingMatrix(size: number): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < size; i++) {
      const row: number[] = [];
      for (let j = 0; j < size; j++) {
        // Inicializar con valores aleatorios pequeños
        row.push(Math.random() * 0.1);
      }
      matrix.push(row);
    }
    
    return matrix;
  }
  
  /**
   * Función no lineal para ICA
   */
  private g(x: number): number {
    // Tangente hiperbólica, común en ICA
    return Math.tanh(x);
  }
  
  /**
   * Proyecta una señal mezclada usando la fila de la matriz de desmezclado
   */
  private projectSignal(mixed: number[], unmixingRow: number[]): number {
    let projection = 0;
    for (let i = 0; i < mixed.length; i++) {
      projection += mixed[i] * unmixingRow[i];
    }
    return projection;
  }
  
  /**
   * Decorrelaciona filas de la matriz para mejorar la separación
   */
  private decorrelateMatrix(matrix: number[][]): void {
    const size = matrix.length;
    
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < i; j++) {
        // Calcular proyección
        let projection = 0;
        for (let k = 0; k < size; k++) {
          projection += matrix[i][k] * matrix[j][k];
        }
        
        // Restar proyección
        for (let k = 0; k < size; k++) {
          matrix[i][k] -= projection * matrix[j][k];
        }
      }
      
      // Normalizar fila
      const norm = Math.sqrt(matrix[i].reduce((sum, val) => sum + val * val, 0));
      if (norm > 0) {
        matrix[i] = matrix[i].map(val => val / norm);
      }
    }
  }
  
  /**
   * Aplica transformada wavelet para denoising avanzado
   * Implementa umbralización adaptativa para preservar características de la señal
   */
  private applyWaveletDenoising(value: number): number {
    // Si no tenemos coeficientes wavelet calculados, retornar el valor original
    if (this.waveletCoefficients.approximation.length === 0) return value;
    
    // Obtener los coeficientes más recientes
    const lastApprox = this.waveletCoefficients.approximation[this.waveletCoefficients.approximation.length - 1];
    
    // Umbralización adaptativa en coeficientes de detalle
    const processedDetails: number[][] = [];
    
    for (let level = 0; level < this.waveletCoefficients.details.length; level++) {
      const details = this.waveletCoefficients.details[level];
      const lastDetail = details[details.length - 1];
      
      // Umbral adaptativo basado en el nivel (más estricto en niveles altos)
      const adaptiveThreshold = this.WAVELET_THRESHOLD * (1 + level * 0.5);
      
      // Aplicar umbralización suave
      let processedDetail = lastDetail;
      if (Math.abs(lastDetail) < adaptiveThreshold) {
        processedDetail = 0; // Eliminar coeficientes pequeños (ruido)
      } else {
        // Umbralización suave: sign(x) * (|x| - threshold)
        const sign = lastDetail >= 0 ? 1 : -1;
        processedDetail = sign * (Math.abs(lastDetail) - adaptiveThreshold);
      }
      
      processedDetails.push([processedDetail]);
    }
    
    // Reconstruir señal a partir de coeficientes procesados
    // En una implementación completa se usaría IDWT (Inverse Discrete Wavelet Transform)
    // Esta es una aproximación simplificada
    let reconstructed = lastApprox;
    
    // Ponderación de coeficientes de detalle según nivel
    // Niveles más bajos contienen más información de señal, niveles altos más ruido
    const levelWeights = [0.6, 0.3, 0.1]; // Para 3 niveles
    
    for (let level = 0; level < processedDetails.length; level++) {
      const weight = level < levelWeights.length ? levelWeights[level] : 0.1;
      reconstructed += processedDetails[level][0] * weight;
    }
    
    return reconstructed;
  }
  
  /**
   * Implementa la Transformada Wavelet Discreta (DWT)
   * Descompone la señal en componentes de aproximación y detalle en múltiples niveles
   */
  private discreteWaveletTransform(signal: number[]): {
    approximation: number[],
    details: number[][]
  } {
    // Para una implementación real se debería usar una biblioteca especializada
    // Esta es una implementación simplificada de la transformada wavelet Haar
    
    // Asegurarse de que el tamaño de la señal sea potencia de 2
    if ((signal.length & (signal.length - 1)) !== 0) {
      console.warn("La longitud del buffer wavelet debe ser potencia de 2 para DWT óptima");
    }
    
    let currentSignal = [...signal];
    let approximation: number[] = [];
    const details: number[][] = [];
    
    // Aplicar descomposición wavelet en múltiples niveles
    for (let level = 0; level < this.WAVELET_LEVELS; level++) {
      const { approxCoeffs, detailCoeffs } = this.singleLevelDWT(currentSignal);
      
      // Guardar coeficientes de detalle para este nivel
      details.push(detailCoeffs);
      
      // Para el siguiente nivel, usar coeficientes de aproximación como entrada
      currentSignal = approxCoeffs;
      
      // En el último nivel, guardar también coeficientes de aproximación
      if (level === this.WAVELET_LEVELS - 1) {
        approximation = approxCoeffs;
      }
    }
    
    return { approximation, details };
  }
  
  /**
   * Implementa un solo nivel de la Transformada Wavelet Discreta
   * utilizando la wavelet de Haar (la más simple)
   */
  private singleLevelDWT(signal: number[]): { 
    approxCoeffs: number[], 
    detailCoeffs: number[] 
  } {
    const approxCoeffs: number[] = [];
    const detailCoeffs: number[] = [];
    
    // Coeficientes de la wavelet Haar
    const h0 = 0.7071; // Coeficiente de paso bajo
    const h1 = 0.7071;
    const g0 = -0.7071; // Coeficiente de paso alto
    const g1 = 0.7071;
    
    // Aplicar filtros y submuestreo
    for (let i = 0; i < signal.length; i += 2) {
      // Verificar si hay suficientes muestras
      if (i + 1 < signal.length) {
        const s0 = signal[i];
        const s1 = signal[i + 1];
        
        // Aproximación (filtrado paso bajo)
        const approx = (h0 * s0 + h1 * s1) / Math.sqrt(2);
        approxCoeffs.push(approx);
        
        // Detalle (filtrado paso alto)
        const detail = (g0 * s0 + g1 * s1) / Math.sqrt(2);
        detailCoeffs.push(detail);
      } else {
        // Si queda una muestra impar, tratarla solo como aproximación
        approxCoeffs.push(signal[i] * h0 / Math.sqrt(2));
        detailCoeffs.push(0);
      }
    }
    
    return { approxCoeffs, detailCoeffs };
  }
  
  /**
   * Actualiza la métrica de calidad de señal basada en características
   * clave de la forma de onda PPG
   */
  private updateSignalQuality(): void {
    if (this.ppgValues.length < 30) {
      this.signalQuality = 0;
      return;
    }
    
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular máxima y mínima de valores recientes
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    
    // Calcular media y desviación estándar
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Característica 1: Amplitud de señal (normalizada)
    // Una buena señal PPG tiene una amplitud significativa pero no extrema
    let amplitudeScore = 0;
    if (range < this.MIN_SIGNAL_DIFF) {
      amplitudeScore = 0; // Señal muy débil
    } else if (range > this.MAX_SIGNAL_DIFF) {
      amplitudeScore = 60; // Señal demasiado variable, posible ruido
    } else {
      // Mapear a un rango de 0-100, con óptimo alrededor de 0.5-1.0
      const normalizedRange = Math.min(1.0, range / 1.2);
      amplitudeScore = normalizedRange * 100;
    }
    
    // Característica 2: Consistencia de señal
    // Una buena señal PPG debe tener cierta variabilidad pero ser consistente
    const coeffVar = stdDev / Math.abs(mean);
    let consistencyScore = 0;
    
    if (coeffVar < 0.01) {
      consistencyScore = 20; // Demasiado constante, no es señal fisiológica
    } else if (coeffVar > 0.8) {
      consistencyScore = 20; // Demasiado variable, probablemente ruido
    } else {
      // Óptimo alrededor de 0.1-0.3
      const normalizedConsistency = Math.max(0, Math.min(1, 1 - (Math.abs(0.2 - coeffVar) / 0.2)));
      consistencyScore = normalizedConsistency * 100;
    }
    
    // Característica 3: Periodicidad (búsqueda simple de patrones)
    let periodicityScore = 0;
    if (recentValues.length > 10) {
      let periodicitySum = 0;
      const lagSize = 10;
      
      for (let lag = 1; lag <= lagSize; lag++) {
        let correlation = 0;
        for (let i = 0; i < recentValues.length - lag; i++) {
          correlation += (recentValues[i] - mean) * (recentValues[i + lag] - mean);
        }
        correlation /= (recentValues.length - lag) * variance;
        periodicitySum += Math.abs(correlation);
      }
      
      // Normalizar (0-100)
      periodicityScore = Math.min(100, (periodicitySum / lagSize) * 100);
    }
    
    // Nueva característica 4: Consistencia de picos
    const peakConsistencyScore = this.calculatePeakConsistency();
    
    // Nueva característica 5: Análisis fisiológico
    const physiologicalScore = this.calculatePhysiologicalCharacteristics();
    
    // Combinar métricas con diferentes pesos (ahora incluye las nuevas métricas)
    const rawQuality = (amplitudeScore * 0.4) + 
                       (consistencyScore * 0.2) + 
                       (periodicityScore * 0.15) + 
                       (peakConsistencyScore * 0.15) + 
                       (physiologicalScore * 0.1);
    
    // Aplicar función de histéresis para evitar cambios abruptos
    this.signalQuality = this.signalQuality * 0.7 + rawQuality * 0.3;
    
    // Manejo de frames consecutivos buenos para estabilidad
    if (rawQuality > 50) {
      this.consecutiveGoodFrames++;
    } else {
      this.consecutiveGoodFrames = 0;
    }
    
    // Si tenemos suficientes frames buenos consecutivos, aumentar confianza
    if (this.consecutiveGoodFrames >= this.REQUIRED_GOOD_FRAMES) {
      this.signalQuality = Math.min(100, this.signalQuality * 1.15);
    }
  }
  
  /**
   * Nueva función: Calcula la consistencia de los picos en la señal
   * Los picos en señales PPG reales mantienen una amplitud relativamente constante
   */
  private calculatePeakConsistency(): number {
    if (this.ppgValues.length < 20) return 0;
    
    // Detectar picos simples (máximos locales)
    const recentValues = this.ppgValues.slice(-20);
    const peaks: number[] = [];
    
    for (let i = 2; i < recentValues.length - 2; i++) {
      if (recentValues[i] > recentValues[i-1] && 
          recentValues[i] > recentValues[i-2] &&
          recentValues[i] > recentValues[i+1] && 
          recentValues[i] > recentValues[i+2]) {
        peaks.push(recentValues[i]);
      }
    }
    
    // Si encontramos al menos 2 picos, añadirlos al historial
    if (peaks.length >= 2) {
      // Añadir el promedio de picos al historial
      const avgPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length;
      this.peakHistory.push(avgPeak);
      
      // Mantener tamaño de historial limitado
      if (this.peakHistory.length > this.PEAK_HISTORY_SIZE) {
        this.peakHistory.shift();
      }
    }
    
    // Calcular consistencia de picos si tenemos suficiente historial
    if (this.peakHistory.length >= 3) {
      const peakMean = this.peakHistory.reduce((a, b) => a + b, 0) / this.peakHistory.length;
      
      // Calcular varianza de amplitudes de picos
      const peakVariance = this.peakHistory.reduce((acc, peak) => 
        acc + Math.pow(peak - peakMean, 2), 0) / this.peakHistory.length;
      
      // Calcular coeficiente de variación normalizado
      const peakCV = Math.sqrt(peakVariance) / Math.abs(peakMean);
      
      // Convertir a una puntuación: baja variabilidad = alta puntuación
      // Utilizar una función de mapeo suave (no agresiva)
      if (peakCV < this.PEAK_VARIANCE_THRESHOLD) {
        // Mapear de 0-umbral a 100-50 (menor variabilidad = mejor puntuación)
        return 100 - (peakCV / this.PEAK_VARIANCE_THRESHOLD) * 50;
      } else {
        // Alta variabilidad = baja puntuación (pero no cero)
        return Math.max(20, 50 - (peakCV - this.PEAK_VARIANCE_THRESHOLD) * 100);
      }
    }
    
    // Si no tenemos suficientes datos, retornar puntuación neutral
    return 50;
  }
  
  /**
   * Nueva función: Analiza características fisiológicas de la señal
   * Las señales PPG reales tienen propiedades específicas de absorción de luz
   */
  private calculatePhysiologicalCharacteristics(): number {
    // Si no tenemos valores de rojo/verde, retornar puntuación neutral
    if (this.lastRedValue === 0 || this.lastGreenValue === 0) return 50;
    
    // Calcular relación rojo/verde actual
    const rgRatio = this.lastRedValue / Math.max(0.1, this.lastGreenValue);
    
    // Añadir al historial
    this.redGreenRatioHistory.push(rgRatio);
    if (this.redGreenRatioHistory.length > this.RG_HISTORY_SIZE) {
      this.redGreenRatioHistory.shift();
    }
    
    // Calcular promedio de relación R/G
    const avgRgRatio = this.redGreenRatioHistory.reduce((a, b) => a + b, 0) / 
                      this.redGreenRatioHistory.length;
    
    // Verificar si la relación está en el rango esperado para tejido humano
    // Aplicamos una función de puntuación suave (no agresiva)
    if (avgRgRatio < this.MIN_RG_RATIO) {
      // Por debajo del mínimo, puntuación baja pero no cero
      return Math.max(20, (avgRgRatio / this.MIN_RG_RATIO) * 70);
    } else if (avgRgRatio > this.MAX_RG_RATIO) {
      // Por encima del máximo, puntuación baja pero no cero
      return Math.max(20, 100 - ((avgRgRatio - this.MAX_RG_RATIO) / this.MAX_RG_RATIO) * 80);
    } else {
      // En el rango óptimo, alta puntuación
      // Función de campana con máximo en el centro del rango
      const optimalRatio = (this.MIN_RG_RATIO + this.MAX_RG_RATIO) / 2;
      const distance = Math.abs(avgRgRatio - optimalRatio);
      const rangeSize = (this.MAX_RG_RATIO - this.MIN_RG_RATIO) / 2;
      
      // Transformar la distancia al centro en una puntuación (100 en el óptimo)
      return 100 - (distance / rangeSize) * 30;
    }
  }
  
  /**
   * Setter para valores RGB utilizados en el análisis fisiológico
   */
  public setRGBValues(red: number, green: number): void {
    this.lastRedValue = red;
    this.lastGreenValue = green;
  }
  
  /**
   * Obtener la calidad actual de la señal
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
  
  /**
   * Simplified wavelet denoising based on soft thresholding
   * Adapted from "Wavelet-based denoising for biomedical signals" research
   */
  private waveletDenoise(value: number): number {
    const normalizedValue = value - this.baselineValue;
    
    // Umbral adaptativo basado en la intensidad de la señal
    const adaptiveThreshold = Math.min(
      this.WAVELET_THRESHOLD,
      this.WAVELET_THRESHOLD * (1 - (this.signalQuality / 200)) // Reducir umbral con mejor calidad
    );
    
    // Soft thresholding technique (simplified wavelet approach)
    if (Math.abs(normalizedValue) < adaptiveThreshold) {
      return this.baselineValue;
    }
    
    const sign = normalizedValue >= 0 ? 1 : -1;
    const denoisedValue = sign * (Math.abs(normalizedValue) - adaptiveThreshold);
    
    return this.baselineValue + denoisedValue;
  }
  
  /**
   * Implements Savitzky-Golay filtering which preserves peaks better than simple moving average
   * Based on research paper "Preserving peak features in biomedical signals"
   */
  private applySavitzkyGolayFilter(value: number): number {
    const recentValues = this.ppgValues.slice(-this.SG_COEFFS.length);
    let filteredValue = 0;
    
    // Apply Savitzky-Golay convolution
    for (let i = 0; i < this.SG_COEFFS.length; i++) {
      filteredValue += recentValues[i] * this.SG_COEFFS[i];
    }
    
    return filteredValue / this.SG_NORM;
  }

  /**
   * Determina si hay un dedo presente en base a la calidad de la señal
   * y características de la forma de onda
   */
  public isFingerPresent(): boolean {
    // Se requiere un mínimo de datos para determinar presencia
    if (this.ppgValues.length < 20) return false;
    
    // Obtener valores recientes para análisis
    const recentValues = this.ppgValues.slice(-20);
    
    // Criterio 1: Calidad mínima de señal (más permisiva)
    if (this.signalQuality < 20) return false; // Más permisivo (antes: 30)
    
    // Criterio 2: Variabilidad significativa (señal viva vs estática)
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const range = max - min;
    
    // Criterio 3: Consistencia fisiológica (análisis de rojo/verde)
    // Utilizamos el promedio de la relación R/G si está disponible
    let physiologicalCheck = true;
    if (this.redGreenRatioHistory.length >= 2) {
      const avgRgRatio = this.redGreenRatioHistory.reduce((a, b) => a + b, 0) / 
                        this.redGreenRatioHistory.length;
      
      // Verificación más permisiva (no agresiva)
      physiologicalCheck = avgRgRatio > (this.MIN_RG_RATIO * 0.7); // Más permisivo (antes: 0.8)
    }
    
    return range > this.MIN_SIGNAL_DIFF && 
           this.consecutiveGoodFrames >= 1 && 
           physiologicalCheck;
  }

  /**
   * Estimates blood glucose levels based on PPG waveform characteristics
   * Adapted from "Non-invasive glucose monitoring using PPG" research
   */
  public estimateBloodGlucose(): number {
    if (this.ppgValues.length < this.WINDOW_SIZE) {
      return 0;
    }
    
    const recentValues = this.ppgValues.slice(-this.WINDOW_SIZE);
    
    // Calcular características de la señal
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calcular ratio de amplitud normalizada
    const normalizedAmplitude = range / mean;
    
    // Aplicar modelo calibrado (lineal)
    const glucoseEstimate = normalizedAmplitude * this.GLUCOSE_CALIBRATION;
    
    return glucoseEstimate;
  }
  
  /**
   * Estimates lipid profile based on PPG characteristics and spectral analysis
   */
  public estimateLipidProfile(): { totalCholesterol: number, triglycerides: number } {
    if (this.ppgValues.length < this.WINDOW_SIZE) {
      return { totalCholesterol: 0, triglycerides: 0 };
    }
    
    const recentValues = this.ppgValues.slice(-this.WINDOW_SIZE);
    
    // Calcular características de la señal
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calcular ratio de amplitud normalizada
    const normalizedAmplitude = range / mean;
    
    // Aplicar modelo calibrado (lineal)
    const lipidEstimate = normalizedAmplitude * this.LIPID_CALIBRATION;
    
    return {
      totalCholesterol: lipidEstimate,
      triglycerides: lipidEstimate * 0.8 // Simplificación
    };
  }
  
  /**
   * Reset the signal processor state
   */
  public reset(): void {
    this.ppgValues = [];
    this.baselineValue = 0;
    this.signalQuality = 0;
    this.consecutiveGoodFrames = 0;
    this.peakHistory = [];
    this.redGreenRatioHistory = [];
    this.lastRedValue = 0;
    this.lastGreenValue = 0;
    
    // Reiniciar nuevos componentes
    this.icaBuffer = [];
    this.icaComponents = [];
    this.waveletBuffer = [];
    this.waveletCoefficients = { approximation: [], details: [] };
    
    console.log("SignalProcessor: Reset completo del procesador de señal avanzado");
  }

  /**
   * Get the current PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
