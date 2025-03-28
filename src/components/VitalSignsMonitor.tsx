
import React from 'react';
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
    isArrhythmia
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
              <CameraView />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HeartRateDisplay 
                heartRate={heartRate} 
                isMonitoring={isMonitoring}
                isArrhythmia={isArrhythmia}
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
                
                <SignalQualityIndicator quality={signalQuality} />
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <VitalSign 
              title="Heart Rate" 
              value={`${vitalSigns.heartRate > 0 ? vitalSigns.heartRate : '--'}`} 
              unit="BPM" 
            />
            <VitalSign 
              title="SpO2" 
              value={`${vitalSigns.spo2 > 0 ? vitalSigns.spo2 : '--'}`} 
              unit="%" 
            />
            <VitalSign 
              title="Blood Pressure" 
              value={vitalSigns.pressure} 
              unit="mmHg" 
            />
            <VitalSign 
              title="Arrhythmia" 
              value={vitalSigns.arrhythmiaStatus} 
              unit="" 
              isAlert={isArrhythmia}
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
