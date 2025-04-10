
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Droplet, Activity, Thermometer } from "lucide-react";
import VitalsChart from "@/components/VitalsChart";
import AppTitle from "@/components/AppTitle";
import GraphGrid from "@/components/GraphGrid";

const Charts = () => {
  const navigate = useNavigate();
  const [heartRateData, setHeartRateData] = useState([]);
  const [spo2Data, setSpo2Data] = useState([]);
  const [pressureData, setPressureData] = useState([]);
  const [hydrationData, setHydrationData] = useState([]);

  useEffect(() => {
    // This would typically fetch data from a database or context
    // For demo, we'll generate sample data
    const now = new Date();
    
    // Generate sample heart rate data for the last 30 minutes
    const hrData = Array.from({ length: 12 }, (_, i) => {
      const time = new Date(now.getTime() - (30 - i * 2.5) * 60 * 1000);
      return {
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: 60 + Math.floor(Math.random() * 40) // 60-100 BPM
      };
    });
    
    // Generate sample SpO2 data
    const o2Data = Array.from({ length: 12 }, (_, i) => {
      const time = new Date(now.getTime() - (30 - i * 2.5) * 60 * 1000);
      return {
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: 94 + Math.floor(Math.random() * 5) // 94-99%
      };
    });
    
    // Generate sample blood pressure data
    const bpData = Array.from({ length: 12 }, (_, i) => {
      const time = new Date(now.getTime() - (30 - i * 2.5) * 60 * 1000);
      return {
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        systolic: 110 + Math.floor(Math.random() * 30), // 110-140
        diastolic: 70 + Math.floor(Math.random() * 15) // 70-85
      };
    });
    
    // Generate sample hydration data
    const hydData = Array.from({ length: 12 }, (_, i) => {
      const time = new Date(now.getTime() - (30 - i * 2.5) * 60 * 1000);
      return {
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: 50 + Math.floor(Math.random() * 40) // 50-90%
      };
    });
    
    setHeartRateData(hrData);
    setSpo2Data(o2Data);
    setPressureData(bpData);
    setHydrationData(hydData);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ 
      height: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: '100vh',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'linear-gradient(to bottom, #9b87f5 0%, #D6BCFA 15%, #8B5CF6 30%, #D946EF 45%, #F97316 60%, #0EA5E9 75%, #1A1F2C 85%, #221F26 92%, #222222 100%)'
    }}>
      <div className="relative z-10 h-full flex flex-col">
        <div className="px-4 py-4 flex items-center bg-black/30 backdrop-blur-sm">
          <button 
            onClick={() => navigate('/')}
            className="p-2 rounded-full bg-black/20 text-white mr-4"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Historial de Signos Vitales</h1>
        </div>
        
        <div className="absolute top-20 left-0 right-0 bottom-0 overflow-auto px-4 py-4 pb-20">
          <div className="absolute inset-0 -z-10">
            <GraphGrid />
          </div>
          
          <div className="flex flex-col gap-8 pb-10">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center mb-2">
                <Heart className="w-5 h-5 text-red-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Ritmo Cardíaco</h2>
              </div>
              <VitalsChart 
                data={heartRateData}
                dataKey="value"
                title=""
                label="BPM"
                color="#ef4444"
              />
            </div>
            
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center mb-2">
                <Activity className="w-5 h-5 text-blue-400 mr-2" />
                <h2 className="text-lg font-semibold text-white">SpO2</h2>
              </div>
              <VitalsChart 
                data={spo2Data}
                dataKey="value"
                title=""
                label="%"
                color="#3b82f6"
              />
            </div>
            
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center mb-2">
                <Activity className="w-5 h-5 text-purple-400 mr-2" />
                <h2 className="text-lg font-semibold text-white">Presión Arterial</h2>
              </div>
              <VitalsChart 
                data={pressureData}
                dataKey="systolic"
                secondaryDataKey="diastolic"
                title=""
                label="mmHg"
                color="#8b5cf6"
                secondaryColor="#a78bfa"
              />
            </div>
            
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center mb-2">
                <Droplet className="w-5 h-5 text-cyan-400 mr-2" />
                <h2 className="text-lg font-semibold text-white">Hidratación</h2>
              </div>
              <VitalsChart 
                data={hydrationData}
                dataKey="value"
                title=""
                label="%"
                color="#06b6d4"
              />
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 inset-x-0">
          <AppTitle />
        </div>
      </div>
    </div>
  );
};

export default Charts;
