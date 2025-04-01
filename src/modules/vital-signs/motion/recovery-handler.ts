
import { SignalMathUtils } from './signal-math-utils';

/**
 * Manejador para la fase de recuperación tras artefactos
 */
export class RecoveryHandler {
  private recoveryBuffer: number[] = [];
  private recoveryStartTime: number = 0;
  private isInRecoveryPhase: boolean = false;
  private readonly recoveryTime: number;
  
  constructor(recoveryTime: number = 1500) {
    this.recoveryTime = recoveryTime;
  }
  
  /**
   * Inicia la fase de recuperación
   */
  public startRecovery(timestamp: number): void {
    this.isInRecoveryPhase = true;
    this.recoveryStartTime = timestamp;
    this.recoveryBuffer = [];
  }
  
  /**
   * Verifica si estamos en fase de recuperación
   */
  public isInRecovery(): boolean {
    return this.isInRecoveryPhase;
  }
  
  /**
   * Gestiona el procesamiento durante la fase de recuperación
   */
  public handleRecoveryPhase(value: number, timestamp: number): { 
    confidenceReduction: number, 
    correctedValue: number 
  } {
    // Comprobar si la fase de recuperación ha terminado
    if (timestamp - this.recoveryStartTime >= this.recoveryTime) {
      this.isInRecoveryPhase = false;
      this.recoveryBuffer = [];
      return {
        confidenceReduction: 0,
        correctedValue: value
      };
    }
    
    // Almacenar valor en buffer de recuperación
    this.recoveryBuffer.push(value);
    
    // Calcular valor corregido usando filtrado de mediana
    let correctedValue = value;
    if (this.recoveryBuffer.length >= 3) {
      correctedValue = SignalMathUtils.calculateMedian(this.recoveryBuffer.slice(-3));
    }
    
    // Calcular reducción de confianza basada en tiempo transcurrido en recuperación
    const timeInRecovery = timestamp - this.recoveryStartTime;
    const confidenceReduction = 0.5 * (1 - Math.min(timeInRecovery / this.recoveryTime, 1));
    
    return {
      confidenceReduction,
      correctedValue
    };
  }
  
  /**
   * Reinicia el manejador
   */
  public reset(): void {
    this.recoveryBuffer = [];
    this.recoveryStartTime = 0;
    this.isInRecoveryPhase = false;
  }
}
