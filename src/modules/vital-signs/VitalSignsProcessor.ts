/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Quitar imports de procesadores antiguos
// import { SpO2Processor } from './spo2-processor';
// import { BloodPressureProcessor } from './blood-pressure-processor';
// import { ArrhythmiaProcessor } from './arrhythmia-processor';
// import { GlucoseProcessor } from './glucose-processor';
// import { LipidProcessor } from './lipid-processor';
// import { HydrationEstimator } from '../../core/analysis/HydrationEstimator'; // Podría ser un canal

// Añadir imports de canales nuevos
import { SpO2Channel } from './channels/SpO2Channel';
import { BloodPressureChannel } from './channels/BloodPressureChannel';
import { GlucoseChannel } from './channels/GlucoseChannel';
import { HeartRateChannel } from './channels/HeartRateChannel';
import { ArrhythmiaChannel, ArrhythmiaResultData } from './channels/ArrhythmiaChannel';
import { LipidChannel } from './channels/LipidChannel';
// import { HydrationChannel } from './channels/HydrationChannel'; // (Si se crea)

import { SignalProcessor } from './signal-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
// import { ConfidenceCalculator } from './calculators/confidence-calculator'; // Reemplazar cálculo
import { VitalSignsResult } from './types/vital-signs-result';
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig, RRData } from './channels/ISignalChannel';

/**
 * Main vital signs processor - Refactored to use specialized channels
 * Integrates different specialized channels to calculate health metrics
 * Operates ONLY in direct measurement mode without reference values or simulation
 */
export class VitalSignsProcessor {
  // Colección de canales de procesamiento
  private channels: Map<string, ISignalChannel> = new Map();

  // Procesador de señal general para filtrado inicial y calidad
  private signalProcessor: SignalProcessor;

  // Validadores y calculadores generales (pueden moverse a canales específicos o a un sistema de feedback)
  private signalValidator: SignalValidator; // Mantener por ahora para validación general
  // private confidenceCalculator: ConfidenceCalculator; // Reemplazado por métricas de canal
  // private arrhythmiaProcessor: ArrhythmiaProcessor; // Lógica movida a ArrhythmiaChannel

  // Último resultado agregado (para referencia interna si es necesario)
  private lastAggregatedResult: VitalSignsResult | null = null;

  /**
   * Constructor que inicializa el procesador de señal y registra los canales.
   */
  constructor() {
    console.log("VitalSignsProcessor [Channel Based]: Initializing new instance");

    // Inicializar componentes centrales
    this.signalProcessor = new SignalProcessor();
    this.signalValidator = new SignalValidator(0.01, 15);
    // this.confidenceCalculator = new ConfidenceCalculator(0.15); // Quitar
    // this.arrhythmiaProcessor = new ArrhythmiaProcessor(); // Quitar

    // Registrar los canales especializados
    this.registerChannel(new HeartRateChannel());
    this.registerChannel(new SpO2Channel());
    this.registerChannel(new BloodPressureChannel());
    this.registerChannel(new GlucoseChannel());
    this.registerChannel(new LipidChannel());
    this.registerChannel(new ArrhythmiaChannel());
    // this.registerChannel(new HydrationChannel()); // (Si se crea)

    // Eliminar instancias de procesadores antiguos
    // this.spo2Processor = new SpO2Processor();
    // this.bpProcessor = new BloodPressureProcessor();
    // this.glucoseProcessor = new GlucoseProcessor();
    // this.lipidProcessor = new LipidProcessor();
    // this.hydrationEstimator = new HydrationEstimator();

  }

  /**
   * Registra un nuevo canal de procesamiento.
   * @param channel Instancia de una clase que implementa ISignalChannel.
   */
  public registerChannel(channel: ISignalChannel): void {
    if (this.channels.has(channel.id)) {
      console.warn(`Channel with id '${channel.id}' already registered. Overwriting.`);
    }
    this.channels.set(channel.id, channel);
    console.log(`Registered channel: ${channel.id}`);
  }

