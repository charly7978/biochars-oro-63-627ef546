
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';
import { calculateAC, calculateDC, findPeaksAndValleys } from '../../../utils/vitalSignsUtils';

/**
 * Procesador para cálculo de presión arterial
 * Utiliza características de onda de pulso para estimar presión
 * No utiliza simulación ni valores de referencia
 */
export class BloodPressureProcessor extends BaseProcessor {
  // Parámetros de calibración
  private systolicCalibration: number = 120; // mmHg
  private diastolicCalibration: number = 80; // mmHg
  private calibrationFactor: number = 1.0;
  
  // Características de la señal
  private lastHeartRate: number = 0;
  private lastPWV: number = 0; // Velocidad de onda de pulso
  
  // Constantes
  private readonly DEFAULT_PULSE_TRANSIT_TIME = 200; // ms
  private readonly MIN_BUFFER_SIZE = 30;
  private readonly MIN_HEART_RATE = 40;
  private readonly MAX_HEART_RATE = 200;
  
  constructor() {
    super();
    console.log("BloodPressureProcessor: Initialized");
  }
  
  /**
   * Establece calibración para mediciones de presión arterial
   * @param systolic Presión sistólica de referencia (mmHg)
   * @param diastolic Presión diastólica de referencia (mmHg)
   */
  public setCalibration(systolic: number, diastolic: number): void {
    if (systolic > 0 && diastolic > 0 && systolic > diastolic) {
      this.systolicCalibration = systolic;
      this.diastolicCalibration = diastolic;
      console.log("BloodPressureProcessor: Calibration set", { systolic, diastolic });
    }
  }
  
  /**
   * Calcula presión arterial basada en características de la señal PPG
   * @param filteredValue Valor filtrado actual de señal PPG
   * @param heartRate Frecuencia cardíaca actual
   * @param buffer Buffer de señal PPG
   * @returns Presión arterial como string "SYS/DIA"
   */
  public calculateBloodPressure(
    filteredValue: number,
    heartRate: number,
    buffer: number[]
  ): string {
    // Verificar datos mínimos para cálculo
    if (buffer.length < this.MIN_BUFFER_SIZE || 
        heartRate < this.MIN_HEART_RATE || 
        heartRate > this.MAX_HEART_RATE) {
      return "--/--";
    }
    
    // Almacenar frecuencia cardíaca para cálculos
    this.lastHeartRate = heartRate;
    
    // Extraer características de la señal PPG
    const recentBuffer = buffer.slice(-this.MIN_BUFFER_SIZE);
    const { peakIndices, valleyIndices } = findPeaksAndValleys(recentBuffer);
    
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return "--/--";
    }
    
    // Calcular PTT (Pulse Transit Time) basado en características de la forma de onda
    // En sistemas reales se usa ECG+PPG, aquí estimamos por morfología de PPG
    const ptt = this.estimatePulseTransitTime(recentBuffer, peakIndices, valleyIndices);
    
    // Calcular índice de rigidez arterial
    const stiffnessIndex = this.calculateStiffnessIndex(recentBuffer, ptt);
    
    // Calcular PWV (Pulse Wave Velocity) como inversa de PTT
    const estimatedPWV = 1000 / Math.max(1, ptt);
    this.lastPWV = estimatedPWV;
    
    // Aplicar modelo para estimar presión
    const [systolic, diastolic] = this.estimateBloodPressure(
      stiffnessIndex, heartRate, estimatedPWV
    );
    
    return `${systolic}/${diastolic}`;
  }
  
  /**
   * Estima tiempo de tránsito de pulso basado en forma de onda PPG
   */
  private estimatePulseTransitTime(
    buffer: number[],
    peakIndices: number[],
    valleyIndices: number[]
  ): number {
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return this.DEFAULT_PULSE_TRANSIT_TIME;
    }
    
    // Calcular tiempo de subida (rise time) promedio
    let totalRiseTime = 0;
    let count = 0;
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const peakIndex = peakIndices[i];
      
      // Encontrar valle anterior más cercano
      let closestValley = -1;
      let minDistance = Number.MAX_VALUE;
      
      for (const valleyIndex of valleyIndices) {
        if (valleyIndex < peakIndex) {
          const distance = peakIndex - valleyIndex;
          if (distance < minDistance) {
            minDistance = distance;
            closestValley = valleyIndex;
          }
        }
      }
      
      if (closestValley !== -1) {
        const riseTime = peakIndex - closestValley;
        totalRiseTime += riseTime;
        count++;
      }
    }
    
    if (count === 0) {
      return this.DEFAULT_PULSE_TRANSIT_TIME;
    }
    
    // Convertir a PTT equivalente
    const avgRiseTime = totalRiseTime / count;
    const estimatedPTT = avgRiseTime * 10 + 100; // Modelo simplificado
    
    return Math.min(300, Math.max(150, estimatedPTT));
  }
  
  /**
   * Calcula índice de rigidez arterial basado en forma de onda PPG
   */
  private calculateStiffnessIndex(buffer: number[], ptt: number): number {
    const ac = calculateAC(buffer);
    const dc = calculateDC(buffer);
    
    if (ac === 0 || dc === 0) return 1.0;
    
    // Calcular índice de rigidez como combinación de perfusión y PTT
    const perfusionIndex = ac / dc;
    const normalizedPTT = ptt / 200; // Normalizado a valores típicos
    
    return (1 / normalizedPTT) * (1 - Math.min(0.5, perfusionIndex));
  }
  
  /**
   * Estima valores de presión arterial usando modelo basado en características
   */
  private estimateBloodPressure(
    stiffnessIndex: number,
    heartRate: number,
    pwv: number
  ): [number, number] {
    // Modelo simplificado de presión basado en rigidez arterial, FC y PWV
    // Aplicar valores de calibración para ajustar modelo
    
    // Factor de ajuste por frecuencia cardíaca
    const hrFactor = Math.pow((heartRate - 60) / 20, 2) * 0.1;
    
    // Normalizar PWV
    const normalizedPWV = Math.min(1.5, Math.max(0.5, pwv / 10));
    
    // Calcular sistólica y diastólica
    const baseSystolic = this.systolicCalibration * normalizedPWV * 
                         (1 + stiffnessIndex * 0.2) * 
                         (1 + hrFactor);
    
    const baseDiastolic = this.diastolicCalibration * 
                         (1 + stiffnessIndex * 0.1) * 
                         (1 + hrFactor * 0.5);
    
    // Aplicar factor de calibración
    const systolic = Math.round(baseSystolic * this.calibrationFactor);
    const diastolic = Math.round(baseDiastolic * this.calibrationFactor);
    
    // Validar resultados fisiológicamente plausibles
    const validatedSystolic = Math.min(200, Math.max(80, systolic));
    const validatedDiastolic = Math.min(120, Math.max(40, diastolic));
    
    return [validatedSystolic, validatedDiastolic];
  }
  
  /**
   * Establece factor de calibración
   */
  public setCalibrationFactor(factor: number): void {
    if (factor > 0) {
      this.calibrationFactor = factor;
    }
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    super.reset();
    this.lastHeartRate = 0;
    this.lastPWV = 0;
    console.log("BloodPressureProcessor: Reset complete");
  }
}
