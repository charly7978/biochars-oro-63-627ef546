
/**
 * Calculador de Signos Vitales
 * Implementa algoritmos finales de cálculo para cada signo vital
 */

import { EventType, eventBus } from '../events/EventBus';
import { OptimizedHeartRateData, OptimizedSpO2Data, OptimizedBloodPressureData, OptimizedGlucoseData, OptimizedLipidData, OptimizedArrhythmiaData } from '../optimization/SignalOptimizer';

// Resultado final de signos vitales
export interface VitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    display: string;
  };
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  arrhythmiaStatus: string;
  lastArrhythmiaData?: OptimizedArrhythmiaData;
  confidence: {
    heartRate: number;
    spo2: number;
    bloodPressure: number;
    glucose: number;
    lipids: number;
  };
}

export class VitalSignsCalculator {
  // Estado
  private isCalculating: boolean = false;
  private lastResult: VitalSignsResult | null = null;
  
  // Datos intermedios para cálculos
  private lastHeartRate: OptimizedHeartRateData | null = null;
  private lastSpO2: OptimizedSpO2Data | null = null;
  private lastBloodPressure: OptimizedBloodPressureData | null = null;
  private lastGlucose: OptimizedGlucoseData | null = null;
  private lastLipids: OptimizedLipidData | null = null;
  private lastArrhythmia: OptimizedArrhythmiaData | null = null;
  
  // Configuración de cálculo
  private readonly UPDATE_INTERVAL = 500; // ms
  private updateTimer: number | null = null;
  
  /**
   * Iniciar cálculos
   */
  startCalculating(): void {
    if (this.isCalculating) return;
    
    this.isCalculating = true;
    this.reset();
    
    // Suscribirse a señales optimizadas
    eventBus.subscribe(EventType.OPTIMIZED_HEART_RATE, this.handleHeartRate.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_SPO2, this.handleSpO2.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_BLOOD_PRESSURE, this.handleBloodPressure.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_GLUCOSE, this.handleGlucose.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_LIPIDS, this.handleLipids.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_ARRHYTHMIA, this.handleArrhythmia.bind(this));
    
    // Iniciar bucle de actualización
    this.startUpdateLoop();
    
    console.log('Calculador de signos vitales iniciado');
  }
  
  /**
   * Detener cálculos
   */
  stopCalculating(): void {
    this.isCalculating = false;
    
    if (this.updateTimer !== null) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log('Calculador de signos vitales detenido');
  }
  
  /**
   * Reiniciar estado
   */
  reset(): void {
    this.lastHeartRate = null;
    this.lastSpO2 = null;
    this.lastBloodPressure = null;
    this.lastGlucose = null;
    this.lastLipids = null;
    this.lastArrhythmia = null;
    
    // Mantener último resultado completo para comparación
    // pero marcar como no válido para nuevos cálculos
    if (this.lastResult) {
      this.lastResult = {
        ...this.lastResult,
        confidence: {
          heartRate: 0,
          spo2: 0,
          bloodPressure: 0,
          glucose: 0,
          lipids: 0
        }
      };
    }
  }
  
  /**
   * Iniciar bucle de actualización periódica
   */
  private startUpdateLoop(): void {
    if (!this.isCalculating) return;
    
    // Calcular y publicar resultados
    this.calculateAndPublishResults();
    
    // Programar próxima actualización
    this.updateTimer = window.setTimeout(() => this.startUpdateLoop(), this.UPDATE_INTERVAL);
  }
  
  /**
   * Manejar datos de frecuencia cardíaca
   */
  private handleHeartRate(data: OptimizedHeartRateData): void {
    this.lastHeartRate = data;
  }
  
  /**
   * Manejar datos de SpO2
   */
  private handleSpO2(data: OptimizedSpO2Data): void {
    this.lastSpO2 = data;
  }
  
  /**
   * Manejar datos de presión arterial
   */
  private handleBloodPressure(data: OptimizedBloodPressureData): void {
    this.lastBloodPressure = data;
  }
  
  /**
   * Manejar datos de glucosa
   */
  private handleGlucose(data: OptimizedGlucoseData): void {
    this.lastGlucose = data;
  }
  
  /**
   * Manejar datos de lípidos
   */
  private handleLipids(data: OptimizedLipidData): void {
    this.lastLipids = data;
  }
  
  /**
   * Manejar datos de arritmia
   */
  private handleArrhythmia(data: OptimizedArrhythmiaData): void {
    this.lastArrhythmia = data;
    
    // Si se detecta arritmia, publicar evento específico
    if (data.detected) {
      eventBus.publish(EventType.ARRHYTHMIA_DETECTED, data);
    }
  }
  
