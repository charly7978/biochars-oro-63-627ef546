
import React from 'react';
import AppTitle from '../AppTitle';
import { Fingerprint } from 'lucide-react';

interface QualityIndicatorProps {
  quality: number;
  getAverageQuality: () => number;
  getTrueFingerDetection: () => boolean;
  getQualityColor: (q: number) => string;
  getQualityText: (q: number) => string;
}

const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  quality,
  getAverageQuality,
  getTrueFingerDetection,
  getQualityColor,
  getQualityText
}) => {
  const displayQuality = getAverageQuality();
  const displayFingerDetected = getTrueFingerDetection();

  return (
    <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-1">
      <div className="flex items-center gap-1 ml-2 mt-0" style={{transform: 'translateY(-2mm)'}}>
        <div className="w-[120px]">
          <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
            <div
              className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
              style={{ width: `${displayFingerDetected ? displayQuality : 0}%` }}
            />
          </div>
          <span 
            className="text-[7px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
            style={{ color: displayQuality > 60 ? '#0EA5E9' : '#F59E0B' }}
          >
            {getQualityText(quality)}
          </span>
        </div>
        <div style={{ marginLeft: '2mm' }}>
          <AppTitle />
        </div>
      </div>

      <div className="flex flex-col items-center">
        <Fingerprint
          className={`h-7 w-7 transition-colors duration-300 ${
            !displayFingerDetected ? 'text-gray-400' :
            displayQuality > 65 ? 'text-green-500' :
            displayQuality > 40 ? 'text-yellow-500' :
            'text-red-500'
          }`}
          strokeWidth={1.5}
          style={{
            opacity: displayFingerDetected ? 1 : 0.6,
            filter: displayFingerDetected ? 'none' : 'grayscale(0.5)'
          }}
        />
        <span className="text-[7px] text-center font-medium text-black/80">
          {displayFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
        </span>
      </div>
    </div>
  );
};

export default QualityIndicator;
