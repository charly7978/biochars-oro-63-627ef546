
#!/usr/bin/env node

/**
 * Script para verificar las referencias a categorías de telemetría
 * Este script analiza todos los archivos TypeScript/JavaScript buscando 
 * referencias inválidas a TelemetryCategory
 */

const fs = require('fs');
const path = require('path');

// Colores para la salida de la consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}Verificador de Categorías de Telemetría${colors.reset}`);

// Lista de categorías válidas
// IMPORTANTE: Mantener esta lista sincronizada con el enum en SignalProcessingTelemetry.ts
const VALID_CATEGORIES = [
  'PERFORMANCE',
  'SIGNAL_PROCESSING', 
  'NEURAL_NETWORK',
  'ERROR',
  'USER_INTERACTION',
  'SYSTEM',
  'CI_INTEGRATION',
  'MEMORY_MANAGEMENT',
  'SIGNAL_CAPTURE'
];

// Patrón para detectar uso de TelemetryCategory
const CATEGORY_REGEX = /TelemetryCategory\.([A-Z_]+)/g;

/**
 * Verifica un archivo en busca de referencias inválidas
 */
function verifyFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const invalidReferences = [];
    
    let match;
    while ((match = CATEGORY_REGEX.exec(content)) !== null) {
      const category = match[1];
      if (!VALID_CATEGORIES.includes(category)) {
        invalidReferences.push({
          category,
          lineNumber: getLineNumber(content, match.index)
        });
      }
    }
    
    return invalidReferences;
  } catch (error) {
    console.error(`${colors.red}Error al verificar ${filePath}:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Obtiene el número de línea para una posición en el texto
 */
function getLineNumber(content, position) {
  const lines = content.substring(0, position).split('\n');
  return lines.length;
}

/**
 * Escanea un directorio en busca de archivos TypeScript/JavaScript
 */
function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('dist')) {
      scanDirectory(filePath, results);
    } else if (
      stat.isFile() && 
      (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js'))
    ) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Buscar todos los archivos TypeScript/JavaScript en el proyecto
const tsFiles = scanDirectory('src');
console.log(`${colors.blue}Archivos a verificar: ${tsFiles.length}${colors.reset}`);

// Verificar cada archivo
let totalInvalidReferences = 0;
const invalidFiles = [];

for (const file of tsFiles) {
  const invalidReferences = verifyFile(file);
  
  if (invalidReferences.length > 0) {
    console.error(`${colors.red}Referencias inválidas en ${file}:${colors.reset}`);
    
    for (const ref of invalidReferences) {
      console.error(`  ${colors.yellow}Línea ${ref.lineNumber}:${colors.reset} TelemetryCategory.${ref.category} (categoría inexistente)`);
    }
    
    totalInvalidReferences += invalidReferences.length;
    invalidFiles.push(file);
  }
}

// Mostrar resultado final
if (totalInvalidReferences > 0) {
  console.error(`\n${colors.red}Se encontraron ${totalInvalidReferences} referencias inválidas en ${invalidFiles.length} archivos.${colors.reset}`);
  console.error(`${colors.yellow}Categorías válidas: ${VALID_CATEGORIES.join(', ')}${colors.reset}`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}✓ No se encontraron referencias inválidas a categorías de telemetría.${colors.reset}`);
  process.exit(0);
}
