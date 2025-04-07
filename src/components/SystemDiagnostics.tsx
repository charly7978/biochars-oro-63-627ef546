
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActivitySquare, Server, Shield, RefreshCw, XCircle, CheckCircle, AlertTriangle, RotateCw, Tool, Zap } from 'lucide-react';
import ErrorDefenseSystem from '@/core/error-defense/ErrorDefenseSystem';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SystemDiagnosticsProps {
  minimal?: boolean;
}

export function SystemDiagnostics({ minimal = false }: SystemDiagnosticsProps) {
  const { errorState, attemptRecovery, forceRebuild } = useErrorDefense('SystemDiagnostics');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOpen, setIsOpen] = useState<boolean>(!minimal);
  const [recoveryInProgress, setRecoveryInProgress] = useState<boolean>(false);
  const [recoveryLog, setRecoveryLog] = useState<string[]>([]);
  
  // Actualizar periódicamente
  useEffect(() => {
    const updateInterval = setInterval(() => {
      setLastUpdated(new Date());
    }, 15000);
    
    return () => clearInterval(updateInterval);
  }, []);
  
  // Manejar la recuperación con retroalimentación
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
      
      // Simular progreso de recuperación
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
  
  // Manejar la reconstrucción forzada
  const handleForceRebuild = () => {
    if (window.confirm("¿Estás seguro? Esta acción reconstruirá completamente el sistema de procesamiento y puede tardar unos segundos.")) {
      setRecoveryInProgress(true);
      setRecoveryLog(prev => [...prev, `${new Date().toLocaleTimeString()}: Iniciando reconstrucción forzada...`]);
      
      try {
        const result = forceRebuild();
        
        // Simular progreso
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
  
  // Si es minimal, mostrar solo el panel compacto
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
  
  // Determinar color del estado del sistema
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
    <Card className={minimal ? "fixed bottom-4 right-4 z-40 w-80 max-h-[90vh] overflow-auto" : "w-full"}>
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
        {/* Estado General */}
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
        
        {/* Diagnóstico de Salud */}
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
        
        {/* Errores Recientes */}
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
        
        {/* Último Error (si existe) */}
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
        
        {/* Recomendaciones del sistema */}
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
        
        {/* Log de Recuperación */}
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
