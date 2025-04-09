
/**
 * Hook para integrar el Sistema de Defensa contra Errores
 * en componentes de React con capacidades de auto-reparación proactivas
 */

import { useState, useEffect, useCallback } from 'react';
import ErrorDefenseSystem, { 
  SystemError, 
  ErrorCategory, 
  ErrorSeverity 
} from '@/core/error-defense/ErrorDefenseSystem';
import { performSystemDiagnostics } from '@/utils/signalLogging';
import DependencyManager from '@/core/error-defense/DependencyManager';
import SelfHealingSystem from '@/core/error-defense/SelfHealingSystem';

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
  healingMetrics: {
    preventedIssues: number;
    recoveredErrors: number;
    lastHealingCycle: string;
  } | null;
}

export function useErrorDefense(componentId?: string) {
  const [errorState, setErrorState] = useState<ErrorDefenseState>({
    isSystemHealthy: true,
    criticalErrors: 0,
    highErrors: 0,
    totalErrors: 0,
    lastError: null,
    diagnostics: null,
    healingMetrics: null
  });
  
  // Get system instances
  const errorSystem = ErrorDefenseSystem.getInstance();
  const dependencyManager = DependencyManager.getInstance();
  const healingSystem = SelfHealingSystem.getInstance();
  
  // Register this component with the system
  useEffect(() => {
    if (componentId) {
      errorSystem.registerComponent(componentId, 'healthy');
      
      return () => {
        // Not necessary to explicitly unregister
        // since the system handles its own limits
      };
    }
  }, [componentId, errorSystem]);
  
  // Update state when errors occur
  useEffect(() => {
    const removeListener = errorSystem.addErrorListener((error: SystemError) => {
      setErrorState(prevState => {
        const status = errorSystem.getSystemStatus();
        const diagnostics = performSystemDiagnostics();
        const healingMetrics = healingSystem.getHealthMetrics();
        
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
          },
          healingMetrics: {
            preventedIssues: healingMetrics.preventedIssues,
            recoveredErrors: healingMetrics.recoveredErrors,
            lastHealingCycle: healingMetrics.lastHealingCycle > 0 
              ? new Date(healingMetrics.lastHealingCycle).toISOString() 
              : 'never'
          }
        };
      });
    });
    
    // Initialize state
    const status = errorSystem.getSystemStatus();
    const initialDiagnostics = performSystemDiagnostics();
    const healingMetrics = healingSystem.getHealthMetrics();
    
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
      },
      healingMetrics: {
        preventedIssues: healingMetrics.preventedIssues,
        recoveredErrors: healingMetrics.recoveredErrors,
        lastHealingCycle: healingMetrics.lastHealingCycle > 0 
          ? new Date(healingMetrics.lastHealingCycle).toISOString() 
          : 'never'
      }
    });
    
    return () => {
      removeListener();
    };
  }, [errorSystem, healingSystem]);
  
  /**
   * Report an error from the component
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
      id: '', // Will be generated automatically
      timestamp: Date.now(),
      category,
      severity,
      message,
      source,
      metadata
    });
  }, [componentId, errorSystem]);
  
  /**
   * Update the component status
   */
  const updateComponentStatus = useCallback((
    status: 'healthy' | 'degraded' | 'failed'
  ) => {
    if (componentId) {
      errorSystem.updateComponentStatus(componentId, status);
    }
  }, [componentId, errorSystem]);
  
  /**
   * Attempt recovery with enhanced self-healing strategies
   */
  const attemptRecovery = useCallback(() => {
    console.log('Initiating advanced system recovery protocol');
    
    // 1. Trigger self-healing cycle
    healingSystem.triggerHealingCycle();
    
    // 2. Perform complete system diagnostics
    const diagnostics = performSystemDiagnostics();
    
    // 3. Apply specific recovery strategies based on diagnostics
    const recoveryActions: string[] = [];
    
    // Reinitialize critical dependencies first
    try {
      const dependencyResults = dependencyManager.initializeAllDependencies();
      let dependenciesInitialized = 0;
      
      for (const [name, success] of dependencyResults.entries()) {
        if (success) {
          dependenciesInitialized++;
          recoveryActions.push(`${name} initialized successfully`);
        } else {
          recoveryActions.push(`${name} using fallback mode`);
        }
      }
      
      // Reset all processors
      dependencyManager.resetAllDependencies();
      recoveryActions.push('All processors reset');
      
      // Clear stored states that might be corrupted
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove = [
          'arrhythmia_detection_state',
          'signal_processor_state',
          'vital_signs_state'
        ];
        
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
            recoveryActions.push(`${key} cleared from storage`);
          } catch (e) {
            console.warn(`Error clearing ${key} from localStorage:`, e);
          }
        });
      }
      
      // Force memory cleanup for TensorFlow if present
      if (typeof window !== 'undefined' && (window as any).tf) {
        try {
          (window as any).tf.disposeVariables();
          (window as any).tf.engine().endScope();
          (window as any).tf.engine().startScope();
          recoveryActions.push('TensorFlow memory released');
        } catch (e) {
          console.warn('Error releasing TensorFlow memory:', e);
        }
      }
    } catch (e) {
      console.error('Error during recovery:', e);
      recoveryActions.push(`Recovery error: ${e}`);
    }
    
    // 4. Reset the error defense system
    errorSystem.reset();
    recoveryActions.push('Error defense system reset');
    
    // 5. Force specific healing actions based on system health
    if (diagnostics.systemHealth === 'critical' || diagnostics.systemHealth === 'degraded') {
      healingSystem.forcePreventiveAction('reinitialize-dependencies');
      healingSystem.forcePreventiveAction('reset-processors');
      recoveryActions.push('Critical system healing forced');
    }
    
    // 6. Verify integrity after recovery
    setTimeout(() => {
      const postRecoveryDiagnostics = performSystemDiagnostics();
      const healingMetrics = healingSystem.getHealthMetrics();
      const recoverySuccess = postRecoveryDiagnostics.systemHealth !== 'critical' && 
                             postRecoveryDiagnostics.systemHealth !== 'degraded';
      
      console.log(`Recovery ${recoverySuccess ? 'successful' : 'partial'}:`, postRecoveryDiagnostics);
      
      // Update state with recovery results
      setErrorState(prevState => ({
        ...prevState,
        isSystemHealthy: errorSystem.getSystemStatus().isHealthy,
        diagnostics: {
          systemHealth: postRecoveryDiagnostics.systemHealth,
          recommendations: postRecoveryDiagnostics.recommendations,
          timestamp: postRecoveryDiagnostics.timestamp
        },
        healingMetrics: {
          preventedIssues: healingMetrics.preventedIssues,
          recoveredErrors: healingMetrics.recoveredErrors,
          lastHealingCycle: healingMetrics.lastHealingCycle > 0 
            ? new Date(healingMetrics.lastHealingCycle).toISOString() 
            : 'never'
        }
      }));
    }, 1000);
    
    // Update state immediately with recovery actions
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
  }, [errorSystem, healingSystem, dependencyManager]);
  
  /**
   * Periodically check system health
   * and run detailed forensic diagnostics
   */
  const checkForIssues = useCallback(() => {
    const status = errorSystem.getSystemStatus();
    const diagnostics = performSystemDiagnostics();
    const healingMetrics = healingSystem.getHealthMetrics();
    
    // Trigger preemptive healing on health decline
    if (diagnostics.systemHealth === 'critical' || diagnostics.systemHealth === 'degraded') {
      healingSystem.triggerHealingCycle();
    }
    
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
      },
      healingMetrics: {
        preventedIssues: healingMetrics.preventedIssues,
        recoveredErrors: healingMetrics.recoveredErrors,
        lastHealingCycle: healingMetrics.lastHealingCycle > 0 
          ? new Date(healingMetrics.lastHealingCycle).toISOString() 
          : 'never'
      }
    }));
    
    return !status.isHealthy;
  }, [errorSystem, healingSystem]);
  
  /**
   * Force complete rebuilding of all critical processors
   */
  const forceRebuild = useCallback(() => {
    // This is an extreme measure to be used only in case
    // of severe operational problems
    console.warn('Initiating forced system rebuild...');
    
    // 1. Save important data in temporary storage
    const tempStorage: Record<string, any> = {};
    try {
      if (localStorage) {
        // Save important configurations
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('config') || key.includes('settings')) {
            tempStorage[key] = localStorage.getItem(key);
          }
        });
      }
    } catch (e) {
      console.error('Error backing up configurations:', e);
    }
    
    // 2. Perform complete cleanup
    attemptRecovery();
    
    // 3. Force reinitialization of the application
    try {
      // Force reload of critical modules
      if (typeof window !== 'undefined') {
        // Try to reinitialize all processors
        dependencyManager.resetAllDependencies();
        
        // Remove global instances to force fresh initialization
        if ((window as any).heartBeatProcessor) {
          delete (window as any).heartBeatProcessor;
        }
        if ((window as any).signalProcessor) {
          delete (window as any).signalProcessor;
        }
        if ((window as any).vitalSignsProcessor) {
          delete (window as any).vitalSignsProcessor;
        }
        
        // Trigger forceful dependency reinitialization
        setTimeout(() => {
          dependencyManager.initializeAllDependencies();
          
          // Restore important configurations
          try {
            Object.keys(tempStorage).forEach(key => {
              localStorage.setItem(key, tempStorage[key]);
            });
            console.log('Configurations restored after reset');
          } catch (e) {
            console.error('Error restoring configurations:', e);
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Error during forced rebuild:', e);
    }
    
    // 4. Reset all defense and healing systems
    errorSystem.reset();
    healingSystem.reset();
    
    return "Forced system rebuild completed";
  }, [attemptRecovery, errorSystem, healingSystem, dependencyManager]);
  
  return {
    errorState,
    reportError,
    updateComponentStatus,
    attemptRecovery,
    checkForIssues,
    forceRebuild
  };
}
