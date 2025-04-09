
/**
 * Verificador de Coherencia
 * 
 * Comprueba que los cambios no rompan la funcionalidad existente,
 * valida la compatibilidad con los componentes existentes.
 */

import { VerificationResult, VerificationType, ViolationDetail } from './types';

export class CoherenceChecker {
  /**
   * Verifica la coherencia entre el código original y el modificado
   */
  public async checkCoherence(
    originalCode: string,
    modifiedCode: string,
    context: { fileName: string; moduleName: string; }
  ): Promise<VerificationResult> {
    console.log(`Verificando coherencia en ${context.fileName}...`);
    
    const violations: ViolationDetail[] = [];
    
    // Verificar cambios en interfaces públicas
    this.checkPublicInterfaces(originalCode, modifiedCode, violations);
    
    // Verificar coherencia de tipos
    this.checkTypeCoherence(originalCode, modifiedCode, violations);
    
    // Verificar manejo de errores
    this.checkErrorHandling(originalCode, modifiedCode, violations);
    
    // Verificar cambios en comentarios importantes
    this.checkImportantComments(originalCode, modifiedCode, violations);
    
    // Determinar resultado final
    const highSeverityViolations = violations.filter(v => v.severity === 'high');
    
    if (highSeverityViolations.length > 0) {
      return {
        success: false,
        message: 'Se encontraron violaciones críticas de coherencia.',
        details: {
          violations,
          highSeverityCount: highSeverityViolations.length,
          totalViolations: violations.length
        }
      };
    }
    
    if (violations.length > 0) {
      return {
        success: true,
        message: 'Se encontraron advertencias de coherencia, pero se puede proceder.',
        details: {
          violations,
          totalViolations: violations.length,
          warningsOnly: true
        }
      };
    }
    
    return {
      success: true,
      message: 'Verificación de coherencia exitosa.',
      details: {
        coherencePassed: true
      }
    };
  }
  
  /**
   * Verifica cambios en interfaces públicas
   */
  private checkPublicInterfaces(originalCode: string, modifiedCode: string, violations: ViolationDetail[]): void {
    // Extraer métodos y propiedades públicas
    const originalPublics = this.extractPublicElements(originalCode);
    const modifiedPublics = this.extractPublicElements(modifiedCode);
    
    // Verificar elementos eliminados
    for (const element of originalPublics) {
      if (!modifiedPublics.some(e => e.name === element.name)) {
        violations.push({
          type: VerificationType.COHERENCE_CHECK,
          message: `Se eliminó el elemento público '${element.name}'.`,
          severity: 'high'
        });
      }
    }
    
    // Verificar cambios en firmas de métodos
    for (const originalElement of originalPublics) {
      const modifiedElement = modifiedPublics.find(e => e.name === originalElement.name);
      
      if (modifiedElement && originalElement.type === 'method' && modifiedElement.type === 'method') {
        // Verificar cambios en parámetros
        if (originalElement.parameters !== modifiedElement.parameters) {
          violations.push({
            type: VerificationType.COHERENCE_CHECK,
            message: `Se modificó la firma del método público '${originalElement.name}'.`,
            severity: 'high'
          });
        }
        
        // Verificar cambios en tipo de retorno
        if (originalElement.returnType !== modifiedElement.returnType) {
          violations.push({
            type: VerificationType.COHERENCE_CHECK,
            message: `Se modificó el tipo de retorno del método público '${originalElement.name}'.`,
            severity: 'high'
          });
        }
      }
    }
  }
  
