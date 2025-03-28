
/**
 * Proveedor de Señal Combinada
 * Integra y combina señales de latidos y PPG para proveer una señal balanceada
 */

import { EventType, eventBus } from '../events/EventBus';
import { HeartBeatData } from './HeartBeatExtractor';
import { PPGSignalData } from './PPGSignalExtractor';

export interface CombinedSignalData {
  timestamp: number;
  heartbeatValue: number;
  ppgValue: number;
  combinedValue: number;
  fingerDetected: boolean;
  quality: number;
}

export class CombinedSignalProvider {
  private lastHeartbeatData: HeartBeatData | null = null;
  private lastPPGData: PPGSignalData | null = null;
  private isActive: boolean = false;
  private lastCombinedData: CombinedSignalData | null = null;
  
  /**
   * Iniciar combinación de señales
   */
  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Suscribirse a eventos de señal
    eventBus.subscribe(EventType.HEARTBEAT_DATA, this.handleHeartbeatData.bind(this));
    eventBus.subscribe(EventType.PPG_SIGNAL_EXTRACTED, this.handlePPGData.bind(this));
    
    // Iniciar ciclo de combinación
    this.combinationLoop();
    
    console.log('Proveedor de señal combinada iniciado');
  }
  
  /**
   * Detener combinación
   */
  stop(): void {
    this.isActive = false;
    this.lastHeartbeatData = null;
    this.lastPPGData = null;
    this.lastCombinedData = null;
    console.log('Proveedor de señal combinada detenido');
  }
  
  /**
   * Manejar datos de latido
   */
  private handleHeartbeatData(data: HeartBeatData): void {
    this.lastHeartbeatData = data;
  }
  
  /**
   * Manejar datos PPG
   */
  private handlePPGData(data: PPGSignalData): void {
    this.lastPPGData = data;
  }
  
  /**
   * Bucle de combinación de señales (ejecutado periódicamente)
   */
  private combinationLoop(): void {
    if (!this.isActive) return;
    
    // Solo combinar si tenemos ambos tipos de datos
    if (this.lastHeartbeatData && this.lastPPGData) {
      // Detectar presencia de dedo y calidad de señal (básico en esta etapa)
      const ppgRecent = this.lastPPGData.rawValues;
      const hasEnoughData = ppgRecent.length >= 10;
      
      // Cálculo básico de presencia de dedo
      let fingerDetected = false;
      let signalQuality = 0;
      
      if (hasEnoughData) {
        const recentAvg = ppgRecent.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const minThreshold = 0.1; // Umbral mínimo para detección de dedo
        
        // Detección básica basada en amplitud
        fingerDetected = recentAvg > minThreshold;
        
        // Calidad básica
        if (fingerDetected) {
          const recentMax = Math.max(...ppgRecent.slice(-10));
          const recentMin = Math.min(...ppgRecent.slice(-10));
          const amplitude = recentMax - recentMin;
          
          // Calidad basada en amplitud de señal
          signalQuality = Math.min(100, Math.max(0, amplitude * 200));
        }
      }
      
      // Crear datos combinados
      const combinedData: CombinedSignalData = {
        timestamp: Date.now(),
        heartbeatValue: this.lastHeartbeatData.rawValue,
        ppgValue: this.lastPPGData.combinedValue,
        combinedValue: (this.lastHeartbeatData.rawValue * 0.3) + (this.lastPPGData.combinedValue * 0.7),
        fingerDetected,
        quality: signalQuality
      };
      
      this.lastCombinedData = combinedData;
      
      // Publicar datos combinados
      eventBus.publish(EventType.COMBINED_SIGNAL_DATA, combinedData);
      
      // También informar sobre detección de dedo
      eventBus.publish(
        fingerDetected ? EventType.FINGER_DETECTED : EventType.FINGER_LOST,
        { quality: signalQuality, timestamp: combinedData.timestamp }
      );
    }
    
    // Programar próxima combinación
    setTimeout(() => this.combinationLoop(), 33); // ~30fps
  }
  
  /**
   * Obtener últimos datos
   */
  getLastData(): CombinedSignalData | null {
    return this.lastCombinedData;
  }
}

// Exportar instancia singleton
export const combinedSignalProvider = new CombinedSignalProvider();
