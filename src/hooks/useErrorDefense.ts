
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

export interface ErrorDefenseState {
  isSystemHealthy: boolean;
  criticalErrors: number;
  highErrors: number;
  totalErrors: number;
  lastError: SystemError | null;
}

export function useErrorDefense(componentId?: string) {
  const [errorState, setErrorState] = useState<ErrorDefenseState>({
    isSystemHealthy: true,
    criticalErrors: 0,
    highErrors: 0,
    totalErrors: 0,
    lastError: null
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
        
        return {
          isSystemHealthy: status.isHealthy,
          criticalErrors: status.recentErrors.critical,
          highErrors: status.recentErrors.high,
          totalErrors: 
            status.recentErrors.critical + 
            status.recentErrors.high + 
            status.recentErrors.medium + 
            status.recentErrors.low,
          lastError: error
        };
      });
    });
    
    // Configuración inicial
    const status = errorSystem.getSystemStatus();
    setErrorState({
      isSystemHealthy: status.isHealthy,
      criticalErrors: status.recentErrors.critical,
      highErrors: status.recentErrors.high,
      totalErrors: 
        status.recentErrors.critical + 
        status.recentErrors.high + 
        status.recentErrors.medium + 
        status.recentErrors.low,
      lastError: null
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
   * Intenta recuperar el sistema
   */
  const attemptRecovery = useCallback(() => {
    console.log('Intentando recuperación del sistema');
    
    // Reiniciar procesadores críticos
    try {
      if (typeof window !== 'undefined') {
        if ((window as any).heartBeatProcessor) {
          console.log('Restableciendo heartBeatProcessor global');
          (window as any).heartBeatProcessor.reset();
        }
        
        if ((window as any).signalProcessor) {
          console.log('Restableciendo signalProcessor global');
          (window as any).signalProcessor.reset();
        }
        
        if ((window as any).vitalSignsProcessor) {
          console.log('Restableciendo vitalSignsProcessor global');
          (window as any).vitalSignsProcessor.reset();
        }
        
        // Limpiar almacenamiento local relacionado con procesadores
        if (localStorage) {
          localStorage.removeItem('arrhythmia_detection_state');
          localStorage.removeItem('signal_processor_state');
          localStorage.removeItem('vital_signs_state');
        }
      }
    } catch (e) {
      console.error('Error al restablecer procesadores:', e);
    }
    
    // Resetear el sistema de defensa
    errorSystem.reset();
    
    // Actualizar el estado
    const status = errorSystem.getSystemStatus();
    setErrorState({
      isSystemHealthy: status.isHealthy,
      criticalErrors: status.recentErrors.critical,
      highErrors: status.recentErrors.high,
      totalErrors: 
        status.recentErrors.critical + 
        status.recentErrors.high + 
        status.recentErrors.medium + 
        status.recentErrors.low,
      lastError: null
    });
  }, [errorSystem]);
  
  // Verificar periódicamente el estado del sistema
  const checkForIssues = useCallback(() => {
    const status = errorSystem.getSystemStatus();
    
    setErrorState({
      isSystemHealthy: status.isHealthy,
      criticalErrors: status.recentErrors.critical,
      highErrors: status.recentErrors.high,
      totalErrors: 
        status.recentErrors.critical + 
        status.recentErrors.high + 
        status.recentErrors.medium + 
        status.recentErrors.low,
      lastError: errorState.lastError
    });
    
    return !status.isHealthy;
  }, [errorSystem, errorState.lastError]);
  
  return {
    errorState,
    reportError,
    updateComponentStatus,
    attemptRecovery,
    checkForIssues
  };
}
