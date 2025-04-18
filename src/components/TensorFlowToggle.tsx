
import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BrainCircuit, Cpu, CpuIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { TensorFlowService } from '@/core/services/TensorFlowService';
import { Badge } from '@/components/ui/badge';

export function TensorFlowToggle() {
  const [enabled, setEnabled] = useState(true);
  const [cpuUsage, setCpuUsage] = useState<number | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  
  // Cargar estado inicial de TensorFlow
  useEffect(() => {
    const tensorFlowService = TensorFlowService.getInstance();
    setEnabled(tensorFlowService.isTensorFlowEnabled());
    
    // Iniciar monitoreo de recursos
    const interval = setInterval(() => {
      // Simulación de monitoreo de recursos (no disponible directamente en todos los navegadores)
      if (window.performance && (window.performance as any).memory) {
        const memoryInfo = (window.performance as any).memory;
        const usedHeapPercentage = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
        setMemoryUsage(Math.round(usedHeapPercentage));
      }
      
      // Estimación de uso de CPU (simulada)
      const randomVariation = Math.random() * 10 - 5; // Variación de ±5%
      const baseCpuUsage = enabled ? 45 : 25; // Base más alta si TensorFlow está activo
      setCpuUsage(Math.max(5, Math.min(95, baseCpuUsage + randomVariation)));
    }, 2000);
    
    return () => clearInterval(interval);
  }, [enabled]);
  
  // Manejar cambio de estado
  const handleToggle = (checked: boolean) => {
    const tensorFlowService = TensorFlowService.getInstance();
    
    if (checked) {
      tensorFlowService.enableTensorFlow();
    } else {
      tensorFlowService.disableTensorFlow();
    }
    
    setEnabled(checked);
  };
  
  // Determinar el estado de uso de recursos
  const getResourceStatus = (value: number | null): 'low' | 'medium' | 'high' | 'idle' => {
    if (value === null) return 'idle';
    if (value < 30) return 'low';
    if (value < 70) return 'medium';
    return 'high';
  };
  
  // Colores para los indicadores de uso
  const getStatusColor = (status: 'low' | 'medium' | 'high' | 'idle'): string => {
    switch (status) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      case 'idle': return 'bg-gray-400';
    }
  };
  
  const cpuStatus = getResourceStatus(cpuUsage);
  const memoryStatus = getResourceStatus(memoryUsage);
  
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BrainCircuit className="h-5 w-5" />
          <span>Red Neuronal</span>
          <Badge variant={enabled ? "default" : "outline"} className="ml-auto">
            {enabled ? "Activa" : "Inactiva"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {enabled
            ? "La red neuronal está activa y procesando datos"
            : "La red neuronal está desactivada"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-3">
          <Switch
            id="tf-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
          <Label htmlFor="tf-toggle" className="cursor-pointer">
            {enabled ? "Desactivar" : "Activar"} Red Neuronal
          </Label>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2">
          {enabled 
            ? "Usando TensorFlow para cálculos precisos con IA" 
            : "Usando funciones estadísticas básicas para cálculos aproximados"}
        </p>
        
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">CPU</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(cpuStatus)}`} />
              <span className="text-xs">{cpuUsage !== null ? `${Math.round(cpuUsage)}%` : 'N/A'}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 13V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8"></path>
                <path d="M18 14v4"></path>
                <path d="M15 18h6"></path>
              </svg>
              <span className="text-xs font-medium">Memoria</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(memoryStatus)}`} />
              <span className="text-xs">{memoryUsage !== null ? `${Math.round(memoryUsage)}%` : 'N/A'}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <p className="text-xs text-muted-foreground">
          {enabled && cpuStatus === 'high' 
            ? "Desactivar la red neuronal puede mejorar el rendimiento" 
            : "El rendimiento actual es óptimo"}
        </p>
      </CardFooter>
    </Card>
  );
} 
