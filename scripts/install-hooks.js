
#!/usr/bin/env node

/**
 * Script para instalar los hooks de Git
 * Este script copia los hooks necesarios al directorio .git/hooks
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
  blue: '\x1b[34m'
};

console.log(`${colors.blue}Instalando hooks de Git para el Sistema de Escudo Protector...${colors.reset}`);

try {
  // Obtener la ruta del directorio .git
  const gitDir = execSync('git rev-parse --git-dir').toString().trim();
  const hooksDir = path.join(gitDir, 'hooks');
  
  // Asegurarse de que existe el directorio hooks
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  
  // Crear el hook pre-commit
  const preCommitHookPath = path.join(hooksDir, 'pre-commit');
  const preCommitContent = `#!/bin/sh
# Hook de pre-commit para ejecutar el Sistema de Escudo Protector
echo "Ejecutando Sistema de Escudo Protector..."
node scripts/pre-commit-hook.js
exit $?
`;
  
  fs.writeFileSync(preCommitHookPath, preCommitContent);
  // Hacer ejecutable el hook
  fs.chmodSync(preCommitHookPath, '755');
  
  // Crear el hook pre-push
  const prePushHookPath = path.join(hooksDir, 'pre-push');
  const prePushContent = `#!/bin/sh
# Hook de pre-push para ejecutar el Sistema de Escudo Protector
echo "Ejecutando Sistema de Escudo Protector..."
node scripts/pre-commit-hook.js
exit $?
`;
  
  fs.writeFileSync(prePushHookPath, prePushContent);
  // Hacer ejecutable el hook
  fs.chmodSync(prePushHookPath, '755');
  
  console.log(`${colors.green}Hooks de Git instalados correctamente.${colors.reset}`);
  console.log(`${colors.yellow}Para habilitar los hooks, ejecuta 'node scripts/install-hooks.js' en tu terminal.${colors.reset}`);
  
} catch (error) {
  console.error(`${colors.red}Error al instalar los hooks:${colors.reset}`, error.message);
  process.exit(1);
}

