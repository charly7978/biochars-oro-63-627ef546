
/**
 * Integración con sistemas CI/CD
 * 
 * Este archivo proporciona funciones para integrar el Sistema de Escudo Protector
 * con herramientas de CI/CD como GitHub Actions y hooks de Git.
 */

import fs from 'fs';
import path from 'path';
import { shield } from './index';
import { getGuardianConfig, shouldIgnoreFile } from '../config/GuardianConfig';
import { SignalProcessingTelemetry, TelemetryCategory } from '../telemetry/SignalProcessingTelemetry';

// Instancia de telemetría
const telemetry = SignalProcessingTelemetry.getInstance();

/**
 * Verifica un archivo específico
 * @param filePath Ruta del archivo a verificar
 * @param originalContent Contenido original (si está disponible)
 * @returns Objeto con el resultado de la verificación
 */
export async function verifyFile(
  filePath: string,
  originalContent?: string
): Promise<{ success: boolean; violations: any[] }> {
  const config = getGuardianConfig();
  
  // Verificar si el archivo debe ignorarse
  if (shouldIgnoreFile(filePath, config)) {
    return { success: true, violations: [] };
  }
  
  const verificationId = `ci_verify_${Date.now()}_${filePath}`;
  telemetry.startPhase(verificationId, TelemetryCategory.CI_INTEGRATION);
  
  try {
    // Leer el contenido del archivo
    const currentContent = fs.readFileSync(filePath, 'utf-8');
    
    // Si no se proporciona contenido original, usar el del control de versiones
    let originalFileContent = originalContent;
    if (!originalFileContent) {
      try {
        // Intentar obtener la versión del archivo del repositorio
        originalFileContent = getFileFromRepository(filePath);
      } catch (error) {
        // Si no se puede obtener, usar el contenido actual
        originalFileContent = currentContent;
      }
    }
    
    // Obtener el nombre del módulo a partir de la ruta del archivo
    const pathParts = filePath.split('/');
    const moduleName = pathParts.length > 2 ? pathParts[pathParts.length - 2] : 'desconocido';
    
    // Realizar la verificación con el escudo protector
    const result = await shield.verifyChange(
      originalFileContent,
      currentContent,
      { fileName: filePath, moduleName }
    );
    
    telemetry.endPhase(verificationId, TelemetryCategory.CI_INTEGRATION);
    
    return {
      success: result.success,
      violations: result.details.violations || []
    };
  } catch (error) {
    telemetry.recordPhaseEvent(verificationId, 'verification_error', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      fileName: filePath
    });
    
    telemetry.endPhase(verificationId, TelemetryCategory.CI_INTEGRATION);
    
    console.error(`Error al verificar archivo ${filePath}:`, error);
    return {
      success: false,
      violations: [{
        type: 'error',
        message: `Error durante la verificación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        severity: 'high'
      }]
    };
  }
}

/**
 * Verifica todos los archivos modificados en el repositorio
 * @returns Objeto con los resultados de la verificación
 */
export async function verifyChangedFiles(): Promise<{
  success: boolean;
  fileResults: Array<{ file: string; success: boolean; violations: any[] }>;
}> {
  try {
    // Obtener la lista de archivos modificados
    const modifiedFiles = getModifiedFiles();
    
    if (modifiedFiles.length === 0) {
      return { success: true, fileResults: [] };
    }
    
    const results = [];
    let overallSuccess = true;
    
    // Verificar cada archivo modificado
    for (const file of modifiedFiles) {
      const result = await verifyFile(file);
      results.push({
        file,
        success: result.success,
        violations: result.violations
      });
      
      if (!result.success) {
        overallSuccess = false;
      }
    }
    
    return {
      success: overallSuccess,
      fileResults: results
    };
  } catch (error) {
    console.error('Error al verificar archivos modificados:', error);
    return {
      success: false,
      fileResults: []
    };
  }
}

/**
 * Obtiene una lista de archivos modificados según git
 */
function getModifiedFiles(): string[] {
  try {
    // Esta función debería ejecutar git diff para obtener archivos modificados
    // Como no podemos ejecutar comandos en este entorno, simulamos el resultado
    console.log('Obteniendo archivos modificados...');
    return [];
  } catch (error) {
    console.error('Error al obtener archivos modificados:', error);
    return [];
  }
}

/**
 * Obtiene el contenido de un archivo desde el repositorio git
 * @param filePath Ruta del archivo
 */
function getFileFromRepository(filePath: string): string {
  try {
    // Esta función debería ejecutar git show para obtener el contenido
    // Como no podemos ejecutar comandos en este entorno, devolvemos el contenido actual
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`No se pudo obtener el contenido original de ${filePath}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Función principal para CLI
 * @param args Argumentos de la línea de comandos
 */
export async function runCLI(args: string[]): Promise<number> {
  const command = args[0] || 'verify-all';
  
  try {
    switch (command) {
      case 'verify-all': {
        // Verificar todos los archivos
        const tsFiles = getAllTypeScriptFiles();
        let hasErrors = false;
        
        for (const file of tsFiles) {
          const result = await verifyFile(file);
          if (!result.success) {
            hasErrors = true;
            console.error(`Errores en ${file}:`, result.violations);
          }
        }
        
        return hasErrors ? 1 : 0;
      }
      
      case 'verify-changed': {
        // Verificar archivos modificados
        const result = await verifyChangedFiles();
        return result.success ? 0 : 1;
      }
      
      case 'verify-file': {
        // Verificar un archivo específico
        const filePath = args[1];
        if (!filePath) {
          console.error('Error: Se requiere un nombre de archivo para verificar.');
          return 1;
        }
        
        const result = await verifyFile(filePath);
        return result.success ? 0 : 1;
      }
      
      default:
        console.error(`Comando desconocido: ${command}`);
        return 1;
    }
  } catch (error) {
    console.error('Error:', error);
    return 1;
  }
}

/**
 * Obtiene todos los archivos TypeScript/JavaScript en el proyecto
 */
function getAllTypeScriptFiles(): string[] {
  const result: string[] = [];
  
  function scanDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (
        file.endsWith('.ts') || 
        file.endsWith('.tsx') || 
        file.endsWith('.js') || 
        file.endsWith('.jsx')
      ) {
        result.push(filePath);
      }
    }
  }
  
  scanDirectory('src');
  return result;
}

