/**
 * Verificador de Tipos Pre-Commit
 * 
 * Realiza una verificación sintáctica y de tipos antes de que se apliquen cambios.
 * Este componente detecta errores de sintaxis y tipos que podrían causar problemas de compilación.
 */

import { VerificationResult, VerificationType, ViolationDetail } from './types';
import { SignalProcessingTelemetry, TelemetryCategory } from '../telemetry/SignalProcessingTelemetry';

export class PreCommitTypeChecker {
  private telemetry: SignalProcessingTelemetry;
  
  constructor() {
    this.telemetry = SignalProcessingTelemetry.getInstance();
    console.log('PreCommitTypeChecker: Inicializado');
  }
  
  /**
   * Realiza una verificación previa a la aplicación de cambios
   */
  public async performPreCommitCheck(
    code: string, 
    context: { fileName: string; moduleName: string; }
  ): Promise<VerificationResult> {
    const checkId = `pre_commit_check_${Date.now()}`;
    this.telemetry.startPhase(checkId, TelemetryCategory.PERFORMANCE);
    
    console.log(`PreCommitTypeChecker: Verificando ${context.fileName}`);
    
    const violations: ViolationDetail[] = [];
    
    // Verificar errores de sintaxis básicos
    const syntaxViolations = this.checkBasicSyntax(code);
    violations.push(...syntaxViolations);
    
    // Verificar errores de tipo comunes
    const typeViolations = this.checkCommonTypeErrors(code, context.fileName);
    violations.push(...typeViolations);
    
    // Verificar enumeraciones específicamente
    const enumViolations = this.checkEnumDefinitions(code);
    violations.push(...enumViolations);
    
    // Verificar importaciones
    const importViolations = this.checkImports(code);
    violations.push(...importViolations);
    
    // Verificar referencias a definiciones de telemetría (específico para prevenir errores como el de TelemetryCategory)
    if (context.fileName.includes('telemetry') || code.includes('Telemetry') || code.includes('TelemetryCategory')) {
      const telemetryViolations = this.checkTelemetryReferences(code);
      violations.push(...telemetryViolations);
    }
    
    // Nueva verificación: analizar todos los archivos en busca de referencias a TelemetryCategory
    const telemetryCategoryViolations = this.checkTelemetryCategoryUsage(code);
    violations.push(...telemetryCategoryViolations);
    
    this.telemetry.endPhase(checkId, TelemetryCategory.PERFORMANCE);
    
    const criticalViolations = violations.filter(v => v.severity === 'high');
    
    if (criticalViolations.length > 0) {
      return {
        success: false,
        message: `Se encontraron ${criticalViolations.length} errores críticos de sintaxis/tipo que impedirían la compilación.`,
        details: {
          violations,
          fileName: context.fileName
        }
      };
    }
    
    return {
      success: true,
      message: 'Verificación de sintaxis y tipos exitosa.',
      details: {
        warningCount: violations.length,
        fileName: context.fileName
      }
    };
  }
  
