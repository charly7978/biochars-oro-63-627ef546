
/**
 * Sistema de Escudo Protector
 * 
 * Este sistema actúa como guardián para prevenir errores y duplicaciones en el código,
 * asegurando que todas las modificaciones cumplan con los estándares establecidos.
 */

import { VerificationResult } from './types';
import { CodeVerifier } from './CodeVerifier';
import { DataIntegrityValidator } from './DataIntegrityValidator';
import { CoherenceChecker } from './CoherenceChecker';
import { ChangeLogger } from './ChangeLogger';
import { RollbackManager } from './RollbackManager';
import { SignalProcessingTelemetry, TelemetryCategory } from '../telemetry/SignalProcessingTelemetry';
import { PreCommitTypeChecker } from './PreCommitTypeChecker';

export class CodeProtectionShield {
  private static instance: CodeProtectionShield;
  private verifier: CodeVerifier;
  private integrityValidator: DataIntegrityValidator;
  private coherenceChecker: CoherenceChecker;
  private changeLogger: ChangeLogger;
  private rollbackManager: RollbackManager;
  private telemetry: SignalProcessingTelemetry;
  private typeChecker: PreCommitTypeChecker;
  
  private constructor() {
    this.verifier = new CodeVerifier();
    this.integrityValidator = new DataIntegrityValidator();
    this.coherenceChecker = new CoherenceChecker();
    this.changeLogger = new ChangeLogger();
    this.rollbackManager = new RollbackManager();
    this.telemetry = SignalProcessingTelemetry.getInstance();
    this.typeChecker = new PreCommitTypeChecker();
    
    console.log('Sistema de Escudo Protector inicializado correctamente');
  }
  
  /**
   * Obtiene la instancia única del Escudo Protector (Singleton)
   */
  public static getInstance(): CodeProtectionShield {
    if (!CodeProtectionShield.instance) {
      CodeProtectionShield.instance = new CodeProtectionShield();
    }
    return CodeProtectionShield.instance;
  }
  
