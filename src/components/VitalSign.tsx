
import React from 'react';

interface VitalSignProps {
  label: string;
  value: number | string | any;
  unit?: string;
  highlighted?: boolean;
}

const VitalSign: React.FC<VitalSignProps> = ({ 
  label, 
  value, 
  unit = '', 
  highlighted = false 
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

  return (
    <div className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
      highlighted ? 'bg-green-900/30' : 'bg-gray-900/30'
    }`}>
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="flex items-baseline">
        <span className={`text-xl font-bold ${
          highlighted ? 'text-green-400' : 'text-white'
        }`}>
          {displayValue}
        </span>
        {unit && displayValue !== "--" && (
          <span className="text-gray-400 text-xs ml-1">{unit}</span>
        )}
      </div>
    </div>
  );
};

export default VitalSign;
