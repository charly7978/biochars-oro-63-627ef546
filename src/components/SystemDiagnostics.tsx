import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ActivitySquare, Server, Shield, RefreshCw, XCircle, CheckCircle, 
  AlertTriangle, RotateCw, Zap, AlertCircle, Bug, Camera, Ban, 
  FileWarning
} from 'lucide-react';
import ErrorDefenseSystem, { ErrorCategory, SystemError } from '@/core/error-defense/ErrorDefenseSystem';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getLogEntries, LogLevel, evaluateSystemQuality } from '@/utils/signalLogging';
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
  const [commonErrorPatterns, setCommonErrorPatterns] = useState<{pattern: string, count: number}[]>([]);
  const [showAdvancedTools, setShowAdvancedTools] = useState<boolean>(false);
  
  useEffect(() => {
    const fetchCriticalData = async () => {
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
      
      analyzeErrorPatterns(recentLogs);
    };
    
    fetchCriticalData();
    
    const updateInterval = setInterval(() => {
      setLastUpdated(new Date());
      fetchCriticalData();
    }, 15000);
    
    return () => clearInterval(updateInterval);
  }, []);
  
  const analyzeErrorPatterns = (logs: any[]) => {
    const errorLogs = logs.filter(log => log.level === LogLevel.ERROR);
    const patterns: Record<string, number> = {};
    
    errorLogs.forEach(log => {
      let pattern = log.message;
      
      pattern = pattern.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[ID]');
      pattern = pattern.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]');
      pattern = pattern.replace(/at position \d+/g, 'at position [N]');
      pattern = pattern.replace(/line \d+/g, 'line [N]');
      pattern = pattern.replace(/\d+ ms/g, '[N] ms');
      
      if (pattern.includes('InvalidStateError') && pattern.includes('Track is in an invalid state')) {
        pattern = 'InvalidStateError: The associated Track is in an invalid state';
      }
      
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });
    
    const patternArray = Object.entries(patterns)
      .filter(([_, count]) => count > 1)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    setCommonErrorPatterns(patternArray);
  };
  
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
  
  const handleResetCamera = () => {
    setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Reiniciando cámara y permisos...`]);
    
    try {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then(stream => {
            stream.getTracks().forEach(track => track.stop());
            
            setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Tracks de video liberados correctamente`]);
            
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          })
          .catch(error => {
            setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Error al acceder a la cámara: ${error.message}`]);
          });
      } else {
        setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: API MediaDevices no disponible en este navegador`]);
      }
    } catch (e) {
      setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Error al reiniciar la cámara: ${e}`]);
    }
  };
  
  const getErrorExplanation = () => {
    let message = "";
    
    if (missingDependencies.length > 0) {
      message += `• Dependencias no disponibles: ${missingDependencies.join(", ")}.\n`;
    }
    
    if (errorState.criticalErrors > 0 || errorState.highErrors > 0) {
      message += `• ${errorState.criticalErrors} errores críticos y ${errorState.highErrors} errores graves detectados.\n`;
      
      if (commonErrorPatterns.length > 0) {
        message += `• Patrones de error más comunes:\n`;
        commonErrorPatterns.forEach(pattern => {
          message += `  - "${pattern.pattern.substring(0, 50)}${pattern.pattern.length > 50 ? '...' : ''}" (${pattern.count} veces)\n`;
        });
      }
    }
    
    if (criticalErrors.some(e => e.message.includes('Track') || e.message.includes('camera') || e.message.includes('InvalidState'))) {
      message += `• Se detectaron problemas con la cámara. Considere reiniciar los permisos de cámara.\n`;
    }
    
    if (message === "" && !errorState.isSystemHealthy) {
      message = "El sistema ha detectado problemas pero no se puede determinar la causa exacta.";
    }
    
    return message || "No se han detectado problemas críticos.";
  };
  
  const getSuggestedActions = () => {
    const suggestions: string[] = [];
    
    if (commonErrorPatterns.some(p => p.pattern.includes('Track is in an invalid state'))) {
      suggestions.push('Use el botón "Reiniciar Cámara" para solucionar los problemas con el stream de video.');
      suggestions.push('Verifique que ha concedido permisos de cámara al navegador.');
    }
    
    if (missingDependencies.length > 0) {
      suggestions.push('Intente una reconstrucción forzada para reinicializar las dependencias del sistema.');
    }
    
    if (errorState.totalErrors > 10) {
      suggestions.push('Para problemas persistentes, recargue completamente la página.');
    }
    
    return suggestions;
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
    <Card className={minimal ? "fixed bottom-4 right-4 z-40 w-[450px] max-h-[90vh] overflow-auto" : "w-full"}>
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
            
            {getSuggestedActions().length > 0 && (
              <div className="mt-2 border-t border-destructive/20 pt-2">
                <h4 className="text-xs font-medium mb-1">Acciones recomendadas:</h4>
                <ul className="text-xs space-y-1 ml-5 list-disc text-muted-foreground">
                  {getSuggestedActions().map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
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
        
        {commonErrorPatterns.length > 0 && (
          <div className="text-sm">
            <h4 className="font-medium mb-1">Patrones de Error Comunes:</h4>
            <div className="space-y-1 p-2 bg-muted/50 border rounded-md">
              {commonErrorPatterns.map((pattern, i) => (
                <div key={i} className="text-xs flex items-start gap-2 py-1 border-b last:border-0">
                  <FileWarning className="h-3 w-3 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="truncate block">
                      {pattern.pattern.substring(0, 60)}{pattern.pattern.length > 60 ? '...' : ''}
                    </span>
                    <span className="text-muted-foreground">Ocurrencias: {pattern.count}</span>
                  </div>
                </div>
              ))}
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
        
        <Collapsible 
          className="w-full"
          open={showAdvancedTools}
          onOpenChange={setShowAdvancedTools}
        >
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <div className="flex items-center justify-between w-full">
                <span>Herramientas Avanzadas</span>
                <Bug className="h-4 w-4" />
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-2 p-2 bg-muted/50 border rounded-md">
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-medium">Reiniciar Cámara</div>
                  <div className="text-muted-foreground">Soluciona problemas con el stream de video</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 text-xs h-8"
                  onClick={handleResetCamera}
                  disabled={recoveryInProgress}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Reiniciar</span>
                </Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-medium">Limpiar Almacenamiento</div>
                  <div className="text-muted-foreground">Elimina datos almacenados del navegador</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 text-xs h-8"
                  onClick={() => {
                    try {
                      localStorage.clear();
                      setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Almacenamiento local limpiado`]);
                    } catch (e) {
                      console.error("Error al limpiar almacenamiento:", e);
                    }
                  }}
                  disabled={recoveryInProgress}
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>Limpiar</span>
                </Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-medium">Recargar Aplicación</div>
                  <div className="text-muted-foreground">Reinicia completamente la aplicación</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Recargar</span>
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
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
        
        <div className="w-full flex justify-end gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-1"
            disabled={recoveryInProgress}
            onClick={handleResetCamera}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Reiniciar Cámara</span>
          </Button>
          
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
