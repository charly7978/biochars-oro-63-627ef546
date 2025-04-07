
#!/usr/bin/env node

/**
 * Script para proteger contra acciones peligrosas
 * Este script actúa como guardian para prevenir acciones potencialmente peligrosas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Archivos críticos que requieren confirmación para modificar
const CRITICAL_FILES = [
  'package.json',
  '.github/workflows',
  'ci/',
  '.npmrc',
  '.env'
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
 * Verifica una ruta de archivo por archivos críticos
 */
function isFileCritical(filePath) {
  return CRITICAL_FILES.some(criticalPath => filePath.includes(criticalPath));
}

/**
 * Pide confirmación al usuario para continuar
 */
function askForConfirmation(message) {
  process.stdout.write(`${colors.yellow}${message} (s/N): ${colors.reset}`);
  const response = require('readline-sync').question('');
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
  isFileCritical
};
