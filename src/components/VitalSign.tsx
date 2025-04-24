
import React, { ReactNode, useEffect, useState } from 'react';
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
  // Estado local para la animación suave de valores
  const [displayValue, setDisplayValue] = useState<string | number>(value);
  
  // Actualizar el valor mostrado cuando cambia value
  useEffect(() => {
    // Asegurarse de que los valores vacíos se muestren como "--"
    if (value === null || value === undefined || value === 0) {
      setDisplayValue("--");
    } else {
      setDisplayValue(value);
    }
    
    console.log(`VitalSign [${label}] updated:`, { value, highlighted });
  }, [value, label]);

  const getValueTextSize = () => {
    if (compact) return "text-xl";
    
    // Adjust text size based on length
    if (typeof displayValue === 'string' && displayValue.length > 5) {
      return "text-xl sm:text-2xl";
    }
    return "text-2xl sm:text-3xl";
  };

  return (
    <div 
      className={cn(
        "rounded-lg p-2 flex flex-col items-center justify-center transition-all duration-300",
        highlighted 
          ? "bg-gray-900/60 border border-gray-700/40" 
          : "bg-gray-900/40",
        compact ? "h-auto" : "h-full"
      )}
      style={{
        transition: "all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
        transform: highlighted ? "translateY(0)" : "translateY(0)",
        boxShadow: highlighted ? "0 0 15px rgba(0, 0, 0, 0.3)" : "none"
      }}
    >
      <div className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      
      <div 
        className={cn(
          getValueTextSize(),
          "font-bold transition-colors duration-300",
          highlighted 
            ? "text-white" 
            : "text-gray-300"
        )}
        style={{ 
          textShadow: highlighted ? "0 0 8px rgba(255, 255, 255, 0.4)" : "none"
        }}
      >
        <span className="inline-flex items-center">
          {displayValue}
          {icon && <span className="ml-1">{icon}</span>}
        </span>
        {unit && <span className="text-sm font-medium ml-1 text-gray-400">{unit}</span>}
      </div>
    </div>
  );
};

export default VitalSign;
