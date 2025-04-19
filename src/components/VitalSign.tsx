
import React, { ReactNode, useEffect, useRef } from 'react';
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
  const prevValueRef = useRef<string | number>('--');
  const valueRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Detector de cambios para animación
    if (value !== prevValueRef.current && valueRef.current && highlighted) {
      // Aplicar clase de animación y remover después
      valueRef.current.classList.add('value-updated');
      
      setTimeout(() => {
        valueRef.current?.classList.remove('value-updated');
      }, 1500);
    }
    
    prevValueRef.current = value;
  }, [value, highlighted]);

  const getValueTextSize = () => {
    if (compact) return "text-xl";
    
    // Adjust text size based on length
    if (typeof value === 'string' && value.length > 5) {
      return "text-xl sm:text-2xl";
    }
    return "text-2xl sm:text-3xl";
  };

  // Determinar si es un valor real o un placeholder
  const isRealValue = value !== '--' && value !== 0 && value !== '0' && value !== '--/--';

  return (
    <div 
      className={cn(
        "rounded-lg p-2 flex flex-col items-center justify-center transition-all duration-300 relative",
        highlighted && isRealValue
          ? "bg-gray-900/80 border border-gray-800/50 shadow-lg" 
          : "bg-gray-100/20",
        compact ? "h-auto" : "h-full"
      )}
    >
      {/* Badge para valores reales */}
      {highlighted && isRealValue && (
        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      )}
      
      <div className="text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-1">
        {label}
      </div>
      
      <div 
        ref={valueRef}
        className={cn(
          getValueTextSize(),
          "font-bold transition-colors duration-300",
          highlighted && isRealValue
            ? "text-white" 
            : "text-gray-700"
        )}
        style={{ 
          animation: highlighted && isRealValue ? animations["result-animate"] : "none" 
        }}
      >
        <span 
          className="inline-flex items-center"
          style={{ animation: highlighted && isRealValue ? animations["number-highlight"] : "none" }}
        >
          {value}
          {icon && <span className="ml-1">{icon}</span>}
        </span>
        {unit && <span className="text-sm font-medium ml-1 text-gray-400">{unit}</span>}
      </div>
      
      {/* Indicador más visible cuando hay valor real */}
      {highlighted && isRealValue && (
        <div className="h-0.5 w-10 bg-gradient-to-r from-purple-500 to-pink-500 mt-1 rounded-full" />
      )}
    </div>
  );
};

export default VitalSign;
