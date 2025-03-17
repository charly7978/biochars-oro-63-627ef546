
import React from 'react';

interface DiagnosticOverlayProps {
  isMonitoring: boolean;
  lastSignal: any;
  heartRate: number;
  signalQuality: number;
}

const DiagnosticOverlay: React.FC<DiagnosticOverlayProps> = ({ 
  isMonitoring, 
  lastSignal, 
  heartRate,
  signalQuality
}) => {
  if (!isMonitoring) return null;
  
  return (
    <div className="absolute top-0 left-0 p-2 bg-black/50 text-white text-xs w-full z-50 font-mono">
      <div>
        Status: {isMonitoring ? 'Monitoring' : 'Idle'} | 
        Signal: {lastSignal?.filteredValue?.toFixed(2) || 'N/A'} | 
        Quality: {signalQuality}%
      </div>
      <div>
        Finger: {lastSignal?.fingerDetected ? 'YES' : 'NO'} | 
        HR: {heartRate} BPM | 
        Raw: {lastSignal?.rawValue?.toFixed(2) || 'N/A'}
      </div>
      <div>
        Time: {new Date().toLocaleTimeString()} | 
        Camera: {lastSignal ? 'Active' : 'Inactive'} |
        Torch: {lastSignal?.torchEnabled ? 'ON' : 'OFF'}
      </div>
    </div>
  );
};

export default DiagnosticOverlay;
