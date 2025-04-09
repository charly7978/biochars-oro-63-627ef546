
/**
 * Component that demonstrates the hybrid signal processing capabilities
 * Combines traditional algorithms with neural networks
 */
import React, { useState, useEffect } from 'react';
import { useHybridVitalSignsProcessor } from '../hooks/useHybridVitalSignsProcessor';
import { HybridProcessingOptions } from '../modules/vital-signs';

interface HybridSignalProcessorProps {
  signalValue: number;
  rrData?: { intervals: number[]; lastPeakTime: number | null };
  onResultsUpdate?: (results: any) => void;
}

export const HybridSignalProcessor: React.FC<HybridSignalProcessorProps> = ({
  signalValue,
  rrData,
  onResultsUpdate
}) => {
  // Use our hybrid processor hook
  const {
    processSignal,
    lastValidResults,
    neuralEnabled,
    toggleNeuralProcessing,
    diagnosticsEnabled,
    toggleDiagnostics,
    debugInfo,
    getNeuralInfo
  } = useHybridVitalSignsProcessor({
    useNeuralModels: true,
    neuralWeight: 0.6,
    neuralConfidenceThreshold: 0.5
  });
  
  // State for options
  const [neuralWeight, setNeuralWeight] = useState<number>(0.6);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [results, setResults] = useState<any>(null);
  const [neuralInfo, setNeuralInfo] = useState<any>(null);
  
  // Process signal when it changes
  useEffect(() => {
    const processSignalAsync = async () => {
      if (signalValue !== undefined) {
        const result = await processSignal(signalValue, rrData);
        setResults(result);
        if (onResultsUpdate) {
          onResultsUpdate(result);
        }
      }
    };
    
    processSignalAsync();
  }, [signalValue, rrData, processSignal, onResultsUpdate]);
  
  // Update neural info periodically
  useEffect(() => {
    const updateNeuralInfo = () => {
      setNeuralInfo(getNeuralInfo());
    };
    
    updateNeuralInfo();
    const interval = setInterval(updateNeuralInfo, 5000);
    
    return () => clearInterval(interval);
  }, [getNeuralInfo]);
  
  // Update processor options when sliders change
  const handleNeuralWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setNeuralWeight(value);
  };
  
  const handleConfidenceThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setConfidenceThreshold(value);
  };
  
  const applySettings = () => {
    const options: Partial<HybridProcessingOptions> = {
      neuralWeight,
      neuralConfidenceThreshold: confidenceThreshold
    };
    
    toggleNeuralProcessing(neuralEnabled);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Hybrid Signal Processor</h2>
      
      {/* Results Display */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="p-3 bg-gray-100 rounded">
          <div className="text-sm font-medium text-gray-500">SpO2</div>
          <div className="text-2xl font-bold">{results?.spo2 || '--'}%</div>
        </div>
        <div className="p-3 bg-gray-100 rounded">
          <div className="text-sm font-medium text-gray-500">Blood Pressure</div>
          <div className="text-2xl font-bold">{results?.pressure || '--/--'}</div>
        </div>
        <div className="p-3 bg-gray-100 rounded">
          <div className="text-sm font-medium text-gray-500">Glucose</div>
          <div className="text-2xl font-bold">{results?.glucose || '--'} mg/dL</div>
        </div>
      </div>
      
      {/* Neural Processing Controls */}
      <div className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Neural Processing</h3>
          <div className="flex items-center">
            <span className="mr-2 text-sm">{neuralEnabled ? 'Enabled' : 'Disabled'}</span>
            <button
              onClick={() => toggleNeuralProcessing(!neuralEnabled)}
              className={`px-3 py-1 rounded text-white text-sm ${
                neuralEnabled ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              {neuralEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Neural Weight: {neuralWeight.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={neuralWeight}
              onChange={handleNeuralWeightChange}
              className="w-full"
              disabled={!neuralEnabled}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Traditional</span>
              <span>Equal</span>
              <span>Neural</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confidence Threshold: {confidenceThreshold.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={confidenceThreshold}
              onChange={handleConfidenceThresholdChange}
              className="w-full"
              disabled={!neuralEnabled}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
          
          <button
            onClick={applySettings}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
            disabled={!neuralEnabled}
          >
            Apply Settings
          </button>
        </div>
      </div>
      
      {/* Neural Info */}
      {neuralInfo && (
        <div className="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50">
          <h3 className="font-medium mb-2">TensorFlow Info</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">Backend:</div>
            <div className="font-semibold">{neuralInfo.backend}</div>
            
            <div className="text-gray-600">WebGPU:</div>
            <div className="font-semibold">
              {neuralInfo.webgpuEnabled ? (
                <span className="text-green-600">Enabled</span>
              ) : (
                <span className="text-gray-600">Disabled</span>
              )}
            </div>
            
            <div className="text-gray-600">Models:</div>
            <div className="font-semibold">{neuralInfo.modelsLoaded.length}</div>
          </div>
        </div>
      )}
      
      {/* Confidence Display */}
      {results?.confidence && (
        <div className="mb-6 p-4 border border-green-200 rounded-lg bg-green-50">
          <h3 className="font-medium mb-2">Result Confidence</h3>
          <div className="space-y-2">
            {Object.entries(results.confidence).map(([key, value]) => (
              <div key={key} className="flex items-center">
                <span className="w-24 text-sm text-gray-600">{key}:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full"
                    style={{ width: `${(value as number) * 100}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-sm">
                  {((value as number) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Diagnostics Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Diagnostics</span>
        <button
          onClick={() => toggleDiagnostics(!diagnosticsEnabled)}
          className={`px-3 py-1 rounded text-white text-sm ${
            diagnosticsEnabled ? 'bg-purple-500' : 'bg-gray-500'
          }`}
        >
          {diagnosticsEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
