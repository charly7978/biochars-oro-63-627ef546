
import React, { useState, useEffect, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ShieldCheck, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorDetection } from '@/hooks/useErrorDetection';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import ErrorBoundary from './ErrorBoundary';
import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity } from '@/core/error-defense/ErrorDefenseSystem';

interface ErrorHandlingProviderProps {
  children: ReactNode;
}

/**
 * Error handling provider component that wraps an application
 * with error boundary and monitoring capabilities
 */
export function ErrorHandlingProvider({ children }: ErrorHandlingProviderProps) {
  const {
    isActive,
    errorStats,
    startMonitoring,
    stopMonitoring,
    resetMonitoring,
    reportError
  } = useErrorDetection();
  
  const {
    errorState,
    attemptRecovery,
    checkForIssues,
    updateComponentStatus
  } = useErrorDefense('ErrorHandlingProvider');
  
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [isCritical, setIsCritical] = useState<boolean>(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);
  const [showHealthIndicator, setShowHealthIndicator] = useState<boolean>(false);
  
  // Inicializar sistema de defensa al cargar
  useEffect(() => {
    // Asegurar que el sistema está inicializado
    ErrorDefenseSystem.getInstance();
    
    // Iniciar monitoreo de errores
    startMonitoring();
    
    // Marcar componente como saludable
    updateComponentStatus('healthy');
    
    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring, updateComponentStatus]);
  
  // Check for issues periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Verificar sistema de defensa contra errores
      const hasIssues = checkForIssues();
      
      // Verificar errores desde sistema anterior
      const hasLegacyIssues = errorStats.count > 0;
      const criticalLegacyIssues = errorStats.count > 5;
      
      // Mostrar indicador de salud temporalmente
      setShowHealthIndicator(true);
      setTimeout(() => setShowHealthIndicator(false), 2000);
      
      // Combinar información de ambos sistemas
      const combinedHasIssues = hasIssues || hasLegacyIssues;
      const combinedIsCritical = 
        (!errorState.isSystemHealthy && errorState.criticalErrors > 0) || 
        criticalLegacyIssues;
      
      // Establecer estado de alerta
      setShowWarning(combinedHasIssues);
      
      // Construir mensaje de problemas
      let message = null;
      if (combinedHasIssues) {
        if (errorState.criticalErrors > 0) {
          message = `${errorState.criticalErrors} errores críticos detectados`;
        } else if (errorState.highErrors > 0) {
          message = `${errorState.highErrors} errores graves detectados`;
        } else if (errorState.totalErrors > 0) {
          message = `${errorState.totalErrors} errores detectados`;
        } else if (hasLegacyIssues) {
          message = `${errorStats.count} errores detectados`;
        }
      }
      setIssueMessage(message);
      setIsCritical(combinedIsCritical);
      
      // Auto-recovery attempt for non-critical issues
      if (combinedHasIssues && !combinedIsCritical && !recoveryAttempted) {
        console.log("ErrorHandlingProvider: Auto-recovery attempt for non-critical issue");
        handleRecovery();
        setRecoveryAttempted(true);
        
        // Reset recovery attempt flag after 30 seconds
        setTimeout(() => {
          setRecoveryAttempted(false);
        }, 30000);
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [errorStats, recoveryAttempted, checkForIssues, errorState]);
  
  // Handle recovery attempt
  const handleRecovery = async () => {
    // Utilizar sistema de recuperación unificado
    attemptRecovery();
    resetMonitoring();
    
    setShowWarning(false);
    console.log("ErrorHandlingProvider: Recovery attempted");
    
    // Reset arrhythmia detection services if possible
    try {
      if (typeof window !== 'undefined') {
        // Reset any global detection services
        if ((window as any).heartBeatProcessor) {
          (window as any).heartBeatProcessor.reset();
          console.log("ErrorHandlingProvider: Reset heartBeatProcessor");
        }
        
        // Clear any stale RR interval data
        if (localStorage) {
          localStorage.removeItem('arrhythmia_detection_state');
          console.log("ErrorHandlingProvider: Cleared persisted arrhythmia state");
        }
      }
    } catch (error) {
      console.error("ErrorHandlingProvider: Error during additional recovery steps", error);
    }
  };
  
  return (
    <ErrorBoundary
      resetOnPropsChange={false}
      onError={(error) => {
        setShowWarning(true);
        setIssueMessage("React error: " + error.message);
        setIsCritical(true);
        
        // Reportar al sistema antiguo
        reportError("REACT_ERROR", error.message, { stack: error.stack });
        
        // Reportar al nuevo sistema de defensa
        const defenseSystem = ErrorDefenseSystem.getInstance();
        defenseSystem.reportError({
          id: '',
          timestamp: Date.now(),
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.CRITICAL,
          message: error.message,
          source: 'react',
          stack: error.stack,
          metadata: { type: 'react_error' }
        });
      }}
    >
      {/* Indicador de salud del sistema */}
      {showHealthIndicator && (
        <div className="fixed top-2 right-2 z-50 transition-opacity duration-300">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            errorState.isSystemHealthy ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {errorState.isSystemHealthy ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <Activity className="h-3 w-3" />
            )}
            <span>Sistema {errorState.isSystemHealthy ? 'estable' : 'en recuperación'}</span>
          </div>
        </div>
      )}
      
      {/* Show warning banner for non-fatal issues */}
      {showWarning && (
        <Alert
          variant={isCritical ? "destructive" : "default"}
          className="mb-4 sticky top-0 z-50"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {isCritical ? 'Error del Sistema Detectado' : 'Advertencia'}
          </AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between">
            <span>{issueMessage || 'Problemas del sistema detectados'}</span>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
              onClick={handleRecovery}
            >
              <RefreshCw className="h-3 w-3" /> Intentar Recuperación
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Render children */}
      {children}
    </ErrorBoundary>
  );
}
