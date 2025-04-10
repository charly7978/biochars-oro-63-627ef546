
import React, { useState } from 'react';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Droplets, Activity, LineChart } from "lucide-react";
import VitalsChart from './VitalsChart';

interface Measurement {
  id: string;
  timestamp: number;
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  arrhythmiaStatus: string;
}

interface VitalsHistoryViewProps {
  measurements: Measurement[];
  onClose: () => void;
}

const VitalsHistoryView: React.FC<VitalsHistoryViewProps> = ({ 
  measurements = [], 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<string>("heart-rate");

  // Organizar datos para los gráficos
  const formatDataForCharts = () => {
    return {
      heartRate: measurements.map(m => ({ 
        timestamp: new Date(m.timestamp).toLocaleTimeString(), 
        value: m.heartRate 
      })),
      spo2: measurements.map(m => ({ 
        timestamp: new Date(m.timestamp).toLocaleTimeString(), 
        value: m.spo2 
      })),
      bloodPressure: measurements.map(m => ({ 
        timestamp: new Date(m.timestamp).toLocaleTimeString(), 
        systolic: m.systolic,
        diastolic: m.diastolic
      })),
    };
  };

  const chartData = formatDataForCharts();

  const renderSummaryStats = () => {
    if (measurements.length === 0) return null;

    // Calcular promedios
    const avgHeartRate = measurements.reduce((sum, m) => sum + m.heartRate, 0) / measurements.length;
    const avgSpo2 = measurements.reduce((sum, m) => sum + m.spo2, 0) / measurements.length;
    const avgSystolic = measurements.reduce((sum, m) => sum + m.systolic, 0) / measurements.length;
    const avgDiastolic = measurements.reduce((sum, m) => sum + m.diastolic, 0) / measurements.length;

    return (
      <div className="grid grid-cols-4 gap-4 my-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <h4 className="text-sm font-medium">Prom. Ritmo Cardíaco</h4>
            </div>
            <p className="text-2xl font-bold">{avgHeartRate.toFixed(0)} BPM</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium">Prom. SpO2</h4>
            </div>
            <p className="text-2xl font-bold">{avgSpo2.toFixed(0)}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-medium">Prom. Presión</h4>
            </div>
            <p className="text-2xl font-bold">{avgSystolic.toFixed(0)}/{avgDiastolic.toFixed(0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-green-500" />
              <h4 className="text-sm font-medium">Total Mediciones</h4>
            </div>
            <p className="text-2xl font-bold">{measurements.length}</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="bg-background p-4 rounded-lg max-w-4xl w-full mx-auto">
      <CardHeader>
        <CardTitle>Historial de Mediciones</CardTitle>
        <CardDescription>
          Resumen y tendencias de sus signos vitales recientes
        </CardDescription>
      </CardHeader>

      {renderSummaryStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="heart-rate" className="flex items-center gap-2">
            <Heart className="h-4 w-4" /> Ritmo Cardíaco
          </TabsTrigger>
          <TabsTrigger value="spo2" className="flex items-center gap-2">
            <Droplets className="h-4 w-4" /> SpO2
          </TabsTrigger>
          <TabsTrigger value="blood-pressure" className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Presión Arterial
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="heart-rate">
          <Card>
            <CardContent className="pt-6">
              <VitalsChart 
                title="Tendencia de Ritmo Cardíaco"
                data={chartData.heartRate}
                dataKey="value"
                label="BPM"
                color="#ef4444"
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="spo2">
          <Card>
            <CardContent className="pt-6">
              <VitalsChart 
                title="Tendencia de SpO2"
                data={chartData.spo2}
                dataKey="value"
                label="%"
                color="#3b82f6"
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="blood-pressure">
          <Card>
            <CardContent className="pt-6">
              <VitalsChart 
                title="Tendencia de Presión Arterial"
                data={chartData.bloodPressure}
                dataKey="systolic"
                secondaryDataKey="diastolic"
                label="mmHg"
                color="#8b5cf6"
                secondaryColor="#d946ef"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default VitalsHistoryView;
