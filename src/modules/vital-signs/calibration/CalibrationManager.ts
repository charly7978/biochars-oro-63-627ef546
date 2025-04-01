/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES...
 * Administrador de calibración para signos vitales.
 * Permite aprender y aplicar factores de calibración individuales.
 */
import { VitalSignType } from '../../../types/signal';
import { v4 as uuidv4 } from 'uuid';

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

export interface CalibrationFactors {
  spo2: number;
  bloodPressure: number;
  glucose: number;
  lipids: number;
  cardiac: number;
  lastUpdated: number;
  confidence: number;
}

export class CalibrationManager {
  private static instance: CalibrationManager;
  private id: string;
  private calibrationFactors: CalibrationFactors;
  private referenceData: CalibrationReference[] = [];
  private readonly MAX_REFERENCES = 5;
  private isCalibrated: boolean = false;
  
  private constructor() {
    this.id = `calibration-${uuidv4().substring(0, 8)}`;
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
  
  public static getInstance(): CalibrationManager {
    if (!CalibrationManager.instance) {
      CalibrationManager.instance = new CalibrationManager();
    }
    return CalibrationManager.instance;
  }
  
  public addReferenceData(reference: CalibrationReference): boolean {
    const hasValidData = 
      reference.spo2 !== undefined ||
      reference.systolic !== undefined ||
      reference.diastolic !== undefined ||
      reference.glucose !== undefined ||
      reference.cholesterol !== undefined ||
      reference.triglycerides !== undefined ||
      reference.heartRate !== undefined;
    
    if (!hasValidData) {
      console.warn("CalibrationManager: Referencia sin datos válidos");
      return false;
    }
    
    if (!reference.timestamp) {
      reference.timestamp = Date.now();
    }
    
    this.referenceData.push(reference);
    if (this.referenceData.length > this.MAX_REFERENCES) {
      this.referenceData.shift();
    }
    
    this.calculateCalibrationFactors();
    
    console.log("CalibrationManager: Referencia agregada", {
      totalReferences: this.referenceData.length,
      isCalibrated: this.isCalibrated
    });
    
    return true;
  }
  
  private calculateCalibrationFactors(): void {
    if (this.referenceData.length === 0) {
      this.isCalibrated = false;
      return;
    }
    if (this.referenceData.length >= 2) {
      this.isCalibrated = true;
    }
    
    let spo2Factor = 0;
    let bpFactor = 0;
    let glucoseFactor = 0;
    let lipidsFactor = 0;
    let cardiacFactor = 0;
    let spo2Count = 0, bpCount = 0, glucoseCount = 0, lipidsCount = 0, cardiacCount = 0;
    
    for (const ref of this.referenceData) {
      if (ref.spo2 !== undefined) {
        const theoreticalSpo2 = 97;
        spo2Factor += ref.spo2 / theoreticalSpo2;
        spo2Count++;
      }
      if (ref.systolic !== undefined && ref.diastolic !== undefined) {
        const theoreticalSystolic = 120;
        const theoreticalDiastolic = 80;
        const systolicFactor = ref.systolic / theoreticalSystolic;
        const diastolicFactor = ref.diastolic / theoreticalDiastolic;
        bpFactor += (systolicFactor + diastolicFactor) / 2;
        bpCount++;
      }
      if (ref.glucose !== undefined) {
        const theoreticalGlucose = 100;
        glucoseFactor += ref.glucose / theoreticalGlucose;
        glucoseCount++;
      }
      if (ref.cholesterol !== undefined || ref.triglycerides !== undefined) {
        let lipidFactor = 0;
        let lipidCount = 0;
        if (ref.cholesterol !== undefined) {
          const theoreticalCholesterol = 180;
          lipidFactor += ref.cholesterol / theoreticalCholesterol;
          lipidCount++;
        }
        if (ref.triglycerides !== undefined) {
          const theoreticalTriglycerides = 150;
          lipidFactor += ref.triglycerides / theoreticalTriglycerides;
          lipidCount++;
        }
        if (lipidCount > 0) {
          lipidsFactor += lipidFactor / lipidCount;
          lipidsCount++;
        }
      }
      if (ref.heartRate !== undefined) {
        const theoreticalHeartRate = 70;
        cardiacFactor += ref.heartRate / theoreticalHeartRate;
        cardiacCount++;
      }
    }
    
    spo2Factor = spo2Count > 0 ? spo2Factor / spo2Count : 1.0;
    bpFactor = bpCount > 0 ? bpFactor / bpCount : 1.0;
    glucoseFactor = glucoseCount > 0 ? glucoseFactor / glucoseCount : 1.0;
    lipidsFactor = lipidsCount > 0 ? lipidsFactor / lipidsCount : 1.0;
    cardiacFactor = cardiacCount > 0 ? cardiacFactor / cardiacCount : 1.0;
    
    const confidence = Math.min(1.0, this.referenceData.length / this.MAX_REFERENCES);
    
    // Aplicar suavizado para evitar amplificaciones excesivas:
    this.calibrationFactors = {
      spo2: 0.5 + spo2Factor * 0.5,
      bloodPressure: 0.5 + bpFactor * 0.5,
      glucose: 0.5 + glucoseFactor * 0.5,
      lipids: 0.5 + lipidsFactor * 0.5,
      cardiac: 0.5 + cardiacFactor * 0.5,
      lastUpdated: Date.now(),
      confidence
    };
    
    console.log("CalibrationManager: Factores actualizados", {
      spo2Factor: this.calibrationFactors.spo2,
      bpFactor: this.calibrationFactors.bloodPressure,
      glucoseFactor: this.calibrationFactors.glucose,
      lipidsFactor: this.calibrationFactors.lipids,
      cardiacFactor: this.calibrationFactors.cardiac,
      confidence
    });
  }
  
  public applyCalibration(type: VitalSignType, value: number): number {
    if (!this.isCalibrated || value === 0) return value;
    let factor = 1.0;
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
    const confidence = this.calibrationFactors.confidence;
    const calibratedValue = value * (factor * confidence + (1 - confidence));
    return calibratedValue;
  }
  
  public isSystemCalibrated(): boolean {
    return this.isCalibrated;
  }
  
  public getCalibrationFactors(): CalibrationFactors {
    return { ...this.calibrationFactors };
  }
  
  public getCalibrationConfidence(): number {
    return this.calibrationFactors.confidence;
  }
  
  public resetCalibration(): void {
    this.referenceData = [];
    this.isCalibrated = false;
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
