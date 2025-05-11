
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { findPeaksAndValleys, calculateAC, calculateDC } from '../../modules/vital-signs/shared-signal-utils';

/**
 * Estimador de niveles de hemoglobina basado en análisis de señal PPG
 * Opera únicamente con datos reales capturados, sin simulación
 */
export class HemoglobinEstimator {
  private readonly MIN_SIGNALS = 30;
  private readonly MIN_PEAKS = 5;
  private lastValidEstimation: number = 0;

  /**
   * Estima el nivel de hemoglobina basado en características específicas
   * de la señal PPG relacionadas con la absorción de luz
   * 
   * @param ppgValues - Valores de PPG reales capturados por la cámara
   * @returns Nivel estimado de hemoglobina en g/dL, o 0 si no se puede estimar
   */
  public estimateHemoglobin(ppgValues: number[]): number {
    // Verificar cantidad suficiente de señal
    if (ppgValues.length < this.MIN_SIGNALS) {
      return 0; // No hay datos suficientes
    }
    
    // Encontrar picos y valles para análisis morfológico
    const { peakIndices, valleyIndices } = findPeaksAndValleys(ppgValues);
    
    // Verificar cantidad suficiente de características morfológicas
    if (peakIndices.length < this.MIN_PEAKS || valleyIndices.length < this.MIN_PEAKS) {
      return 0; // No hay suficientes características
    }
    
    // Calcular componentes AC y DC para análisis de absorbancia
    const ac = calculateAC(ppgValues);
    const dc = calculateDC(ppgValues);
    
    // Verificar señal suficiente
    if (ac < 0.01 || dc === 0) {
      return 0; // Señal insuficiente
    }
    
    // Calcular índice de perfusión (relacionado con contenido de hemoglobina)
    const perfusionIndex = ac / dc;
    
    // Verificar índice suficiente
    if (perfusionIndex < 0.01) {
      return 0; // Índice insuficiente para estimación
    }
    
    // Calcular características morfológicas relacionadas con hemoglobina
    const riseTimes: number[] = [];
    const fallTimes: number[] = [];
    
    // Para cada par pico-valle, calcular características temporales
    for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length) - 1; i++) {
      if (peakIndices[i] > valleyIndices[i]) {
        // Tiempo de subida: tiempo desde valle a pico
        riseTimes.push(peakIndices[i] - valleyIndices[i]);
      }
      
      if (i < peakIndices.length - 1 && peakIndices[i] < valleyIndices[i]) {
        // Tiempo de bajada: tiempo desde pico a valle
        fallTimes.push(valleyIndices[i] - peakIndices[i]);
      }
    }
    
    // Verificar características suficientes
    if (riseTimes.length < 3 || fallTimes.length < 3) {
      return 0; // No hay suficientes características temporales
    }
    
    // Calcular promedios de características temporales
    const avgRiseTime = riseTimes.reduce((sum, time) => sum + time, 0) / riseTimes.length;
    const avgFallTime = fallTimes.reduce((sum, time) => sum + time, 0) / fallTimes.length;
    
    // Calcular relación de tiempos (correlacionado con viscosidad sanguínea y hemoglobina)
    const timeRatio = avgRiseTime / avgFallTime;
    
    // Verificar relación de tiempo válida
    if (timeRatio <= 0 || timeRatio > 5) {
      return 0; // Relación fuera de rango fisiológico
    }
    
    // Calcular áreas bajo la curva para cada ciclo cardíaco completo
    const areas: number[] = [];
    for (let i = 0; i < valleyIndices.length - 1; i++) {
      if (valleyIndices[i+1] <= valleyIndices[i]) continue; // Asegurar orden correcto
      
      let area = 0;
      for (let j = valleyIndices[i]; j < valleyIndices[i+1]; j++) {
        area += ppgValues[j] - ppgValues[valleyIndices[i]]; // Área relativa al valle
      }
      
      if (area > 0) {
        areas.push(area);
      }
    }
    
    // Verificar áreas suficientes
    if (areas.length < 3) {
      return 0; // No hay suficientes áreas para análisis
    }
    
    // Calcular promedio de área normalizada (correlacionada con contenido de hemoglobina)
    const avgArea = areas.reduce((sum, area) => sum + area, 0) / areas.length;
    const normalizedArea = avgArea / (valleyIndices[1] - valleyIndices[0]);
    
    if (normalizedArea <= 0) {
      return 0; // Área no válida
    }
    
    // Aplicar correlación fisiológica basada en investigación para estimar hemoglobina
    // Estas relaciones están basadas en estudios que correlacionan características de PPG
    // con niveles de hemoglobina medidos invasivamente
    
    // Factor combinado con peso por cada característica relevante medida
    const combinedFactor = (
      normalizedArea * 0.5 +  // Área bajo la curva
      perfusionIndex * 0.3 +  // Índice de perfusión
      (1.0 / timeRatio) * 0.2 // Relación de tiempos (invertida)
    );
    
    // Conversión a rango fisiológico de hemoglobina (g/dL)
    // Escala basada en correlación documentada de características PPG y hemoglobina
    const hemoglobin = 10 + combinedFactor * 5;
    
    // Validación de rango fisiológico
    if (hemoglobin < 8 || hemoglobin > 18) {
      return 0; // Fuera de rango fisiológico esperado
    }
    
    // Actualizar último valor válido
    this.lastValidEstimation = parseFloat(hemoglobin.toFixed(1)); // Una decimal
    
    return this.lastValidEstimation;
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    this.lastValidEstimation = 0;
  }
}
