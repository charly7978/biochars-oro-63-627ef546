
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActivitySquare, Server, Shield, RefreshCw, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import ErrorDefenseSystem from '@/core/error-defense/ErrorDefenseSystem';
import { useErrorDefense } from '@/hooks/useErrorDefense';
import { Separator } from '@/components/ui/separator';

interface SystemDiagnosticsProps {
  minimal?: boolean;
}

export function SystemDiagnostics({ minimal = false }: SystemDiagnosticsProps) {
  const { errorState, attemptRecovery } = useErrorDefense('SystemDiagnostics');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOpen, setIsOpen] = useState<boolean>(!minimal);
  
  // Actualizar periódicamente
  useEffect(() => {
    const updateInterval = setInterval(() => {
      setLastUpdated(new Date());
    }, 15000);
    
    return () => clearInterval(updateInterval);
  }, []);
  
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
  
  return (
    <Card className={minimal ? "fixed bottom-4 right-4 z-40 w-80" : "w-full"}>
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
      
      <CardContent>
        <div className="space-y-4">
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
        </div>
      </CardContent>
      
      <Separator />
      
      <CardFooter className="pt-4 flex justify-between items-center">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ActivitySquare className="h-3 w-3" />
          <span>Actualizado: {lastUpdated.toLocaleTimeString()}</span>
        </div>
        
        <Button 
          size="sm" 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={attemptRecovery}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Recuperar</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
