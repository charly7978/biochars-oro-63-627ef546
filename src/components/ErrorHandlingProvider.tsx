
import React, { useState, useEffect, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ShieldCheck, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorDetection } from '@/hooks/useErrorDetection';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import ErrorBoundary from './ErrorBoundary';
import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity } from '@/core/error-defense/ErrorDefenseSystem';
import { SystemDiagnostics } from './SystemDiagnostics';

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
    updateComponentStatus,
    forceRebuild
  } = useErrorDefense('ErrorHandlingProvider');
  
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [isCritical, setIsCritical] = useState<boolean>(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);
  const [showHealthIndicator, setShowHealthIndicator] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  
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
      
      // Mostrar diagnóstico automáticamente para problemas críticos
      if (combinedIsCritical && !showDiagnostics) {
        setShowDiagnostics(true);
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [errorStats, recoveryAttempted, checkForIssues, errorState, showDiagnostics]);
  
  // Handle recovery attempt
  const handleRecovery = async () => {
    // Utilizar sistema de recuperación unificado
    attemptRecovery();
    resetMonitoring();
    
    setShowWarning(false);
    console.log("ErrorHandlingProvider: Recovery attempted");
  };
  
  // Handle forced rebuild
  const handleForceRebuild = async () => {
    if (window.confirm("Esta acción realizará una reconstrucción forzada del sistema. ¿Continuar?")) {
      forceRebuild();
      resetMonitoring();
      setShowWarning(false);
      console.log("ErrorHandlingProvider: Forced rebuild initiated");
    }
  };
  
  return (
    <ErrorBoundary
      resetOnPropsChange={false}
      onError={(error) => {
        setShowWarning(true);
        setIssueMessage("React error: " + error.message);
        setIsCritical(true);
        setShowDiagnostics(true);
        
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
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
                onClick={handleRecovery}
              >
                <RefreshCw className="h-3 w-3" /> Recuperación Estándar
              </Button>
              
              <Button
                size="sm"
                variant="secondary"
                className="flex items-center gap-1"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
              >
                <Activity className="h-3 w-3" /> 
                {showDiagnostics ? 'Ocultar Diagnóstico' : 'Mostrar Diagnóstico'}
              </Button>
              
              {isCritical && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-1"
                  onClick={handleForceRebuild}
                >
                  <RefreshCw className="h-3 w-3" /> Reconstrucción Forzada
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Diagnóstico del sistema (minimizado si no hay problemas) */}
      {showDiagnostics ? (
        <div className="mb-4">
          <SystemDiagnostics minimal={false} />
        </div>
      ) : (
        <SystemDiagnostics minimal={true} />
      )}
      
      {/* Render children */}
      {children}
    </ErrorBoundary>
  );
}
