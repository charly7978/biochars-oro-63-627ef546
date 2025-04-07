
/**
 * Hook para integrar el Sistema de Defensa contra Errores
 * en componentes de React
 */

import { useState, useEffect, useCallback } from 'react';
import ErrorDefenseSystem, { 
  SystemError, 
  ErrorCategory, 
  ErrorSeverity 
} from '@/core/error-defense/ErrorDefenseSystem';
import { performSystemDiagnostics } from '@/utils/signalLogging';

export interface ErrorDefenseState {
  isSystemHealthy: boolean;
  criticalErrors: number;
  highErrors: number;
  totalErrors: number;
  lastError: SystemError | null;
  diagnostics: {
    systemHealth: 'critical' | 'degraded' | 'fair' | 'good' | 'excellent';
    recommendations: string[];
    timestamp: number;
  } | null;
}

export function useErrorDefense(componentId?: string) {
  const [errorState, setErrorState] = useState<ErrorDefenseState>({
    isSystemHealthy: true,
    criticalErrors: 0,
    highErrors: 0,
    totalErrors: 0,
    lastError: null,
    diagnostics: null
  });
  
  // Obtener la instancia del sistema
  const errorSystem = ErrorDefenseSystem.getInstance();
  
  // Registrar este componente en el sistema
  useEffect(() => {
    if (componentId) {
      errorSystem.registerComponent(componentId, 'healthy');
      
      return () => {
        // No es necesario explícitamente desregistrar
        // ya que el sistema maneja sus propios límites
      };
    }
  }, [componentId, errorSystem]);
  
  // Actualizar el estado cuando ocurren errores
  useEffect(() => {
    const removeListener = errorSystem.addErrorListener((error: SystemError) => {
      setErrorState(prevState => {
        const status = errorSystem.getSystemStatus();
        const diagnostics = performSystemDiagnostics();
        
        return {
          isSystemHealthy: status.isHealthy,
          criticalErrors: status.recentErrors.critical,
          highErrors: status.recentErrors.high,
          totalErrors: 
            status.recentErrors.critical + 
            status.recentErrors.high + 
            status.recentErrors.medium + 
            status.recentErrors.low,
          lastError: error,
          diagnostics: {
            systemHealth: diagnostics.systemHealth,
            recommendations: diagnostics.recommendations,
            timestamp: diagnostics.timestamp
          }
        };
      });
    });
    
    // Configuración inicial
    const status = errorSystem.getSystemStatus();
    const initialDiagnostics = performSystemDiagnostics();
    
    setErrorState({
      isSystemHealthy: status.isHealthy,
      criticalErrors: status.recentErrors.critical,
      highErrors: status.recentErrors.high,
      totalErrors: 
        status.recentErrors.critical + 
        status.recentErrors.high + 
        status.recentErrors.medium + 
        status.recentErrors.low,
      lastError: null,
      diagnostics: {
        systemHealth: initialDiagnostics.systemHealth,
        recommendations: initialDiagnostics.recommendations,
        timestamp: initialDiagnostics.timestamp
      }
    });
    
    return () => {
      removeListener();
    };
  }, [errorSystem]);
  
  /**
   * Reportar un error desde el componente
   */
  const reportError = useCallback((
    message: string,
    options?: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      metadata?: Record<string, any>;
      source?: string;
    }
  ) => {
    const {
      category = ErrorCategory.OPERATIONAL,
      severity = ErrorSeverity.MEDIUM,
      metadata = {},
      source = componentId || 'unknown'
    } = options || {};
    
    errorSystem.reportError({
      id: '', // Se generará automáticamente
      timestamp: Date.now(),
      category,
      severity,
      message,
      source,
      metadata
    });
  }, [componentId, errorSystem]);
  
  /**
   * Actualizar el estado del componente
   */
  const updateComponentStatus = useCallback((
    status: 'healthy' | 'degraded' | 'failed'
  ) => {
    if (componentId) {
      errorSystem.updateComponentStatus(componentId, status);
    }
  }, [componentId, errorSystem]);
  
  /**
   * Intenta recuperar el sistema con estrategias avanzadas de mitigación
   */
  const attemptRecovery = useCallback(() => {
    console.log('Iniciando protocolo de recuperación del sistema');
    
    // 1. Iniciar diagnóstico completo
    const diagnostics = performSystemDiagnostics();
    
    // 2. Aplicar estrategias específicas según el diagnóstico
    const recoveryActions: string[] = [];
    
    // Reiniciar procesadores críticos
    try {
      if (typeof window !== 'undefined') {
        // Manejar los procesadores globales
        if ((window as any).heartBeatProcessor) {
          console.log('Restableciendo heartBeatProcessor global');
          (window as any).heartBeatProcessor.reset();
          recoveryActions.push('HeartBeatProcessor reiniciado');
        }
        
        if ((window as any).signalProcessor) {
          console.log('Restableciendo signalProcessor global');
          (window as any).signalProcessor.reset();
          recoveryActions.push('SignalProcessor reiniciado');
        }
        
        if ((window as any).vitalSignsProcessor) {
          console.log('Restableciendo vitalSignsProcessor global');
          (window as any).vitalSignsProcessor.reset();
          recoveryActions.push('VitalSignsProcessor reiniciado');
        }
        
        // Limpiar almacenamiento local relacionado con procesadores
        if (localStorage) {
          localStorage.removeItem('arrhythmia_detection_state');
          localStorage.removeItem('signal_processor_state');
          localStorage.removeItem('vital_signs_state');
          recoveryActions.push('Estados persistentes limpiados');
        }
        
        // Intentar liberar memoria de tensores si TensorFlow está presente
        if ((window as any).tf) {
          try {
            (window as any).tf.disposeVariables();
            (window as any).tf.engine().endScope();
            (window as any).tf.engine().startScope();
            recoveryActions.push('Memoria de TensorFlow liberada');
          } catch (e) {
            console.warn('Error al liberar memoria de TensorFlow:', e);
          }
        }
      }
    } catch (e) {
      console.error('Error al restablecer procesadores:', e);
      recoveryActions.push(`Error en recuperación: ${e}`);
    }
    
    // 3. Resetear el sistema de defensa
    errorSystem.reset();
    recoveryActions.push('Sistema de defensa reiniciado');
    
    // 4. Verificar integridad después de la recuperación
    setTimeout(() => {
      const postRecoveryDiagnostics = performSystemDiagnostics();
      const recoverySuccess = postRecoveryDiagnostics.systemHealth !== 'critical' && 
                             postRecoveryDiagnostics.systemHealth !== 'degraded';
      
      console.log(`Recuperación ${recoverySuccess ? 'exitosa' : 'parcial'}:`, postRecoveryDiagnostics);
      
      // 5. Actualizar estado con resultados de recuperación
      setErrorState(prevState => ({
        ...prevState,
        isSystemHealthy: errorSystem.getSystemStatus().isHealthy,
        diagnostics: {
          systemHealth: postRecoveryDiagnostics.systemHealth,
          recommendations: postRecoveryDiagnostics.recommendations,
          timestamp: postRecoveryDiagnostics.timestamp
        }
      }));
    }, 1000);
    
    // Actualizar el estado inmediatamente con las acciones realizadas
    setErrorState(prevState => ({
      ...prevState,
      lastError: null,
      diagnostics: {
        ...prevState.diagnostics!,
        recommendations: recoveryActions,
        timestamp: Date.now()
      }
    }));
    
    return recoveryActions;
  }, [errorSystem]);
  
  /**
   * Verificar periódicamente el estado del sistema
   * y ejecutar diagnóstico forense detallado
   */
  const checkForIssues = useCallback(() => {
    const status = errorSystem.getSystemStatus();
    const diagnostics = performSystemDiagnostics();
    
    setErrorState(prevState => ({
      isSystemHealthy: status.isHealthy,
      criticalErrors: status.recentErrors.critical,
      highErrors: status.recentErrors.high,
      totalErrors: 
        status.recentErrors.critical + 
        status.recentErrors.high + 
        status.recentErrors.medium + 
        status.recentErrors.low,
      lastError: prevState.lastError,
      diagnostics: {
        systemHealth: diagnostics.systemHealth,
        recommendations: diagnostics.recommendations,
        timestamp: diagnostics.timestamp
      }
    }));
    
    return !status.isHealthy;
  }, [errorSystem]);
  
  /**
   * Forzar limpieza y recreación de todos los procesadores críticos
   */
  const forceRebuild = useCallback(() => {
    // Esta es una medida extrema que solo debe usarse en caso
    // de problemas graves de funcionamiento
    console.warn('Iniciando reconstrucción forzada de procesadores...');
    
    // 1. Guardar datos importantes en memoria temporal
    const tempStorage: Record<string, any> = {};
    try {
      if (localStorage) {
        // Guardar configuraciones importantes
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('config') || key.includes('settings')) {
            tempStorage[key] = localStorage.getItem(key);
          }
        });
      }
    } catch (e) {
      console.error('Error al respaladar configuraciones:', e);
    }
    
    // 2. Realizar limpieza completa
    attemptRecovery();
    
    // 3. Reinicialización forzada de la aplicación
    try {
      // Forzar recarga de módulos críticos
      if (typeof window !== 'undefined') {
        // Intentar reinicializar todos los procesadores
        if ((window as any).heartBeatProcessor) {
          delete (window as any).heartBeatProcessor;
        }
        if ((window as any).signalProcessor) {
          delete (window as any).signalProcessor;
        }
        if ((window as any).vitalSignsProcessor) {
          delete (window as any).vitalSignsProcessor;
        }
        
        // Restaurar configuraciones importantes
        setTimeout(() => {
          try {
            Object.keys(tempStorage).forEach(key => {
              localStorage.setItem(key, tempStorage[key]);
            });
            console.log('Configuraciones restauradas después de reinicio');
          } catch (e) {
            console.error('Error al restaurar configuraciones:', e);
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Error durante la reconstrucción forzada:', e);
    }
    
    // 4. Resetear el sistema de defensa
    errorSystem.reset();
    
    return "Reconstrucción forzada completada";
  }, [attemptRecovery, errorSystem]);
  
  return {
    errorState,
    reportError,
    updateComponentStatus,
    attemptRecovery,
    checkForIssues,
    forceRebuild
  };
}
