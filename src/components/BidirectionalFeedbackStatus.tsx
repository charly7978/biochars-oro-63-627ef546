
import React, { useEffect, useState, useRef } from 'react';
import { getGlobalFeedbackState } from '../hooks/heart-beat/signal-processing/signal-quality';
import { ArrowRightLeft, Signal, Activity, Heart, AlertTriangle, Info } from 'lucide-react';

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
    stability: 0,
    currentBPM: 0,
    isPeakActive: false
  });
  
  const [vitalSigns, setVitalSigns] = useState({
    spo2Quality: 0,
    pressureReliability: 0,
    arrhythmiaConfidence: 0,
    glucoseReliability: 0,
    lipidsReliability: 0
  });

  // Referencias para detectar cambios
  const previousValuesRef = useRef({
    signalStrength: 0,
    heartRateConfidence: 0,
    spo2Quality: 0
  });
  
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [debugInfo, setDebugInfo] = useState('No updates');
  
  useEffect(() => {
    // Poll feedback data frequently to detect real changes
    const interval = setInterval(() => {
      const feedback = getGlobalFeedbackState();
      
      // Detect significant changes to confirm system is active
      const hasSignificantChanges = 
        Math.abs(previousValuesRef.current.signalStrength - feedback.signalQuality.signalStrength) > 0.01 ||
        Math.abs(previousValuesRef.current.heartRateConfidence - feedback.heartRate.confidence) > 0.01 ||
        Math.abs(previousValuesRef.current.spo2Quality - feedback.vitalSigns.spo2Quality) > 0.01;
      
      if (hasSignificantChanges) {
        console.log('CAMBIO DETECTADO en retroalimentación bidireccional:', {
          'antes-señal': previousValuesRef.current.signalStrength.toFixed(2),
          'ahora-señal': feedback.signalQuality.signalStrength.toFixed(2),
          'antes-ritmo': previousValuesRef.current.heartRateConfidence.toFixed(2),
          'ahora-ritmo': feedback.heartRate.confidence.toFixed(2),
          'antes-oxígeno': previousValuesRef.current.spo2Quality.toFixed(2),
          'ahora-oxígeno': feedback.vitalSigns.spo2Quality.toFixed(2)
        });
        
        // Update counter and timestamp on real change
        setUpdateCount(prev => prev + 1);
        const now = new Date();
        setLastUpdateTime(now.toISOString().substr(11, 12));
        
        // Update debug info with exact values that changed
        setDebugInfo(`${now.toISOString().substr(11, 12)} - Signal: ${previousValuesRef.current.signalStrength.toFixed(2)} → ${feedback.signalQuality.signalStrength.toFixed(2)}, HR: ${previousValuesRef.current.heartRateConfidence.toFixed(2)} → ${feedback.heartRate.confidence.toFixed(2)}`);
      }
      
      // Update previous values
      previousValuesRef.current = {
        signalStrength: feedback.signalQuality.signalStrength,
        heartRateConfidence: feedback.heartRate.confidence,
        spo2Quality: feedback.vitalSigns.spo2Quality
      };
      
      // Detailed log for debugging
      console.log('Estado actual de retroalimentación bidireccional:', {
        señal: {
          intensidad: (feedback.signalQuality.signalStrength * 100).toFixed(1) + '%',
          ruido: (feedback.signalQuality.noiseLevel * 100).toFixed(1) + '%',
          estabilidad: (feedback.signalQuality.stabilityScore * 100).toFixed(1) + '%',
          detecciónDedo: (feedback.signalQuality.fingerDetectionConfidence * 100).toFixed(1) + '%'
        },
        ritmoCardíaco: {
          bpm: feedback.heartRate.currentBPM,
          confianza: (feedback.heartRate.confidence * 100).toFixed(1) + '%',
          pico: feedback.heartRate.isPeak ? 'SÍ' : 'NO',
          estabilidad: (feedback.heartRate.rhythmStability * 100).toFixed(1) + '%'
        },
        signosVitales: {
          oxígeno: (feedback.vitalSigns.spo2Quality * 100).toFixed(1) + '%',
          presión: (feedback.vitalSigns.pressureReliability * 100).toFixed(1) + '%',
          arritmia: (feedback.vitalSigns.arrhythmiaConfidence * 100).toFixed(1) + '%',
          glucosa: (feedback.vitalSigns.glucoseReliability || 0) * 100 + '%',
          lípidos: (feedback.vitalSigns.lipidsReliability || 0) * 100 + '%'
        }
      });
      
      setSignalQuality({
        signalStrength: feedback.signalQuality.signalStrength,
        noiseLevel: feedback.signalQuality.noiseLevel,
        stability: feedback.signalQuality.stabilityScore,
        fingerConfidence: feedback.signalQuality.fingerDetectionConfidence
      });
      
      setHeartRate({
        confidence: feedback.heartRate.confidence,
        stability: feedback.heartRate.rhythmStability,
        currentBPM: feedback.heartRate.currentBPM,
        isPeakActive: feedback.heartRate.isPeak
      });
      
      setVitalSigns({
        spo2Quality: feedback.vitalSigns.spo2Quality,
        pressureReliability: feedback.vitalSigns.pressureReliability,
        arrhythmiaConfidence: feedback.vitalSigns.arrhythmiaConfidence,
        glucoseReliability: feedback.vitalSigns.glucoseReliability || 0,
        lipidsReliability: feedback.vitalSigns.lipidsReliability || 0
      });
    }, 150); // Poll more frequently to better detect real changes
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="absolute inset-x-4 top-20 z-30 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-[10px] border border-blue-500/80 shadow-lg shadow-blue-900/20 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <ArrowRightLeft className="h-3 w-3 text-blue-400 mr-1" />
          <span className="text-white/90 font-semibold">Sistema Integrado de Retroalimentación</span>
        </div>
        <div className="text-green-400 text-[8px] flex items-center space-x-1">
          <span>Cambios detectados: {updateCount}</span>
          <span>|</span>
          <span className="font-mono">Último: {lastUpdateTime}</span>
        </div>
      </div>
      
      <div className="flex justify-between">
        <div className="flex-1 mr-1">
          <div className="flex items-center mb-1">
            <Signal className="h-2.5 w-2.5 text-green-400 mr-0.5" />
            <span className="text-white/80">Señal</span>
            <span className="ml-1 text-[7px] text-green-300">{(signalQuality.signalStrength * 100).toFixed(1)}%</span>
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
            <Heart className={`h-2.5 w-2.5 ${heartRate.isPeakActive ? 'text-red-300' : 'text-red-600'} mr-0.5`} />
            <span className="text-white/80">Frecuencia</span>
            <span className="text-white/80 ml-1 text-[7px]">{heartRate.currentBPM > 0 ? heartRate.currentBPM + ' bpm' : '--'}</span>
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
            
            <div className="text-white/60">Glucosa:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-blue-500 transition-all duration-300"
                   style={{ width: `${vitalSigns.glucoseReliability * 100}%` }} />
            </div>
            
            <div className="text-white/60">Lípidos:</div>
            <div className="text-white relative w-full h-1.5 bg-gray-700 rounded overflow-hidden">
              <div className="absolute inset-0 bg-blue-500 transition-all duration-300"
                   style={{ width: `${vitalSigns.lipidsReliability * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-1 pt-1 border-t border-gray-700 flex justify-between items-center">
        <div className="text-white/60 text-[8px] flex items-center">
          <AlertTriangle className="h-2 w-2 text-yellow-400 mr-0.5" />
          <span>Sistema operando únicamente con datos reales</span>
        </div>
        <div className="text-[7px] text-blue-300 font-mono">{debugInfo}</div>
      </div>
    </div>
  );
};

export default BidirectionalFeedbackStatus;
