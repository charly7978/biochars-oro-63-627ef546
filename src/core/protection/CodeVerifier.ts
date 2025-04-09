/**
 * Verificador de Código
 * 
 * Analiza las dependencias y referencias, verifica la integridad de los tipos y interfaces,
 * y comprueba que no haya duplicación de funcionalidades.
 */

import { VerificationResult, VerificationType, ViolationDetail } from './types';
import { SignalProcessingTelemetry, TelemetryCategory } from '../telemetry/SignalProcessingTelemetry';

export class CodeVerifier {
  private telemetry: SignalProcessingTelemetry;
  
  constructor() {
    this.telemetry = SignalProcessingTelemetry.getInstance();
  }
  
  /**
   * Verifica el código modificado para asegurar que cumple con los estándares
   */
  public async verifyCode(
    originalCode: string,
    modifiedCode: string,
    context: { fileName: string; moduleName: string; }
  ): Promise<VerificationResult> {
    console.log(`Verificando cambios en ${context.fileName}...`);
    
    const verificationId = `verify_${Date.now()}_${context.fileName}`;
    this.telemetry.startPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
    
    const violations: ViolationDetail[] = [];
    
    // Verificar dependencias
    const dependencyViolations = this.checkDependencies(originalCode, modifiedCode);
    violations.push(...dependencyViolations);
    
    // Verificar integridad de tipos
    const typeViolations = this.checkTypeIntegrity(originalCode, modifiedCode);
    violations.push(...typeViolations);
    
    // Verificar enumeraciones y referencias
    const enumViolations = this.checkEnumReferences(modifiedCode);
    violations.push(...enumViolations);
    
    // Verificar errores de sintaxis TypeScript
    const syntaxViolations = this.checkTypescriptSyntax(modifiedCode);
    violations.push(...syntaxViolations);
    
    // Verificar duplicaciones
    const duplicationViolations = this.checkDuplication(originalCode, modifiedCode);
    violations.push(...duplicationViolations);
    
    // Verificar específicamente para archivos de extracción de señales
    if (context.fileName.includes('Extractor') || context.fileName.includes('signal-processing')) {
      const simulationViolations = this.checkForSimulation(modifiedCode);
      violations.push(...simulationViolations);
    }
    
    // Verificar uso de funciones prohibidas en el contexto
    const prohibitedFunctionViolations = this.checkProhibitedFunctions(modifiedCode, context);
    violations.push(...prohibitedFunctionViolations);
    
    // Determinar resultado final
    const highSeverityViolations = violations.filter(v => v.severity === 'high');
    
    this.telemetry.endPhase(verificationId, TelemetryCategory.SIGNAL_PROCESSING);
    
    if (highSeverityViolations.length > 0) {
      return {
        success: false,
        message: 'Se encontraron violaciones críticas que impiden aplicar el cambio.',
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
        message: 'Se encontraron advertencias, pero se puede proceder con el cambio.',
        details: {
          violations,
          totalViolations: violations.length,
          warningsOnly: true
        }
      };
    }
    
    return {
      success: true,
      message: 'Verificación exitosa. No se encontraron problemas.',
      details: {
        verificationPassed: true
      }
    };
  }
  
  /**
   * Verifica las dependencias en el código
   */
  private checkDependencies(originalCode: string, modifiedCode: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Extraer importaciones del código original y modificado
    const originalImports = this.extractImports(originalCode);
    const modifiedImports = this.extractImports(modifiedCode);
    
    // Verificar si se eliminaron importaciones que aún se utilizan
    const removedImports = originalImports.filter(imp => !modifiedImports.includes(imp));
    for (const removedImport of removedImports) {
      // Verificar si el módulo aún se usa en el código
      if (this.isModuleStillUsed(removedImport, modifiedCode)) {
        violations.push({
          type: VerificationType.DEPENDENCY_CHECK,
          message: `Se eliminó la importación ${removedImport} pero aún se utiliza en el código.`,
          severity: 'high'
        });
      }
    }
    
    // Verificar si hay importaciones circulares
    for (const modifiedImport of modifiedImports) {
      if (this.couldCreateCircularDependency(modifiedImport, modifiedCode)) {
        violations.push({
          type: VerificationType.DEPENDENCY_CHECK,
          message: `Posible dependencia circular con ${modifiedImport}.`,
          severity: 'medium'
        });
      }
    }
    
    return violations;
  }
  
