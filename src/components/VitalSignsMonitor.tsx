
import React, { useCallback } from 'react';
import { useVitalSigns } from '@/context/VitalSignsContext';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import MonitorButton from '@/components/MonitorButton';
import CameraView from '@/modules/camera/CameraView';
import VitalSign from '@/components/VitalSign';
import HeartRateDisplay from '@/components/HeartRateDisplay';
import SignalQualityIndicator from '@/components/SignalQualityIndicator';

const VitalSignsMonitor: React.FC = () => {
  const {
    isMonitoring,
    heartRate,
    signalQuality,
    vitalSigns,
    elapsedTime,
    startMonitoring,
    stopMonitoring,
    resetAll,
    isArrhythmia,
    handleStreamReady
  } = useVitalSigns();

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  return (
    <div className="container max-w-3xl mx-auto p-4">
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="w-full aspect-video relative overflow-hidden rounded-lg">
              <CameraView 
                onStreamReady={handleStreamReady}
                isMonitoring={isMonitoring}
                isFingerDetected={signalQuality > 0.2}
                signalQuality={signalQuality * 100}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HeartRateDisplay 
                bpm={heartRate} 
                confidence={signalQuality}
              />
              
              <div className="flex flex-col justify-between gap-2">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Signal Quality</div>
                  <div className="flex items-center gap-2">
                    <Progress value={signalQuality * 100} className="h-2" />
                    <span className="text-sm">{Math.round(signalQuality * 100)}%</span>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 mb-1">Elapsed Time</div>
                  <div className="flex items-center gap-2">
                    <Progress value={(elapsedTime / 30) * 100} className="h-2" />
                    <span className="text-sm">{elapsedTime}s</span>
                  </div>
                </div>
                
                <SignalQualityIndicator quality={signalQuality} isMonitoring={isMonitoring} />
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <VitalSign 
              label="FRECUENCIA CARDÍACA" 
              value={vitalSigns.heartRate > 0 ? vitalSigns.heartRate : '--'} 
              unit="BPM" 
            />
            <VitalSign 
              label="SPO2" 
              value={vitalSigns.spo2 > 0 ? vitalSigns.spo2 : '--'} 
              unit="%" 
            />
            <VitalSign 
              label="PRESIÓN ARTERIAL" 
              value={vitalSigns.pressure} 
              unit="mmHg" 
            />
            <VitalSign 
              label="ARRITMIAS" 
              value={vitalSigns.arrhythmiaStatus} 
              unit="" 
              highlighted={isArrhythmia}
            />
          </div>
        </Card>
        
        <div className="grid grid-cols-2 gap-4">
          <MonitorButton 
            isMonitoring={isMonitoring} 
            onToggle={handleToggleMonitoring} 
            variant="monitor" 
          />
          <MonitorButton 
            isMonitoring={false} 
            onToggle={resetAll} 
            variant="reset" 
          />
        </div>
      </div>
    </div>
  );
};

export default VitalSignsMonitor;
