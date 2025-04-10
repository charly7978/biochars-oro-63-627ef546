
import React, { useEffect, useState } from 'react';
import { getGlobalFeedbackState } from '../hooks/heart-beat/signal-processing/signal-quality';
import { ArrowRightLeft, Signal, Activity, Heart } from 'lucide-react';

interface BidirectionalFeedbackStatusProps {
  isActive: boolean;
}

const BidirectionalFeedbackStatus: React.FC<BidirectionalFeedbackStatusProps> = ({ isActive }) => {
  const [signalQuality, setSignalQuality] = useState({
    signalStrength: 0,
    noiseLevel: 0,
    stability: 0,
    fingerConfidence: 0
  });
  
  const [heartRate, setHeartRate] = useState({
    confidence: 0,
    stability: 0
  });
  
  const [vitalSigns, setVitalSigns] = useState({
    spo2Quality: 0,
    pressureReliability: 0,
    arrhythmiaConfidence: 0
  });
  
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      const feedback = getGlobalFeedbackState();
      
      setSignalQuality({
        signalStrength: feedback.signalQuality.signalStrength,
        noiseLevel: feedback.signalQuality.noiseLevel,
        stability: feedback.signalQuality.stabilityScore,
        fingerConfidence: feedback.signalQuality.fingerDetectionConfidence
      });
      
      setHeartRate({
        confidence: feedback.heartRate.confidence,
        stability: feedback.heartRate.rhythmStability
      });
      
      setVitalSigns({
        spo2Quality: feedback.vitalSigns.spo2Quality,
        pressureReliability: feedback.vitalSigns.pressureReliability,
        arrhythmiaConfidence: feedback.vitalSigns.arrhythmiaConfidence
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [isActive]);
  
  // Make sure it's visible even when not active, for debugging purposes
  // if (!isActive) return null;
  
  return (
    <div className="absolute bottom-16 left-4 right-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-[9px] border border-blue-500/30 shadow-lg">
      <div className="flex items-center justify-center mb-2">
        <ArrowRightLeft className="h-3 w-3 text-blue-400 mr-1" />
        <span className="text-white/90 font-semibold">Feedback Bidireccional</span>
      </div>
      
      <div className="flex justify-between">
        <div className="flex-1 mr-1">
          <div className="flex items-center mb-1">
            <Signal className="h-2.5 w-2.5 text-green-400 mr-0.5" />
            <span className="text-white/80">Señal</span>
          </div>
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            <div className="text-white/60">Intensidad:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-green-500 transition-all duration-300"
                   style={{ width: `${signalQuality.signalStrength * 100}%` }} />
            </div>
            
            <div className="text-white/60">Estabilidad:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-green-500 transition-all duration-300"
                   style={{ width: `${signalQuality.stability * 100}%` }} />
            </div>
            
            <div className="text-white/60">Detección:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-green-500 transition-all duration-300"
                   style={{ width: `${signalQuality.fingerConfidence * 100}%` }} />
            </div>
          </div>
        </div>
        
        <div className="flex-1 mr-1">
          <div className="flex items-center mb-1">
            <Heart className="h-2.5 w-2.5 text-red-400 mr-0.5" />
            <span className="text-white/80">Frecuencia</span>
          </div>
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            <div className="text-white/60">Confianza:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-red-500 transition-all duration-300"
                   style={{ width: `${heartRate.confidence * 100}%` }} />
            </div>
            
            <div className="text-white/60">Estabilidad:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-red-500 transition-all duration-300"
                   style={{ width: `${heartRate.stability * 100}%` }} />
            </div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center mb-1">
            <Activity className="h-2.5 w-2.5 text-blue-400 mr-0.5" />
            <span className="text-white/80">Medidas</span>
          </div>
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            <div className="text-white/60">Oxígeno:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-blue-500 transition-all duration-300"
                   style={{ width: `${vitalSigns.spo2Quality * 100}%` }} />
            </div>
            
            <div className="text-white/60">Presión:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-blue-500 transition-all duration-300"
                   style={{ width: `${vitalSigns.pressureReliability * 100}%` }} />
            </div>
            
            <div className="text-white/60">Arritmias:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-blue-500 transition-all duration-300"
                   style={{ width: `${vitalSigns.arrhythmiaConfidence * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidirectionalFeedbackStatus;
