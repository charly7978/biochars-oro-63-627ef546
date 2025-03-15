
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { PPGProcessor } from './vital-signs/ppg-processor';
import { SpO2Processor } from './vital-signs/spo2-processor';
import { BloodPressureProcessor } from './vital-signs/blood-pressure-processor';
import { ArrhythmiaProcessor } from './vital-signs/arrhythmia-processor';
import { SignalMetrics } from './vital-signs/signal-metrics';

/**
 * Procesador principal de signos vitales que coordina los módulos especializados
 */
export class VitalSignsProcessor {
  constructor() {
    // Inicializar los procesadores especializados
    this.ppgProcessor = new PPGProcessor();
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalMetrics = new SignalMetrics();
    
    console.log("VitalSignsProcessor: Inicializado con arquitectura modular");
  }

  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   * @param ppgValue Valor actual de la señal PPG
   * @param rrData Datos de intervalos RR opcionales
   * @returns Objeto con los signos vitales calculados
   */
  processSignal(ppgValue, rrData) {
    console.log("VitalSignsProcessor: Entrada de señal", {
      ppgValue,
      isLearning: this.arrhythmiaProcessor.isInLearningPhase(),
      rrIntervalsCount: rrData?.intervals?.length || 0,
      receivedRRData: !!rrData
    });

    // Procesar y amplificar la señal PPG
    const filteredValue = this.ppgProcessor.processSignal(ppgValue);
    
    // Almacenar el valor filtrado para cálculos futuros
    this.signalMetrics.storeValue(filteredValue);
    
    // Actualizar datos de arritmia si están disponibles
    this.arrhythmiaProcessor.updateRRIntervals(rrData);

    // Calcular SpO2 usando los valores recientes
    const spo2 = this.spo2Processor.calculateSpO2(this.signalMetrics.getRecentValues(60));
    
    // Calcular presión arterial usando los valores recientes
    const bp = this.bpProcessor.calculateBloodPressure(this.signalMetrics.getRecentValues(60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;

    // Obtener estado de arritmia
    const arrhythmiaStatus = this.arrhythmiaProcessor.getArrhythmiaStatus();

    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus
    };
  }

  /**
   * Reinicia todos los procesadores
   */
  reset() {
    this.ppgProcessor.reset();
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalMetrics.reset();
    console.log("VitalSignsProcessor: Reset completo");
  }
}
