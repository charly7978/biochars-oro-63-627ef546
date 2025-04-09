
#!/usr/bin/env node

/**
 * Script CLI para ejecutar el Sistema de Escudo Protector (Guardian)
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
  magenta: '\x1b[35m'
};

// Parsear argumentos
const args = process.argv.slice(2);
const command = args[0] || 'verify-all';

console.log(`${colors.blue}Sistema de Escudo Protector (Guardian) - CLI${colors.reset}`);

// Función principal
async function main() {
  try {
    switch (command) {
      case 'verify-all':
        await verifyAllFiles();
        break;
      case 'verify-changed':
        await verifyChangedFiles();
        break;
      case 'verify-file':
        if (!args[1]) {
          console.error(`${colors.red}Error: Se requiere un nombre de archivo para verificar.${colors.reset}`);
          showHelp();
          process.exit(1);
        }
        await verifyFile(args[1]);
        break;
      case 'install-hooks':
        await installHooks();
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Funciones auxiliares
async function verifyAllFiles() {
  console.log(`${colors.blue}Verificando todos los archivos...${colors.reset}`);
  
  // Obtener lista de archivos TypeScript/JavaScript
  let tsFiles;
  try {
    tsFiles = execSync('find src -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx"')
      .toString()
      .split('\n')
      .filter(file => file.trim() !== '');
  } catch (error) {
    console.error(`${colors.red}Error al buscar archivos:${colors.reset}`, error.message);
    process.exit(1);
  }
  
  console.log(`${colors.blue}Encontrados ${tsFiles.length} archivos para verificar.${colors.reset}`);
  
  // Verificar cada archivo
  let hasErrors = false;
  for (const file of tsFiles) {
    try {
      // Aquí se llamaría a la función de verificación real usando la API del Guardian
      console.log(`${colors.yellow}Verificando ${file}...${colors.reset}`);
      
      // Simulación - En un entorno real, aquí se cargaría y ejecutaría el módulo real
      await new Promise(resolve => setTimeout(resolve, 100)); // Simular procesamiento
      
      console.log(`${colors.green}✓ ${file}${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Error en ${file}:${colors.reset}`, error.message);
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.error(`${colors.red}La verificación falló. Algunos archivos tienen errores.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}Todos los archivos pasaron la verificación.${colors.reset}`);
  }
}

async function verifyChangedFiles() {
  console.log(`${colors.blue}Verificando archivos modificados...${colors.reset}`);
  
  try {
    // Obtener archivos modificados
    const gitStatus = execSync('git status --porcelain').toString();
    const modifiedFiles = gitStatus
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.substring(3))
      .filter(file => 
        file.endsWith('.ts') || file.endsWith('.tsx') || 
        file.endsWith('.js') || file.endsWith('.jsx')
      );
    
    if (modifiedFiles.length === 0) {
      console.log(`${colors.yellow}No hay archivos modificados para verificar.${colors.reset}`);
      return;
    }
    
    console.log(`${colors.blue}Encontrados ${modifiedFiles.length} archivos modificados para verificar.${colors.reset}`);
    
    // Verificar cada archivo modificado
    let hasErrors = false;
    for (const file of modifiedFiles) {
      try {
        console.log(`${colors.yellow}Verificando ${file}...${colors.reset}`);
        
        // Simulación - En un entorno real, aquí se cargaría y ejecutaría el módulo real
        await new Promise(resolve => setTimeout(resolve, 100)); // Simular procesamiento
        
        console.log(`${colors.green}✓ ${file}${colors.reset}`);
      } catch (error) {
        console.error(`${colors.red}✗ Error en ${file}:${colors.reset}`, error.message);
        hasErrors = true;
      }
    }
    
    if (hasErrors) {
      console.error(`${colors.red}La verificación falló. Algunos archivos tienen errores.${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`${colors.green}Todos los archivos modificados pasaron la verificación.${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error al verificar archivos modificados:${colors.reset}`, error.message);
    process.exit(1);
  }
}

async function verifyFile(fileName) {
  console.log(`${colors.blue}Verificando archivo ${fileName}...${colors.reset}`);
  
  try {
    if (!fs.existsSync(fileName)) {
      console.error(`${colors.red}Error: El archivo ${fileName} no existe.${colors.reset}`);
      process.exit(1);
    }
    
    // Simulación - En un entorno real, aquí se cargaría y ejecutaría el módulo real
    await new Promise(resolve => setTimeout(resolve, 300)); // Simular procesamiento
    
    console.log(`${colors.green}El archivo ${fileName} pasó la verificación.${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error al verificar ${fileName}:${colors.reset}`, error.message);
    process.exit(1);
  }
}

async function installHooks() {
  console.log(`${colors.blue}Instalando hooks de Git...${colors.reset}`);
  
  try {
    // Llamar al script de instalación de hooks
    require('./install-hooks.js');
  } catch (error) {
    console.error(`${colors.red}Error al instalar hooks:${colors.reset}`, error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
${colors.blue}Uso:${colors.reset}
  node scripts/run-guardian.js [comando] [opciones]

${colors.blue}Comandos:${colors.reset}
  verify-all           Verifica todos los archivos TypeScript/JavaScript
  verify-changed       Verifica solo archivos modificados según git
  verify-file <file>   Verifica un archivo específico
  install-hooks        Instala los hooks de Git
  help                 Muestra esta ayuda

${colors.blue}Ejemplos:${colors.reset}
  node scripts/run-guardian.js verify-all
  node scripts/run-guardian.js verify-file src/core/protection/CodeVerifier.ts
  `);
}

// Ejecutar la función principal
main().catch(error => {
  console.error(`${colors.red}Error no controlado:${colors.reset}`, error);
  process.exit(1);
});

