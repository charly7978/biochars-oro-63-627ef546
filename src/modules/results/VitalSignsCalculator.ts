
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Calculador de Signos Vitales
 * Integra señales optimizadas para cálculo preciso de signos vitales
 */

import { EventType, eventBus } from '../events/EventBus';
import { 
  OptimizedHeartRate, 
  OptimizedSPO2, 
  OptimizedBloodPressure,
  OptimizedGlucose,
  OptimizedLipids,
  OptimizedArrhythmia
} from '../optimization/SignalOptimizer';

export interface ArrhythmiaData {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
  windows: Array<{start: number, end: number}>;
  detected: boolean;
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
  display: string;
}

export interface Lipids {
  totalCholesterol: number;
  triglycerides: number;
}

export interface VitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  bloodPressure: BloodPressure;
  glucose: number;
  lipids: Lipids;
  reliability: number;
  arrhythmiaStatus: string;
  arrhythmiaData?: ArrhythmiaData;
}

export class VitalSignsCalculator {
  // Estado
  private isCalculating: boolean = false;
  private calculationInterval: number | null = null;
  
  // Datos optimizados más recientes
  private lastHeartRate: OptimizedHeartRate | null = null;
  private lastSPO2: OptimizedSPO2 | null = null;
  private lastBloodPressure: OptimizedBloodPressure | null = null;
  private lastGlucose: OptimizedGlucose | null = null;
  private lastLipids: OptimizedLipids | null = null;
  private lastArrhythmia: OptimizedArrhythmia | null = null;
  
  // Resultados calculados
  private lastResult: VitalSignsResult | null = null;
  private lastValidResult: VitalSignsResult | null = null;
  
  // Ventanas de arritmias (para visualización)
  private arrhythmiaWindows: Array<{start: number, end: number}> = [];
  private isArrhythmiaDetected: boolean = false;
  
  /**
   * Iniciar cálculo continuo
   */
  startCalculating(): void {
    if (this.isCalculating) return;
    
    this.isCalculating = true;
    
    // Suscribirse a datos optimizados
    eventBus.subscribe(EventType.OPTIMIZED_HEART_RATE, this.handleHeartRateData.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_SPO2, this.handleSPO2Data.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_BLOOD_PRESSURE, this.handleBloodPressureData.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_GLUCOSE, this.handleGlucoseData.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_LIPIDS, this.handleLipidsData.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_ARRHYTHMIA, this.handleArrhythmiaData.bind(this));
    
    // Iniciar ciclo de cálculo
    this.calculationInterval = window.setInterval(() => {
      this.calculateVitalSigns();
    }, 1000); // Calcular cada 1 segundo
    
    console.log('Calculador de signos vitales iniciado');
  }
  
  /**
   * Detener cálculo
   */
  stopCalculating(): void {
    this.isCalculating = false;
    
    if (this.calculationInterval !== null) {
      clearInterval(this.calculationInterval);
      this.calculationInterval = null;
    }
    
    // Mantener último resultado válido
    if (this.lastResult && this.isResultValid(this.lastResult)) {
      this.lastValidResult = this.lastResult;
    }
    
    console.log('Calculador de signos vitales detenido');
  }
  
  /**
   * Manejar datos de frecuencia cardíaca
   */
  private handleHeartRateData(data: OptimizedHeartRate): void {
    this.lastHeartRate = data;
    
    // Notificar cambio de frecuencia cardíaca si es válida
    if (data.heartRate > 0 && data.confidence > 50) {
      eventBus.publish(EventType.HEARTBEAT_RATE_CHANGED, {
        heartRate: data.heartRate,
        timestamp: data.timestamp
      });
    }
  }
  
  /**
   * Manejar datos de SpO2
   */
  private handleSPO2Data(data: OptimizedSPO2): void {
    this.lastSPO2 = data;
  }
  
  /**
   * Manejar datos de presión arterial
   */
  private handleBloodPressureData(data: OptimizedBloodPressure): void {
    this.lastBloodPressure = data;
  }
  
  /**
   * Manejar datos de glucosa
   */
  private handleGlucoseData(data: OptimizedGlucose): void {
    this.lastGlucose = data;
  }
  
  /**
   * Manejar datos de lípidos
   */
  private handleLipidsData(data: OptimizedLipids): void {
    this.lastLipids = data;
  }
  
