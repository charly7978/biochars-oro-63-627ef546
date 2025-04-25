
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

  // Determinamos si hay un valor real para mostrar de manera más permisiva
  // Ahora permitimos mostrar valores de 0 y "--" como valores válidos
  const hasValue = value !== undefined && value !== null;
  
  // Format function to handle all types of values properly
  const formattedValue = () => {
    // Handle numeric values (both integers and floats)
    if (typeof value === 'number') {
      // Mostramos también valores 0
      if (label === "HIDRATACIÓN" || label === "SPO2") {
        // These are percentages, show as integers
        return value;
      } else if (label === "HEMOGLOBINA") {
        // For hemoglobin, show one decimal place
        return value.toFixed(1);
      }
      return value;
    }
    
    // Handle string values that are not empty or placeholders
    if (typeof value === 'string' && value !== undefined) {
      return value;
    }
    
    // Default placeholder
    return "--";
  };
  
  // Debug logging for troubleshooting display issues
  console.log(`VitalSign rendering: ${label}`, {
    rawValue: value,
    formattedValue: formattedValue(),
    hasValue,
    valueType: typeof value
  });

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
          {formattedValue()}
          {icon && <span className="ml-1">{icon}</span>}
        </span>
        {unit && <span className="text-sm font-medium ml-1 text-gray-400">{unit}</span>}
      </div>
    </div>
  );
};

export default VitalSign;