  /**
   * Verifica un cambio propuesto antes de aplicarlo
   * @param originalCode Código original
   * @param modifiedCode Código modificado
   * @param context Contexto de la modificación (nombre de archivo, etc.)
   * @returns Resultado de la verificación
   */
  public async verifyChange(
    originalCode: string, 
    modifiedCode: string, 
    context: { fileName: string; moduleName: string; }
  ): Promise<VerificationResult> {
    // Registrar inicio de la verificación en telemetría
    const verificationId = `verify_${Date.now()}_${context.fileName}`;
    this.telemetry.startPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
    
    // Crear punto de restauración antes de verificar
    this.rollbackManager.createRestorePoint(context.fileName, originalCode);
    
    // Registrar intento de cambio
    this.changeLogger.logChangeAttempt(context, new Date());
    
    try {
      // 0. Verificación sintáctica previa (nueva)
      const syntaxResult = await this.typeChecker.performPreCommitCheck(modifiedCode, context);
      this.telemetry.measurePhase(verificationId, 'syntax_check_time', performance.now(), 'ms');
      
      if (!syntaxResult.success) {
        console.warn(`Verificación sintáctica fallida: ${syntaxResult.message}`);
        
        // Registrar fallo en telemetría
        this.telemetry.recordPhaseEvent(verificationId, 'syntax_check_failed', {
          message: syntaxResult.message,
          details: syntaxResult.details
        });
        
        this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
        return syntaxResult;
      }
      
      // 1. Verificación previa de dependencias y tipos
      const verificationResult = await this.verifier.verifyCode(originalCode, modifiedCode, context);
      this.telemetry.measurePhase(verificationId, 'verification_time', performance.now(), 'ms');
      
      if (!verificationResult.success) {
        console.warn(`Verificación previa fallida: ${verificationResult.message}`);
        
        // Registrar fallo en telemetría
        this.telemetry.recordPhaseEvent(verificationId, 'verification_failed', {
          message: verificationResult.message,
          details: verificationResult.details
        });
        
        this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
        return verificationResult;
      }
      
      // 2. Validación de integridad de datos
      const integrityResult = await this.integrityValidator.validateIntegrity(modifiedCode, context);
      this.telemetry.measurePhase(verificationId, 'integrity_validation_time', performance.now(), 'ms');
      
      if (!integrityResult.success) {
        console.warn(`Validación de integridad fallida: ${integrityResult.message}`);
        
        // Registrar fallo en telemetría
        this.telemetry.recordPhaseEvent(verificationId, 'integrity_failed', {
          message: integrityResult.message,
          details: integrityResult.details
        });
        
        this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
        return integrityResult;
      }
      
      // 3. Verificación de coherencia
      const coherenceResult = await this.coherenceChecker.checkCoherence(originalCode, modifiedCode, context);
      this.telemetry.measurePhase(verificationId, 'coherence_check_time', performance.now(), 'ms');
      
      if (!coherenceResult.success) {
        console.warn(`Verificación de coherencia fallida: ${coherenceResult.message}`);
        
        // Registrar fallo en telemetría
        this.telemetry.recordPhaseEvent(verificationId, 'coherence_failed', {
          message: coherenceResult.message,
          details: coherenceResult.details
        });
        
        this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
        return coherenceResult;
      }
      
      // Si pasa todas las verificaciones, registrar el cambio exitoso
      this.changeLogger.logSuccessfulChange(context, new Date(), {
        verificationDetails: verificationResult.details,
        integrityDetails: integrityResult.details,
        coherenceDetails: coherenceResult.details
      });
      
      // Registrar éxito en telemetría
      this.telemetry.recordPhaseEvent(verificationId, 'verification_successful', {
        fileName: context.fileName,
        moduleName: context.moduleName
      });
      
      this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
      
      return {
        success: true,
        message: 'El cambio ha sido verificado correctamente y es seguro aplicarlo.',
        details: {
          verificationPassed: true,
          integrityPassed: true,
          coherencePassed: true
        }
      };
    } catch (error) {
      console.error('Error durante el proceso de verificación:', error);
      // En caso de error, preparar rollback
      this.rollbackManager.prepareRollback(context.fileName);
      
      // Registrar error en telemetría
      this.telemetry.recordPhaseEvent(verificationId, 'verification_error', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        fileName: context.fileName
      });
      
      this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
      
      return {
        success: false,
        message: `Error durante la verificación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: {
          error: error instanceof Error ? error.message : 'Error desconocido',
          verificationPassed: false
        }
      };
    }
  }
  
  /**
   * Aplica un cambio después de haber sido verificado
   */
  public async applyChange(
    fileName: string,
    modifiedCode: string
  ): Promise<boolean> {
    try {
      // Registrar la aplicación del cambio
      this.changeLogger.logChangeApplication(
        { fileName, moduleName: this.detectModuleName(fileName) },
        new Date()
      );
      
      // Registrar en telemetría
      this.telemetry.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'change_applied',
        { fileName }
      );
      
      console.log(`Cambio aplicado correctamente a ${fileName}`);
      return true;
    } catch (error) {
      console.error(`Error al aplicar cambio a ${fileName}:`, error);
      
      // Registrar error en telemetría
      this.telemetry.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'change_application_error',
        { 
          fileName,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
      
      // En caso de error durante la aplicación, realizar rollback
      await this.performRollback(fileName);
      return false;
    }
  }
  
  /**
   * Realiza un rollback para un archivo específico
   */
  public async performRollback(fileName: string): Promise<boolean> {
    try {
      const success = await this.rollbackManager.rollback(fileName);
      if (success) {
        console.log(`Rollback exitoso para ${fileName}`);
        this.changeLogger.logRollback({ fileName, moduleName: this.detectModuleName(fileName) }, new Date());
        
        // Registrar en telemetría
        this.telemetry.recordEvent(
          TelemetryCategory.SIGNAL_PROCESSING,
          'rollback_successful',
          { fileName }
        );
      } else {
        console.error(`No se pudo realizar rollback para ${fileName}`);
        
        // Registrar en telemetría
        this.telemetry.recordEvent(
          TelemetryCategory.SIGNAL_PROCESSING,
          'rollback_failed',
          { fileName }
        );
      }
      return success;
    } catch (error) {
      console.error(`Error durante rollback de ${fileName}:`, error);
      
      // Registrar en telemetría
      this.telemetry.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'rollback_error',
        { 
          fileName,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
      
      return false;
    }
  }
  
  /**
   * Registra un resultado de verificación en el log
   * @param verification Detalles de la verificación
   */
  public logVerification(verification: {
    type: string;
    result: VerificationResult;
    timestamp: number;
    context: { fileName: string; moduleName: string; }
  }): void {
    try {
      this.changeLogger.logVerification(verification.context, new Date(verification.timestamp), {
        type: verification.type,
        result: verification.result
      });
      
      // Registrar en telemetría
      this.telemetry.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'verification_logged',
        {
          type: verification.type,
          success: verification.result.success,
          fileName: verification.context.fileName
        }
      );
      
      if (!verification.result.success) {
        console.warn(`Verificación fallida: ${verification.type} en ${verification.context.fileName}`);
      }
    } catch (error) {
      console.error('Error al registrar verificación:', error);
      
      // Registrar error en telemetría
      this.telemetry.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'verification_log_error',
        { 
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      );
    }
  }
  
  /**
   * Detecta el nombre del módulo basado en el nombre del archivo
   */
  private detectModuleName(fileName: string): string {
    const parts = fileName.split('/');
    if (parts.length > 2) {
      return parts[parts.length - 2];
    }
    return 'desconocido';
  }
  
  /**
   * Obtiene estadísticas del sistema de protección
   */
  public getStats(): {
    logStats: ReturnType<ChangeLogger['getLogStats']>;
    telemetryEvents: number;
  } {
    return {
      logStats: this.changeLogger.getLogStats(),
      telemetryEvents: this.telemetry.getEvents().length
    };
  }
}
