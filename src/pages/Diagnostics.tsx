
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDiagnostics } from '@/hooks/useDiagnostics';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import SignalQualityCard from '@/components/diagnostics/SignalQualityCard';
import CalibrationCard from '@/components/diagnostics/CalibrationCard';
import ChannelsCard from '@/components/diagnostics/ChannelsCard';
import SignalVisualizerCard from '@/components/diagnostics/SignalVisualizerCard';
import HeartbeatQualityCard from '@/components/diagnostics/HeartbeatQualityCard';
import ProcessingPipelineCard from '@/components/diagnostics/ProcessingPipelineCard';
import FeedbackSystemCard from '@/components/diagnostics/FeedbackSystemCard';

// Define DataPoint interface for chart data
interface DataPoint {
  value: number;
  time: number;
}

// Helper to convert number arrays to DataPoint arrays for visualization
const convertToDataPoints = (values: number[]): DataPoint[] => {
  return values.map((value, index) => ({
    value,
    time: Date.now() - (values.length - index) * 100 // Simulate time series
  }));
};

const Diagnostics = () => {
  const { diagnosticsData, updateDiagnosticsData } = useDiagnostics();
  
  // Update diagnostics data immediately on component mount
  useEffect(() => {
    updateDiagnosticsData();
    
    // Set up interval for continuous updates
    const intervalId = setInterval(() => {
      updateDiagnosticsData();
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [updateDiagnosticsData]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">System Diagnostics</h1>
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Main
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Signal Quality */}
          <SignalQualityCard 
            quality={diagnosticsData.signalQuality.current}
            status={diagnosticsData.signalQuality.status}
            noiseLevel={diagnosticsData.signalMetrics.noiseLevel}
            stabilityScore={diagnosticsData.signalMetrics.stabilityScore}
          />
          
          {/* Cardiac Signal Quality */}
          <HeartbeatQualityCard 
            currentBPM={diagnosticsData.heartbeatMetrics.currentBPM}
            confidence={diagnosticsData.heartbeatMetrics.confidence}
            arrhythmiaDetected={diagnosticsData.heartbeatMetrics.arrhythmiaDetected}
            signalStrength={diagnosticsData.heartbeatMetrics.signalStrength > 80 ? 'strong' : 
                           diagnosticsData.heartbeatMetrics.signalStrength > 50 ? 'moderate' : 
                           diagnosticsData.heartbeatMetrics.signalStrength > 20 ? 'weak' : 'unknown'}
            rrIntervalQuality={diagnosticsData.heartbeatMetrics.rrIntervalQuality}
          />
          
          {/* Calibration Status */}
          <CalibrationCard 
            active={diagnosticsData.calibration.active}
            status={diagnosticsData.calibration.status === 'uncalibrated' ? 
                  'not_calibrated' : diagnosticsData.calibration.status}
            progress={diagnosticsData.calibration.progress}
            lastCalibrated={diagnosticsData.calibration.lastCalibrated}
          />
          
          {/* Signal Visualization - Full width */}
          <div className="col-span-1 md:col-span-2 xl:col-span-3">
            <SignalVisualizerCard 
              rawSignal={convertToDataPoints(diagnosticsData.signalHistory.raw)}
              filteredSignal={convertToDataPoints(diagnosticsData.signalHistory.filtered)}
              amplifiedSignal={convertToDataPoints(diagnosticsData.signalHistory.amplified)}
            />
          </div>
          
          {/* Channels Status */}
          <ChannelsCard channels={diagnosticsData.channels} />
          
          {/* Processing Pipeline */}
          <ProcessingPipelineCard 
            framesProcessed={diagnosticsData.processingPipeline.framesProcessed}
            framesPerSecond={diagnosticsData.processingPipeline.framesPerSecond}
            activeProcessors={diagnosticsData.processingPipeline.activeProcessors}
          />
          
          {/* Feedback System */}
          <FeedbackSystemCard 
            bidirectionalActive={diagnosticsData.feedbackSystem.bidirectionalActive}
            lastFeedbackTime={diagnosticsData.feedbackSystem.lastFeedbackTime}
            feedbackQueue={diagnosticsData.feedbackSystem.feedbackQueue}
            adaptations={diagnosticsData.feedbackSystem.adaptations}
          />
        </div>
        
        <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2">System Status Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Signal Processing</h3>
              <p className="text-sm">
                {diagnosticsData.systemStatus.isMonitoring 
                  ? `System actively monitoring with ${diagnosticsData.processingPipeline.activeProcessors.length} processors.` 
                  : 'System is not actively monitoring.'}
                {' '}
                {diagnosticsData.systemStatus.fingerDetected 
                  ? 'Finger is detected on the sensor.' 
                  : 'No finger detected.'}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Signal Quality</h3>
              <p className="text-sm">
                {diagnosticsData.signalQuality.status === 'good'
                  ? 'Signal quality is good for accurate vital sign analysis.'
                  : diagnosticsData.signalQuality.status === 'moderate'
                  ? 'Signal quality is moderate - results may have reduced accuracy.'
                  : 'Signal quality is poor - place finger firmly on the sensor.'}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Calibration Status</h3>
              <p className="text-sm">
                {diagnosticsData.calibration.status === 'calibrated'
                  ? 'System is fully calibrated and optimized.'
                  : diagnosticsData.calibration.status === 'calibrating'
                  ? `System is currently calibrating (${diagnosticsData.calibration.progress}% complete).`
                  : 'System requires calibration for optimal performance.'}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Adaptation Status</h3>
              <p className="text-sm">
                {diagnosticsData.feedbackSystem.bidirectionalActive
                  ? 'Bidirectional feedback is active and adapting to signal conditions.'
                  : 'Bidirectional feedback is inactive.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Diagnostics;
