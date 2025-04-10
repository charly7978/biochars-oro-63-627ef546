
import React, { ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { animations } from '@/theme/animations';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  compact?: boolean;
  icon?: ReactNode;
}

const VitalSign: React.FC<VitalSignProps> = ({
  label,
  value,
  unit,
  highlighted = false,
  compact = false,
  icon
}) => {
  const getValueTextSize = () => {
    if (compact) return "text-xl";
    
    // Adjust text size based on length
    if (typeof value === 'string' && value.length > 5) {
      return "text-xl sm:text-2xl";
    }
    return "text-2xl sm:text-3xl";
  };

  return (
    <div 
      className={cn(
        "rounded-lg p-2 flex flex-col items-center justify-center transition-all duration-300",
        highlighted 
          ? "bg-white/10 border border-white/20" 
          : "bg-gray-100/20",
        compact ? "h-auto" : "h-full"
      )}
    >
      <div className="text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-1">
        {label}
      </div>
      
      <div 
        className={cn(
          getValueTextSize(),
          "font-bold transition-colors duration-300",
          highlighted 
            ? "text-gray-900" 
            : "text-gray-700"
        )}
        style={{ 
          animation: highlighted ? animations["result-animate"] : "none" 
        }}
      >
        <span 
          className="inline-flex items-center"
          style={{ animation: highlighted ? animations["number-highlight"] : "none" }}
        >
          {value}
          {icon && <span className="ml-1">{icon}</span>}
        </span>
        {unit && <span className="text-sm font-medium ml-1 text-gray-600">{unit}</span>}
      </div>
    </div>
  );
};

export default VitalSign;

