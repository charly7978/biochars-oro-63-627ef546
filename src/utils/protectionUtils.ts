/**
 * Utilidades para trabajar con el Sistema de Escudo Protector
 */

import { shield } from '../core/protection';
import { SignalProcessingTelemetry, TelemetryCategory } from '../core/telemetry/SignalProcessingTelemetry';
import * as os from 'os';

// Instancia de telemetría
const telemetry = SignalProcessingTelemetry.getInstance();

// Lista de patrones de código potencialmente peligrosos
const DANGEROUS_PATTERNS = [
  { pattern: /rm\s+-rf\s+/, description: 'Eliminación recursiva forzada' },
  { pattern: /DROP\s+TABLE/i, description: 'Eliminación de tabla de base de datos' },
  { pattern: /DELETE\s+FROM/i, description: 'Eliminación masiva de registros' },
  { pattern: /eval\s*\(/, description: 'Evaluación dinámica de código (eval)' },
  { pattern: /exec\s*\(/, description: 'Ejecución de comandos del sistema' },
  { pattern: /child_process/, description: 'Uso de procesos hijo' },
  { pattern: /process\.exit/, description: 'Terminación forzada del proceso' },
  { pattern: /fs\.rmdir/, description: 'Eliminación de directorios' },
  { pattern: /fs\.unlink/, description: 'Eliminación de archivos' },
];

/**
 * Verifica un cambio propuesto con el escudo protector
 */
export async function verifyCodeChange(
  originalCode: string,
  modifiedCode: string,
  fileName: string
): Promise<boolean> {
  const verificationId = `verify_change_${Date.now()}`;
  telemetry.startPhase(verificationId, TelemetryCategory.PERFORMANCE);
  
  try {
    // NUEVO: Verificación de patrones peligrosos antes de continuar
    const dangerousPatterns = detectDangerousPatterns(modifiedCode);
    if (dangerousPatterns.length > 0) {
      console.error('⚠️ ¡ALERTA! Se detectaron patrones de código potencialmente peligrosos:');
      dangerousPatterns.forEach(item => {
        console.error(`- ${item.description}`);
      });
      
      // Registrar el intento bloqueado
      telemetry.recordPhaseEvent(verificationId, 'dangerous_code_blocked', {
        fileName,
        patterns: dangerousPatterns.map(p => p.description)
      });
      
      telemetry.endPhase(verificationId, TelemetryCategory.PERFORMANCE);
      
      // Mostrar mensaje prominente en consola
      console.error('\n' + '='.repeat(80));
      console.error('🛑 ACCIÓN BLOQUEADA: Código potencialmente peligroso detectado');
      console.error('='.repeat(80) + '\n');
      
      return false;
    }
    
    const moduleName = fileName.split('/').slice(-2)[0] || 'desconocido';
    
    // Registrar métricas de tamaño de código
    telemetry.recordMetric(
      TelemetryCategory.PERFORMANCE,
      'original_code_size',
      originalCode.length,
      'bytes',
      { fileName }
    );
    
    telemetry.recordMetric(
      TelemetryCategory.PERFORMANCE,
      'modified_code_size',
      modifiedCode.length,
      'bytes',
      { fileName }
    );
    
    // Registrar diferencia de tamaño
    const sizeDiff = modifiedCode.length - originalCode.length;
    telemetry.recordMetric(
      TelemetryCategory.PERFORMANCE,
      'code_size_diff',
      sizeDiff,
      'bytes',
      { fileName }
    );
    
    // Realizar verificación previa
    const result = await shield.verifyChange(
      originalCode,
      modifiedCode,
      { fileName, moduleName }
    );
    
    telemetry.measurePhase(verificationId, 'verification_time', performance.now(), 'ms');
    
    if (!result.success) {
      console.error(`Verificación fallida para ${fileName}:`, result.message);
      console.error('Detalles:', result.details);
      
      telemetry.recordPhaseEvent(verificationId, 'verification_failed', {
        fileName,
        message: result.message,
        details: result.details
      });
      
      telemetry.endPhase(verificationId, TelemetryCategory.PERFORMANCE);
      return false;
    }
    
    // Si hay advertencias, mostrarlas pero permitir el cambio
    if (result.details.violations && result.details.violations.length > 0) {
      console.warn(`Advertencias para ${fileName}:`, result.message);
      console.warn('Detalles:', result.details);
      
      telemetry.recordPhaseEvent(verificationId, 'verification_warnings', {
        fileName,
        warningCount: result.details.violations.length
      });
    }
    
    // Registrar verificación exitosa
    telemetry.recordPhaseEvent(verificationId, 'verification_success', {
      fileName
    });
    
    const applyResult = await shield.applyChange(fileName, modifiedCode);
    telemetry.endPhase(verificationId, TelemetryCategory.PERFORMANCE);
    
    return applyResult;
  } catch (error) {
    console.error(`Error al verificar cambio en ${fileName}:`, error);
    
    telemetry.recordPhaseEvent(verificationId, 'verification_error', {
      fileName,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
    
    telemetry.endPhase(verificationId, TelemetryCategory.PERFORMANCE);
    return false;
  }
}

/**
 * Detecta patrones de código potencialmente peligrosos
 */
export function detectDangerousPatterns(code: string): Array<{pattern: RegExp, description: string}> {
  return DANGEROUS_PATTERNS.filter(item => item.pattern.test(code));
}

/**
 * Verifica si una acción es potencialmente peligrosa
 */
export function isActionDangerous(action: string): { isDangerous: boolean, reason?: string } {
  // Verificar patrones peligrosos en la acción
  const dangerousPatterns = detectDangerousPatterns(action);
  if (dangerousPatterns.length > 0) {
    return { 
      isDangerous: true, 
      reason: `Patrón peligroso detectado: ${dangerousPatterns[0].description}`
    };
  }
  
  // Verificar intentos de modificar archivos críticos
  const criticalFilePatterns = [
    /package\.json/i,
    /\.github\/workflows/i,
    /ci\//i,
    /\.npmrc/i,
    /\.env/i
  ];
  
  for (const pattern of criticalFilePatterns) {
    if (pattern.test(action)) {
      return { 
        isDangerous: true, 
        reason: `Intentando modificar archivo crítico que coincide con: ${pattern}`
      };
    }
  }
  
  return { isDangerous: false };
}

/**
 * Realiza un rollback para un archivo
 */
export async function rollbackChanges(fileName: string): Promise<boolean> {
  const rollbackId = `rollback_${Date.now()}`;
  telemetry.startPhase(rollbackId, TelemetryCategory.PERFORMANCE);
  
  try {
    const result = await shield.performRollback(fileName);
    
    telemetry.recordPhaseEvent(rollbackId, 'rollback_attempt', {
      fileName,
      success: result
    });
    
    telemetry.endPhase(rollbackId, TelemetryCategory.PERFORMANCE);
    return result;
  } catch (error) {
    console.error(`Error al realizar rollback de ${fileName}:`, error);
    
    telemetry.recordPhaseEvent(rollbackId, 'rollback_error', {
      fileName,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
    
    telemetry.endPhase(rollbackId, TelemetryCategory.PERFORMANCE);
    return false;
  }
}

/**
 * Analiza un archivo en busca de violaciones de integridad y seguridad
 */
export async function analyzeFileForViolations(
  code: string,
  fileName: string
): Promise<{ violations: any[]; hasCriticalViolations: boolean }> {
  const analysisId = `analyze_${Date.now()}`;
  telemetry.startPhase(analysisId, TelemetryCategory.PERFORMANCE);
  
  try {
    const moduleName = fileName.split('/').slice(-2)[0] || 'desconocido';
    
    // Usar el verificador de tipos previo al commit
    const { PreCommitTypeChecker } = await import('../core/protection');
    const typeChecker = new PreCommitTypeChecker();
    
    // Realizar verificación de tipos
    const typeResult = await typeChecker.performPreCommitCheck(code, { fileName, moduleName });
    
    // Usar el validador de integridad
    const { DataIntegrityValidator } = await import('../core/protection');
    const validator = new DataIntegrityValidator();
    
    // Realizar validación de integridad
    const integrityResult = await validator.validateIntegrity(code, { fileName, moduleName });
    
    // Combinar violaciones
    const allViolations = [
      ...(typeResult.details.violations || []),
      ...(integrityResult.details.violations || [])
    ];
    
    telemetry.recordMetric(
      TelemetryCategory.PERFORMANCE,
      'violation_count',
      allViolations.length,
      'count',
      { fileName }
    );
    
    telemetry.endPhase(analysisId, TelemetryCategory.PERFORMANCE);
    
    return {
      violations: allViolations,
      hasCriticalViolations: !typeResult.success || !integrityResult.success
    };
  } catch (error) {
    console.error(`Error al analizar ${fileName}:`, error);
    
    telemetry.recordPhaseEvent(analysisId, 'analysis_error', {
      fileName,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
    
    telemetry.endPhase(analysisId, TelemetryCategory.PERFORMANCE);
    
    return {
      violations: [{
        type: 'error',
        message: `Error en análisis: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        severity: 'high'
      }],
      hasCriticalViolations: true
    };
  }
}

/**
 * Nueva función: Bloquear inmediatamente una acción peligrosa
 */
export function blockDangerousAction(action: string, context: string): { blocked: boolean, reason?: string } {
  const check = isActionDangerous(action);
  
  if (check.isDangerous) {
    console.error('\n' + '='.repeat(80));
    console.error(`🛑 ACCIÓN BLOQUEADA: ${check.reason}`);
    console.error(`Contexto: ${context}`);
    console.error('='.repeat(80) + '\n');
    
    // Registrar el bloqueo en telemetría
    telemetry.recordEvent(
      TelemetryCategory.SYSTEM,
      'dangerous_action_blocked',
      {
        action,
        reason: check.reason,
        context
      }
    );
    
    return { blocked: true, reason: check.reason };
  }
  
  return { blocked: false };
}
