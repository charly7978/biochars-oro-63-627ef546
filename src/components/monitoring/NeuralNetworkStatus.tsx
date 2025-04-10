
import React, { useEffect, useState } from 'react';
import { TensorFlowModelRegistry } from '../../core/neural/tensorflow/TensorFlowModelRegistry';
import { useTensorFlowModel } from '../../hooks/useTensorFlowModel';
import { toast } from 'sonner';

interface ModelInfo {
  name: string;
  status: 'loading' | 'ready' | 'error' | 'not_loaded';
  predictionTime: number;
  confidence: number;
}

export const NeuralNetworkStatus: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [backend, setBackend] = useState('');
  const [supportedBackends, setSupportedBackends] = useState<string[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<any>(null);
  
  const heartRateModel = useTensorFlowModel('heartRate', false);
  
  useEffect(() => {
    // Initialize TensorFlow registry
    const initTF = async () => {
      try {
        const registry = TensorFlowModelRegistry.getInstance();
        
        if (!initialized) {
          await registry.initialize();
          setInitialized(true);
          setBackend(registry.getActiveBackend());
          setSupportedBackends(registry.getSupportedBackends());
          
          toast.success(`TensorFlow.js inicializado usando ${registry.getActiveBackend()}`);
        }
      } catch (error) {
        console.error('Error initializing TensorFlow:', error);
        toast.error('Error inicializando TensorFlow.js');
      }
    };
    
    initTF();
    
    // Update model info periodically
    const updateInterval = setInterval(() => {
      if (heartRateModel.isReady) {
        setModelInfo([
          {
            name: 'Heart Rate',
            status: heartRateModel.isReady ? 'ready' : (heartRateModel.isLoading ? 'loading' : 'not_loaded'),
            predictionTime: heartRateModel.predictionTime,
            confidence: heartRateModel.confidence
          }
        ]);
        
        setMemoryInfo(heartRateModel.memoryInfo);
      }
    }, 2000);
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [heartRateModel, initialized]);
  
  // Load the heart rate model
  const loadHeartRateModel = async () => {
    try {
      await heartRateModel.loadModel();
      toast.success('Modelo de ritmo cardíaco cargado');
    } catch (error) {
      console.error('Error loading heart rate model:', error);
      toast.error('Error cargando modelo');
    }
  };
  
  // Clean up memory
  const cleanupMemory = async () => {
    await heartRateModel.cleanupMemory();
    toast.success('Memoria liberada');
  };
  
  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Estado Neural</h3>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Estado TensorFlow.js</span>
          <span className={`text-xs px-2 py-1 rounded-full ${initialized ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {initialized ? 'Activo' : 'Inicializando...'}
          </span>
        </div>
        
        {initialized && (
          <div className="text-xs text-gray-600 mb-2">
            <div>Backend: <span className="font-medium">{backend}</span></div>
            <div>
              Backends disponibles: 
              {supportedBackends.map(b => (
                <span key={b} className={`ml-1 px-1.5 py-0.5 rounded ${b === backend ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Modelos</h4>
        
        {modelInfo.length > 0 ? (
          <div className="space-y-3">
            {modelInfo.map(model => (
              <div key={model.name} className="bg-white p-3 rounded border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{model.name}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    model.status === 'ready' ? 'bg-green-100 text-green-800' :
                    model.status === 'loading' ? 'bg-yellow-100 text-yellow-800' :
                    model.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {model.status === 'ready' ? 'Listo' :
                     model.status === 'loading' ? 'Cargando...' :
                     model.status === 'error' ? 'Error' :
                     'No cargado'}
                  </span>
                </div>
                
                {model.status === 'ready' && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="block text-gray-500">Tiempo</span>
                      <span className="font-medium">{model.predictionTime.toFixed(1)} ms</span>
                    </div>
                    <div>
                      <span className="block text-gray-500">Confianza</span>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div 
                          className={`h-1.5 rounded-full ${
                            model.confidence > 0.7 ? 'bg-green-500' :
                            model.confidence > 0.4 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{width: `${model.confidence * 100}%`}}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-3 rounded border border-gray-200 text-sm text-gray-500">
            No hay modelos cargados
          </div>
        )}
      </div>
      
      {memoryInfo && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Memoria</h4>
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="block text-gray-500">Tensores</span>
                <span className="font-medium">{memoryInfo.numTensors}</span>
              </div>
              <div>
                <span className="block text-gray-500">Bytes</span>
                <span className="font-medium">{(memoryInfo.numBytes / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex space-x-2">
        <button
          onClick={loadHeartRateModel}
          className="text-xs px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          disabled={heartRateModel.isReady}
        >
          Cargar modelo
        </button>
        
        <button
          onClick={cleanupMemory}
          className="text-xs px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Limpiar memoria
        </button>
      </div>
    </div>
  );
};

export default NeuralNetworkStatus;
