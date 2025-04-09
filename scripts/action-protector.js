
#!/usr/bin/env node

/**
 * Script para proteger contra acciones peligrosas
 * Este script actúa como guardian para prevenir acciones potencialmente peligrosas
 * y ahora incluye pre-validación de tipos TypeScript para detectar errores antes de ejecutar
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline-sync');

// Colores para la salida de la consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bright: '\x1b[1m'
};

// Patrones peligrosos a detectar
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
  { pattern: /package\.json/, description: 'Modificación del package.json' },
  { pattern: /\.github\/workflows/, description: 'Modificación de configuraciones de CI/CD' }
];

// Patrones comunes de errores de TypeScript a detectar
const TS_ERROR_PATTERNS = [
  { pattern: /([A-Za-z0-9_]+)\s+does\s+not\s+exist\s+on\s+type/, description: 'Propiedad inexistente' },
  { pattern: /Cannot\s+find\s+name\s+['"]([^'"]+)['"]/, description: 'Variable no definida' },
  { pattern: /Type\s+['"]([^'"]+)['"]\s+is\s+not\s+assignable\s+to\s+type/, description: 'Tipo incompatible' },
  { pattern: /Property\s+['"]([^'"]+)['"]\s+does\s+not\s+exist\s+on\s+type/, description: 'Propiedad inexistente' }
];

/**
 * Verifica una acción por patrones peligrosos
 */
function verifyAction(action) {
  // Verificar patrones peligrosos
  for (const item of DANGEROUS_PATTERNS) {
    if (item.pattern.test(action)) {
      return {
        isDangerous: true,
        reason: `Patrón detectado: ${item.description}`
      };
    }
  }
  
  return { isDangerous: false };
}

/**
 * NUEVA FUNCIÓN: Pre-verifica un archivo TypeScript para detectar errores comunes
 */
function preVerifyTypeScriptFile(filePath) {
  if (!fs.existsSync(filePath) || !filePath.match(/\.(ts|tsx)$/)) {
    return { success: true };
  }

  try {
    console.log(`${colors.blue}Pre-verificando archivo TypeScript: ${filePath}${colors.reset}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Ejecutar una verificación de tipo simple con tsc
    try {
      // Intentar compilar solo el archivo para verificar errores
      execSync(`npx tsc --noEmit --skipLibCheck ${filePath}`, { stdio: 'pipe' });
      console.log(`${colors.green}✓ Verificación de tipos exitosa para ${filePath}${colors.reset}`);
      return { success: true };
    } catch (compileError) {
      const errorOutput = compileError.stderr?.toString() || compileError.toString();
      
      // Buscar patrones de error comunes
      const detectedErrors = [];
      
      for (const pattern of TS_ERROR_PATTERNS) {
        const matches = errorOutput.match(new RegExp(pattern.pattern, 'g'));
        if (matches && matches.length > 0) {
          detectedErrors.push(`${pattern.description}: ${matches[0]}`);
        }
      }
      
      // Buscar referencias a TelemetryCategory que no existen
      const telemetryCategoryErrors = errorOutput.match(/Property\s+['"]([A-Z_]+)['"]\s+does\s+not\s+exist\s+on\s+type\s+['"]typeof\s+TelemetryCategory['"]/g);
      if (telemetryCategoryErrors && telemetryCategoryErrors.length > 0) {
        for (const error of telemetryCategoryErrors) {
          const categoryMatch = error.match(/['"]([A-Z_]+)['"]/);
          if (categoryMatch && categoryMatch[1]) {
            detectedErrors.push(`Categoría de telemetría inexistente: ${categoryMatch[1]}`);
          }
        }
      }
      
      if (detectedErrors.length === 0) {
        detectedErrors.push("Errores de TypeScript detectados pero no se pudo determinar el tipo");
      }
      
      console.error(`${colors.bgRed}${colors.bright}⚠️  ¡ADVERTENCIA! Errores de TypeScript detectados:${colors.reset}`);
      for (const error of detectedErrors) {
        console.error(`${colors.red}- ${error}${colors.reset}`);
      }
      
      return { 
        success: false, 
        errors: detectedErrors 
      };
    }
  } catch (error) {
    console.error(`${colors.red}Error al pre-verificar ${filePath}:${colors.reset}`, error.message);
    return { 
      success: false, 
      errors: [`Error al verificar: ${error.message}`]
    };
  }
}

/**
 * Pide confirmación al usuario para continuar
 */
function askForConfirmation(message) {
  const response = readline.question(`${colors.yellow}${message} (s/N): ${colors.reset}`);
  return response.toLowerCase() === 's';
}

/**
 * Función principal
 */
function main() {
  // Recuperar los argumentos de la acción
  const args = process.argv.slice(2);
  const action = args.join(' ');
  
  console.log(`${colors.blue}Sistema de Protección de Acciones${colors.reset}`);
  console.log(`Acción solicitada: ${action}\n`);
  
  // Verificar si la acción es peligrosa
  const checkResult = verifyAction(action);
  
  if (checkResult.isDangerous) {
    console.log(`${colors.bgRed}${colors.bright}⚠️  ¡ADVERTENCIA! Acción potencialmente peligrosa detectada${colors.reset}`);
    console.log(`${colors.red}Razón: ${checkResult.reason}${colors.reset}\n`);
    
    const confirmation = askForConfirmation('¿Está seguro de que desea continuar con esta acción potencialmente peligrosa?');
    
    if (!confirmation) {
      console.log(`${colors.green}✓ Acción cancelada por seguridad.${colors.reset}`);
      process.exit(0);
    }
    
    console.log(`${colors.yellow}⚠️ Continuando con la acción potencialmente peligrosa por confirmación del usuario...${colors.reset}\n`);
  }
  
  // NUEVO: Pre-verificar archivos TypeScript si la acción implica modificación de archivos .ts o .tsx
  if (action.includes('.ts') && !action.includes('--noVerify')) {
    // Detectar posibles archivos TypeScript en el comando
    const tsFileMatches = action.match(/\S+\.tsx?/g);
    
    if (tsFileMatches && tsFileMatches.length > 0) {
      let tsErrors = false;
      
      for (const filePath of tsFileMatches) {
        if (fs.existsSync(filePath)) {
          const verifyResult = preVerifyTypeScriptFile(filePath);
          if (!verifyResult.success) {
            tsErrors = true;
          }
        }
      }
      
      if (tsErrors) {
        const confirmation = askForConfirmation('Se detectaron errores de TypeScript. ¿Desea continuar de todos modos?');
        
        if (!confirmation) {
          console.log(`${colors.green}✓ Acción cancelada por seguridad.${colors.reset}`);
          process.exit(0);
        }
        
        console.log(`${colors.yellow}⚠️ Continuando a pesar de los errores de TypeScript por confirmación del usuario...${colors.reset}\n`);
      }
    }
  }
  
  // Si llegamos aquí, la acción fue confirmada o no es peligrosa
  try {
    // Ejecutar la acción solicitada
    const result = execSync(action, { stdio: 'inherit' });
    console.log(`${colors.green}✓ Acción completada con éxito.${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error al ejecutar la acción:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Ejecutar la función principal
if (require.main === module) {
  main();
}

module.exports = {
  verifyAction,
  preVerifyTypeScriptFile
};
