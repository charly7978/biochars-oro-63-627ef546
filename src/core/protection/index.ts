
/**
 * Exportaciones del Sistema de Escudo Protector
 */

export { CodeProtectionShield } from './CodeProtectionShield';
export { CodeVerifier } from './CodeVerifier';
export { DataIntegrityValidator } from './DataIntegrityValidator';
export { CoherenceChecker } from './CoherenceChecker';
export { ChangeLogger } from './ChangeLogger';
export { RollbackManager } from './RollbackManager';
export * from './types';

// Exportar una instancia predeterminada del escudo protector
import { CodeProtectionShield } from './CodeProtectionShield';
export const shield = CodeProtectionShield.getInstance();