  /**
   * Procesa la señal PPG, distribuyéndola a los canales registrados y agregando los resultados.
   */
  public processSignal(
    ppgValue: number
    // rrData se obtendrá internamente del canal HeartRate
  ): VitalSignsResult {

    // 1. Pre-procesamiento y validación inicial de la señal
    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(ppgValue);

    if (!fingerDetected || quality < 20) { // Umbral básico de calidad
      // console.log("VitalSignsProcessor: Finger not detected or low quality", { fingerDetected, quality });
      // Devolver el último resultado válido si existe, si no, uno vacío. Evita que los valores desaparezcan.
      return this.lastAggregatedResult || ResultFactory.createEmptyResults();
    }

    const ppgChunk = this.signalProcessor.getPPGValues(); // Obtener el chunk de datos filtrados

    // 2. Procesamiento en paralelo por cada canal registrado
    let rrDataForChannels: RRData | undefined = undefined;

    // Procesar primero HeartRate para obtener RRData
    const hrChannel = this.channels.get('heartRate');
    if (hrChannel) {
        try {
            hrChannel.process(ppgChunk);
            const hrResult = hrChannel.getResult();
            if (hrResult && typeof hrResult === 'object' && 'rrData' in hrResult) {
                rrDataForChannels = (hrResult as { rrData?: RRData }).rrData;
            }
        } catch (error) {
             console.error(`Error processing channel heartRate:`, error);
        }
    }

    // Procesar los demás canales
    this.channels.forEach((channel, id) => {
      if (id === 'heartRate') return; // Ya procesado
      try {
          // Pasar rrData al canal de arritmia, y potencialmente a otros que lo necesiten
          channel.process(ppgChunk, rrDataForChannels);
      } catch (error) {
        console.error(`Error processing channel ${id}:`, error);
      }
    });

    // 3. Recopilación y agregación de resultados y métricas de calidad
    const resultsMap: Record<string, ChannelResult | null> = {};
    const qualityMap: Record<string, ChannelQualityMetrics | null> = {};
    let totalConfidence = 0;
    let contributingChannels = 0;

    this.channels.forEach(channel => {
        const result = channel.getResult();
        const qualityMetrics = channel.getQualityMetrics();
        resultsMap[channel.id] = result;
        qualityMap[channel.id] = qualityMetrics;

        // Calcular confianza general promedio
        const minConfidence = channel.getConfig().minConfidence ?? 0.5;
        if (result && qualityMetrics && qualityMetrics.confidence >= minConfidence) {
            totalConfidence += qualityMetrics.confidence;
            contributingChannels++;
        }
    });

    // Calcular confianza general (promedio de canales confiables)
    const overallConfidence = contributingChannels > 0 ? totalConfidence / contributingChannels : 0;

    // 4. Construir el resultado agregado usando ResultFactory
    const spo2Result = resultsMap['spo2'] as { spo2: number } | null;
    const bpResult = resultsMap['bloodPressure'] as { systolic: number, diastolic: number } | null;
    const arrhythmiaResult = resultsMap['arrhythmia'] as { arrhythmia: ArrhythmiaResultData } | null;
    const glucoseResult = resultsMap['glucose'] as { glucose: number } | null;
    const lipidsResult = resultsMap['lipids'] as { lipids: { totalCholesterol: number, triglycerides: number } } | null;
    const heartRateResult = resultsMap['heartRate'] as { bpm?: number, rrData?: RRData } | null;

    const aggregatedResult = ResultFactory.createResult(
      spo2Result?.spo2 ?? (this.lastAggregatedResult?.spo2 || 0),
      bpResult ? `${bpResult.systolic}/${bpResult.diastolic}` : (this.lastAggregatedResult?.pressure || "--/--"),
      arrhythmiaResult?.arrhythmia?.status ?? (this.lastAggregatedResult?.arrhythmiaStatus || 'normal'),
      glucoseResult?.glucose ?? (this.lastAggregatedResult?.glucose || 0),
      lipidsResult?.lipids ?? (this.lastAggregatedResult?.lipids || { totalCholesterol: 0, triglycerides: 0 }),
      this.calculateDefaultHemoglobin(spo2Result?.spo2 ?? (this.lastAggregatedResult?.spo2 || 0)),
      this.lastAggregatedResult?.hydration || 0,
      qualityMap['glucose']?.confidence ?? 0,
      qualityMap['lipids']?.confidence ?? 0,
      overallConfidence,
      null // arrhythmiaResult?.arrhythmia?.lastArrhythmiaData || null
    );

    // 5. (Futuro) Aplicar Validación Cruzada y Feedback

    this.lastAggregatedResult = aggregatedResult; // Guardar el último resultado
    return aggregatedResult;
  }

  // --- Métodos antiguos (a ser reemplazados/refactorizados) ---

  /**
   * Calculate a default hemoglobin value based on SpO2
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    // Mantener temporalmente o mover a un futuro HemoglobinChannel
    if (spo2 <= 0) return 0;
    const base = 14;
    // Ajustes simplificados, idealmente basados en correlaciones más complejas
    if (spo2 > 95) return Math.round(base + ((spo2 - 95) * 0.1));
    if (spo2 > 90) return Math.round(base - 1 + ((spo2 - 90) * 0.08));
    if (spo2 > 85) return Math.round(base - 2 + ((spo2 - 85) * 0.06));
    return Math.round(base - 3);
  }

  /**
   * Calculate perfusion adjustment based on SpO2 - Este método ya no es necesario aquí.
   * La perfusión se manejaría dentro de cada canal si es relevante.
   */
  // private calculatePerfusionAdjustment(spo2: number): number { ... }

  /**
   * Reset the processor and all registered channels.
   */
  public reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor [Channel Based]: Resetting...");
    this.signalProcessor.reset();
    // this.arrhythmiaProcessor.reset(); // Quitar

    // Resetear procesadores antiguos temporalmente - QUITAR
    // this.spo2Processor.reset();
    // this.bpProcessor.reset();
    // this.glucoseProcessor.reset();
    // this.lipidProcessor.reset();
    // this.hydrationEstimator.reset();

    this.channels.forEach(channel => channel.reset());
    this.lastAggregatedResult = null;
    return null; // Force fresh measurements
  }

  /**
   * Get arrhythmia counter (now fetched from ArrhythmiaChannel).
   */
  public getArrhythmiaCounter(): number {
    const arrhythmiaResult = this.channels.get('arrhythmia')?.getResult() as { arrhythmia: ArrhythmiaResultData } | null;
    return arrhythmiaResult?.arrhythmia?.count ?? 0;
  }

  /**
   * Get the last valid results - Now returns last aggregated or null.
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastAggregatedResult;
  }

  /**
   * Completely reset the processor and channels.
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor [Channel Based]: Full reset completed");
  }

  // --- Variables y métodos temporales para transición - QUITAR ---
  // private spo2Processor: SpO2Processor;
  // private bpProcessor: BloodPressureProcessor;
  // private glucoseProcessor: GlucoseProcessor;
  // private lipidProcessor: LipidProcessor;
  // private hydrationEstimator: HydrationEstimator; // Quitar o convertir en canal

}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
// Re-export RRData si es necesario externamente (aunque ahora se maneja internamente)
export type { RRData } from './channels/ISignalChannel';
