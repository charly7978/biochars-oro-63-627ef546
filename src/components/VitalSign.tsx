
import React from 'react';

interface VitalSignProps {
  label: string;
  value: number | string;
  unit?: string;
  calibrationProgress?: number;
  highlighted?: boolean;
}

const VitalSign = ({ 
  label, 
  value, 
  unit = '', 
  calibrationProgress,
  highlighted = false
}: VitalSignProps) => {
  // Formatear el valor de hemoglobina como entero
  let displayValue = value;
  if (label.includes("HEMOGLOBINA") && typeof value === 'number') {
    displayValue = Math.round(value);
  }
  
  const isCalibrating = calibrationProgress !== undefined && calibrationProgress < 100;
  
  return (
    <div className={`bg-gray-900/40 backdrop-blur-md rounded-xl p-3 flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${
      highlighted ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
    }`}>
      <h3 className="text-[10px] text-gray-300 font-medium uppercase tracking-wide mb-1">
        {label}
      </h3>
      
      <div className="relative w-full h-12 flex items-center justify-center">
        {isCalibrating ? (
          <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, calibrationProgress)}%` }}
            ></div>
          </div>
        ) : (
          <p className="text-xl font-bold text-white">
            {displayValue} {unit && <span className="text-sm text-gray-300">{unit}</span>}
          </p>
        )}
      </div>
    </div>
  );
};

export default VitalSign;
