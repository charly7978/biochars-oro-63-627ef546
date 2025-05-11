import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Cpu, Zap, BrainCircuit, Activity } from "lucide-react";

interface NeuralNetworkStatusProps {
  enabled: boolean;
  ready: boolean;
  models: Array<{
    id: string;
    name: string;
    version: string;
    architecture: string;
  }>;
  lastProcessingTime?: number;
  modelsUsed?: string[];
  confidence?: number;
}

export function NeuralNetworkStatus({
  enabled,
  ready,
  models,
  lastProcessingTime = 0,
  modelsUsed = [],
  confidence = 0
}: NeuralNetworkStatusProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <BrainCircuit className="w-5 h-5" />
            <span>Estado de Red Neural</span>
          </CardTitle>
          <Badge variant={enabled ? "default" : "outline"}>
            {enabled ? "Activada" : "Desactivada"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Estado de procesamiento */}
        {lastProcessingTime > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Tiempo de procesamiento</span>
              <span className="font-medium">{lastProcessingTime.toFixed(2)} ms</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Confianza</span>
              <span className="font-medium">{Math.round(confidence * 100)}%</span>
            </div>
            <Progress value={confidence * 100} className="h-2" />
          </div>
        )}
        
        {/* Listado de modelos */}
        <div className="space-y-2">
          {models.map(model => (
            <div 
              key={model.id} 
              className={`p-2 rounded-lg border ${
                modelsUsed.includes(model.id) 
                  ? "bg-primary/5 border-primary/20" 
                  : "bg-muted/40 border-border/50"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="font-medium flex items-center gap-1.5">
                  {modelsUsed.includes(model.id) && (
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{model.name}</span>
                </div>
                <Badge variant="outline" className="text-xs px-1 h-5">
                  v{model.version}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                <span>{model.architecture}</span>
              </div>
            </div>
          ))}
        </div>
        
        {models.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No hay modelos disponibles actualmente</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
