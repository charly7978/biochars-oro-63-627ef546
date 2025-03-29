
import React from 'react';
import { SignalValidationResult } from '../core/RealSignalValidator';

interface Props {
  result: SignalValidationResult;
}

const SignalValidationBox: React.FC<Props> = ({ result }) => {
  return (
    <div
      className="px-3 py-1 rounded-lg border shadow text-xs font-medium"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(1.5px)',
        color: result.color === 'red' ? '#dc2626' : result.color === 'orange' ? '#ea580c' : '#16a34a',
        borderColor: result.color === 'red' ? '#fca5a5' : result.color === 'orange' ? '#fdba74' : '#86efac'
      }}
    >
      <div className="flex items-center gap-2">
        <div 
          className="w-2.5 h-2.5 rounded-full" 
          style={{ 
            backgroundColor: result.color === 'red' ? '#dc2626' : 
                            result.color === 'orange' ? '#ea580c' : 
                            result.color === 'yellow' ? '#eab308' : 
                            result.color === 'green' ? '#16a34a' : '#6b7280' 
          }}
        />
        <span>{result.label}</span>
      </div>
      {result.warnings.length > 0 && (
        <ul className="mt-1 list-disc list-inside text-[10px] text-gray-700">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SignalValidationBox;
