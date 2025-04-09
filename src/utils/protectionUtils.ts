
/**
 * Utilidades para trabajar con el Sistema de Escudo Protector
 */

import { shield } from '../core/protection';

/**
 * Verifica un cambio propuesto con el escudo protector
 */
export async function verifyCodeChange(
  originalCode: string,
  modifiedCode: string,
  fileName: string
): Promise<boolean> {
  try {
    const moduleName = fileName.split('/').slice(-2)[0] || 'desconocido';
    
    const result = await shield.verifyChange(
      originalCode,
      modifiedCode,
      { fileName, moduleName }
    );
    
    if (!result.success) {
      console.error(`Verificación fallida para ${fileName}:`, result.message);
      console.error('Detalles:', result.details);
      return false;
    }
    
    // Si hay advertencias, mostrarlas pero permitir el cambio
    if (result.details.violations && result.details.violations.length > 0) {
      console.warn(`Advertencias para ${fileName}:`, result.message);
      console.warn('Detalles:', result.details);
    }
    
    return await shield.applyChange(fileName, modifiedCode);
  } catch (error) {
    console.error(`Error al verificar cambio en ${fileName}:`, error);
    return false;
  }
}

/**
 * Realiza un rollback para un archivo
 */
export async function rollbackChanges(fileName: string): Promise<boolean> {
  try {
    return await shield.performRollback(fileName);
  } catch (error) {
    console.error(`Error al realizar rollback de ${fileName}:`, error);
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
  try {
    const moduleName = fileName.split('/').slice(-2)[0] || 'desconocido';
    
    // Usamos el validador de integridad directamente
    const { DataIntegrityValidator } = await import('../core/protection');
    const validator = new DataIntegrityValidator();
    
    const result = await validator.validateIntegrity(code, { fileName, moduleName });
    
    return {
      violations: result.details.violations || [],
      hasCriticalViolations: !result.success
    };
  } catch (error) {
    console.error(`Error al analizar ${fileName}:`, error);
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
