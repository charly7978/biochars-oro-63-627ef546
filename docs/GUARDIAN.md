
# Sistema de Escudo Protector (Guardian)

Este documento describe cómo funciona el Sistema de Escudo Protector y cómo integrarlo con los sistemas de CI/CD.

## Descripción

El Sistema de Escudo Protector (Guardian) es un sistema de protección de código que verifica la integridad y coherencia del código antes de que se apliquen cambios. Esto ayuda a prevenir errores, duplicaciones y violaciones de políticas de código.

## Características Principales

### 1. Prevención de errores de TypeScript en tiempo real
El sistema ahora detecta errores de TypeScript antes de que estos lleguen al código base:
- Verificación de referencias a enumeraciones (como TelemetryCategory)
- Detección de propiedades inexistentes
- Análisis de tipos incompatibles

### 2. Protección contra acciones peligrosas
Previene la ejecución de comandos potencialmente dañinos:
- Bloqueo de comandos destructivos (rm -rf, DELETE FROM, etc.)
- Alerta sobre modificaciones a archivos críticos
- Solicitud de confirmación para acciones de alto riesgo

### 3. Integración con CI/CD
Verificación automática en flujos de trabajo de integración continua:
- GitHub Actions para verificación en cada push/pull request
- Hooks de Git para validación local antes de commit/push
- Verificación de tipos TypeScript antes de la construcción

## Integración con CI/CD

### GitHub Actions

El repositorio incluye un flujo de trabajo de GitHub Actions que ejecuta el Guardian en cada push y pull request. Este flujo de trabajo se encuentra en `.github/workflows/npm-gulp.yml`.

### Hooks de Git

Para habilitar la verificación local antes de confirmar o enviar cambios, puedes instalar los hooks de Git proporcionados:

```bash
node scripts/install-hooks.js
```

Esto instalará:
- Un hook `pre-commit` que verifica los archivos modificados antes de confirmar
- Un hook `pre-push` que verifica todos los cambios antes de enviarlos al repositorio remoto

## Arquitectura

El Sistema de Escudo Protector consta de los siguientes componentes:

1. **CodeProtectionShield**: Clase principal que coordina la verificación de cambios
2. **CodeVerifier**: Verifica la integridad del código
3. **DataIntegrityValidator**: Valida la integridad de los datos
4. **CoherenceChecker**: Comprueba la coherencia entre el código original y modificado
5. **ChangeLogger**: Registra todos los cambios y verificaciones
6. **RollbackManager**: Gestiona los puntos de restauración y rollbacks
7. **PreCommitTypeChecker**: Realiza verificaciones de tipo antes de confirmar cambios (¡NUEVO!)

## Comando de Verificación

Para verificar manualmente un cambio de código, puedes utilizar:

```bash
npm run code-protection
```

## Protección contra Acciones Peligrosas

El sistema ahora incluye protección contra acciones potencialmente peligrosas:

```bash
node scripts/action-protector.js "tu-comando-aquí"
```

Este sistema verificará si el comando contiene patrones potencialmente peligrosos y pedirá confirmación antes de ejecutarlo.

### Patrones bloqueados automáticamente:

- Eliminación recursiva forzada (rm -rf)
- Instrucciones de eliminación de bases de datos
- Uso de eval() o execSync()
- Modificación de archivos críticos como package.json
- Comandos de eliminación de archivos

### Verificación de errores TypeScript

El sistema ahora verifica automáticamente errores de TypeScript:

```bash
node scripts/action-protector.js "tu-comando-que-modifica-archivos-ts"
```

Detectará errores como:
- Referencias a TelemetryCategory inexistentes 
- Propiedades que no existen en un tipo
- Tipos incompatibles

## Uso con comandos peligrosos

Si necesitas ejecutar un comando que se detecta como peligroso pero estás seguro de su efecto:

```bash
node scripts/action-protector.js "rm -rf temp_dir"
```

El sistema te pedirá confirmación antes de continuar.

## Configuración

El comportamiento del Guardian se puede configurar editando el archivo `src/core/config/GuardianConfig.ts`.
