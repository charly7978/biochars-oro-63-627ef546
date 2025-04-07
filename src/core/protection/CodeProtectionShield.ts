
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

export class CodeProtectionShield {
  private static instance: CodeProtectionShield;
  private verifier: CodeVerifier;
  private integrityValidator: DataIntegrityValidator;
  private coherenceChecker: CoherenceChecker;
  private changeLogger: ChangeLogger;
  private rollbackManager: RollbackManager;
  
  private constructor() {
    this.verifier = new CodeVerifier();
    this.integrityValidator = new DataIntegrityValidator();
    this.coherenceChecker = new CoherenceChecker();
    this.changeLogger = new ChangeLogger();
    this.rollbackManager = new RollbackManager();
    
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
    // Crear punto de restauración antes de verificar
    this.rollbackManager.createRestorePoint(context.fileName, originalCode);
    
    // Registrar intento de cambio
    this.changeLogger.logChangeAttempt(context, new Date());
    
    try {
      // 1. Verificación previa de dependencias y tipos
      const verificationResult = await this.verifier.verifyCode(originalCode, modifiedCode, context);
      if (!verificationResult.success) {
        console.warn(`Verificación previa fallida: ${verificationResult.message}`);
        return verificationResult;
      }
      
      // 2. Validación de integridad de datos
      const integrityResult = await this.integrityValidator.validateIntegrity(modifiedCode, context);
      if (!integrityResult.success) {
        console.warn(`Validación de integridad fallida: ${integrityResult.message}`);
        return integrityResult;
      }
      
      // 3. Verificación de coherencia
      const coherenceResult = await this.coherenceChecker.checkCoherence(originalCode, modifiedCode, context);
      if (!coherenceResult.success) {
        console.warn(`Verificación de coherencia fallida: ${coherenceResult.message}`);
        return coherenceResult;
      }
      
      // Si pasa todas las verificaciones, registrar el cambio exitoso
      this.changeLogger.logSuccessfulChange(context, new Date(), {
        verificationDetails: verificationResult.details,
        integrityDetails: integrityResult.details,
        coherenceDetails: coherenceResult.details
      });
      
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
      
      console.log(`Cambio aplicado correctamente a ${fileName}`);
      return true;
    } catch (error) {
      console.error(`Error al aplicar cambio a ${fileName}:`, error);
      
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
      } else {
        console.error(`No se pudo realizar rollback para ${fileName}`);
      }
      return success;
    } catch (error) {
      console.error(`Error durante rollback de ${fileName}:`, error);
      return false;
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
}
