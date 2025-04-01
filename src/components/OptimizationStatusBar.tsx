
import React, { useEffect, useState } from 'react';
import { useOptimizedProcessing } from '../hooks/useOptimizedProcessing';
import { OptimizationPhase } from '../modules/extraction/optimization/OptimizationManager';

interface OptimizationStatusBarProps {
  showControls?: boolean;
  enableAutoAdvance?: boolean;
  initialPhase?: OptimizationPhase;
  onPhaseChange?: (phase: OptimizationPhase) => void;
}

const OptimizationStatusBar: React.FC<OptimizationStatusBarProps> = ({
  showControls = true,
  enableAutoAdvance = true,
  initialPhase = 'phase1',
  onPhaseChange
}) => {
  const { 
    isInitialized, 
    status, 
    error, 
    advanceToNextPhase,
    setPhase,
    getDetailedMetrics
  } = useOptimizedProcessing(true, {
    autoAdvancePhases: enableAutoAdvance,
    initialPhase
  });
  
  const [metrics, setMetrics] = useState<any>(null);
  
  // Actualizar métricas periódicamente
  useEffect(() => {
    if (!isInitialized) return;
    
    const intervalId = setInterval(() => {
      const currentMetrics = getDetailedMetrics();
      setMetrics(currentMetrics);
    }, 2000);
    
    return () => clearInterval(intervalId);
  }, [isInitialized, getDetailedMetrics]);
  
  // Notificar cambios de fase
  useEffect(() => {
    if (status && onPhaseChange) {
      onPhaseChange(status.phase);
    }
  }, [status, onPhaseChange]);
  
  // Mapear fase a texto más amigable
  const getPhaseLabel = (phase: OptimizationPhase) => {
    switch (phase) {
      case 'phase1': return 'Básicas';
      case 'phase2': return 'Avanzadas';
      case 'phase3': return 'Completas';
      default: return 'Desconocido';
    }
  };
  
  // Mostrar spinner durante inicialización
  if (!isInitialized) {
    return (
      <div className="bg-gray-100 p-2 rounded-md text-sm flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        <span>Inicializando optimizaciones...</span>
      </div>
    );
  }
  
  // Mostrar error si ocurre
  if (error) {
    return (
      <div className="bg-red-100 p-2 rounded-md text-sm text-red-700">
        Error: {error}
      </div>
    );
  }
  
  return (
    <div className="bg-gray-100 p-3 rounded-md text-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">Optimizaciones Activas</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
          Fase: {getPhaseLabel(status?.phase || 'phase1')}
        </span>
      </div>
      
      {status && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white p-2 rounded shadow-sm">
            <div className="text-xs text-gray-500">Tiempo de procesamiento</div>
            <div className="font-medium">{status.processingTime.toFixed(2)} ms</div>
          </div>
          
          <div className="bg-white p-2 rounded shadow-sm">
            <div className="text-xs text-gray-500">Funciones activas</div>
            <div className="font-medium">{status.enabledFeatures.length}</div>
          </div>
          
          {metrics && metrics.processingTime && (
            <>
              <div className="bg-white p-2 rounded shadow-sm">
                <div className="text-xs text-gray-500">Rango de tiempo</div>
                <div className="font-medium">
                  {metrics.processingTime.min.toFixed(1)} - {metrics.processingTime.max.toFixed(1)} ms
                </div>
              </div>
              
              {metrics.memory.available && (
                <div className="bg-white p-2 rounded shadow-sm">
                  <div className="text-xs text-gray-500">Memoria</div>
                  <div className="font-medium">
                    {(metrics.memory.avg / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {showControls && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setPhase('phase1')}
            className={`px-2 py-1 text-xs rounded ${status?.phase === 'phase1' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'}`}
          >
            Fase 1
          </button>
          
          <button
            onClick={() => setPhase('phase2')}
            className={`px-2 py-1 text-xs rounded ${status?.phase === 'phase2' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'}`}
          >
            Fase 2
          </button>
          
          <button
            onClick={() => setPhase('phase3')}
            className={`px-2 py-1 text-xs rounded ${status?.phase === 'phase3' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'}`}
          >
            Fase 3
          </button>
          
          {status?.readyForNextPhase && status.phase !== 'phase3' && (
            <button
              onClick={advanceToNextPhase}
              className="px-2 py-1 text-xs bg-green-500 text-white rounded ml-auto"
            >
              Avanzar fase ➔
            </button>
          )}
        </div>
      )}
      
      {status?.readyForNextPhase && status.phase !== 'phase3' && !showControls && (
        <div className="bg-green-100 p-2 rounded text-xs text-green-700 mt-2">
          ✓ Listo para avanzar a la siguiente fase
        </div>
      )}
      
      {status?.phase === 'phase3' && (
        <div className="bg-green-100 p-2 rounded text-xs text-green-700 mt-2">
          ✓ Todas las optimizaciones están activas
        </div>
      )}
    </div>
  );
};

export default OptimizationStatusBar;