  /**
   * Calcular y publicar resultados de signos vitales
   */
  private calculateAndPublishResults(): void {
    // Verificar si tenemos suficientes datos para calcular
    if (!this.lastHeartRate) return;
    
    try {
      // Determinar estado de arritmia
      let arrhythmiaStatus = "Normal";
      if (this.lastArrhythmia) {
        if (this.lastArrhythmia.detected) {
          arrhythmiaStatus = "Arritmia Detectada";
        } else if (this.lastArrhythmia.rmssd > 25) {
          arrhythmiaStatus = "Variabilidad Elevada";
        }
      }
      
      // Crear resultado de signos vitales
      const result: VitalSignsResult = {
        timestamp: Date.now(),
        heartRate: this.lastHeartRate?.optimizedValue || 0,
        spo2: this.lastSpO2?.optimizedValue || 0,
        bloodPressure: {
          systolic: this.lastBloodPressure?.optimizedSystolic || 0,
          diastolic: this.lastBloodPressure?.optimizedDiastolic || 0,
          display: this.formatBloodPressure(
            this.lastBloodPressure?.optimizedSystolic,
            this.lastBloodPressure?.optimizedDiastolic
          )
        },
        glucose: this.lastGlucose?.optimizedValue || 0,
        lipids: {
          totalCholesterol: this.lastLipids?.optimizedCholesterol || 0,
          triglycerides: this.lastLipids?.optimizedTriglycerides || 0
        },
        arrhythmiaStatus,
        lastArrhythmiaData: this.lastArrhythmia || undefined,
        confidence: {
          heartRate: this.lastHeartRate?.confidence || 0,
          spo2: this.lastSpO2?.confidence || 0,
          bloodPressure: this.lastBloodPressure?.confidence || 0,
          glucose: this.lastGlucose?.confidence || 0,
          lipids: this.lastLipids?.confidence || 0
        }
      };
      
      // Solo publicar si hay cambios significativos o tiempo suficiente
      const shouldPublish = this.shouldPublishUpdate(result);
      
      if (shouldPublish) {
        this.lastResult = result;
        
        // Publicar resultados
        eventBus.publish(EventType.VITAL_SIGNS_UPDATED, result);
      }
      
    } catch (error) {
      console.error('Error calculando signos vitales:', error);
    }
  }
  
  /**
   * Determinar si se debe publicar una actualización
   */
  private shouldPublishUpdate(newResult: VitalSignsResult): boolean {
    // Si no hay resultado previo, publicar
    if (!this.lastResult) return true;
    
    // Si ha pasado suficiente tiempo (5 segundos), publicar
    if (newResult.timestamp - this.lastResult.timestamp > 5000) return true;
    
    // Verificar cambios significativos
    const hasSignificantChanges = 
      Math.abs(newResult.heartRate - this.lastResult.heartRate) >= 2 || 
      Math.abs(newResult.spo2 - this.lastResult.spo2) >= 1 || 
      Math.abs(newResult.bloodPressure.systolic - this.lastResult.bloodPressure.systolic) >= 3 || 
      Math.abs(newResult.bloodPressure.diastolic - this.lastResult.bloodPressure.diastolic) >= 2 || 
      Math.abs(newResult.glucose - this.lastResult.glucose) >= 2 || 
      Math.abs(newResult.lipids.totalCholesterol - this.lastResult.lipids.totalCholesterol) >= 3 || 
      Math.abs(newResult.lipids.triglycerides - this.lastResult.lipids.triglycerides) >= 3 || 
      newResult.arrhythmiaStatus !== this.lastResult.arrhythmiaStatus;
    
    return hasSignificantChanges;
  }
  
  /**
   * Formatear presión arterial para visualización
   */
  private formatBloodPressure(systolic?: number, diastolic?: number): string {
    if (!systolic || !diastolic) return "--/--";
    return `${systolic}/${diastolic}`;
  }
  
  /**
   * Obtener último resultado calculado
   */
  getLastResult(): VitalSignsResult | null {
    return this.lastResult;
  }
  
  /**
   * Obtener valores calculados específicos
   */
  getCurrentValues(): {
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
    totalCholesterol: number;
    triglycerides: number;
    arrhythmiaStatus: string;
  } {
    return {
      heartRate: this.lastResult?.heartRate || 0,
      spo2: this.lastResult?.spo2 || 0,
      systolic: this.lastResult?.bloodPressure.systolic || 0,
      diastolic: this.lastResult?.bloodPressure.diastolic || 0,
      glucose: this.lastResult?.glucose || 0,
      totalCholesterol: this.lastResult?.lipids.totalCholesterol || 0,
      triglycerides: this.lastResult?.lipids.triglycerides || 0,
      arrhythmiaStatus: this.lastResult?.arrhythmiaStatus || "Normal"
    };
  }
}

// Exportar instancia singleton
export const vitalSignsCalculator = new VitalSignsCalculator();
