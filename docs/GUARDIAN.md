
# Sistema de Escudo Protector (Guardian)

Este documento describe cómo funciona el Sistema de Escudo Protector y cómo integrarlo con los sistemas de CI/CD.

## Descripción

El Sistema de Escudo Protector (Guardian) es un sistema de protección de código que verifica la integridad y coherencia del código antes de que se apliquen cambios. Esto ayuda a prevenir errores, duplicaciones y violaciones de políticas de código.

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

## Comando de Verificación

Para verificar manualmente un cambio de código, puedes utilizar:

```bash
npm run code-protection
```

## Configuración

El comportamiento del Guardian se puede configurar editando el archivo `src/core/config/GuardianConfig.ts`.

