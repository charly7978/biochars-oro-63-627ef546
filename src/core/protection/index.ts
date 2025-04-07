
/**
 * Exportaciones del Sistema de Escudo Protector
 * Con soporte mejorado para procesamiento de señales PPG avanzado
 * y nuevas funcionalidades para integración con CI/CD
 */

export { CodeProtectionShield } from './CodeProtectionShield';
export { CodeVerifier } from './CodeVerifier';
export { DataIntegrityValidator } from './DataIntegrityValidator';
export { CoherenceChecker } from './CoherenceChecker';
export { ChangeLogger } from './ChangeLogger';
export { RollbackManager } from './RollbackManager';
export { PreCommitTypeChecker } from './PreCommitTypeChecker';
export * from './types';

// Nuevas exportaciones relacionadas con verificación de señales
export { SignalIntegrityValidator } from './SignalIntegrityValidator';
export { ProcessingValidation } from './ProcessingValidation';

// Exportación de la configuración del Guardian
export * from '../config/GuardianConfig';

// Exportar el API CLI para uso con herramientas de CI/CD
export * from './CIIntegration';

// Exportar una instancia predeterminada del escudo protector
import { CodeProtectionShield } from './CodeProtectionShield';
export const shield = CodeProtectionShield.getInstance();

