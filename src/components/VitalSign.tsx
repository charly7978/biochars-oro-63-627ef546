
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
  normalRange?: string;
  description?: string;
}

const VitalSign = ({
  label,
  value,
  unit,
  highlighted = false,
  calibrationProgress,
  normalRange,
  description
}: VitalSignProps) => {
  // Prepare display value
  const displayValue = typeof value === 'number' ? value.toString() : value;
  
  const isCalibrating = calibrationProgress !== undefined && calibrationProgress < 100;

  return (
    <div className={`
      relative overflow-hidden rounded-xl p-3 w-full h-28
      flex flex-col items-center justify-between transition-all duration-300
      ${highlighted ? 'bg-gradient-to-br from-blue-900/80 to-indigo-900/80 border border-blue-600/50' : 'bg-gray-900/40 backdrop-blur-sm'}
    `}>
      {/* Calibration Overlay */}
      {isCalibrating && (
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <div className="w-full bg-gray-700/50 h-1 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300" 
              style={{ width: `${calibrationProgress || 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-white/80 mt-1">
            Calibrando...
          </span>
        </div>
      )}

      {/* Main content - only visible when not calibrating */}
      <div className={`w-full flex flex-col items-center ${isCalibrating ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
        <div className="text-[10px] font-semibold text-gray-200 tracking-wider">
          {label}
        </div>
        
        <div className="flex items-end justify-center mt-1">
          <span className="text-2xl font-bold text-white">
            {displayValue}
          </span>
          {unit && (
            <span className="text-xs font-medium text-gray-300 ml-1 mb-1">
              {unit}
            </span>
          )}
        </div>
        
        {normalRange && (
          <div className="text-[10px] font-medium text-gray-300/80 mt-1">
            Normal: {normalRange}
          </div>
        )}
        
        {description && (
          <div className="text-[9px] text-gray-400/80 mt-0.5">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

export default VitalSign;
