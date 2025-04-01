
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Administrador de calibración para signos vitales
 * Permite aprender y aplicar factores de calibración individuales
 */

import { VitalSignType } from '../../../types/signal';
import { v4 as uuidv4 } from 'uuid';

// Estructura para los datos de referencia
export interface CalibrationReference {
  spo2?: number;
  systolic?: number;
  diastolic?: number;
  glucose?: number;
  cholesterol?: number;
  triglycerides?: number;
  heartRate?: number;
  timestamp: number;
}

// Factores de calibración resultantes
export interface CalibrationFactors {
  spo2: number;
  bloodPressure: number;
  glucose: number;
  lipids: number;
  cardiac: number;
  lastUpdated: number;
  confidence: number;
}

/**
 * Administrador de calibración para signos vitales
 * Aprende de mediciones de referencia y ajusta los valores medidos
 */
export class CalibrationManager {
  private static instance: CalibrationManager;
  private id: string;
  private calibrationFactors: CalibrationFactors;
  private referenceData: CalibrationReference[] = [];
  private readonly MAX_REFERENCES = 5;
  private isCalibrated: boolean = false;
  
  /**
   * Constructor privado para singleton
   */
  private constructor() {
    this.id = `calibration-${uuidv4().substring(0, 8)}`;
    
    // Inicializar con factores neutrales (1.0)
    this.calibrationFactors = {
      spo2: 1.0,
      bloodPressure: 1.0,
      glucose: 1.0,
      lipids: 1.0,
      cardiac: 1.0,
      lastUpdated: Date.now(),
      confidence: 0
    };
    
    console.log("CalibrationManager: Inicializado con ID", this.id);
  }
  
  /**
   * Obtener instancia única
   */
  public static getInstance(): CalibrationManager {
    if (!CalibrationManager.instance) {
      CalibrationManager.instance = new CalibrationManager();
    }
    return CalibrationManager.instance;
  }
  
  /**
   * Agregar datos de referencia para calibración
   * @param reference Datos de referencia médicos
   * @returns True si se agregó correctamente
   */
  public addReferenceData(reference: CalibrationReference): boolean {
    // Validar que tenga al menos un valor
    const hasValidData = 
      reference.spo2 !== undefined ||
      reference.systolic !== undefined ||
      reference.diastolic !== undefined ||
      reference.glucose !== undefined ||
      reference.cholesterol !== undefined ||
      reference.triglycerides !== undefined ||
      reference.heartRate !== undefined;
    
    if (!hasValidData) {
      console.warn("CalibrationManager: Se intentó agregar referencia sin datos válidos");
      return false;
    }
    
    // Agregar timestamp si no tiene
    if (!reference.timestamp) {
      reference.timestamp = Date.now();
    }
    
    // Agregar datos de referencia
    this.referenceData.push(reference);
    
    // Mantener solo las referencias más recientes
    if (this.referenceData.length > this.MAX_REFERENCES) {
      this.referenceData.shift();
    }
    
    // Recalcular factores de calibración
    this.calculateCalibrationFactors();
    
    console.log("CalibrationManager: Datos de referencia agregados", {
      totalReferences: this.referenceData.length,
      isCalibrated: this.isCalibrated
    });
    
    return true;
  }
  
