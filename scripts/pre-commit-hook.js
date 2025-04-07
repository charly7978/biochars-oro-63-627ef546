
#!/usr/bin/env node

/**
 * Script de pre-commit para ejecutar el Sistema de Escudo Protector
 * Este script se ejecuta antes de confirmar cambios con git
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

console.log(`${colors.blue}Sistema de Escudo Protector - Verificación Pre-Commit${colors.reset}`);

try {
  // Obtener la lista de archivos modificados
  const gitStatus = execSync('git diff --cached --name-only --diff-filter=ACMR').toString();
  const modifiedFiles = gitStatus.split('\n').filter(file => file.trim() !== '');
  
  if (modifiedFiles.length === 0) {
    console.log(`${colors.yellow}No hay archivos para verificar.${colors.reset}`);
    process.exit(0);
  }
  
  console.log(`${colors.blue}Archivos a verificar: ${modifiedFiles.length}${colors.reset}`);
  
  // Filtrar solo archivos TypeScript/JavaScript
  const tsFiles = modifiedFiles.filter(file => 
    file.endsWith('.ts') || file.endsWith('.tsx') || 
    file.endsWith('.js') || file.endsWith('.jsx')
  );
  
  if (tsFiles.length === 0) {
    console.log(`${colors.yellow}No hay archivos TypeScript/JavaScript para verificar.${colors.reset}`);
    process.exit(0);
  }
  
  let hasErrors = false;
  
  // Para cada archivo modificado, ejecutar la verificación
  for (const file of tsFiles) {
    console.log(`${colors.blue}Verificando ${file}...${colors.reset}`);
    
    try {
      // Leer el contenido del archivo
      const originalContent = fs.readFileSync(file, 'utf-8');
      
      // Crear un archivo temporal con el contenido original (para comparación)
      const tempFile = path.join(os.tmpdir(), `original_${path.basename(file)}`);
      fs.writeFileSync(tempFile, originalContent);
      
      // Ejecutar el verificador usando node para cargar el módulo
      const verificationScript = `
        const { verifyCodeChange } = require('./dist/utils/protectionUtils');
        const fs = require('fs');
        
        (async () => {
          const originalContent = fs.readFileSync('${tempFile}', 'utf-8');
          const modifiedContent = fs.readFileSync('${file}', 'utf-8');
          const result = await verifyCodeChange(originalContent, modifiedContent, '${file}');
          
          if (!result) {
            process.exit(1);
          }
          
          process.exit(0);
        })();
      `;
      
      const tempScriptFile = path.join(os.tmpdir(), 'verify_script.js');
      fs.writeFileSync(tempScriptFile, verificationScript);
      
      execSync(`node ${tempScriptFile}`, { stdio: 'inherit' });
      console.log(`${colors.green}Verificación exitosa para ${file}${colors.reset}`);
      
      // Limpiar archivos temporales
      fs.unlinkSync(tempFile);
      fs.unlinkSync(tempScriptFile);
      
    } catch (error) {
      console.error(`${colors.red}Error al verificar ${file}:${colors.reset}`, error.message);
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.error(`${colors.red}La verificación del Escudo Protector falló. Corrige los errores antes de confirmar.${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.green}Todos los archivos pasaron la verificación del Escudo Protector.${colors.reset}`);
  process.exit(0);
  
} catch (error) {
  console.error(`${colors.red}Error durante la verificación:${colors.reset}`, error.message);
  process.exit(1);
}

