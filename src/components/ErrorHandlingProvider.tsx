import React, { useState, useEffect, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ShieldCheck, Activity, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorDetection } from '@/hooks/useErrorDetection';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import ErrorBoundary from './ErrorBoundary';
import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity } from '@/core/error-defense/ErrorDefenseSystem';
import { SystemDiagnostics } from './SystemDiagnostics';
import { evaluateSystemQuality } from '@/utils/signalLogging';
import SelfHealingSystem from '@/core/error-defense/SelfHealingSystem';
import ImportErrorDefenseSystem from '@/core/error-defense/ImportErrorDefenseSystem';

interface ErrorHandlingProviderProps {
  children: ReactNode;
}

/**
 * Error handling provider component that wraps an application
 * with error boundary and monitoring capabilities
 */
export function ErrorHandlingProvider({ children }: ErrorHandlingProviderProps) {
  const {
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
  const [showHealthIndicator, setShowHealthIndicator] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [systemQualityScore, setSystemQualityScore] = useState<number>(100);
  const [lastAutoRecovery, setLastAutoRecovery] = useState<number>(0);
  const [importErrorSystemInitialized, setImportErrorSystemInitialized] = useState<boolean>(false);
  
  useEffect(() => {
    const defenseSystem = ErrorDefenseSystem.getInstance();
    
    startMonitoring();
    updateComponentStatus('healthy');
    
    const qualityReport = evaluateSystemQuality();
    setSystemQualityScore(qualityReport.score);
    
    setShowHealthIndicator(true);
    setTimeout(() => setShowHealthIndicator(false), 3000);
    
    return () => {
      stopMonitoring();
      defenseSystem.removeAllListeners();
    };
  }, [startMonitoring, stopMonitoring, updateComponentStatus]);
  
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const hasIssues = checkForIssues();
      const hasLegacyIssues = errorStats.count > 0;
      const criticalLegacyIssues = errorStats.count > 5;
      
      setShowHealthIndicator(true);
      setTimeout(() => setShowHealthIndicator(false), 2000);
      
      const combinedHasIssues = hasIssues || hasLegacyIssues;
      const combinedIsCritical = 
        (!errorState.isSystemHealthy && errorState.criticalErrors > 0) || 
        criticalLegacyIssues;
      
      setShowWarning(combinedHasIssues);
      
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
      
      const qualityReport = evaluateSystemQuality();
      setSystemQualityScore(qualityReport.score);
      
      const now = Date.now();
      if (combinedHasIssues && now - lastAutoRecovery > 60000) {
        const shouldAutoRecover = 
          (qualityReport.score < 70) || 
          (!combinedIsCritical && errorState.totalErrors > 3) || 
          (hasLegacyIssues && errorStats.count > 2);
          
        if (shouldAutoRecover) {
          console.log("ErrorHandlingProvider: Intelligent auto-recovery triggered");
          handleRecovery();
          setLastAutoRecovery(now);
        }
      }
      
      if (combinedIsCritical && !showDiagnostics) {
        setShowDiagnostics(true);
      }
    }, 10000);
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [errorStats, checkForIssues, errorState, showDiagnostics, lastAutoRecovery]);
  
  const handleRecovery = async () => {
    const recoveryActions = attemptRecovery();
    resetMonitoring();
    
    setShowWarning(false);
    console.log("ErrorHandlingProvider: Recovery attempted");
    
    if (!importErrorSystemInitialized) {
      try {
        const importErrorSystem = ImportErrorDefenseSystem.getInstance();
        importErrorSystem.initializeGlobalInterceptor();
        setImportErrorSystemInitialized(true);
        
        console.log('ErrorHandlingProvider: ImportErrorDefenseSystem initialized during recovery');
      } catch (error) {
        console.error('Error initializing ImportErrorDefenseSystem during recovery:', error);
      }
    }
    
    const selfHealingSystem = SelfHealingSystem.getInstance();
    selfHealingSystem.forcePreventiveAction('fix-missing-exports');
    selfHealingSystem.forcePreventiveAction('resolve-module-imports');
  };
  
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
        
        reportError("REACT_ERROR", error.message, { stack: error.stack });
        
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
        
        const errorMessage = error.message || '';
        if (errorMessage.includes('Module') || 
            errorMessage.includes('import') || 
            errorMessage.includes('export') ||
            errorMessage.includes('SyntaxError')) {
          
          console.log('ErrorHandlingProvider: React error contains import/module issue:', errorMessage);
          
          const selfHealingSystem = SelfHealingSystem.getInstance();
          selfHealingSystem.forcePreventiveAction('fix-missing-exports');
          selfHealingSystem.forcePreventiveAction('resolve-module-imports');
        }
      }}
    >
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
      
      {showDiagnostics ? (
        <div className="mb-4">
          <SystemDiagnostics minimal={false} />
        </div>
      ) : (
        <SystemDiagnostics minimal={true} />
      )}
      
      {children}
    </ErrorBoundary>
  );
}
