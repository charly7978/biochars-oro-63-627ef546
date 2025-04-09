
/**
 * Tipos para el Sistema de Escudo Protector
 */

export interface VerificationResult {
  success: boolean;
  message: string;
  details: Record<string, any>;
}

export interface ChangeLogEntry {
  timestamp: Date;
  context: {
    fileName: string;
    moduleName: string;
  };
  type: 'attempt' | 'success' | 'failure' | 'rollback' | 'verification';
  details?: Record<string, any>;
}

export interface RestorePoint {
  fileName: string;
  originalCode: string;
  timestamp: Date;
}

export enum VerificationType {
  DEPENDENCY_CHECK = 'dependency_check',
  TYPE_INTEGRITY = 'type_integrity',
  DUPLICATION_CHECK = 'duplication_check',
  COHERENCE_CHECK = 'coherence_check',
  DATA_INTEGRITY = 'data_integrity',
  LEGAL_COMPLIANCE = 'legal_compliance'
}

export interface ViolationDetail {
  type: VerificationType;
  message: string;
  location?: string;
  severity: 'high' | 'medium' | 'low';
}
