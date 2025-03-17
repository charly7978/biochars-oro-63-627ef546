
import React from 'react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Simplified component that shows if camera is working
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Simple color based on presence of signal
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    return '#00ff00';
  };

  // Simple text status
  const getQualityText = (q: number) => {
    if (q === 0) return 'Inactivo';
    return 'Activo';
  };

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative" style={{ marginTop: "-9mm" }}>
      <div className="flex items-center gap-1">
        <div 
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300"
          style={{
            borderColor: getQualityColor(quality),
            backgroundColor: `${getQualityColor(quality)}33`
          }}
        >
          <span className="text-[9px] font-bold text-white">{quality > 0 ? 'ON' : 'OFF'}</span>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-semibold text-white/90">Estado de Cámara</span>
            <span 
              className="text-[9px] font-medium"
              style={{ color: getQualityColor(quality) }}
            >
              {getQualityText(quality)}
            </span>
          </div>

          <div className="w-full h-0.5 bg-gray-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{
                width: `${quality}%`,
                backgroundColor: getQualityColor(quality)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalQualityIndicator;
