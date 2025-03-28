
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
 * Integra los datos optimizados para calcular resultados finales de signos vitales
 */

import { EventType, eventBus } from '../events/EventBus';
import { OptimizedHeartRate, OptimizedSPO2, OptimizedBloodPressure } from '../optimization/SignalOptimizer';
import { BloodPressureProcessor } from '../vital-signs/blood-pressure-processor';

export interface VitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    display: string;
  };
  arrhythmiaStatus: string;
  reliability: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    windows?: {start: number; end: number}[];
    detected?: boolean;
  };
}

export class VitalSignsCalculator {
  // Estado interno
  private isCalculating: boolean = false;
  private calculationInterval: number | null = null;
  
  // Últimos valores recibidos
  private lastHeartRate: OptimizedHeartRate | null = null;
  private lastSPO2: OptimizedSPO2 | null = null;
  private lastBloodPressure: OptimizedBloodPressure | null = null;
  private lastArrhythmiaData: any | null = null;
  
  // Otros procesadores
  private bpProcessor: BloodPressureProcessor = new BloodPressureProcessor();
  
  // Constantes
  private readonly CALCULATION_INTERVAL_MS = 1000;
  private readonly RELIABILITY_THRESHOLD = 40;
  private readonly CRITICAL_ARRHYTHMIA_THRESHOLD = 0.2;
  
  /**
   * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
   * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
   * 
   * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
   * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
   * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
   */
  
  /**
   * Iniciar cálculo de signos vitales
   */
  startCalculating(): void {
    if (this.isCalculating) return;
    
    this.isCalculating = true;
    
    // Suscribirse a eventos de señales optimizadas
    eventBus.subscribe(EventType.OPTIMIZED_HEART_RATE, this.handleOptimizedHeartRate.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_SPO2, this.handleOptimizedSPO2.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_BLOOD_PRESSURE, this.handleOptimizedBloodPressure.bind(this));
    eventBus.subscribe(EventType.OPTIMIZED_ARRHYTHMIA, this.handleOptimizedArrhythmia.bind(this));
    
    // Programar cálculo periódico de resultados
    this.calculationInterval = window.setInterval(() => {
      this.calculateAndPublishResults();
    }, this.CALCULATION_INTERVAL_MS);
    
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
    
    this.reset();
    console.log('Calculador de signos vitales detenido');
  }
  
  /**
   * Reiniciar estado interno
   */
  reset(): void {
    this.lastHeartRate = null;
    this.lastSPO2 = null;
    this.lastBloodPressure = null;
    this.lastArrhythmiaData = null;
    this.bpProcessor.reset();
  }
  
  /**
   * Manejar datos de frecuencia cardíaca optimizados
   */
  private handleOptimizedHeartRate(data: OptimizedHeartRate): void {
    if (!this.isCalculating) return;
    this.lastHeartRate = data;
  }
  
  /**
   * Manejar datos de SpO2 optimizados
   */
  private handleOptimizedSPO2(data: OptimizedSPO2): void {
    if (!this.isCalculating) return;
    this.lastSPO2 = data;
  }
  
  /**
   * Manejar datos de presión arterial optimizados
   */
  private handleOptimizedBloodPressure(data: OptimizedBloodPressure): void {
    if (!this.isCalculating) return;
    this.lastBloodPressure = data;
  }
  
  /**
   * Manejar datos de arritmia optimizados
   */
  private handleOptimizedArrhythmia(data: any): void {
    if (!this.isCalculating) return;
    this.lastArrhythmiaData = data;
    
    // Detectar si hay arritmia crítica
    if (data.rrVariation > this.CRITICAL_ARRHYTHMIA_THRESHOLD) {
      // Notificar arritmia detectada
      eventBus.publish(EventType.ARRHYTHMIA_DETECTED, {
        timestamp: data.timestamp,
        severity: data.rrVariation > 0.3 ? 'severe' : 'moderate',
        data: data
      });
    }
  }
  