  /**
   * Verifica errores básicos de sintaxis
   */
  private checkBasicSyntax(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Verificar que no haya llaves, paréntesis o corchetes sin cerrar
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Desequilibrio en llaves: ${openBraces} abiertas vs ${closeBraces} cerradas.`,
        severity: 'high'
      });
    }
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Desequilibrio en paréntesis: ${openParens} abiertos vs ${closeParens} cerrados.`,
        severity: 'high'
      });
    }
    
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Desequilibrio en corchetes: ${openBrackets} abiertos vs ${closeBrackets} cerrados.`,
        severity: 'high'
      });
    }
    
    // Verificar puntos y coma faltantes en líneas que deberían tenerlos
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Ignorar líneas que son comentarios, están vacías o tienen llaves
      if (line.startsWith('//') || line.length === 0 || line.includes('{') || 
          line.includes('}') || line.endsWith(';') || line.endsWith(',')) {
        continue;
      }
      
      // Verificar líneas que probablemente deberían terminar en punto y coma
      if (/(\b(const|let|var)\b.*=.*|\breturn\b.*|[a-zA-Z0-9)\]]$)/.test(line) && 
          !line.endsWith(';') && !lines[i+1]?.trim().startsWith('.')) {
        violations.push({
          type: VerificationType.TYPE_INTEGRITY,
          message: `Posible falta de punto y coma en línea ${i+1}: "${line}"`,
          severity: 'medium'
        });
      }
    }
    
    // Verificar declaraciones de función erróneas
    const invalidFunctionDeclarations = code.match(/function\s+\w+\s*\{/g);
    if (invalidFunctionDeclarations) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Declaración de función con sintaxis incorrecta (faltan paréntesis): ${invalidFunctionDeclarations[0]}`,
        severity: 'high'
      });
    }
    
    return violations;
  }
  
  /**
   * Verifica errores comunes de tipo
   */
  private checkCommonTypeErrors(code: string, fileName: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Verificar asignaciones a tipos incompatibles básicos
    const potentialTypeErrors = [
      { pattern: /const\s+(\w+)\s*:\s*number\s*=\s*['"][^'"]*['"]/g, message: 'Posible asignación de string a variable de tipo number' },
      { pattern: /const\s+(\w+)\s*:\s*string\s*=\s*\d+(?!\s*\+\s*['"])/g, message: 'Posible asignación de number a variable de tipo string' },
      { pattern: /const\s+(\w+)\s*:\s*boolean\s*=\s*(?!true|false|[a-zA-Z_]\w*)[^;]+/g, message: 'Posible asignación de valor no booleano a variable de tipo boolean' }
    ];
    
    for (const error of potentialTypeErrors) {
      let match;
      while ((match = error.pattern.exec(code)) !== null) {
        violations.push({
          type: VerificationType.TYPE_INTEGRITY,
          message: `${error.message}: ${match[0]}`,
          severity: 'high'
        });
      }
    }
    
    // Verificar acceso a propiedad inexistente (patrones comunes)
    const potentialPropertyErrors = code.match(/\.\s*[a-zA-Z_]\w*\s*\.\s*[a-zA-Z_]\w*\s*\.\s*[a-zA-Z_]\w*/g);
    if (potentialPropertyErrors) {
      for (const propAccess of potentialPropertyErrors) {
        violations.push({
          type: VerificationType.TYPE_INTEGRITY,
          message: `Posible acceso a propiedad anidada inexistente: ${propAccess}`,
          severity: 'medium'
        });
      }
    }
    
    // Verificar errores de interfaz específicos para ciertos tipos de archivos
    if (fileName.includes('telemetry')) {
      if (code.includes('TelemetryCategory') && !code.includes('enum TelemetryCategory')) {
        const telemetryCategoryUsages = code.match(/TelemetryCategory\.[A-Z_]+/g) || [];
        
        // Verificar que todos los usos de TelemetryCategory referenciados estén definidos
        for (const usage of telemetryCategoryUsages) {
          const category = usage.split('.')[1];
          if (!code.includes(`${category} = `)) {
            violations.push({
              type: VerificationType.TYPE_INTEGRITY,
              message: `Posible referencia a categoría de telemetría inexistente: ${usage}`,
              severity: 'high'
            });
          }
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Verifica definiciones de enumeraciones y sus usos
   */
  private checkEnumDefinitions(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Extraer definiciones de enum
    const enumMatches = [...code.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)];
    
    for (const enumMatch of enumMatches) {
      const enumName = enumMatch[1];
      const enumBody = enumMatch[2];
      
      // Verificar duplicados en valores de enum
      const enumValues = [...enumBody.matchAll(/\b(\w+)\b\s*=?\s*/g)].map(m => m[1]);
      const uniqueValues = new Set(enumValues);
      
      if (enumValues.length !== uniqueValues.size) {
        const duplicates = enumValues.filter((value, index, self) => self.indexOf(value) !== index);
        violations.push({
          type: VerificationType.TYPE_INTEGRITY,
          message: `Valores duplicados en enum ${enumName}: ${duplicates.join(', ')}`,
          severity: 'high'
        });
      }
      
      // Verificar usos del enum en el código
      const enumUsages = [...code.matchAll(new RegExp(`${enumName}\\.([\\w_]+)`, 'g'))];
      for (const usage of enumUsages) {
        const usedValue = usage[1];
        if (!enumValues.includes(usedValue)) {
          violations.push({
            type: VerificationType.TYPE_INTEGRITY,
            message: `Referencia a valor inexistente '${usedValue}' en enum '${enumName}'.`,
            severity: 'high'
          });
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Verifica importaciones y referencias
   */
  private checkImports(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Extraer importaciones
    const imports = [...code.matchAll(/import\s+(?:{([^}]*)}\s+from\s+['"]([^'"]+)['"]|([^;]+)\s+from\s+['"]([^'"]+)['"])/g)];
    
    for (const importMatch of imports) {
      let importedItems;
      let importPath;
      
      if (importMatch[1]) {
        // Importación con llaves
        importedItems = importMatch[1].split(',').map(item => item.trim().split(' as ')[0]);
        importPath = importMatch[2];
      } else {
        // Importación por defecto o de otro tipo
        importPath = importMatch[4];
      }
      
      // Verificar path de importación
      if (importPath && (importPath.includes('..') || importPath.startsWith('.'))) {
        // Es una importación relativa, verificar que la estructura sea válida
        if (importPath.match(/\.{2,3}\/[^/]/)) {
          // Parece válida
        } else if (!importPath.match(/^\.{1,2}\/[^/]+/)) {
          violations.push({
            type: VerificationType.DEPENDENCY_CHECK,
            message: `Posible path de importación relativa inválido: ${importPath}`,
            severity: 'high'
          });
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Verificaciones específicas para referencias en el código de telemetría
   */
  private checkTelemetryReferences(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Verificar que todas las categorías de telemetría usadas estén definidas
    if (code.includes('TelemetryCategory')) {
      // Extraer la definición del enum si existe
      const enumMatch = code.match(/enum\s+TelemetryCategory\s*\{([^}]*)\}/);
      if (enumMatch) {
        const enumDefinition = enumMatch[1];
        
        // Extraer todas las categorías definidas
        const definedCategories = [...enumDefinition.matchAll(/\b([A-Z_]+)\s*=/g)].map(m => m[1]);
        
        // Buscar usos de TelemetryCategory en el código
        const categoryUsages = [...code.matchAll(/TelemetryCategory\.([A-Z_]+)/g)].map(m => m[1]);
        
        // Identificar categorías usadas pero no definidas
        const uniqueUsages = [...new Set(categoryUsages)];
        for (const usage of uniqueUsages) {
          if (!definedCategories.includes(usage)) {
            violations.push({
              type: VerificationType.TYPE_INTEGRITY,
              message: `La categoría de telemetría "${usage}" se usa pero no está definida en el enum TelemetryCategory.`,
              severity: 'high'
            });
          }
        }
      } else if (code.includes('TelemetryCategory.')) {
        // Se usan categorías pero no hay definición de enum en este archivo
        // Verificar si hay imports de TelemetryCategory
        if (!code.match(/import\s+.*\{\s*TelemetryCategory\s*\}/)) {
          violations.push({
            type: VerificationType.TYPE_INTEGRITY,
            message: 'Se usa TelemetryCategory pero no se importa ni se define en este archivo.',
            severity: 'high'
          });
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Nueva función: Verificar específicamente el uso de TelemetryCategory
   * Detecta referencias a categorías que no existen en el enum
   */
  private checkTelemetryCategoryUsage(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Lista completa de categorías válidas
    const validCategories = Object.keys(TelemetryCategory)
      .filter(key => isNaN(Number(key)))  // Filtrar solo las claves de string
      .map(key => key.toString());
    
    // Buscar usos del patrón TelemetryCategory.ALGO
    const categoryUsageRegex = /TelemetryCategory\.([A-Z_]+)/g;
    let match;
    
    while ((match = categoryUsageRegex.exec(code)) !== null) {
      const usedCategory = match[1];
      
      // Verificar si la categoría existe en el enum
      if (!validCategories.includes(usedCategory)) {
        violations.push({
          type: VerificationType.TYPE_INTEGRITY,
          message: `Referencia a categoría de telemetría inexistente: TelemetryCategory.${usedCategory}`,
          severity: 'high'
        });
      }
    }
    
    return violations;
  }
}
