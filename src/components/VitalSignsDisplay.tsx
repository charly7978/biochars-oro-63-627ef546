
import React from 'react';
import VitalSign from './VitalSign';
import { VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

interface VitalSignsDisplayProps {
  vitalSigns: VitalSignsResult;
  heartRate: number;
  showResults: boolean;
}

const VitalSignsDisplay: React.FC<VitalSignsDisplayProps> = ({ 
  vitalSigns, 
  heartRate, 
  showResults 
}) => {
  return (
    <div className="absolute inset-x-0 top-[55%] bottom-[60px] bg-black/10 px-4 py-6">
      <div className="grid grid-cols-3 gap-4 place-items-center">
        <VitalSign 
          label="FRECUENCIA CARDÍACA"
          value={heartRate || "--"}
          unit="BPM"
          highlighted={showResults}
        />
        <VitalSign 
          label="SPO2"
          value={vitalSigns.spo2 || "--"}
          unit="%"
          highlighted={showResults}
        />
        <VitalSign 
          label="PRESIÓN ARTERIAL"
          value={vitalSigns.pressure}
          unit="mmHg"
          highlighted={showResults}
        />
        <VitalSign 
          label="GLUCOSA"
          value={vitalSigns.glucose || "--"}
          unit="mg/dL"
          highlighted={showResults}
        />
        <VitalSign 
          label="COLESTEROL/TRIGL."
          value={`${vitalSigns.lipids?.totalCholesterol || "--"}/${vitalSigns.lipids?.triglycerides || "--"}`}
          unit="mg/dL"
          highlighted={showResults}
        />
        <div></div> {/* Empty div to maintain grid layout */}
      </div>
    </div>
  );
};

export default VitalSignsDisplay;
