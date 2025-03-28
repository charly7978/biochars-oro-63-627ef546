/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

import { calculateVariance } from '../vital-signs/utils';
import { EventType, eventBus } from '../events/EventBus';
import { BloodPressureProcessor } from '../vital-signs/blood-pressure-processor';

export interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    display: string;
  };
  arrhythmiaStatus: string;
  reliability: number;
  timestamp: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    windows?: {start: number; end: number}[];
    detected?: boolean;
  };
}

export class VitalSignsProcessor {
  private ppgValues: number[] = [];
  private rrIntervals: number[] = [];
  private lastRRIntervals: number[] = [];
  private lastHeartRate: number = 60;
  private lastSPO2: number = 98;
  private lastArrhythmiaStatus: string = "NORMAL";
  private lastBloodPressure: string = "120/80";
  private lastPeakTime: number | null = null;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    windows?: {start: number; end: number}[];
    detected?: boolean;
  } | null = null;
  private arrhythmiaLearningData: number[] = [];
  private arrhythmiaBaseline: number = 0;
  private bloodPressureProcessor: BloodPressureProcessor = new BloodPressureProcessor();
  private isLearning: boolean = true;
  private learningStartTime: number = 0;

  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05; // Aumentado de 1.02 a 1.05 para mejor calibración
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Reducido de 0.05 a 0.045 para mayor sensibilidad
  private readonly SPO2_WINDOW = 8; // Reducido de 10 a 8 para respuesta más rápida
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 22; // Reducido de 25 a 22 para mejor detección de arritmias
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2500; // Reducido de 3000 a 2500 ms
  private readonly PEAK_THRESHOLD = 0.28; // Reducido de 0.3 a 0.28 para mayor sensibilidad
  
  constructor() {
    this.learningStartTime = Date.now();
  }
  
  /**
   * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
   * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
   * 
   * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
   * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
   * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
   */
  
  public processSignal(ppgValue: number, rrData?: { intervals: number[]; lastPeakTime: number | null }): VitalSignsResult {
    this.ppgValues.push(ppgValue);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    if (rrData && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
    }
    
    if (this.isLearning && (Date.now() - this.learningStartTime) < this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.arrhythmiaLearningData.push(ppgValue);
      if (this.arrhythmiaLearningData.length > 250) {
        this.arrhythmiaLearningData.shift();
      }
    } else if (this.isLearning) {
      this.isLearning = false;
      this.arrhythmiaBaseline = this.calculateBaseline();
      console.log("Aprendizaje completado, baseline:", this.arrhythmiaBaseline);
    }
    
    const smoothedPPG = this.applySimpleMovingAverage(this.ppgValues, this.SMA_WINDOW);
    const spo2 = this.calculateSPO2(smoothedPPG);
    const rrIntervals = this.filterAndSmoothRRIntervals(this.rrIntervals, this.RR_WINDOW_SIZE);
    const heartRate = rrIntervals.length > 0 ? Math.round(60000 / (rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length)) : this.lastHeartRate;
    
    const bloodPressure = this.bloodPressureProcessor.calculateBloodPressure(heartRate, this.ppgValues);
    
    const arrhythmiaResult = this.processArrhythmia(Date.now());
    
    this.lastHeartRate = heartRate;
    this.lastSPO2 = spo2;
    this.lastBloodPressure = bloodPressure;
    this.lastRRIntervals = rrIntervals;
    this.lastArrhythmiaStatus = arrhythmiaResult.arrhythmiaStatus;
    this.lastArrhythmiaData = arrhythmiaResult.arrhythmiaData;
    
    const reliability = this.calculateReliability(spo2, heartRate, arrhythmiaResult.arrhythmiaStatus);
    
    return {
      heartRate: this.lastHeartRate,
      spo2: this.lastSPO2,
      bloodPressure: {
        systolic: parseInt(bloodPressure.split('/')[0]),
        diastolic: parseInt(bloodPressure.split('/')[1]),
        display: bloodPressure
      },
      arrhythmiaStatus: this.lastArrhythmiaStatus,
      reliability: reliability,
      timestamp: Date.now(),
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }
  
  private calculateReliability(spo2: number, heartRate: number, arrhythmiaStatus: string): number {
    let reliability = 70;
    
    if (spo2 < 90) {
      reliability -= 10;
    }
    if (heartRate < 50 || heartRate > 120) {
      reliability -= 10;
    }
    if (arrhythmiaStatus !== "NORMAL") {
      reliability -= 15;
    }
    
    return Math.max(10, Math.min(95, reliability));
  }
  
  private applySimpleMovingAverage(data: number[], windowSize: number): number[] {
    const sma: number[] = [];
    for (let i = windowSize - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        sum += data[j];
      }
      sma.push(sum / windowSize);
    }
    return sma;
  }
  
  private calculateSPO2(smoothedPPG: number[]): number {
    if (smoothedPPG.length < this.SPO2_WINDOW) {
      return this.lastSPO2;
    }
    
    const recentPPG = smoothedPPG.slice(-this.SPO2_WINDOW);
    const maxValue = Math.max(...recentPPG);
    const minValue = Math.min(...recentPPG);
    
    let perfusionIndex = 0;
    if (maxValue !== 0) {
      perfusionIndex = minValue / maxValue;
    }
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      console.warn("Índice de perfusión bajo:", perfusionIndex);
      return this.lastSPO2;
    }
    
    let spo2 = 100 - (perfusionIndex * 100) * this.SPO2_CALIBRATION_FACTOR;
    spo2 = Math.max(85, Math.min(100, spo2));
    return Math.round(spo2);
  }
  
  private filterAndSmoothRRIntervals(rrIntervals: number[], windowSize: number): number[] {
    const filteredIntervals = rrIntervals.filter(interval => interval > 300 && interval < 1500);
    const smoothedIntervals: number[] = [];
    
    for (let i = windowSize - 1; i < filteredIntervals.length; i++) {
      let sum = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        sum += filteredIntervals[j];
      }
      smoothedIntervals.push(sum / windowSize);
    }
    
    return smoothedIntervals;
  }
  
  private calculateBaseline(): number {
    if (this.arrhythmiaLearningData.length === 0) {
      return 0;
    }
    return this.arrhythmiaLearningData.reduce((a, b) => a + b, 0) / this.arrhythmiaLearningData.length;
  }
  
  private processArrhythmia(timestamp: number): {
    arrhythmiaStatus: string;
    arrhythmiaData: {
      timestamp: number;
      rmssd: number;
      rrVariation: number;
      windows?: {start: number; end: number}[];
      detected?: boolean;
    } | null;
  } {
    if (this.rrIntervals.length < 2) {
      return {
        arrhythmiaStatus: "INSUFICIENTE",
        arrhythmiaData: null
      };
    }
    
    let detectedWindows: {start: number; end: number}[] = [];
    let hasArrhythmia = false;
    
    const rmssd = this.calculateRMSSD(this.rrIntervals);
    const rrVariation = calculateVariance(this.rrIntervals);
    
    let arrhythmiaStatus = "NORMAL";
    
    if (rmssd > this.RMSSD_THRESHOLD) {
      arrhythmiaStatus = "ALERTA";
      hasArrhythmia = true;
      detectedWindows.push({start: 0, end: this.rrIntervals.length});
    }
    
    return {
      arrhythmiaStatus,
      arrhythmiaData: {
        timestamp,
        rmssd,
        rrVariation,
        windows: detectedWindows,
        detected: hasArrhythmia
      }
    };
  }
  
  private calculateRMSSD(rrIntervals: number[]): number {
    let rmsd = 0;
    for (let i = 0; i < rrIntervals.length - 1; i++) {
      rmsd += Math.pow(rrIntervals[i + 1] - rrIntervals[i], 2);
    }
    return Math.sqrt(rmsd / (rrIntervals.length - 1));
  }
  
  public reset() {
    this.ppgValues = [];
    this.rrIntervals = [];
    this.lastRRIntervals = [];
    this.lastHeartRate = 60;
    this.lastSPO2 = 98;
    this.lastArrhythmiaStatus = "NORMAL";
    this.lastBloodPressure = "120/80";
    this.lastPeakTime = null;
    this.bloodPressureProcessor.reset();
    this.arrhythmiaLearningData = [];
    this.arrhythmiaBaseline = 0;
    this.isLearning = true;
    this.learningStartTime = Date.now();
  }
  
  public fullReset(): void {
    this.reset();
  }
  
  /**
   * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
   * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
   * 
   * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
   * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
   * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
   */
}
