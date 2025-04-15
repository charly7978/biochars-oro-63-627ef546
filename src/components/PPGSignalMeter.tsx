import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Chart,
  registerables,
  ChartDataset,
  ChartOptions,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useCamera } from '@/hooks/useCamera';
import { useSignalProcessor } from '@/hooks/useSignalProcessor';
import { useVitalSignsProcessor } from '@/hooks/useVitalSignsProcessor';
import { useHeartBeatProcessor } from '@/hooks/useHeartBeatProcessor';
import { useHeartbeatFeedback } from '@/hooks/useHeartbeatFeedback';
import { ArrhythmiaWindow } from '@/hooks/vital-signs/types';
import { FeedbackService } from '@/services/FeedbackService';
import { cleanupServices } from '@/utils/cleanup-utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Progress
} from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Register chart.js components
Chart.register(...registerables);

interface PPGSignalMeterProps {
  width?: number;
  height?: number;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({
  width = 800,
  height = 300,
}) => {
  // Camera and signal processing hooks
  const { hasCamera, startCamera, stopCamera, frameData } = useCamera();
  const {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
  } = useSignalProcessor();
  const {
    processSignal: processVitalSignal,
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    arrhythmiaCounter,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo
  } = useVitalSignsProcessor();
  const {
    currentBPM,
    confidence,
    processSignal: processHeartBeat,
    reset: resetHeartBeat,
    isArrhythmia,
    requestBeep,
    startMonitoring,
    stopMonitoring,
    arrhythmiaCount
  } = useHeartBeatProcessor();
  const { playHeartbeatSound, playAlertSound } = useHeartbeatFeedback();

  // Ref for chart instance
  const chartRef = useRef<Chart<"line"> | null>(null);

  // State for UI elements
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isHapticEnabled, setIsHapticEnabled] = useState(true);
  const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
  const [isArrhythmiaAreaVisible, setIsArrhythmiaAreaVisible] = useState(true);
  const [signalThreshold, setSignalThreshold] = useState(0.2);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulatedBPM, setSimulatedBPM] = useState(75);
  const [simulatedConfidence, setSimulatedConfidence] = useState(0.8);
  const [simulatedArrhythmia, setSimulatedArrhythmia] = useState(false);
  const [simulatedArrhythmiaCount, setSimulatedArrhythmiaCount] = useState(0);
  const [simulatedSignalQuality, setSimulatedSignalQuality] = useState(75);
  const [simulatedStressLevel, setSimulatedStressLevel] = useState(30);
  const [simulatedArtifact, setSimulatedArtifact] = useState(false);
  const [simulatedSpo2, setSimulatedSpo2] = useState(98);
  const [simulatedHeartRate, setSimulatedHeartRate] = useState(72);
  const [simulatedPressure, setSimulatedPressure] = useState("120/80");
  const [simulatedGlucose, setSimulatedGlucose] = useState(90);
  const [simulatedCholesterol, setSimulatedCholesterol] = useState(180);
  const [simulatedTriglycerides, setSimulatedTriglycerides] = useState(120);
  const [simulatedHemoglobin, setSimulatedHemoglobin] = useState(14);
  const [simulatedHydration, setSimulatedHydration] = useState(60);
  const [simulatedRRIntervals, setSimulatedRRIntervals] = useState([800, 820, 790, 810, 805]);
  const [simulatedHrvData, setSimulatedHrvData] = useState({
    sdnn: 25,
    rmssd: 20,
    pnn50: 45
  });
  const [simulatedPPGData, setSimulatedPPGData] = useState(Array(200).fill(0.5));
  const [isCalibrationMode, setIsCalibrationMode] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [isArtifactDetected, setIsArtifactDetected] = useState(false);
  const [arrhythmiaStatus, setArrhythmiaStatus] = useState("--");
  const [hrvData, setHrvData] = useState({});
  const [ppgData, setPpgData] = useState([]);
  const [stressLevel, setStressLevel] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  const [isFingerDetected, setIsFingerDetected] = useState(false);
  const [isWeakSignal, setIsWeakSignal] = useState(false);
  const [isArrhythmiaDetected, setIsArrhythmiaDetected] = useState(false);
  const [lastValidBPM, setLastValidBPM] = useState(0);
  const [consecutiveWeakSignals, setConsecutiveWeakSignals] = useState(0);
  const [lastPeakTime, setLastPeakTime] = useState(0);
  const [lastSignalValue, setLastSignalValue] = useState(0);
  const [lastDerivativeValue, setLastDerivativeValue] = useState(0);
  const [lastBaselineValue, setLastBaselineValue] = useState(0);
  const [lastConfidenceValue, setLastConfidenceValue] = useState(0);
  const [lastPeakConfirmationBuffer, setLastPeakConfirmationBuffer] = useState([]);
  const [lastConfirmedPeak, setLastConfirmedPeak] = useState(false);
  const [lastHeartBeatResult, setLastHeartBeatResult] = useState(null);
  const [lastVitalSignsResult, setLastVitalSignsResult] = useState(null);
  const [lastArrhythmiaWindow, setLastArrhythmiaWindow] = useState(null);
  const [lastArrhythmiaCount, setLastArrhythmiaCount] = useState(0);
  const [lastArrhythmiaStatus, setLastArrhythmiaStatus] = useState("--");
  const [lastHrvData, setLastHrvData] = useState({});
  const [lastPpgData, setLastPpgData] = useState([]);
  const [lastStressLevel, setLastStressLevel] = useState(0);
  const [lastSignalQuality, setLastSignalQuality] = useState(0);
  const [lastFingerDetected, setLastFingerDetected] = useState(false);
  const [lastWeakSignal, setLastWeakSignal] = useState(false);
  const [lastArrhythmiaDetected, setLastArrhythmiaDetected] = useState(false);
  const [lastValidRRIntervals, setLastValidRRIntervals] = useState([]);
  const [lastValidHrvData, setLastValidHrvData] = useState({});
  const [lastValidPpgData, setLastValidPpgData] = useState([]);
  const [lastValidStressLevel, setLastValidStressLevel] = useState(0);
  const [lastValidSignalQuality, setLastValidSignalQuality] = useState(0);
  const [lastValidFingerDetected, setLastValidFingerDetected] = useState(false);
  const [lastValidWeakSignal, setLastValidWeakSignal] = useState(false);
  const [lastValidArrhythmiaDetected, setLastValidArrhythmiaDetected] = useState(false);
  const [lastValidArrhythmiaCount, setLastValidArrhythmiaCount] = useState(0);
  const [lastValidArrhythmiaStatus, setLastValidArrhythmiaStatus] = useState("--");
  const [lastValidBpm, setLastValidBpm] = useState(0);
  const [lastValidConfidence, setLastValidConfidence] = useState(0);
  const [lastValidPeakTime, setLastValidPeakTime] = useState(0);
  const [lastValidSignalValue, setLastValidSignalValue] = useState(0);
  const [lastValidDerivativeValue, setLastValidDerivativeValue] = useState(0);
  const [lastValidBaselineValue, setLastValidBaselineValue] = useState(0);
  const [lastValidConfidenceValue, setLastValidConfidenceValue] = useState(0);
  const [lastValidPeakConfirmationBuffer, setLastValidPeakConfirmationBuffer] = useState([]);
  const [lastValidConfirmedPeak, setLastValidConfirmedPeak] = useState(false);
  const [lastValidHeartBeatResult, setLastValidHeartBeatResult] = useState(null);
  const [lastValidVitalSignsResult, setLastValidVitalSignsResult] = useState(null);
  const [lastValidArrhythmiaWindow, setLastValidArrhythmiaWindow] = useState(null);
  const [lastValidArrhythmiaCount, setLastValidArrhythmiaCount] = useState(0);
  const [lastValidArrhythmiaStatus, setLastValidArrhythmiaStatus] = useState("--");
  const [lastValidHrvData, setLastValidHrvData] = useState({});
  const [lastValidPpgData, setLastValidPpgData] = useState([]);
  const [lastValidStressLevel, setLastValidStressLevel] = useState(0);
  const [lastValidSignalQuality, setLastValidSignalQuality] = useState(0);
  const [lastValidFingerDetected, setLastValidFingerDetected] = useState(false);
  const [lastValidWeakSignal, setLastValidWeakSignal] = useState(false);
  const [lastValidArrhythmiaDetected, setLastValidArrhythmiaDetected] = useState(false);
  const [lastValidConsecutiveWeakSignals, setLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastPeakTime, setLastValidLastPeakTime] = useState(0);
  const [lastValidLastSignalValue, setLastValidLastSignalValue] = useState(0);
  const [lastValidLastDerivativeValue, setLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastBaselineValue, setLastValidLastBaselineValue] = useState(0);
  const [lastValidLastConfidenceValue, setLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastPeakConfirmationBuffer, setLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastConfirmedPeak, setLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastHeartBeatResult, setLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastVitalSignsResult, setLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastArrhythmiaWindow, setLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastArrhythmiaCount, setLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastArrhythmiaStatus, setLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastHrvData, setLastValidLastHrvData] = useState({});
  const [lastValidLastPpgData, setLastValidLastPpgData] = useState([]);
  const [lastValidLastStressLevel, setLastValidLastStressLevel] = useState(0);
  const [lastValidLastSignalQuality, setLastValidLastSignalQuality] = useState(0);
  const [lastValidLastFingerDetected, setLastValidLastFingerDetected] = useState(false);
  const [lastValidLastWeakSignal, setLastValidLastWeakSignal] = useState(false);
  const [lastValidLastArrhythmiaDetected, setLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidRRIntervals, setLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidHrvData, setLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidPpgData, setLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidStressLevel, setLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidSignalQuality, setLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidFingerDetected, setLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidWeakSignal, setLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidArrhythmiaDetected, setLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidConsecutiveWeakSignals, setLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastPeakTime, setLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastSignalValue, setLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastDerivativeValue, setLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastBaselineValue, setLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastConfidenceValue, setLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastConfirmedPeak, setLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastHeartBeatResult, setLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastVitalSignsResult, setLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastHrvData, setLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastPpgData, setLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastStressLevel, setLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastSignalQuality, setLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastFingerDetected, setLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastWeakSignal, setLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidHrvData, setLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidPpgData, setLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidConsecutiveWeakSignals, setLastValidLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastValidLastPeakTime, setLastValidLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastValidLastSignalValue, setLastValidLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastValidLastDerivativeValue, setLastValidLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastValidLastBaselineValue, setLastValidLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastValidLastConfidenceValue, setLastValidLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastValidLastConfirmedPeak, setLastValidLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastValidLastHeartBeatResult, setLastValidLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastValidLastVitalSignsResult, setLastValidLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastValidLastHrvData, setLastValidLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastValidLastPpgData, setLastValidLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastValidLastStressLevel, setLastValidLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastSignalQuality, setLastValidLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastFingerDetected, setLastValidLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastWeakSignal, setLastValidLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidLastValidHrvData, setLastValidLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidPpgData, setLastValidLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidConsecutiveWeakSignals, setLastValidLastValidLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastValidLastValidLastPeakTime, setLastValidLastValidLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastValidLastValidLastSignalValue, setLastValidLastValidLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastDerivativeValue, setLastValidLastValidLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastBaselineValue, setLastValidLastValidLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastConfidenceValue, setLastValidLastValidLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastValidLastValidLastConfirmedPeak, setLastValidLastValidLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastValidLastValidLastHeartBeatResult, setLastValidLastValidLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastVitalSignsResult, setLastValidLastValidLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastValidLastValidLastHrvData, setLastValidLastValidLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidLastPpgData, setLastValidLastValidLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidLastStressLevel, setLastValidLastValidLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidLastSignalQuality, setLastValidLastValidLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidLastFingerDetected, setLastValidLastValidLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastWeakSignal, setLastValidLastValidLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidHrvData, setLastValidLastValidLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidLastValidPpgData, setLastValidLastValidLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLastValidLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidConsecutiveWeakSignals, setLastValidLastValidLastValidLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastPeakTime, setLastValidLastValidLastValidLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastSignalValue, setLastValidLastValidLastValidLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastDerivativeValue, setLastValidLastValidLastValidLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastBaselineValue, setLastValidLastValidLastValidLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastConfidenceValue, setLastValidLastValidLastValidLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastValidLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastConfirmedPeak, setLastValidLastValidLastValidLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastHeartBeatResult, setLastValidLastValidLastValidLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastValidLastVitalSignsResult, setLastValidLastValidLastValidLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastValidLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastValidLastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastValidLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastValidLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastValidLastValidLastValidLastHrvData, setLastValidLastValidLastValidLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidLastValidLastPpgData, setLastValidLastValidLastValidLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastStressLevel, setLastValidLastValidLastValidLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastSignalQuality, setLastValidLastValidLastValidLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastFingerDetected, setLastValidLastValidLastValidLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastWeakSignal, setLastValidLastValidLastValidLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastValidLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastValidHrvData, setLastValidLastValidLastValidLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidLastValidLastValidPpgData, setLastValidLastValidLastValidLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLastValidLastValidLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidConsecutiveWeakSignals, setLastValidLastValidLastValidLastValidLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastPeakTime, setLastValidLastValidLastValidLastValidLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastSignalValue, setLastValidLastValidLastValidLastValidLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastDerivativeValue, setLastValidLastValidLastValidLastValidLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastBaselineValue, setLastValidLastValidLastValidLastValidLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastConfidenceValue, setLastValidLastValidLastValidLastValidLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastValidLastValidLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastConfirmedPeak, setLastValidLastValidLastValidLastValidLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastHeartBeatResult, setLastValidLastValidLastValidLastValidLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastVitalSignsResult, setLastValidLastValidLastValidLastValidLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastHrvData, setLastValidLastValidLastValidLastValidLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastPpgData, setLastValidLastValidLastValidLastValidLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastStressLevel, setLastValidLastValidLastValidLastValidLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastSignalQuality, setLastValidLastValidLastValidLastValidLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastFingerDetected, setLastValidLastValidLastValidLastValidLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastWeakSignal, setLastValidLastValidLastValidLastValidLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastValidLastValidLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidHrvData, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidPpgData, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidLastValidLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidLastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLast
