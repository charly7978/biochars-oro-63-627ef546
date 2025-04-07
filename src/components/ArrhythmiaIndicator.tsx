
import React, { memo, useEffect, useState } from 'react';
import { AlertTriangle, Heart } from 'lucide-react';
import { animations } from '@/theme/animations';

interface ArrhythmiaIndicatorProps {
  isArrhythmia: boolean;
  arrhythmiaStatus: string;
  className?: string;
  showDetails?: boolean;
}

const ArrhythmiaIndicator = memo(({ 
  isArrhythmia, 
  arrhythmiaStatus,
  className = '',
  showDetails = false
}: ArrhythmiaIndicatorProps) => {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState('--');
  
  useEffect(() => {
    if (isArrhythmia) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    
    // Extract count from arrhythmia status if available
    if (arrhythmiaStatus.includes('|')) {
      const countValue = arrhythmiaStatus.split('|')[1];
      if (countValue && countValue !== '--') {
        setCount(countValue);
      }
    }
  }, [isArrhythmia, arrhythmiaStatus]);
  
  if (!visible && !isArrhythmia && count === '--') return null;
  
  return (
    <div className={`flex items-center justify-center gap-2 rounded-md ${className}`}>
      {(visible || isArrhythmia) && (
        <div className="relative">
          <Heart 
            className="h-5 w-5 text-red-500 opacity-90"
            style={{ animation: animations["arrhythmia-pulse"] }}
            fill="currentColor"
          />
          <AlertTriangle 
            className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1"
            fill="currentColor"
          />
        </div>
      )}
      
      {showDetails && (
        <div className="text-sm font-medium text-gray-200">
          {count !== '--' ? `Arritmias: ${count}` : 'Ritmo Normal'}
        </div>
      )}
    </div>
  );
});

ArrhythmiaIndicator.displayName = 'ArrhythmiaIndicator';

export default ArrhythmiaIndicator;
