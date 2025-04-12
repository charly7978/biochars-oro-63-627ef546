import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TensorFlowService } from '@/core/services/TensorFlowService';

export function TensorFlowToggle() {
  const [enabled, setEnabled] = useState(true);
  
  // Cargar estado inicial de TensorFlow
  useEffect(() => {
    const tensorFlowService = TensorFlowService.getInstance();
    setEnabled(tensorFlowService.isTensorFlowEnabled());
  }, []);
  
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
  
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BrainCircuit className="h-5 w-5" />
          <span>Red Neuronal</span>
        </CardTitle>
        <CardDescription>
          {enabled
            ? "La red neuronal está activa y procesando datos"
            : "La red neuronal está desactivada"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
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
      </CardContent>
    </Card>
  );
} 