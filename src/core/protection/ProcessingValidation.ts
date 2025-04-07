
/**
 * Validación de Procesamiento
 * Verifica en tiempo de ejecución que el procesamiento de señales
 * cumple con los estándares de calidad y no utiliza simulación
 */

import { shield } from './index';
import { VerificationResult, VerificationType } from './types';
import { SignalIntegrityValidator } from './SignalIntegrityValidator';

export class ProcessingValidation {
  private static instance: ProcessingValidation;
  private signalValidator: SignalIntegrityValidator;
  private isActive: boolean = true;
  
  // Registro de validaciones para evitar sobrecarga
  private lastValidationTime: Record<string, number> = {};
  private readonly VALIDATION_INTERVAL_MS = 5000; // 5 segundos entre validaciones
  
  private constructor() {
    this.signalValidator = new SignalIntegrityValidator();
    console.log("ProcessingValidation: Sistema de validación de procesamiento inicializado");
  }
  
  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): ProcessingValidation {
    if (!ProcessingValidation.instance) {
      ProcessingValidation.instance = new ProcessingValidation();
    }
    return ProcessingValidation.instance;
  }
  
  /**
   * Activa o desactiva la validación
   */
  public setActive(active: boolean): void {
    this.isActive = active;
    console.log(`ProcessingValidation: Validación ${active ? 'activada' : 'desactivada'}`);
  }
  
  /**
   * Valida un frame de señal PPG
   * @param signal Datos de señal a validar
   * @param source Identificador de la fuente
   */
  public async validatePPGSignal(signal: any, source: string): Promise<VerificationResult> {
    if (!this.isActive) {
      return {
        success: true,
        message: "Validación desactivada",
        details: {}
      };
    }
    
    // Limitar frecuencia de validación
    const now = Date.now();
    if (this.lastValidationTime[source] && 
        now - this.lastValidationTime[source] < this.VALIDATION_INTERVAL_MS) {
      return {
        success: true,
        message: "Validación omitida por frecuencia",
        details: {
          skipReason: "frequency_limited",
          lastValidation: this.lastValidationTime[source],
          current: now
        }
      };
    }
    
    this.lastValidationTime[source] = now;
    
    // Realizar validación
    try {
      const result = await this.signalValidator.validatePPGSignal(signal, {
        timestamp: now,
        source
      });
      
      return result;
    } catch (error) {
      console.error("ProcessingValidation: Error en validación", error);
      
      return {
        success: false,
        message: "Error durante la validación",
        details: {
          error: error instanceof Error ? error.message : "Error desconocido",
          type: VerificationType.DATA_INTEGRITY
        }
      };
    }
  }
  
  /**
   * Valida un resultado de procesamiento
   * @param result Resultado a validar
   * @param source Identificador de la fuente
   */
  public async validateProcessingResult(result: any, source: string): Promise<VerificationResult> {
    if (!this.isActive) {
      return {
        success: true,
        message: "Validación desactivada",
        details: {}
      };
    }
    
    // Implementación básica - expandir según necesidades
    const hasValues = result && typeof result === 'object';
    const hasUnrealisticValues = hasValues && (
      (result.bpm !== undefined && (result.bpm < 30 || result.bpm > 220)) ||
      (result.spo2 !== undefined && (result.spo2 < 70 || result.spo2 > 100))
    );
    
    if (hasUnrealisticValues) {
      const violation = {
        success: false,
        message: "Valores fisiológicamente implausibles detectados",
        details: {
          values: result,
          source,
          timestamp: Date.now(),
          type: VerificationType.DATA_INTEGRITY
        }
      };
      
      // Registrar violación
      shield.logVerification({
        type: 'processing_validation',
        result: violation,
        timestamp: Date.now(),
        context: {
          fileName: source,
          moduleName: 'processing-validation'
        }
      });
      
      return violation;
    }
    
    return {
      success: true,
      message: "Validación exitosa",
      details: {
        source,
        timestamp: Date.now()
      }
    };
  }
  
  /**
   * Registra una alerta de posible simulación
   */
  public reportSimulationAttempt(source: string, details: any): void {
    console.warn("ProcessingValidation: ALERTA - Posible intento de simulación detectado", {
      source,
      details
    });
    
    shield.logVerification({
      type: 'simulation_alert',
      result: {
        success: false,
        message: "Posible intento de simulación detectado",
        details
      },
      timestamp: Date.now(),
      context: {
        fileName: source,
        moduleName: 'simulation-detection'
      }
    });
  }
}
