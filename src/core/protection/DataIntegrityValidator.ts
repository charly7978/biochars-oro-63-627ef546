
/**
 * Validador de Integridad de Datos
 * 
 * Verifica que no se introduzcan simulaciones o manipulaciones no permitidas,
 * asegura que se mantengan las restricciones legales y regulatorias.
 */

import { VerificationResult, VerificationType, ViolationDetail } from './types';

export class DataIntegrityValidator {
  /**
   * Valida la integridad de los datos en el código modificado
   */
  public async validateIntegrity(
    modifiedCode: string,
    context: { fileName: string; moduleName: string; }
  ): Promise<VerificationResult> {
    console.log(`Validando integridad de datos en ${context.fileName}...`);
    
    const violations: ViolationDetail[] = [];
    
    // Verificar comentarios legales
    this.validateLegalComments(modifiedCode, violations);
    
    // Verificar manipulación de datos prohibida
    this.validateNoDataManipulation(modifiedCode, violations);
    
    // Verificar patrones de seguridad
    this.validateSecurityPatterns(modifiedCode, violations);
    
    // Validaciones específicas por tipo de módulo
    if (context.fileName.includes('vital-signs') || context.moduleName.includes('vital-signs')) {
      this.validateVitalSignsIntegrity(modifiedCode, violations);
    }
    
    if (context.fileName.includes('heart-beat') || context.moduleName.includes('heart-beat')) {
      this.validateHeartBeatIntegrity(modifiedCode, violations);
    }
    
    // Determinar resultado final
    const criticalViolations = violations.filter(v => v.severity === 'high');
    
    if (criticalViolations.length > 0) {
      return {
        success: false,
        message: 'Se encontraron violaciones críticas de integridad.',
        details: {
          violations,
          criticalViolationCount: criticalViolations.length,
          totalViolations: violations.length
        }
      };
    }
    
    if (violations.length > 0) {
      return {
        success: true,
        message: 'Se encontraron advertencias de integridad, pero se puede proceder.',
        details: {
          violations,
          totalViolations: violations.length,
          warningsOnly: true
        }
      };
    }
    
    return {
      success: true,
      message: 'Validación de integridad exitosa.',
      details: {
        integrityPassed: true
      }
    };
  }
  
  /**
   * Valida los comentarios legales requeridos
   */
  private validateLegalComments(code: string, violations: ViolationDetail[]): void {
    // Verificar si se mantiene el comentario de advertencia legal
    const legalWarning = "ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION";
    
    if (code.includes("signal-processing") || code.includes("vital-signs") || code.includes("extraction")) {
      if (!code.includes(legalWarning)) {
        violations.push({
          type: VerificationType.LEGAL_COMPLIANCE,
          message: 'Falta el comentario de advertencia legal obligatoria.',
          severity: 'high'
        });
      }
    }
  }
  
  /**
   * Valida que no haya manipulación de datos prohibida
   */
  private validateNoDataManipulation(code: string, violations: ViolationDetail[]): void {
    // Patrones que podrían indicar manipulación de datos
    const manipulationPatterns = [
      { pattern: /\b(simulate|fake|mock|synthetic|random)\w*\b/i, severity: 'high' },
      { pattern: /\bnew\s+Array\(\d+\)\.fill\(/i, severity: 'medium' },
      { pattern: /Math\.random\(\)/i, severity: 'medium' },
      { pattern: /\bnew\s+Date\(\)\.getTime\(\)\s*[+\-*/]\s*\d+/i, severity: 'low' }
    ];
    
    for (const { pattern, severity } of manipulationPatterns) {
      if (pattern.test(code)) {
        violations.push({
          type: VerificationType.DATA_INTEGRITY,
          message: `Posible manipulación de datos detectada (patrón: ${pattern}).`,
          severity: severity as 'high' | 'medium' | 'low'
        });
      }
    }
  }
  
  /**
   * Valida patrones de seguridad
   */
  private validateSecurityPatterns(code: string, violations: ViolationDetail[]): void {
    // Buscar posibles problemas de seguridad
    if (code.includes('eval(') || code.includes('new Function(')) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: 'Uso de funciones potencialmente inseguras (eval o new Function).',
        severity: 'high'
      });
    }
    
    // Verificar posibles inyecciones
    if (/document\.write\(/.test(code) || /innerHTML\s*=/.test(code)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: 'Posible vulnerabilidad de inyección de código detectada.',
        severity: 'medium'
      });
    }
  }
  
  /**
   * Validaciones específicas para módulos de signos vitales
   */
  private validateVitalSignsIntegrity(code: string, violations: ViolationDetail[]): void {
    // Verificar que no haya generación falsa de signos vitales
    if (/\breturn\s+\d+\s*[+\-*/]\s*Math\.random\(\)/.test(code)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: 'Posible generación de signos vitales falsos detectada.',
        severity: 'high'
      });
    }
    
    // Verificar que no se ignoren datos reales
    if (/\/\/\s*ignore\s+real\s+data/i.test(code)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: 'Posible ignorar datos reales detectado en comentarios.',
        severity: 'high'
      });
    }
  }
  
  /**
   * Validaciones específicas para módulos de ritmo cardíaco
   */
  private validateHeartBeatIntegrity(code: string, violations: ViolationDetail[]): void {
    // Verificar que no se generen pulsos cardíacos falsos
    if (/generate(Fake)?Pulse|simulate(Heart)?Beat/i.test(code)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: 'Posible generación de pulsos cardíacos falsos detectada.',
        severity: 'high'
      });
    }
    
    // Verificar que no se manipulen los intervalos RR
    if (/manipulate(RR|Intervals)|adjust(RR|Intervals)/i.test(code)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: 'Posible manipulación de intervalos RR detectada.',
        severity: 'high'
      });
    }
  }
}
