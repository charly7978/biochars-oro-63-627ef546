/**
 * Interfaz base para todos los canales de procesamiento de signos vitales especializados.
 * Define la estructura y métodos comunes que cada canal debe implementar.
 */

import { VitalSignsResult } from '../types/vital-signs-result';

// Define la estructura para los datos de intervalos RR
export interface RRData {
  intervals: number[];        // Array de los últimos intervalos RR en milisegundos
  lastPeakTime: number | null; // Timestamp del último pico R detectado
}

// Define un tipo genérico para los resultados específicos de cada canal
// Esto permitirá a cada canal devolver su tipo de dato específico (número, objeto, etc.)
export type ChannelResult = number | string | { [key: string]: any } | null;

// Define un tipo para la configuración específica del canal
export type ChannelConfig = { [key: string]: any };

// Define un tipo para las métricas de calidad específicas del canal
export type ChannelQualityMetrics = {
    confidence: number; // Confianza general del canal (0-1)
    signalStability?: number; // Estabilidad de la señal procesada por el canal
    noiseLevel?: number; // Nivel de ruido específico detectado por el canal
    [key: string]: any; // Permite métricas adicionales específicas
};

export interface ISignalChannel {
    /**
     * Identificador único del canal (e.g., 'heartRate', 'spo2', 'glucose').
     */
    readonly id: string;

    /**
     * Procesa un fragmento de la señal PPG.
     * @param ppgChunk Un array de números que representa los valores recientes de PPG.
     * @param rrData Datos opcionales de intervalos RR si están disponibles y son relevantes.
     * @returns Void o una promesa si el procesamiento es asíncrono.
     */
    process(ppgChunk: number[], rrData?: { intervals: number[], lastPeakTime: number | null }): void | Promise<void>;

    /**
     * Obtiene el último resultado calculado por el canal.
     * @returns El resultado específico del canal (puede ser número, string, objeto, etc.).
     */
    getResult(): ChannelResult;

    /**
     * Obtiene las métricas de calidad actuales del canal.
     * @returns Un objeto con métricas como confianza, estabilidad, etc.
     */
    getQualityMetrics(): ChannelQualityMetrics;

    /**
     * Actualiza la configuración específica del canal.
     * @param config Un objeto con los nuevos parámetros de configuración.
     */
    updateConfig(config: Partial<ChannelConfig>): void;

    /**
     * Obtiene la configuración actual del canal.
     * @returns La configuración actual.
     */
    getConfig(): ChannelConfig;

    /**
     * Resetea el estado interno del canal.
     */
    reset(): void;
} 