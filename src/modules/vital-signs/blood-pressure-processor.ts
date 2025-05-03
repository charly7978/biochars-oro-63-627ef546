import { 
  calculateStandardDeviation, 
  normalizeValues, 
  findPeaksAndValleys,
  estimateSignalQuality
} from './shared-signal-utils';

// Constantes fisiológicas
const MIN_SYSTOLIC = 80;
const MAX_SYSTOLIC = 200;
const MIN_DIASTOLIC = 50;
const MAX_DIASTOLIC = 120;
const DEFAULT_SYSTOLIC = NaN; // Default to NaN
const DEFAULT_DIASTOLIC = NaN;

export class BloodPressureProcessor {
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  private lastSystolic: number = NaN;
  private lastDiastolic: number = NaN;
  private confidence: number = 0;
  // No bpModel property needed anymore

  constructor() {
    this.reset(); // Initialize state
  }

  /**
   * Estima la presión arterial usando características de la onda PPG.
   * ADVERTENCIA: Este método es una GRAN SIMPLIFICACIÓN y NO es clínicamente preciso
   * sin calibración extensa y/o sensores adicionales (como ECG para PTT).
   * Los resultados son experimentales y NO deben usarse para fines médicos.
   * @param ppgValues Array de valores de señal PPG (filtrada).
   * @returns Objeto con { systolic: number | NaN, diastolic: number | NaN }.
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number | typeof NaN; diastolic: number | typeof NaN } {
    // Necesita suficientes datos de buena calidad
    const signalQuality = estimateSignalQuality(ppgValues); // Estimar calidad
    if (!ppgValues || ppgValues.length < 50 || signalQuality < 40) { // Requerir calidad mínima
      this.confidence = 0;
      return { systolic: NaN, diastolic: NaN };
    }

    // --- Lógica basada en características PPG (Placeholder / Experimental) --- 
    // Normalizar señal para análisis de forma de onda
    const normalized = normalizeValues(ppgValues); 
    if (normalized.every(v => v === 0)) return { systolic: NaN, diastolic: NaN }; // Normalization failed

    const { peakIndices, valleyIndices } = findPeaksAndValleys(normalized);

    if (peakIndices.length < 3 || valleyIndices.length < 3) { // Need enough features
      this.confidence = 0.1;
      return { systolic: NaN, diastolic: NaN };
    }

    // Calcular tiempo de subida promedio (Pulse Wave Velocity proxy - muy simplificado)
    const riseTimes: number[] = [];
    let lastValleyIdx = -1;
    for (const peakIdx of peakIndices) {
        // Find the valley immediately preceding this peak
        let precedingValleyIdx = -1;
        for(let j = valleyIndices.length - 1; j >= 0; j--) {
            if (valleyIndices[j] < peakIdx && valleyIndices[j] > lastValleyIdx) {
                precedingValleyIdx = valleyIndices[j];
                break;
            }
        }
        if (precedingValleyIdx !== -1) {
            const riseTime = peakIdx - precedingValleyIdx; // In samples
            // Basic plausibility check for rise time (e.g., 5 to 50 samples @30fps)
            if (riseTime > 1 && riseTime < 50) { 
                riseTimes.push(riseTime);
            }
            lastValleyIdx = precedingValleyIdx; // Ensure we don't reuse valleys
        }
    }

    if (riseTimes.length < 2) { // Need at least a few valid rise times
        this.confidence = 0.15;
        return { systolic: NaN, diastolic: NaN };
    }

    // Usar mediana del tiempo de subida para robustez
    const sortedRiseTimes = [...riseTimes].sort((a,b) => a - b);
    const medianRiseTime = sortedRiseTimes[Math.floor(sortedRiseTimes.length / 2)];
    
    // Fórmulas inversas (Placeholder - REQUIERE CALIBRACIÓN REAL)
    // Idea: Tiempo de subida más corto ~ mayor rigidez arterial ~ mayor PA
    // Estos factores (160, 2, 100, 1) son arbitrarios y necesitan calibración.
    const estimatedSystolic = 160 - medianRiseTime * 1.8; 
    const estimatedDiastolic = 100 - medianRiseTime * 0.9; 

    // Validar y limitar resultados
    const systolic = Math.max(MIN_SYSTOLIC, Math.min(MAX_SYSTOLIC, estimatedSystolic));
    const diastolic = Math.max(MIN_DIASTOLIC, Math.min(MAX_DIASTOLIC, estimatedDiastolic));

    if (systolic <= diastolic || isNaN(systolic) || isNaN(diastolic)) { 
        this.confidence = 0.1;
        return { systolic: NaN, diastolic: NaN }; // Resultado fisiológicamente inválido
    }
    
    // Calcular confianza basada en calidad de señal y estabilidad de riseTime
    const riseTimeStdDev = calculateStandardDeviation(riseTimes);
    const riseTimeCV = medianRiseTime > 0 ? riseTimeStdDev / medianRiseTime : 1;
    const stabilityScore = Math.max(0, 1 - riseTimeCV * 3); // Penalizar alta variabilidad
    this.confidence = Math.max(0.1, Math.min(0.6, (signalQuality / 100) * 0.5 + stabilityScore * 0.5)); // Confianza baja/moderada

    this.updateBuffers(systolic, diastolic);
    const smoothed = this.getSmoothedPressure();
    
    // Devolver NaN si el resultado suavizado es inválido
    if (isNaN(smoothed.systolic) || isNaN(smoothed.diastolic)) {
        return { systolic: NaN, diastolic: NaN };
    }

    return { systolic: smoothed.systolic, diastolic: smoothed.diastolic };
  }
  
  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    if (this.systolicBuffer.length > this.BUFFER_SIZE) {
      this.systolicBuffer.shift();
    }
    if (this.diastolicBuffer.length > this.BUFFER_SIZE) {
      this.diastolicBuffer.shift();
    }
  }

  private getSmoothedPressure(): { systolic: number, diastolic: number } {
    const smoothedSystolic = this.systolicBuffer.length > 0
      ? this.systolicBuffer.reduce((a, b) => a + b, 0) / this.systolicBuffer.length
      : NaN;
    const smoothedDiastolic = this.diastolicBuffer.length > 0
      ? this.diastolicBuffer.reduce((a, b) => a + b, 0) / this.diastolicBuffer.length
      : NaN;
    
    // Use Math.round for final integer values
    return {
        systolic: Math.round(smoothedSystolic),
        diastolic: Math.round(smoothedDiastolic)
    };
  }

  // calculateMedian might not be needed if using array median logic directly
  /*
  private calculateMedian(sortedArray: number[]): number {
    // ... 
  }
  */

  public getConfidence(): number {
     return this.confidence;
  }

  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastSystolic = NaN; // Reset to NaN
    this.lastDiastolic = NaN; // Reset to NaN
    this.confidence = 0;
    console.log("Blood Pressure Processor Reset");
  }
}