  /**
   * Manejar datos de arritmias
   */
  private handleArrhythmiaData(data: OptimizedArrhythmia): void {
    this.lastArrhythmia = data;
    
    // Detectar arritmias
    const newArrhythmiaState = data.detectionProbability > 70;
    
    // Si cambió el estado de arritmia
    if (newArrhythmiaState !== this.isArrhythmiaDetected) {
      this.isArrhythmiaDetected = newArrhythmiaState;
      
      // Si se detectó una nueva arritmia, añadir ventana
      if (newArrhythmiaState) {
        const currentTime = Date.now();
        this.arrhythmiaWindows.push({
          start: currentTime - 5000, // 5 segundos antes
          end: currentTime + 5000    // 5 segundos después
        });
        
        // Limitar número de ventanas almacenadas
        if (this.arrhythmiaWindows.length > 5) {
          this.arrhythmiaWindows.shift();
        }
        
        // Notificar detección de arritmia
        eventBus.publish(EventType.ARRHYTHMIA_DETECTED, {
          timestamp: currentTime,
          rmssd: data.rmssd,
          rrVariation: data.rrVariation,
          windows: [...this.arrhythmiaWindows],
          detected: true
        });
      }
      
      // Notificar cambio de estado de arritmia
      eventBus.publish(EventType.ARRHYTHMIA_STATUS_CHANGED, {
        status: this.isArrhythmiaDetected ? 'DETECTED' : 'NORMAL',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Calcular signos vitales integrando datos optimizados
   */
  private calculateVitalSigns(): void {
    if (!this.isCalculating) return;
    
    const currentTime = Date.now();
    
    // Verificar si tenemos datos recientes (últimos 10 segundos)
    const dataFreshness = 10000; // 10 segundos
    const hasRecentHeartRate = this.lastHeartRate && (currentTime - this.lastHeartRate.timestamp < dataFreshness);
    const hasRecentSPO2 = this.lastSPO2 && (currentTime - this.lastSPO2.timestamp < dataFreshness);
    const hasRecentBP = this.lastBloodPressure && (currentTime - this.lastBloodPressure.timestamp < dataFreshness);
    
    // Sólo calcular si tenemos datos mínimos necesarios
    if (!hasRecentHeartRate) {
      return;
    }
    
    // Integrar todos los datos disponibles en un resultado final
    const heartRate = hasRecentHeartRate ? this.lastHeartRate!.heartRate : 0;
    
    // SpO2 (saturación de oxígeno)
    const spo2 = hasRecentSPO2 ? this.lastSPO2!.spo2 : 0;
    
    // Presión arterial
    const bloodPressure: BloodPressure = hasRecentBP ? {
      systolic: this.lastBloodPressure!.systolic,
      diastolic: this.lastBloodPressure!.diastolic,
      display: this.lastBloodPressure!.display
    } : {
      systolic: 0,
      diastolic: 0,
      display: "--/--"
    };
    
    // Glucosa
    const glucose = this.lastGlucose?.value || 0;
    
    // Lípidos
    const lipids: Lipids = this.lastLipids ? {
      totalCholesterol: this.lastLipids.totalCholesterol,
      triglycerides: this.lastLipids.triglycerides
    } : {
      totalCholesterol: 0,
      triglycerides: 0
    };
    
    // Confiabilidad general (promedio ponderado)
    let reliability = 0;
    let weightSum = 0;
    
    if (hasRecentHeartRate) {
      reliability += this.lastHeartRate!.confidence * 0.4;
      weightSum += 0.4;
    }
    
    if (hasRecentSPO2) {
      reliability += this.lastSPO2!.confidence * 0.3;
      weightSum += 0.3;
    }
    
    if (hasRecentBP) {
      reliability += this.lastBloodPressure!.confidence * 0.3;
      weightSum += 0.3;
    }
    
    // Normalizar confiabilidad
    reliability = weightSum > 0 ? reliability / weightSum : 0;
    
    // Estado de arritmia
    const arrhythmiaStatus = this.isArrhythmiaDetected ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
    
    // Datos de arritmia
    const arrhythmiaData: ArrhythmiaData | undefined = this.lastArrhythmia ? {
      timestamp: this.lastArrhythmia.timestamp,
      rmssd: this.lastArrhythmia.rmssd,
      rrVariation: this.lastArrhythmia.rrVariation,
      windows: [...this.arrhythmiaWindows],
      detected: this.isArrhythmiaDetected
    } : undefined;
    
    // Crear resultado final
    const result: VitalSignsResult = {
      timestamp: currentTime,
      heartRate,
      spo2,
      bloodPressure,
      glucose,
      lipids,
      reliability,
      arrhythmiaStatus,
      arrhythmiaData
    };
    
    this.lastResult = result;
    
    // Actualizar último resultado válido si corresponde
    if (this.isResultValid(result)) {
      this.lastValidResult = result;
    }
    
    // Publicar resultado
    eventBus.publish(EventType.VITAL_SIGNS_UPDATED, result);
  }
  
  /**
   * Verificar si un resultado es válido
   */
  private isResultValid(result: VitalSignsResult): boolean {
    // Un resultado es válido si tiene frecuencia cardíaca
    return result.heartRate > 40 && result.heartRate < 200;
  }
  
  /**
   * Obtener último resultado calculado
   */
  getLastVitalSigns(): VitalSignsResult | null {
    return this.lastResult;
  }
  
  /**
   * Obtener último resultado válido
   */
  getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResult;
  }
}

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

// Exportar instancia singleton
export const vitalSignsCalculator = new VitalSignsCalculator();
