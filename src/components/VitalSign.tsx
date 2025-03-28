
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface VitalSignProps {
  label: string;
  value: number | string | any;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
  arrhythmiaData?: any;
}

const VitalSign: React.FC<VitalSignProps> = ({ 
  label, 
  value, 
  unit = '', 
  highlighted = false,
  calibrationProgress,
  arrhythmiaData
}) => {
  // Asegurarse de que value sea primitivo (string o número)
  const displayValue = React.useMemo(() => {
    if (value === null || value === undefined) return "--";
    
    // Si es un objeto con property 'value', usar esa propiedad
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return value.value;
    }
    
    // Si es un número, formatearlo si es necesario
    if (typeof value === 'number') {
      if (value === 0) return "--";
      // Redondear a 1 decimal si no es entero
      return Number.isInteger(value) ? value : value.toFixed(1);
    }
    
    // Para otros casos, convertir a string
    return String(value);
  }, [value]);

  // Determinar si debe mostrar indicador de arritmia
  const showArrhythmiaIndicator = React.useMemo(() => {
    return label === "ARRITMIAS" && 
           arrhythmiaData && 
           String(displayValue).includes("ARRITMIA");
  }, [label, displayValue, arrhythmiaData]);

  // Determinar severidad de arritmia para coloración
  const arrhythmiaSeverity = React.useMemo(() => {
    if (!showArrhythmiaIndicator || !arrhythmiaData) return null;
    return arrhythmiaData.severity === 'alta' ? 'alta' : 'media';
  }, [showArrhythmiaIndicator, arrhythmiaData]);

  // Colores basados en la severidad
  const getBgColor = () => {
    if (highlighted) return 'bg-green-900/30';
    if (showArrhythmiaIndicator) {
      return arrhythmiaData.severity === 'alta' ? 'bg-red-900/40' : 'bg-red-900/30';
    }
    return 'bg-gray-900/30';
  };

  const getTextColor = () => {
    if (highlighted) return 'text-green-400';
    if (showArrhythmiaIndicator) {
      return arrhythmiaData.severity === 'alta' ? 'text-red-500' : 'text-red-400';
    }
    return 'text-white';
  };

  return (
    <div className={`flex flex-col items-center p-2 rounded-lg transition-colors ${getBgColor()}`}>
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="flex items-baseline">
        <span className={`text-xl font-bold ${getTextColor()}`}>
          {displayValue}
        </span>
        {unit && displayValue !== "--" && (
          <span className="text-gray-400 text-xs ml-1">{unit}</span>
        )}
      </div>
      
      {calibrationProgress !== undefined && (
        <div className="w-full mt-1 bg-gray-700/30 h-1 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-in-out" 
            style={{ width: `${Math.min(100, Math.max(0, calibrationProgress * 100))}%` }}
          />
        </div>
      )}
      
      {showArrhythmiaIndicator && arrhythmiaData && (
        <div className="flex items-center mt-1 gap-1">
          <AlertTriangle className={`w-3 h-3 ${arrhythmiaData.severity === 'alta' ? 'text-red-500' : 'text-orange-400'}`} />
          <div className={`text-xs ${arrhythmiaData.severity === 'alta' ? 'text-red-300' : 'text-orange-300'}`}>
            {arrhythmiaData.severity === 'alta' ? 'Severidad alta' : 'Severidad media'}
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
