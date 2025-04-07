
/**
 * Exportaciones del Sistema de Escudo Protector
 * Con soporte mejorado para procesamiento de señales PPG avanzado
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

// Exportar una instancia predeterminada del escudo protector
import { CodeProtectionShield } from './CodeProtectionShield';
export const shield = CodeProtectionShield.getInstance();
