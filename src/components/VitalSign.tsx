
import React, { ReactNode } from 'react';
import { cn } from "@/lib/utils";

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
    
    // Adjust text size based on length without using Math functions
    if (typeof value === 'string' && value.length > 5) {
      return "text-xl sm:text-2xl";
    }
    return "text-2xl sm:text-3xl";
  };

  // MODIFICADO: Determinar si hay un valor real para mostrar
  const hasValue = value !== undefined && value !== null && value !== 0 && value !== "--";

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
          highlighted && hasValue
            ? "text-white" 
            : "text-gray-300"
        )}
        style={{ 
          textShadow: highlighted && hasValue ? "0 0 8px rgba(255, 255, 255, 0.4)" : "none"
        }}
      >
        <span className="inline-flex items-center">
          {/* Display raw value directly without any processing */}
          {value}
          {icon && <span className="ml-1">{icon}</span>}
        </span>
        {unit && <span className="text-sm font-medium ml-1 text-gray-400">{unit}</span>}
      </div>
    </div>
  );
};

export default VitalSign;