  /**
   * Calcular factores de calibración basados en las referencias
   */
  private calculateCalibrationFactors(): void {
    if (this.referenceData.length === 0) {
      this.isCalibrated = false;
      return;
    }
    
    // Necesitamos al menos 2 referencias para una calibración confiable
    if (this.referenceData.length >= 2) {
      this.isCalibrated = true;
    }
    
    // Calcular factores específicos para cada tipo de signo vital
    let spo2Factor = 1.0;
    let bpFactor = 1.0;
    let glucoseFactor = 1.0;
    let lipidsFactor = 1.0;
    let cardiacFactor = 1.0;
    
    // Contador de factores por tipo
    let spo2Count = 0;
    let bpCount = 0;
    let glucoseCount = 0;
    let lipidsCount = 0;
    let cardiacCount = 0;
    
    // Calcular promedio de factores de las últimas referencias
    for (const ref of this.referenceData) {
      // Calcular factor SpO2
      if (ref.spo2 !== undefined) {
        // Usar valores teóricos aproximados para comparación
        const theoreticalSpo2 = 97; // Valor teórico estimado
        spo2Factor += ref.spo2 / theoreticalSpo2;
        spo2Count++;
      }
      
      // Calcular factor presión arterial
      if (ref.systolic !== undefined && ref.diastolic !== undefined) {
        // Usar valores teóricos aproximados para comparación
        const theoreticalSystolic = 120; // Valor teórico estimado
        const theoreticalDiastolic = 80; // Valor teórico estimado
        
        const systolicFactor = ref.systolic / theoreticalSystolic;
        const diastolicFactor = ref.diastolic / theoreticalDiastolic;
        
        // Promediar factores de sistólica y diastólica
        bpFactor += (systolicFactor + diastolicFactor) / 2;
        bpCount++;
      }
      
      // Calcular factor glucosa
      if (ref.glucose !== undefined) {
        // Usar valores teóricos aproximados para comparación
        const theoreticalGlucose = 100; // Valor teórico estimado mg/dL
        glucoseFactor += ref.glucose / theoreticalGlucose;
        glucoseCount++;
      }
      
      // Calcular factor lípidos
      if (ref.cholesterol !== undefined || ref.triglycerides !== undefined) {
        let lipidFactor = 0;
        let lipidCount = 0;
        
        if (ref.cholesterol !== undefined) {
          const theoreticalCholesterol = 180; // Valor teórico estimado mg/dL
          lipidFactor += ref.cholesterol / theoreticalCholesterol;
          lipidCount++;
        }
        
        if (ref.triglycerides !== undefined) {
          const theoreticalTriglycerides = 150; // Valor teórico estimado mg/dL
          lipidFactor += ref.triglycerides / theoreticalTriglycerides;
          lipidCount++;
        }
        
        if (lipidCount > 0) {
          lipidsFactor += lipidFactor / lipidCount;
          lipidsCount++;
        }
      }
      
      // Calcular factor cardíaco
      if (ref.heartRate !== undefined) {
        // Usar valores teóricos aproximados para comparación
        const theoreticalHeartRate = 70; // Valor teórico estimado BPM
        cardiacFactor += ref.heartRate / theoreticalHeartRate;
        cardiacCount++;
      }
    }
    
    // Calcular promedios finales si hay datos suficientes
    if (spo2Count > 0) {
      spo2Factor = spo2Factor / spo2Count;
    }
    
    if (bpCount > 0) {
      bpFactor = bpFactor / bpCount;
    }
    
    if (glucoseCount > 0) {
      glucoseFactor = glucoseFactor / glucoseCount;
    }
    
    if (lipidsCount > 0) {
      lipidsFactor = lipidsFactor / lipidsCount;
    }
    
    if (cardiacCount > 0) {
      cardiacFactor = cardiacFactor / cardiacCount;
    }
    
    // Calcular confianza basada en cantidad de referencias
    const confidence = Math.min(1.0, this.referenceData.length / this.MAX_REFERENCES);
    
    // Actualizar factores de calibración
    this.calibrationFactors = {
      spo2: spo2Factor,
      bloodPressure: bpFactor,
      glucose: glucoseFactor,
      lipids: lipidsFactor,
      cardiac: cardiacFactor,
      lastUpdated: Date.now(),
      confidence
    };
    
    console.log("CalibrationManager: Factores de calibración actualizados", {
      spo2Factor,
      bpFactor,
      glucoseFactor,
      lipidsFactor,
      cardiacFactor,
      confidence
    });
  }
  
  /**
   * Aplicar calibración a un valor medido
   * @param type Tipo de signo vital
   * @param value Valor original medido
   * @returns Valor calibrado
   */
  public applyCalibration(type: VitalSignType, value: number): number {
    if (!this.isCalibrated || value === 0) {
      return value;
    }
    
    let factor = 1.0;
    
    // Seleccionar factor correspondiente
    switch (type) {
      case VitalSignType.SPO2:
        factor = this.calibrationFactors.spo2;
        break;
      case VitalSignType.BLOOD_PRESSURE:
        factor = this.calibrationFactors.bloodPressure;
        break;
      case VitalSignType.GLUCOSE:
        factor = this.calibrationFactors.glucose;
        break;
      case VitalSignType.LIPIDS:
        factor = this.calibrationFactors.lipids;
        break;
      case VitalSignType.CARDIAC:
        factor = this.calibrationFactors.cardiac;
        break;
    }
    
    // Aplicar factor con suavizado
    // Usamos una combinación ponderada por la confianza
    const confidence = this.calibrationFactors.confidence;
    const calibratedValue = value * (factor * confidence + (1 - confidence));
    
    return calibratedValue;
  }
  
  /**
   * Verificar si el sistema está calibrado
   */
  public isSystemCalibrated(): boolean {
    return this.isCalibrated;
  }
  
  /**
   * Obtener factores de calibración actuales
   */
  public getCalibrationFactors(): CalibrationFactors {
    return { ...this.calibrationFactors };
  }
  
  /**
   * Obtener nivel de confianza de la calibración
   */
  public getCalibrationConfidence(): number {
    return this.calibrationFactors.confidence;
  }
  
  /**
   * Reiniciar calibración
   */
  public resetCalibration(): void {
    this.referenceData = [];
    this.isCalibrated = false;
    
    // Restablecer factores a valores neutrales
    this.calibrationFactors = {
      spo2: 1.0,
      bloodPressure: 1.0,
      glucose: 1.0,
      lipids: 1.0,
      cardiac: 1.0,
      lastUpdated: Date.now(),
      confidence: 0
    };
    
    console.log("CalibrationManager: Calibración reiniciada");
  }
}