  /**
   * Extrae las importaciones de un código
   */
  private extractImports(code: string): string[] {
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+[^\s;]+|[^\s;,]+)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
  
  /**
   * Verifica si un módulo sigue siendo utilizado en el código
   */
  private isModuleStillUsed(importPath: string, code: string): boolean {
    // Extraer el nombre del módulo del path de importación
    const moduleName = importPath.split('/').pop() || '';
    const moduleNameWithoutExtension = moduleName.replace(/\.\w+$/, '');
    
    // Buscar referencias al módulo en el código
    const regex = new RegExp(`\\b${moduleNameWithoutExtension}\\b`, 'g');
    return regex.test(code);
  }
  
  /**
   * Verifica si una importación podría crear una dependencia circular
   */
  private couldCreateCircularDependency(importPath: string, code: string): boolean {
    // Implementación simplificada - en un sistema real esto requeriría análisis del grafo de dependencias
    return importPath.includes('./') && code.includes(`from '${importPath}'`);
  }
  
  /**
   * Verifica la integridad de los tipos
   */
  private checkTypeIntegrity(originalCode: string, modifiedCode: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Extraer interfaces y tipos del código original
    const originalTypes = this.extractTypes(originalCode);
    const modifiedTypes = this.extractTypes(modifiedCode);
    
    // Verificar cambios incompatibles en tipos
    for (const typeName of Object.keys(originalTypes)) {
      if (modifiedTypes[typeName]) {
        // Si el tipo aún existe, verificar cambios incompatibles
        const originalType = originalTypes[typeName];
        const modifiedType = modifiedTypes[typeName];
        
        // Verificar si se eliminaron propiedades requeridas
        for (const prop of Object.keys(originalType.properties)) {
          if (!modifiedType.properties[prop]) {
            violations.push({
              type: VerificationType.TYPE_INTEGRITY,
              message: `Se eliminó la propiedad requerida '${prop}' del tipo '${typeName}'.`,
              severity: 'high'
            });
          }
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Extrae los tipos e interfaces de un código
   */
  private extractTypes(code: string): Record<string, { properties: Record<string, boolean> }> {
    const types: Record<string, { properties: Record<string, boolean> }> = {};
    
    // Expresiones regulares para encontrar interfaces y tipos
    const interfaceRegex = /interface\s+(\w+)\s*(?:extends\s+[^{]+)?\s*{([^}]*)}/g;
    const typeRegex = /type\s+(\w+)\s*=\s*{([^}]*)}/g;
    
    // Encontrar interfaces
    let match;
    while ((match = interfaceRegex.exec(code)) !== null) {
      const name = match[1];
      const properties = this.extractProperties(match[2]);
      types[name] = { properties };
    }
    
    // Encontrar tipos
    while ((match = typeRegex.exec(code)) !== null) {
      const name = match[1];
      const properties = this.extractProperties(match[2]);
      types[name] = { properties };
    }
    
    return types;
  }
  
  /**
   * Extrae las propiedades de una definición de tipo
   */
  private extractProperties(propertiesText: string): Record<string, boolean> {
    const properties: Record<string, boolean> = {};
    const propRegex = /(\w+)(\?)?:/g;
    
    let match;
    while ((match = propRegex.exec(propertiesText)) !== null) {
      const name = match[1];
      const isOptional = match[2] === '?';
      properties[name] = !isOptional;
    }
    
    return properties;
  }
  
  /**
   * Verifica referencias a enumeraciones y valores de enum
   * Detecta errores comunes como referencias a valores de enum inexistentes
   */
  private checkEnumReferences(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Extraer definiciones de enum
    const enumDefinitions = this.extractEnumDefinitions(code);
    
    // Verificar referencias a enums
    for (const enumName of Object.keys(enumDefinitions)) {
      const enumValues = enumDefinitions[enumName];
      const enumReferences = this.extractEnumReferences(code, enumName);
      
      // Verificar si las referencias a valores existen en la definición
      for (const reference of enumReferences) {
        if (!enumValues.includes(reference) && reference !== enumName) {
          violations.push({
            type: VerificationType.TYPE_INTEGRITY,
            message: `Referencia a valor inexistente '${reference}' en enum '${enumName}'.`,
            severity: 'high'
          });
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Extrae las definiciones de enumeraciones
   */
  private extractEnumDefinitions(code: string): Record<string, string[]> {
    const enumDefinitions: Record<string, string[]> = {};
    const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;
    
    let match;
    while ((match = enumRegex.exec(code)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      
      // Extraer valores del enum
      const valueRegex = /\b(\w+)\b\s*=?\s*['"]?([^,\s'"]*)/g;
      const values: string[] = [];
      
      let valueMatch;
      while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
        values.push(valueMatch[1]);
      }
      
      enumDefinitions[enumName] = values;
    }
    
    return enumDefinitions;
  }
  
  /**
   * Extrae referencias a valores de un enum específico
   */
  private extractEnumReferences(code: string, enumName: string): string[] {
    const references: string[] = [];
    const referenceRegex = new RegExp(`${enumName}\\.([\\w_]+)`, 'g');
    
    let match;
    while ((match = referenceRegex.exec(code)) !== null) {
      references.push(match[1]);
    }
    
    return references;
  }
  
  /**
   * Verifica errores de sintaxis básicos en TypeScript
   */
  private checkTypescriptSyntax(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Verificar paréntesis, corchetes y llaves sin cerrar
    const openBrackets = (code.match(/\(/g) || []).length;
    const closeBrackets = (code.match(/\)/g) || []).length;
    if (openBrackets !== closeBrackets) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Desequilibrio en paréntesis: ${openBrackets} abiertos vs ${closeBrackets} cerrados.`,
        severity: 'high'
      });
    }
    
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Desequilibrio en llaves: ${openBraces} abiertas vs ${closeBraces} cerradas.`,
        severity: 'high'
      });
    }
    
    const openSquares = (code.match(/\[/g) || []).length;
    const closeSquares = (code.match(/\]/g) || []).length;
    if (openSquares !== closeSquares) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: `Desequilibrio en corchetes: ${openSquares} abiertos vs ${closeSquares} cerrados.`,
        severity: 'high'
      });
    }
    
    // Verificar errores comunes de typescript
    if (code.includes('import type') && code.includes('= require(')) {
      violations.push({
        type: VerificationType.TYPE_INTEGRITY,
        message: 'Mezcla de sintaxis de importación ES6 y CommonJS en el mismo archivo.',
        severity: 'medium'
      });
    }
    
    // Verificar propiedades privadas accedidas incorrectamente
    const privateProps = this.extractPrivateProperties(code);
    for (const prop of privateProps) {
      const directAccess = new RegExp(`(?<!this\\.)${prop}\\b`, 'g');
      if (directAccess.test(code)) {
        violations.push({
          type: VerificationType.TYPE_INTEGRITY,
          message: `Posible acceso incorrecto a propiedad privada '${prop}'.`,
          severity: 'medium'
        });
      }
    }
    
    return violations;
  }
  
  /**
   * Extrae propiedades privadas de una clase
   */
  private extractPrivateProperties(code: string): string[] {
    const privateProps: string[] = [];
    const privatePropsRegex = /private\s+(\w+)\s*:/g;
    
    let match;
    while ((match = privatePropsRegex.exec(code)) !== null) {
      privateProps.push(match[1]);
    }
    
    return privateProps;
  }
  
  /**
   * Verifica si hay duplicación de funcionalidades
   */
  private checkDuplication(originalCode: string, modifiedCode: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Extraer funciones del código original y modificado
    const originalFunctions = this.extractFunctions(originalCode);
    const modifiedFunctions = this.extractFunctions(modifiedCode);
    
    // Verificar funciones similares
    for (let i = 0; i < modifiedFunctions.length; i++) {
      for (let j = i + 1; j < modifiedFunctions.length; j++) {
        const func1 = modifiedFunctions[i];
        const func2 = modifiedFunctions[j];
        
        // Verificar similitud entre funciones
        if (this.areFunctionsSimilar(func1, func2)) {
          violations.push({
            type: VerificationType.DUPLICATION_CHECK,
            message: `Posible duplicación de funcionalidad entre '${func1.name}' y '${func2.name}'.`,
            severity: 'medium'
          });
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Extrae las funciones de un código
   */
  private extractFunctions(code: string): Array<{ name: string; body: string }> {
    const functions: Array<{ name: string; body: string }> = [];
    
    // Regex para encontrar definiciones de funciones
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*function|\b(public|private|protected|async)?\s*(\w+)\s*\()\s*\([^)]*\)\s*{([^}]*)}/g;
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1] || match[2] || match[4] || 'anonymous';
      const body = match[5] || '';
      functions.push({ name, body });
    }
    
    return functions;
  }
  
  /**
   * Verifica si dos funciones son similares (posible duplicación)
   */
  private areFunctionsSimilar(func1: { name: string; body: string }, func2: { name: string; body: string }): boolean {
    // Simplificado para demostración, en un sistema real se usaría un algoritmo más sofisticado
    const lines1 = func1.body.split('\n').filter(line => line.trim().length > 0);
    const lines2 = func2.body.split('\n').filter(line => line.trim().length > 0);
    
    if (lines1.length < 3 || lines2.length < 3) {
      return false; // Funciones muy pequeñas
    }
    
    // Contar líneas similares
    let similarLines = 0;
    for (const line1 of lines1) {
      if (lines2.some(line2 => this.areLinesSimilar(line1, line2))) {
        similarLines++;
      }
    }
    
    // Si más del 70% de las líneas son similares, considerar duplicación
    return similarLines > 0.7 * Math.min(lines1.length, lines2.length);
  }
  
  /**
   * Verifica si dos líneas de código son similares
   */
  private areLinesSimilar(line1: string, line2: string): boolean {
    // Normalizar líneas
    const normal1 = line1.trim().replace(/\s+/g, ' ');
    const normal2 = line2.trim().replace(/\s+/g, ' ');
    
    // Si son idénticas, son similares
    if (normal1 === normal2) return true;
    
    // Verificar longitud similar
    if (Math.abs(normal1.length - normal2.length) > 10) return false;
    
    // Contar caracteres comunes
    let commonChars = 0;
    for (let i = 0; i < Math.min(normal1.length, normal2.length); i++) {
      if (normal1[i] === normal2[i]) commonChars++;
    }
    
    return commonChars > 0.8 * Math.min(normal1.length, normal2.length);
  }
  
  /**
   * Verifica si hay código de simulación (prohibido específicamente en el código)
   */
  private checkForSimulation(code: string): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Palabras clave que podrían indicar simulación
    const simulationKeywords = [
      'simul',
      'fake',
      'mock',
      'synthetic',
      'generateRandom',
      'artificialSignal'
    ];
    
    for (const keyword of simulationKeywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'i');
      if (regex.test(code)) {
        violations.push({
          type: VerificationType.LEGAL_COMPLIANCE,
          message: `Posible código de simulación detectado (palabra clave: ${keyword}).`,
          severity: 'high'
        });
      }
    }
    
    return violations;
  }
  
  /**
   * Verifica si hay funciones prohibidas basándose en el contexto
   */
  private checkProhibitedFunctions(code: string, context: { fileName: string; moduleName: string }): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Funciones prohibidas basadas en el contexto
    const prohibitedFunctions: Record<string, string[]> = {
      'extraction': ['simulateSignal', 'generateFakeData', 'mockHeartbeat'],
      'heart-beat': ['simulateHeartbeat', 'generateSyntheticPulse', 'fakeECG'],
      'signal-processing': ['generateRandomNoise', 'addSyntheticArtifacts']
    };
    
    // Determinar el módulo del archivo
    const moduleKey = Object.keys(prohibitedFunctions).find(
      key => context.fileName.includes(key) || context.moduleName.includes(key)
    );
    
    if (moduleKey && prohibitedFunctions[moduleKey]) {
      for (const funcName of prohibitedFunctions[moduleKey]) {
        const regex = new RegExp(`\\b${funcName}\\b`, 'g');
        if (regex.test(code)) {
          violations.push({
            type: VerificationType.LEGAL_COMPLIANCE,
            message: `Función prohibida detectada: ${funcName} en módulo ${moduleKey}.`,
            severity: 'high'
          });
        }
      }
    }
    
    return violations;
  }
}
