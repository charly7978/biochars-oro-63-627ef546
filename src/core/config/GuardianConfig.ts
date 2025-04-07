
/**
 * Configuración del Sistema de Escudo Protector (Guardian)
 */

export interface GuardianConfig {
  // Severidad mínima para bloquear cambios
  minBlockingSeverity: 'low' | 'medium' | 'high';
  
  // Habilitar o deshabilitar componentes específicos
  enabledComponents: {
    codeVerifier: boolean;
    integrityValidator: boolean;
    coherenceChecker: boolean;
    typeChecker: boolean;
    signalValidator: boolean;
  };
  
  // Configuración para el modo CI/CD
  ciMode: {
    // Si está habilitado, los errores en CI provocarán una salida con código distinto de cero
    enabled: boolean;
    // Nivel de detalle del registro en CI
    logLevel: 'error' | 'warn' | 'info' | 'verbose';
  };
  
  // Configuración para hooks de Git
  gitHooks: {
    // Si está habilitado, se pueden usar los hooks de Git
    enabled: boolean;
    // Archivos que se ignorarán en la verificación
    ignorePatterns: string[];
  };
}

// Configuración predeterminada
export const defaultGuardianConfig: GuardianConfig = {
  minBlockingSeverity: 'high',
  enabledComponents: {
    codeVerifier: true,
    integrityValidator: true,
    coherenceChecker: true,
    typeChecker: true,
    signalValidator: true
  },
  ciMode: {
    enabled: true,
    logLevel: 'info'
  },
  gitHooks: {
    enabled: true,
    ignorePatterns: [
      'node_modules/**',
      'dist/**',
      '**/*.test.ts',
      '**/*.spec.ts'
    ]
  }
};

// Obtener la configuración del Guardian
export function getGuardianConfig(): GuardianConfig {
  try {
    // En un entorno real, aquí se podría cargar la configuración desde un archivo
    return defaultGuardianConfig;
  } catch (error) {
    console.warn('Error al cargar la configuración del Guardian. Usando configuración predeterminada.');
    return defaultGuardianConfig;
  }
}

// Función para verificar si un archivo debe ignorarse
export function shouldIgnoreFile(fileName: string, config: GuardianConfig = getGuardianConfig()): boolean {
  if (!config.gitHooks.enabled) {
    return false;
  }
  
  return config.gitHooks.ignorePatterns.some(pattern => {
    // Convertir el patrón a regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(fileName);
  });
}