  /**
   * Extrae elementos públicos (métodos y propiedades) de un código
   */
  private extractPublicElements(code: string): Array<{
    name: string;
    type: 'method' | 'property';
    parameters?: string;
    returnType?: string;
  }> {
    const elements: Array<{
      name: string;
      type: 'method' | 'property';
      parameters?: string;
      returnType?: string;
    }> = [];
    
    // Regex para métodos públicos
    const publicMethodRegex = /public\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]*))?/g;
    
    let match;
    while ((match = publicMethodRegex.exec(code)) !== null) {
      elements.push({
        name: match[1],
        type: 'method',
        parameters: match[2]?.trim() || '',
        returnType: match[3]?.trim() || 'void'
      });
    }
    
    // Regex para propiedades públicas
    const publicPropertyRegex = /public\s+(\w+)\s*:\s*([^;=]*)/g;
    
    while ((match = publicPropertyRegex.exec(code)) !== null) {
      elements.push({
        name: match[1],
        type: 'property'
      });
    }
    
    return elements;
  }
  
  /**
   * Verifica la coherencia de tipos
   */
  private checkTypeCoherence(originalCode: string, modifiedCode: string, violations: ViolationDetail[]): void {
    // Extraer interfaces y tipos
    const originalTypes = this.extractTypeDefs(originalCode);
    const modifiedTypes = this.extractTypeDefs(modifiedCode);
    
    // Verificar cambios incompatibles en interfaces
    for (const typeName of Object.keys(originalTypes)) {
      const originalType = originalTypes[typeName];
      const modifiedType = modifiedTypes[typeName];
      
      if (modifiedType) {
        // Verificar propiedades requeridas eliminadas
        for (const propName of Object.keys(originalType.props)) {
          const originalProp = originalType.props[propName];
          const modifiedProp = modifiedType.props[propName];
          
          if (!modifiedProp && !originalProp.optional) {
            violations.push({
              type: VerificationType.COHERENCE_CHECK,
              message: `Se eliminó la propiedad requerida '${propName}' del tipo '${typeName}'.`,
              severity: 'high'
            });
          } else if (modifiedProp && originalProp.type !== modifiedProp.type) {
            violations.push({
              type: VerificationType.COHERENCE_CHECK,
              message: `Se cambió el tipo de la propiedad '${propName}' en '${typeName}'.`,
              severity: 'medium'
            });
          }
        }
      }
    }
  }
  
  /**
   * Extrae definiciones de tipos de un código
   */
  private extractTypeDefs(code: string): Record<string, {
    kind: 'interface' | 'type';
    props: Record<string, { type: string; optional: boolean }>;
  }> {
    const types: Record<string, {
      kind: 'interface' | 'type';
      props: Record<string, { type: string; optional: boolean }>;
    }> = {};
    
    // Regex para interfaces
    const interfaceRegex = /interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*{([^}]*)}/g;
    
    let match;
    while ((match = interfaceRegex.exec(code)) !== null) {
      const name = match[1];
      const props = this.extractProps(match[2]);
      
      types[name] = {
        kind: 'interface',
        props
      };
    }
    
    // Regex para tipos
    const typeRegex = /type\s+(\w+)\s*=\s*{([^}]*)}/g;
    
    while ((match = typeRegex.exec(code)) !== null) {
      const name = match[1];
      const props = this.extractProps(match[2]);
      
      types[name] = {
        kind: 'type',
        props
      };
    }
    
    return types;
  }
  
  /**
   * Extrae propiedades de una definición de tipo
   */
  private extractProps(propsText: string): Record<string, { type: string; optional: boolean }> {
    const props: Record<string, { type: string; optional: boolean }> = {};
    
    // Regex para propiedades
    const propRegex = /(\w+)(\?)?:\s*([^;]*);/g;
    
    let match;
    while ((match = propRegex.exec(propsText)) !== null) {
      const name = match[1];
      const optional = Boolean(match[2]);
      const type = match[3].trim();
      
      props[name] = { type, optional };
    }
    
    return props;
  }
  
  /**
   * Verifica cambios en el manejo de errores
   */
  private checkErrorHandling(originalCode: string, modifiedCode: string, violations: ViolationDetail[]): void {
    // Contar bloques try-catch
    const originalTryCatchCount = (originalCode.match(/try\s*{/g) || []).length;
    const modifiedTryCatchCount = (modifiedCode.match(/try\s*{/g) || []).length;
    
    // Si se eliminaron bloques try-catch
    if (originalTryCatchCount > modifiedTryCatchCount) {
      violations.push({
        type: VerificationType.COHERENCE_CHECK,
        message: `Se eliminaron bloques try-catch (original: ${originalTryCatchCount}, modificado: ${modifiedTryCatchCount}).`,
        severity: 'medium'
      });
    }
    
    // Verificar si se eliminaron lanzamientos de excepciones
    const originalThrowCount = (originalCode.match(/throw\s+new\s+/g) || []).length;
    const modifiedThrowCount = (modifiedCode.match(/throw\s+new\s+/g) || []).length;
    
    if (originalThrowCount > modifiedThrowCount) {
      violations.push({
        type: VerificationType.COHERENCE_CHECK,
        message: `Se eliminaron lanzamientos de excepciones (original: ${originalThrowCount}, modificado: ${modifiedThrowCount}).`,
        severity: 'low'
      });
    }
  }
  
  /**
   * Verifica cambios en comentarios importantes
   */
  private checkImportantComments(originalCode: string, modifiedCode: string, violations: ViolationDetail[]): void {
    // Expresiones regulares para comentarios importantes
    const importantCommentPatterns = [
      { pattern: /\/\*\*\s*\n\s*\*\s*ESTA PROHIBIDO/i, description: 'Advertencia legal' },
      { pattern: /\/\*\*\s*\n\s*\*\s*WARNING:/i, description: 'Advertencia importante' },
      { pattern: /\/\/\s*IMPORTANTE:/i, description: 'Nota de importancia' },
      { pattern: /\/\/\s*TODO:/i, description: 'Tarea pendiente' }
    ];
    
    for (const { pattern, description } of importantCommentPatterns) {
      const originalMatches = originalCode.match(pattern) || [];
      const modifiedMatches = modifiedCode.match(pattern) || [];
      
      if (originalMatches.length > modifiedMatches.length) {
        violations.push({
          type: VerificationType.COHERENCE_CHECK,
          message: `Se eliminaron comentarios importantes de tipo "${description}".`,
          severity: 'medium'
        });
      }
    }
  }
}
