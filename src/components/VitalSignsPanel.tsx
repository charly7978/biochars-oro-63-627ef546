
import React from 'react';
import VitalSign from '@/components/VitalSign';

interface VitalSignsPanelProps {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  showResults?: boolean;
  calibrationProgress?: Record<string, number>;
}

const VitalSignsPanel: React.FC<VitalSignsPanelProps> = ({
  heartRate,
  spo2,
  pressure,
  arrhythmiaStatus,
  showResults = false,
  calibrationProgress,
}) => {
  // Extraer el conteo de arritmias de la cadena de estado
  const arrhythmiaCount = arrhythmiaStatus.split('|')[1] || "--";

  return (
    <div className="absolute bottom-[200px] left-0 right-0 px-4">
      <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl p-4">
        <div className="grid grid-cols-4 gap-2">
          <VitalSign 
            label="FRECUENCIA CARDÍACA"
            value={heartRate || "--"}
            unit="BPM"
            calibrationProgress={calibrationProgress?.heartRate}
          />
          <VitalSign 
            label="SPO2"
            value={spo2 || "--"}
            unit="%"
            calibrationProgress={calibrationProgress?.spo2}
          />
          <VitalSign 
            label="PRESIÓN ARTERIAL"
            value={pressure}
            unit="mmHg"
            calibrationProgress={calibrationProgress?.pressure}
          />
          <VitalSign 
            label="ARRITMIAS"
            value={arrhythmiaStatus}
            calibrationProgress={calibrationProgress?.arrhythmia}
          />
        </div>
      </div>
    </div>
  );
};

export default VitalSignsPanel;
