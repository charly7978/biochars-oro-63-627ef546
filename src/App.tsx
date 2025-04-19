import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import React, { useRef } from 'react';
import PPGSignalMeter from './components/PPGSignalMeter';
import { useHeartBeatProcessor } from './hooks/useHeartBeatProcessor';

const App = () => {
  const peakRef = useRef<() => void>(null);

  const { processSignal, currentBPM, confidence, isArrhythmia, ...rest } = useHeartBeatProcessor();

  const handleNewSignal = (value: number) => {
    const result = processSignal(value);
    if (result.isPeak) {
      peakRef.current?.();
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      <PPGSignalMeter
        value={0}
        quality={100}
        isFingerDetected={true}
        onStartMeasurement={() => {}}
        onReset={() => {}}
        triggerPeakFeedbackRef={peakRef}
      />
    </Router>
  );
};

export default App;
