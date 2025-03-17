
import React from 'react';
import VitalSign from "@/components/VitalSign";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";

interface VitalSignsDisplayProps {
  heartRate: number;
  vitalSigns: VitalSignsResult;
  showResults: boolean;
}

const VitalSignsDisplay: React.FC<VitalSignsDisplayProps> = ({
  heartRate,
  vitalSigns,
  showResults
}) => {
  return (
    <div className="absolute inset-x-0 top-[45%] bottom-[60px] bg-black/10 px-4 py-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 place-items-center h-full overflow-y-auto pb-4">
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
          label="COLESTEROL"
          value={vitalSigns.lipids?.totalCholesterol || "--"}
          unit="mg/dL"
          highlighted={showResults}
        />
        <VitalSign 
          label="TRIGLICÉRIDOS"
          value={vitalSigns.lipids?.triglycerides || "--"}
          unit="mg/dL"
          highlighted={showResults}
        />
      </div>
    </div>
  );
};

export default VitalSignsDisplay;
