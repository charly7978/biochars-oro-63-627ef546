
import React, { useState, useEffect, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ShieldCheck, Activity, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorDetection } from '@/hooks/useErrorDetection';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import ErrorBoundary from './ErrorBoundary';
import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity } from '@/core/error-defense/ErrorDefenseSystem';
import { SystemDiagnostics } from './SystemDiagnostics';
import { toast } from '@/hooks/use-toast';
import { evaluateSystemQuality } from '@/utils/signalLogging';

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
  const [systemQualityScore, setSystemQualityScore] = useState<number>(100);
  const [lastAutoRecovery, setLastAutoRecovery] = useState<number>(0);
  
  // Initialize defense system when loading
  useEffect(() => {
    // Ensure the system is initialized
    const defenseSystem = ErrorDefenseSystem.getInstance();
    
    // Start error monitoring
    startMonitoring();
    
    // Mark component as healthy
    updateComponentStatus('healthy');
    
    // Perform initial system quality evaluation
    const qualityReport = evaluateSystemQuality();
    setSystemQualityScore(qualityReport.score);
    
    // Initial health check and notification
    setTimeout(() => {
      setShowHealthIndicator(true);
      toast({
        title: "Sistema de Defensa Activo",
        description: `Estado inicial: ${qualityReport.summary}`,
        variant: "default"
      });
      setTimeout(() => setShowHealthIndicator(false), 3000);
    }, 2000);
    
    return () => {
      stopMonitoring();
      defenseSystem.removeAllListeners();
    };
  }, [startMonitoring, stopMonitoring, updateComponentStatus]);
  
  // Advanced periodic health check system
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Verify error defense system
      const hasIssues = checkForIssues();
      
      // Check for errors from legacy system
      const hasLegacyIssues = errorStats.count > 0;
      const criticalLegacyIssues = errorStats.count > 5;
      
      // Temporarily show health indicator
      setShowHealthIndicator(true);
      setTimeout(() => setShowHealthIndicator(false), 2000);
      
      // Combine information from both systems
      const combinedHasIssues = hasIssues || hasLegacyIssues;
      const combinedIsCritical = 
        (!errorState.isSystemHealthy && errorState.criticalErrors > 0) || 
        criticalLegacyIssues;
      
      // Set alert state
      setShowWarning(combinedHasIssues);
      
      // Build issue message
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
      
      // Evaluate system quality score periodically
      const qualityReport = evaluateSystemQuality();
      setSystemQualityScore(qualityReport.score);
      
      // Intelligent auto-recovery system with throttling
      const now = Date.now();
      if (combinedHasIssues && now - lastAutoRecovery > 60000) { // Max once per minute
        const shouldAutoRecover = 
          (qualityReport.score < 70) || // Poor quality score
          (!combinedIsCritical && errorState.totalErrors > 3) || // Multiple non-critical errors
          (hasLegacyIssues && errorStats.count > 2); // Multiple legacy errors
          
        if (shouldAutoRecover) {
          console.log("ErrorHandlingProvider: Intelligent auto-recovery triggered");
          handleRecovery();
          setLastAutoRecovery(now);
          
          // Notification based on severity
          const notificationVariant = combinedIsCritical ? "destructive" : "default";
          toast({
            title: combinedIsCritical ? "Recuperación Crítica Iniciada" : "Auto-recuperación Iniciada",
            description: "Sistema ejecutando procedimientos de restauración automáticos",
            variant: notificationVariant
          });
        }
      }
      
      // Show diagnostics automatically for critical problems
      if (combinedIsCritical && !showDiagnostics) {
        setShowDiagnostics(true);
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [errorStats, recoveryAttempted, checkForIssues, errorState, showDiagnostics, lastAutoRecovery]);
  
  // Handle recovery attempt
  const handleRecovery = async () => {
    // Use unified recovery system
    const recoveryActions = attemptRecovery();
    resetMonitoring();
    
    setShowWarning(false);
    console.log("ErrorHandlingProvider: Recovery attempted");
    
    // Notify about recovery steps based on severity
    if (recoveryActions && recoveryActions.length > 0) {
      const summary = `Acciones: ${recoveryActions.length > 1 ? 
        recoveryActions[0] + " y " + (recoveryActions.length - 1) + " más" : 
        recoveryActions[0]}`;
        
      toast({
        title: "Recuperación en Proceso",
        description: summary,
        variant: "default"
      });
    }
  };
  
  // Handle forced rebuild
  const handleForceRebuild = async () => {
    if (window.confirm("Esta acción realizará una reconstrucción forzada del sistema. ¿Continuar?")) {
      const result = forceRebuild();
      resetMonitoring();
      setShowWarning(false);
      console.log("ErrorHandlingProvider: Forced rebuild initiated");
      
      toast({
        title: "Reconstrucción Completa Iniciada",
        description: "El sistema está siendo reconstruido desde cero",
        variant: "destructive"
      });
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
        
        // Report to legacy system
        reportError("REACT_ERROR", error.message, { stack: error.stack });
        
        // Report to new defense system
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
        
        // Critical error notification
        toast({
          title: "Error Crítico Detectado",
          description: error.message.substring(0, 100) + (error.message.length > 100 ? '...' : ''),
          variant: "destructive"
        });
      }}
    >
      {/* System health indicator with quality score */}
      {showHealthIndicator && (
        <div className="fixed top-2 right-2 z-50 transition-opacity duration-300">
          <div className={`flex flex-col items-end gap-1`}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              systemQualityScore > 80 ? 'bg-green-100 text-green-800' : 
              systemQualityScore > 60 ? 'bg-amber-100 text-amber-800' : 
              'bg-red-100 text-red-800'
            }`}>
              {systemQualityScore > 80 ? (
                <ShieldCheck className="h-3 w-3" />
              ) : (
                <Activity className="h-3 w-3" />
              )}
              <span>Sistema {
                systemQualityScore > 90 ? 'óptimo' : 
                systemQualityScore > 80 ? 'estable' : 
                systemQualityScore > 60 ? 'en recuperación' : 
                'comprometido'
              }</span>
            </div>
            
            <div className="bg-background border rounded-full px-2 py-0.5 text-xs flex items-center gap-1 shadow-sm">
              <BarChart className="h-3 w-3 text-muted-foreground" />
              <span>Calidad: {systemQualityScore}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Warning banner for detected issues */}
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
      
      {/* System Diagnostics (minimized if no issues) */}
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