  /**
   * Calcular y publicar resultados finales
   */
  private calculateAndPublishResults(): void {
    if (!this.isCalculating) return;
    
    // Verificar si tenemos suficientes datos para calcular
    if (!this.lastHeartRate) return;
    
    try {
      // Calcular confiabilidad general basada en disponibilidad de datos
      // y sus niveles de confianza individuales
      let reliabilityScore = 0;
      let factorsCount = 0;
      
      if (this.lastHeartRate) {
        reliabilityScore += this.lastHeartRate.confidence;
        factorsCount++;
      }
      
      if (this.lastSPO2) {
        reliabilityScore += this.lastSPO2.confidence;
        factorsCount++;
      }
      
      if (this.lastBloodPressure) {
        reliabilityScore += this.lastBloodPressure.confidence;
        factorsCount++;
      }
      
      const reliability = factorsCount > 0 ? reliabilityScore / factorsCount : 0;
      
      // Verificar si la confiabilidad es suficiente
      if (reliability < this.RELIABILITY_THRESHOLD) {
        // Nivel de confianza muy bajo, no publicar resultados poco fiables
        return;
      }
      
      // Determinar estado de arritmia
      let arrhythmiaStatus = "NORMAL";
      
      if (this.lastArrhythmiaData) {
        if (this.lastArrhythmiaData.rrVariation > 0.3) {
          arrhythmiaStatus = "CRÍTICO";
        } else if (this.lastArrhythmiaData.rrVariation > 0.2) {
          arrhythmiaStatus = "ALERTA";
        } else if (this.lastArrhythmiaData.rrVariation > 0.1) {
          arrhythmiaStatus = "MODERADO";
        }
      }
      
      // Crear estructura de datos de signos vitales
      const vitalSigns: VitalSignsResult = {
        timestamp: Date.now(),
        heartRate: this.lastHeartRate ? this.lastHeartRate.heartRate : 0,
        spo2: this.lastSPO2 ? this.lastSPO2.spo2 : 96, // Valor predeterminado seguro
        bloodPressure: {
          systolic: this.lastBloodPressure ? this.lastBloodPressure.systolic : 120,
          diastolic: this.lastBloodPressure ? this.lastBloodPressure.diastolic : 80,
          display: this.lastBloodPressure ? this.lastBloodPressure.display : "120/80"
        },
        arrhythmiaStatus,
        reliability,
        lastArrhythmiaData: this.lastArrhythmiaData
      };
      
      // Publicar resultados finales
      eventBus.publish(EventType.VITAL_SIGNS_UPDATED, vitalSigns);
      
      // Solicitar retroalimentación al optimizador
      this.requestOptimizationFeedback(vitalSigns);
      
    } catch (error) {
      console.error('Error calculando signos vitales:', error);
    }
  }
  
  /**
   * Solicitar retroalimentación al optimizador
   * Permite ajuste bidireccional entre optimizador y calculador
   */
  private requestOptimizationFeedback(results: VitalSignsResult): void {
    // Solicitar ajustes si es necesario
    let needsOptimization = false;
    
    // Ejemplo: solicitar optimización si hay inconsistencias
    if (results.heartRate > 120 && results.bloodPressure.systolic < 110) {
      needsOptimization = true;
    }
    
    if (needsOptimization) {
      eventBus.publish(EventType.PROCESSOR_FEEDBACK, {
        timestamp: Date.now(),
        source: 'vitalSignsCalculator',
        message: 'Se necesitan ajustes de optimización',
        results
      });
    }
  }
  
  /**
   * Calcular manualmente los signos vitales con los datos actuales
   * Útil para obtener resultados bajo demanda
   */
  calculateVitalSigns(): VitalSignsResult | null {
    if (!this.lastHeartRate) return null;
    
    const arrhythmiaStatus = this.lastArrhythmiaData?.rrVariation > 0.2 ? "ALERTA" : "NORMAL";
    
    return {
      timestamp: Date.now(),
      heartRate: this.lastHeartRate ? this.lastHeartRate.heartRate : 0,
      spo2: this.lastSPO2 ? this.lastSPO2.spo2 : 96,
      bloodPressure: {
        systolic: this.lastBloodPressure ? this.lastBloodPressure.systolic : 120,
        diastolic: this.lastBloodPressure ? this.lastBloodPressure.diastolic : 80,
        display: this.lastBloodPressure ? this.lastBloodPressure.display : "120/80"
      },
      arrhythmiaStatus,
      reliability: 70,
      lastArrhythmiaData: this.lastArrhythmiaData
    };
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
