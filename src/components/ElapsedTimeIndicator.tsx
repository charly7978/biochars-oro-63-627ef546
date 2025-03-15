
import React from 'react';

interface ElapsedTimeIndicatorProps {
  elapsedTime: number;
  isMonitoring: boolean;
}

const ElapsedTimeIndicator: React.FC<ElapsedTimeIndicatorProps> = ({ 
  elapsedTime, 
  isMonitoring 
}) => {
  if (!isMonitoring) return null;
  
  return (
    <div className="absolute bottom-40 left-0 right-0 text-center">
      <span className="text-xl font-medium text-gray-300">{elapsedTime}s / 30s</span>
    </div>
  );
};

export default ElapsedTimeIndicator;
