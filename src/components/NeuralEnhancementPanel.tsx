
/**
 * Neural Enhancement Panel
 * Demonstrates Phase 3 capabilities with interactive controls
 */
import React, { useState, useEffect } from 'react';
import { useNeuroEnhancer } from '../hooks/useNeuroEnhancer';

interface NeuralEnhancementPanelProps {
  signalData?: number[];
  onEnhanced?: (enhancedSignal: number[]) => void;
}

export const NeuralEnhancementPanel: React.FC<NeuralEnhancementPanelProps> = ({
  signalData = [],
  onEnhanced
}) => {
  const {
    isReady,
    enhanceSignal,
    lastResult,
    metrics,
    updateOptions,
    options,
    isWebGPUAvailable,
    getTensorFlowInfo
  } = useNeuroEnhancer();
  
  const [enhancementLevel, setEnhancementLevel] = useState(options.enhancementLevel || 0.7);
  const [preserveFeatures, setPreserveFeatures] = useState(options.preserveFeatures || true);
  const [mergeTechniques, setMergeTechniques] = useState(options.mergeTechniques || true);
  const [tfInfo, setTfInfo] = useState<any>(null);
  
  // Get TensorFlow info on load
  useEffect(() => {
    setTfInfo(getTensorFlowInfo());
    
    const infoInterval = setInterval(() => {
      setTfInfo(getTensorFlowInfo());
    }, 5000);
    
    return () => clearInterval(infoInterval);
  }, [getTensorFlowInfo]);
  
  // Enhance signal when it changes
  useEffect(() => {
    if (isReady && signalData.length > 0) {
      enhanceSignal(signalData).then(result => {
        if (onEnhanced) {
          onEnhanced(result.enhancedSignal);
        }
      });
    }
  }, [signalData, isReady, enhanceSignal, onEnhanced]);
  
  // Update options when controls change
  useEffect(() => {
    updateOptions({
      enhancementLevel,
      preserveFeatures,
      mergeTechniques
    });
  }, [enhancementLevel, preserveFeatures, mergeTechniques, updateOptions]);
  
  // Handle enhancement level change
  const handleEnhancementLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnhancementLevel(parseFloat(e.target.value));
  };
  
  // Handle toggle changes
  const handlePreserveFeaturesChange = () => {
    setPreserveFeatures(!preserveFeatures);
  };
  
  const handleMergeTechniquesChange = () => {
    setMergeTechniques(!mergeTechniques);
  };
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3">Neural Signal Enhancement</h2>
      
      {/* Status indicator */}
      <div className="mb-4 flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${isReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
        <span className="text-sm font-medium">
          {isReady ? 'System Ready' : 'Initializing...'}
        </span>
        <span className={`ml-auto text-sm ${isWebGPUAvailable ? 'text-green-600' : 'text-yellow-600'}`}>
          {isWebGPUAvailable ? 'WebGPU Accelerated' : 'Standard Processing'}
        </span>
      </div>
      
      {/* Enhancement controls */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enhancement Level: {enhancementLevel.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={enhancementLevel}
            onChange={handleEnhancementLevelChange}
            className="w-full"
            disabled={!isReady}
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="preserveFeatures"
            checked={preserveFeatures}
            onChange={handlePreserveFeaturesChange}
            className="mr-2"
            disabled={!isReady}
          />
          <label htmlFor="preserveFeatures" className="text-sm text-gray-700">
            Preserve Signal Features
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="mergeTechniques"
            checked={mergeTechniques}
            onChange={handleMergeTechniquesChange}
            className="mr-2"
            disabled={!isReady}
          />
          <label htmlFor="mergeTechniques" className="text-sm text-gray-700">
            Hybrid Enhancement (Neural + Classical)
          </label>
        </div>
      </div>
      
      {/* Results panel */}
      {lastResult && (
        <div className="bg-white p-3 rounded border border-gray-200 mb-4">
          <h3 className="text-sm font-semibold mb-2">Last Enhancement</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">Confidence:</div>
            <div className="font-medium">{(lastResult.confidenceScore * 100).toFixed(1)}%</div>
            
            <div className="text-gray-600">Quality Improvement:</div>
            <div className="font-medium">{(lastResult.qualityImprovement * 100).toFixed(1)}%</div>
            
            <div className="text-gray-600">Processing Time:</div>
            <div className="font-medium">{lastResult.latency.toFixed(2)} ms</div>
          </div>
        </div>
      )}
      
      {/* Metrics panel */}
      <div className="bg-gray-100 p-3 rounded">
        <h3 className="text-sm font-semibold mb-2">Performance Metrics</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-600">Signals Enhanced:</div>
          <div className="font-medium">{metrics.totalEnhanced}</div>
          
          <div className="text-gray-600">Avg. Latency:</div>
          <div className="font-medium">{metrics.avgLatency.toFixed(2)} ms</div>
          
          <div className="text-gray-600">Avg. Improvement:</div>
          <div className="font-medium">{(metrics.avgImprovement * 100).toFixed(1)}%</div>
        </div>
      </div>
      
      {/* TensorFlow info */}
      {tfInfo && (
        <div className="mt-4 text-xs text-gray-500">
          <div>Backend: {tfInfo.backend}</div>
          <div>WebGPU: {tfInfo.webgpuEnabled ? 'Enabled' : 'Disabled'}</div>
          <div>Models: {tfInfo.modelsLoaded.join(', ')}</div>
        </div>
      )}
    </div>
  );
};
