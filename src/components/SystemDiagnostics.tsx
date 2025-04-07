
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActivitySquare, Server, Shield, RefreshCw, XCircle, CheckCircle, AlertTriangle, RotateCw, Zap, AlertCircle, Bug } from 'lucide-react';
import ErrorDefenseSystem, { ErrorCategory, SystemError } from '@/core/error-defense/ErrorDefenseSystem';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getLogEntries, LogLevel } from '@/utils/signalLogging';
import DependencyMonitor from '@/core/error-defense/DependencyMonitor';

interface SystemDiagnosticsProps {
  minimal?: boolean;
}

export function SystemDiagnostics({ minimal = false }: SystemDiagnosticsProps) {
  const { errorState, attemptRecovery, forceRebuild } = useErrorDefense('SystemDiagnostics');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOpen, setIsOpen] = useState<boolean>(!minimal);
  const [recoveryInProgress, setRecoveryInProgress] = useState<boolean>(false);
  const [recoveryLog, setRecoveryLog] = useState<string[]>([]);
  const [criticalErrors, setCriticalErrors] = useState<{message: string, source: string, timestamp: number}[]>([]);
  const [missingDependencies, setMissingDependencies] = useState<string[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  
  // Obtener errores críticos y dependencias faltantes
  useEffect(() => {
    const fetchCriticalData = async () => {
      // Obtener los últimos errores críticos
      const recentLogs = getLogEntries();
      const criticalErrorLogs = recentLogs
        .filter(log => log.level === LogLevel.ERROR)
        .slice(0, 10)
        .map(log => ({
          message: log.message,
          source: log.source,
          timestamp: log.timestamp
        }));
      
      setCriticalErrors(criticalErrorLogs);
      
      // Verificar dependencias faltantes
      try {
        const dependencyMonitor = DependencyMonitor.getInstance();
        const results = await dependencyMonitor.checkAllDependencies();
        
        const missing = Object.entries(results)
          .filter(([_, available]) => !available)
          .map(([name]) => name);
        
        setMissingDependencies(missing);
      } catch (error) {
        console.error("Error al verificar dependencias:", error);
      }
    };
    
    fetchCriticalData();
    
    const updateInterval = setInterval(() => {
      setLastUpdated(new Date());
      fetchCriticalData();
    }, 15000);
    
    return () => clearInterval(updateInterval);
  }, []);
  
  const handleRecovery = async () => {
    setRecoveryInProgress(true);
    setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Iniciando recuperación...`]);
    
    try {
      const actions = attemptRecovery();
      
      if (Array.isArray(actions)) {
        actions.forEach(action => {
          setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${action}`]);
        });
      }
      
      setTimeout(() => {
        setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Verificando integridad del sistema...`]);
      }, 800);
      
      setTimeout(() => {
        setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Recuperación completada`]);
        setRecoveryInProgress(false);
      }, 2000);
    } catch (e) {
      setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Error durante la recuperación: ${e}`]);
      setRecoveryInProgress(false);
    }
  };
  
  const handleForceRebuild = () => {
    if (window.confirm("¿Estás seguro? Esta acción reconstruirá completamente el sistema de procesamiento y puede tardar unos segundos.")) {
      setRecoveryInProgress(true);
      setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Iniciando reconstrucción forzada...`]);
      
      try {
        const result = forceRebuild();
        
        setTimeout(() => {
          setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Eliminando procesadores existentes...`]);
        }, 500);
        
        setTimeout(() => {
          setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Reconstruyendo sistema...`]);
        }, 1200);
        
        setTimeout(() => {
          setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
          setRecoveryInProgress(false);
        }, 2500);
      } catch (e) {
        setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Error durante la reconstrucción: ${e}`]);
        setRecoveryInProgress(false);
      }
    }
  };
  
  // Formatear mensaje explicativo sobre errores críticos
  const getErrorExplanation = () => {
    let message = "";
    
    // Explicar dependencias faltantes
    if (missingDependencies.length > 0) {
      message += `• Dependencias no disponibles: ${missingDependencies.join(", ")}.\n`;
    }
    
    // Explicar patrones de error si hay errores críticos
    if (errorState.criticalErrors > 0 || errorState.highErrors > 0) {
      message += `• ${errorState.criticalErrors} errores críticos y ${errorState.highErrors} errores graves detectados.\n`;
    }
    
    // Si no hay mensajes específicos pero hay problemas
    if (message === "" && !errorState.isSystemHealthy) {
      message = "El sistema ha detectado problemas pero no se puede determinar la causa exacta.";
    }
    
    return message || "No se han detectado problemas críticos.";
  };
  
  if (minimal && !isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          size="sm"
          variant={errorState.isSystemHealthy ? "outline" : "destructive"}
          className="flex items-center gap-2"
          onClick={() => setIsOpen(true)}
        >
          {errorState.isSystemHealthy ? (
            <Shield className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span>
            {errorState.isSystemHealthy 
              ? "Sistema Estable" 
              : `${errorState.criticalErrors + errorState.highErrors} Errores`}
          </span>
        </Button>
      </div>
    );
  }
  
  const getHealthColor = () => {
    if (!errorState.diagnostics) return "text-muted-foreground";
    
    switch (errorState.diagnostics.systemHealth) {
      case 'critical': return "text-destructive";
      case 'degraded': return "text-orange-500";
      case 'fair': return "text-yellow-500";
      case 'good': return "text-green-500";
      case 'excellent': return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };
  
  return (
    <Card className={minimal ? "fixed bottom-4 right-4 z-40 w-96 max-h-[90vh] overflow-auto" : "w-full"}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Diagnóstico del Sistema</CardTitle>
          </div>
          {minimal && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0" 
              onClick={() => setIsOpen(false)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          Estado actual del sistema de integridad
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Explicación detallada de errores críticos */}
        {!errorState.isSystemHealthy && (
          <div className="bg-destructive/10 p-3 rounded-md border border-destructive/30 mb-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-medium text-destructive">Problemas críticos detectados</h3>
                <div className="text-xs whitespace-pre-line text-muted-foreground mt-1">
                  {getErrorExplanation()}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
              >
                {showErrorDetails ? "Ocultar detalles" : "Ver detalles"}
              </Button>
            </div>
            
            {showErrorDetails && (
              <div className="mt-3 pt-3 border-t border-destructive/20">
                <h4 className="text-xs font-medium mb-2">Dependencias faltantes:</h4>
                {missingDependencies.length > 0 ? (
                  <ul className="text-xs space-y-1 ml-5 list-disc">
                    {missingDependencies.map((dep, i) => (
                      <li key={i} className="text-muted-foreground">{dep}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No se detectaron dependencias faltantes.</p>
                )}
                
                <h4 className="text-xs font-medium mb-2 mt-3">Últimos errores críticos:</h4>
                {criticalErrors.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {criticalErrors.map((error, i) => (
                      <div key={i} className="text-xs p-2 bg-muted/50 rounded border">
                        <div className="font-medium">{error.source}</div>
                        <div className="text-muted-foreground truncate">{error.message}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No se encontraron errores críticos recientes.</p>
                )}
              </div>
            )}
          </div>
        )}
      
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium">Estado General:</div>
          <Badge variant={errorState.isSystemHealthy ? "outline" : "destructive"}>
            <div className="flex items-center gap-1">
              {errorState.isSystemHealthy ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Estable</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Problemas Detectados</span>
                </>
              )}
            </div>
          </Badge>
        </div>
        
        {errorState.diagnostics && (
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium">Diagnóstico de Salud:</div>
            <Badge variant="outline" className={getHealthColor()}>
              <div className="flex items-center gap-1">
                <span>{errorState.diagnostics.systemHealth.charAt(0).toUpperCase() + errorState.diagnostics.systemHealth.slice(1)}</span>
              </div>
            </Badge>
          </div>
        )}
        
        <div>
          <h4 className="text-sm font-medium mb-2">Errores Recientes:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-background border rounded-md">
              <span className="text-xs">Críticos:</span>
              <Badge variant={errorState.criticalErrors > 0 ? "destructive" : "outline"}>
                {errorState.criticalErrors}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-2 bg-background border rounded-md">
              <span className="text-xs">Graves:</span>
              <Badge variant={errorState.highErrors > 0 ? "destructive" : "outline"}>
                {errorState.highErrors}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-2 bg-background border rounded-md">
              <span className="text-xs">Total:</span>
              <Badge variant={errorState.totalErrors > 0 ? "secondary" : "outline"}>
                {errorState.totalErrors}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-2 bg-background border rounded-md">
              <span className="text-xs">Último:</span>
              <Badge variant="outline">
                {errorState.lastError ? (
                  <span className="truncate max-w-[80px]" title={errorState.lastError.message}>
                    {new Date(errorState.lastError.timestamp).toLocaleTimeString()}
                  </span>
                ) : (
                  "N/A"
                )}
              </Badge>
            </div>
          </div>
        </div>
        
        {errorState.lastError && (
          <div className="text-sm">
            <h4 className="font-medium mb-1">Último Error:</h4>
            <div className="p-2 bg-destructive/10 border-destructive/20 border rounded-md">
              <div className="font-medium text-xs mb-1 truncate" title={errorState.lastError.message}>
                {errorState.lastError.message}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{errorState.lastError.source}</span>
                <span>{new Date(errorState.lastError.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}
        
        {errorState.diagnostics && errorState.diagnostics.recommendations.length > 0 && (
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <div className="flex items-center justify-between w-full">
                  <span>Recomendaciones ({errorState.diagnostics.recommendations.length})</span>
                  <ActivitySquare className="h-4 w-4" />
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-1 p-2 bg-muted/50 border rounded-md text-xs">
                {errorState.diagnostics.recommendations.map((rec, i) => (
                  <div key={i} className="py-1 flex items-start gap-1">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {recoveryLog.length > 0 && (
          <div className="text-sm">
            <h4 className="font-medium mb-1">Registro de Recuperación:</h4>
            <div className="max-h-32 overflow-y-auto p-2 bg-muted/50 border rounded-md">
              {recoveryLog.map((entry, i) => (
                <div key={i} className="text-xs py-0.5 border-b border-background last:border-0">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <Separator />
      
      <CardFooter className="pt-4 flex flex-col space-y-2">
        <div className="w-full flex justify-between items-center">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <ActivitySquare className="h-3 w-3" />
            <span>Actualizado: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-1"
            disabled={recoveryInProgress}
            onClick={handleRecovery}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recoveryInProgress ? 'animate-spin' : ''}`} />
            <span>Recuperación Estándar</span>
          </Button>
        </div>
        
        <div className="w-full flex justify-end">
          <Button 
            size="sm" 
            variant="secondary" 
            className="flex items-center gap-1"
            disabled={recoveryInProgress}
            onClick={handleForceRebuild}
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Reconstrucción Forzada</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
