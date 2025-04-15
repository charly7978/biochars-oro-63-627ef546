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
  const [lastValidArrhythmiaStatusValue, setLastValidArrhythmiaStatusValue] = useState("--");
  const [lastValidHrvDataValue, setLastValidHrvDataValue] = useState({});
  const [lastValidPpgDataValue, setLastValidPpgDataValue] = [];
  const [lastValidStressLevelValue, setLastValidStressLevelValue] = 0;
  const [lastValidSignalQualityValue, setLastValidSignalQualityValue] = 0;
  const [lastValidFingerDetectedValue, setLastValidFingerDetectedValue] = false;
  const [lastValidWeakSignalValue, setLastValidWeakSignalValue] = false;
  const [lastValidArrhythmiaDetectedValue, setLastValidArrhythmiaDetectedValue] = false;
  const [lastValidArrhythmiaCountValue, setLastValidArrhythmiaCountValue] = 0;
  const [lastValidConsecutiveWeakSignals, setLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidConsecutiveWeakSignalsValue, setLastValidConsecutiveWeakSignalsValue] = useState(0);
  const [lastValidLastPeakTime, setLastValidLastPeakTime] = useState(0);
  const [lastValidLastPeakTimeValue, setLastValidLastPeakTimeValue] = useState(0);
  const [lastValidLastSignalValue, setLastValidLastSignalValue] = useState(0);
  const [lastValidLastSignalValueValue, setLastValidLastSignalValueValue] = useState(0);
  const [lastValidLastDerivativeValue, setLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastDerivativeValueValue, setLastValidLastDerivativeValueValue] = useState(0);
  const [lastValidLastBaselineValue, setLastValidLastBaselineValue] = useState(0);
  const [lastValidLastBaselineValueValue, setLastValidLastBaselineValueValue] = useState(0);
  const [lastValidLastConfidenceValue, setLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastConfidenceValueValue, setLastValidLastConfidenceValueValue] = useState(0);
  const [lastValidLastPeakConfirmationBuffer, setLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastPeakConfirmationBufferValue, setLastValidLastPeakConfirmationBufferValue] = useState([]);
  const [lastValidLastConfirmedPeak, setLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastConfirmedPeakValue, setLastValidLastConfirmedPeakValue] = useState(false);
  const [lastValidLastHeartBeatResult, setLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastHeartBeatResultValue, setLastValidLastHeartBeatResultValue] = useState(null);
  const [lastValidLastVitalSignsResult, setLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastVitalSignsResultValue, setLastValidLastVitalSignsResultValue] = useState(null);
  const [lastValidLastArrhythmiaWindow, setLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastArrhythmiaWindowValue, setLastValidLastArrhythmiaWindowValue] = useState(null);
  const [lastValidLastArrhythmiaCount, setLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastArrhythmiaCountValue, setLastValidLastArrhythmiaCountValue] = useState(0);
  const [lastValidLastArrhythmiaStatus, setLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastArrhythmiaStatusValue, setLastValidLastArrhythmiaStatusValue] = useState("--");
  const [lastValidLastHrvData, setLastValidLastHrvData] = useState({});
  const [lastValidLastHrvDataValue, setLastValidLastHrvDataValue] = useState({});
  const [lastValidLastPpgData, setLastValidLastPpgData] = useState([]);
  const [lastValidLastPpgDataValue, setLastValidLastPpgDataValue] = useState([]);
  const [lastValidLastStressLevel, setLastValidLastStressLevel] = useState(0);
  const [lastValidLastStressLevelValue, setLastValidLastStressLevelValue] = useState(0);
  const [lastValidLastSignalQuality, setLastValidLastSignalQuality] = useState(0);
  const [lastValidLastSignalQualityValue, setLastValidLastSignalQualityValue] = useState(0);
  const [lastValidLastFingerDetected, setLastValidLastFingerDetected] = useState(false);
  const [lastValidLastFingerDetectedValue, setLastValidLastFingerDetectedValue] = useState(false);
  const [lastValidLastWeakSignal, setLastValidLastWeakSignal] = useState(false);
  const [lastValidLastWeakSignalValue, setLastValidLastWeakSignalValue] = useState(false);
  const [lastValidLastArrhythmiaDetected, setLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastArrhythmiaDetectedValue, setLastValidLastArrhythmiaDetectedValue] = useState(false);
  const [lastValidLastValidRRIntervals, setLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidRRIntervalsValue, setLastValidLastValidRRIntervalsValue] = useState([]);
  const [lastValidLastValidHrvData, setLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidHrvDataValue, setLastValidLastValidHrvDataValue] = useState({});
  const [lastValidLastValidPpgData, setLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidPpgDataValue, setLastValidLastValidPpgDataValue] = useState([]);
  const [lastValidLastValidStressLevel, setLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidStressLevelValue, setLastValidLastValidStressLevelValue] = useState(0);
  const [lastValidLastValidSignalQuality, setLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidSignalQualityValue, setLastValidLastValidSignalQualityValue] = useState(0);
  const [lastValidLastValidFingerDetected, setLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidFingerDetectedValue, setLastValidLastValidFingerDetectedValue] = useState(false);
  const [lastValidLastValidWeakSignal, setLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidWeakSignalValue, setLastValidLastValidWeakSignalValue] = useState(false);
  const [lastValidLastValidArrhythmiaDetected, setLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidArrhythmiaDetectedValue, setLastValidLastValidArrhythmiaDetectedValue] = useState(false);
  const [lastValidLastValidConsecutiveWeakSignals, setLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidConsecutiveWeakSignalsValue, setLastValidLastValidConsecutiveWeakSignalsValue] = useState(0);
  const [lastValidLastValidLastPeakTime, setLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastPeakTimeValue, setLastValidLastValidLastPeakTimeValue] = useState(0);
  const [lastValidLastValidLastSignalValue, setLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastSignalValueValue, setLastValidLastValidLastSignalValueValue] = useState(0);
  const [lastValidLastValidLastDerivativeValue, setLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastDerivativeValueValue, setLastValidLastValidLastDerivativeValueValue] = useState(0);
  const [lastValidLastValidLastBaselineValue, setLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastBaselineValueValue, setLastValidLastValidLastBaselineValueValue] = useState(0);
  const [lastValidLastValidLastConfidenceValue, setLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastConfidenceValueValue, setLastValidLastValidLastConfidenceValueValue] = useState(0);
  const [lastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastPeakConfirmationBufferValue, setLastValidLastValidLastPeakConfirmationBufferValue] = useState([]);
  const [lastValidLastValidLastConfirmedPeak, setLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastConfirmedPeakValue, setLastValidLastValidLastConfirmedPeakValue] = useState(false);
  const [lastValidLastValidLastHeartBeatResult, setLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastHeartBeatResultValue, setLastValidLastValidLastHeartBeatResultValue] = useState(null);
  const [lastValidLastValidLastVitalSignsResult, setLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastVitalSignsResultValue, setLastValidLastValidLastVitalSignsResultValue] = useState(null);
  const [lastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastArrhythmiaWindowValue, setLastValidLastValidLastArrhythmiaWindowValue] = useState(null);
  const [lastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastArrhythmiaCountValue, setLastValidLastValidLastArrhythmiaCountValue] = useState(0);
  const [lastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastArrhythmiaStatusValue, setLastValidLastValidLastArrhythmiaStatusValue] = useState("--");
  const [lastValidLastValidLastHrvData, setLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastHrvDataValue, setLastValidLastValidLastHrvDataValue] = useState({});
  const [lastValidLastValidLastPpgData, setLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastPpgDataValue, setLastValidLastValidLastPpgDataValue] = useState([]);
  const [lastValidLastValidLastStressLevel, setLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastStressLevelValue, setLastValidLastValidLastStressLevelValue] = useState(0);
  const [lastValidLastValidLastSignalQuality, setLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastSignalQualityValue, setLastValidLastValidLastSignalQualityValue] = useState(0);
  const [lastValidLastValidLastFingerDetected, setLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastFingerDetectedValue, setLastValidLastValidLastFingerDetectedValue] = useState(false);
  const [lastValidLastValidLastWeakSignal, setLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastWeakSignalValue, setLastValidLastValidLastWeakSignalValue] = useState(false);
  const [lastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastArrhythmiaDetectedValue, setLastValidLastValidLastArrhythmiaDetectedValue] = useState(false);
  const [lastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidRRIntervalsValue, setLastValidLastValidLastValidRRIntervalsValue] = useState([]);
  const [lastValidLastValidLastValidHrvData, setLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidHrvDataValue, setLastValidLastValidLastValidHrvDataValue] = useState({});
  const [lastValidLastValidLastValidPpgData, setLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidPpgDataValue, setLastValidLastValidLastValidPpgDataValue] = useState([]);
  const [lastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidStressLevelValue, setLastValidLastValidLastValidStressLevelValue] = useState(0);
  const [lastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidSignalQualityValue, setLastValidLastValidLastValidSignalQualityValue] = useState(0);
  const [lastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidFingerDetectedValue, setLastValidLastValidLastValidFingerDetectedValue] = useState(false);
  const [lastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidWeakSignalValue, setLastValidLastValidLastValidWeakSignalValue] = useState(false);
  const [lastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidArrhythmiaDetectedValue, setLastValidLastValidLastValidArrhythmiaDetectedValue] = useState(false);
  const [lastValidLastValidLastValidConsecutiveWeakSignals, setLastValidLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastValidConsecutiveWeakSignalsValue, setLastValidLastValidLastValidConsecutiveWeakSignalsValue] = useState(0);
  const [lastValidLastValidLastValidLastPeakTime, setLastValidLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastValidLastPeakTimeValue, setLastValidLastValidLastValidLastPeakTimeValue] = useState(0);
  const [lastValidLastValidLastValidLastSignalValue, setLastValidLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastValidLastSignalValueValue, setLastValidLastValidLastValidLastSignalValueValue] = useState(0);
  const [lastValidLastValidLastValidLastDerivativeValue, setLastValidLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastValidLastDerivativeValueValue, setLastValidLastValidLastValidLastDerivativeValueValue] = useState(0);
  const [lastValidLastValidLastValidLastBaselineValue, setLastValidLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastValidLastBaselineValueValue, setLastValidLastValidLastValidLastBaselineValueValue] = useState(0);
  const [lastValidLastValidLastValidLastConfidenceValue, setLastValidLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastValidLastConfidenceValueValue, setLastValidLastValidLastValidLastConfidenceValueValue] = useState(0);
  const [lastValidLastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastValidLastPeakConfirmationBufferValue, setLastValidLastValidLastValidLastPeakConfirmationBufferValue] = useState([]);
  const [lastValidLastValidLastValidLastConfirmedPeak, setLastValidLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastValidLastConfirmedPeakValue, setLastValidLastValidLastValidLastConfirmedPeakValue] = useState(false);
  const [lastValidLastValidLastValidLastHeartBeatResult, setLastValidLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastValidLastHeartBeatResultValue, setLastValidLastValidLastValidLastHeartBeatResultValue] = useState(null);
  const [lastValidLastValidLastValidLastVitalSignsResult, setLastValidLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastValidLastVitalSignsResultValue, setLastValidLastValidLastValidLastVitalSignsResultValue] = useState(null);
  const [lastValidLastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastValidLastArrhythmiaWindowValue, setLastValidLastValidLastValidLastArrhythmiaWindowValue] = useState(null);
  const [lastValidLastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastValidLastArrhythmiaCount] = useState(0);
  const [lastValidLastValidLastValidLastArrhythmiaCountValue, setLastValidLastValidLastValidLastArrhythmiaCountValue] = useState(0);
  const [lastValidLastValidLastValidLastArrhythmiaStatus, setLastValidLastValidLastValidLastArrhythmiaStatus] = useState("--");
  const [lastValidLastValidLastValidLastArrhythmiaStatusValue, setLastValidLastValidLastValidLastArrhythmiaStatusValue] = useState("--");
  const [lastValidLastValidLastValidLastHrvData, setLastValidLastValidLastValidLastHrvData] = useState({});
  const [lastValidLastValidLastValidLastHrvDataValue, setLastValidLastValidLastValidLastHrvDataValue] = useState({});
  const [lastValidLastValidLastValidLastPpgData, setLastValidLastValidLastValidLastPpgData] = useState([]);
  const [lastValidLastValidLastValidLastPpgDataValue, setLastValidLastValidLastValidLastPpgDataValue] = useState([]);
  const [lastValidLastValidLastValidLastStressLevel, setLastValidLastValidLastValidLastStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastStressLevelValue, setLastValidLastValidLastValidLastStressLevelValue] = useState(0);
  const [lastValidLastValidLastValidLastSignalQuality, setLastValidLastValidLastValidLastSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastSignalQualityValue, setLastValidLastValidLastValidLastSignalQualityValue] = useState(0);
  const [lastValidLastValidLastValidLastFingerDetected, setLastValidLastValidLastValidLastFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastFingerDetectedValue, setLastValidLastValidLastValidLastFingerDetectedValue] = useState(false);
  const [lastValidLastValidLastValidLastWeakSignal, setLastValidLastValidLastValidLastWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastWeakSignalValue, setLastValidLastValidLastValidLastWeakSignalValue] = useState(false);
  const [lastValidLastValidLastValidLastArrhythmiaDetected, setLastValidLastValidLastValidLastArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastArrhythmiaDetectedValue, setLastValidLastValidLastValidLastArrhythmiaDetectedValue] = useState(false);
  const [lastValidLastValidLastValidLastValidRRIntervals, setLastValidLastValidLastValidLastValidRRIntervals] = useState([]);
  const [lastValidLastValidLastValidLastValidRRIntervalsValue, setLastValidLastValidLastValidLastValidRRIntervalsValue] = useState([]);
  const [lastValidLastValidLastValidLastValidHrvData, setLastValidLastValidLastValidLastValidHrvData] = useState({});
  const [lastValidLastValidLastValidLastValidHrvDataValue, setLastValidLastValidLastValidLastValidHrvDataValue] = useState({});
  const [lastValidLastValidLastValidLastValidPpgData, setLastValidLastValidLastValidLastValidPpgData] = useState([]);
  const [lastValidLastValidLastValidLastValidPpgDataValue, setLastValidLastValidLastValidLastValidPpgDataValue] = useState([]);
  const [lastValidLastValidLastValidLastValidStressLevel, setLastValidLastValidLastValidLastValidStressLevel] = useState(0);
  const [lastValidLastValidLastValidLastValidStressLevelValue, setLastValidLastValidLastValidLastValidStressLevelValue] = useState(0);
  const [lastValidLastValidLastValidLastValidSignalQuality, setLastValidLastValidLastValidLastValidSignalQuality] = useState(0);
  const [lastValidLastValidLastValidLastValidSignalQualityValue, setLastValidLastValidLastValidLastValidSignalQualityValue] = useState(0);
  const [lastValidLastValidLastValidLastValidFingerDetected, setLastValidLastValidLastValidLastValidFingerDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidFingerDetectedValue, setLastValidLastValidLastValidLastValidFingerDetectedValue] = useState(false);
  const [lastValidLastValidLastValidLastValidWeakSignal, setLastValidLastValidLastValidLastValidWeakSignal] = useState(false);
  const [lastValidLastValidLastValidLastValidWeakSignalValue, setLastValidLastValidLastValidLastValidWeakSignalValue] = useState(false);
  const [lastValidLastValidLastValidLastValidArrhythmiaDetected, setLastValidLastValidLastValidLastValidArrhythmiaDetected] = useState(false);
  const [lastValidLastValidLastValidLastValidArrhythmiaDetectedValue, setLastValidLastValidLastValidLastValidArrhythmiaDetectedValue] = useState(false);
  const [lastValidLastValidLastValidLastValidConsecutiveWeakSignals, setLastValidLastValidLastValidLastValidConsecutiveWeakSignals] = useState(0);
  const [lastValidLastValidLastValidLastValidConsecutiveWeakSignalsValue, setLastValidLastValidLastValidLastValidConsecutiveWeakSignalsValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastPeakTime, setLastValidLastValidLastValidLastValidLastPeakTime] = useState(0);
  const [lastValidLastValidLastValidLastValidLastPeakTimeValue, setLastValidLastValidLastValidLastValidLastPeakTimeValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastSignalValue, setLastValidLastValidLastValidLastValidLastSignalValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastSignalValueValue, setLastValidLastValidLastValidLastValidLastSignalValueValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastDerivativeValue, setLastValidLastValidLastValidLastValidLastDerivativeValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastDerivativeValueValue, setLastValidLastValidLastValidLastValidLastDerivativeValueValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastBaselineValue, setLastValidLastValidLastValidLastValidLastBaselineValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastBaselineValueValue, setLastValidLastValidLastValidLastValidLastBaselineValueValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastConfidenceValue, setLastValidLastValidLastValidLastValidLastConfidenceValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastConfidenceValueValue, setLastValidLastValidLastValidLastValidLastConfidenceValueValue] = useState(0);
  const [lastValidLastValidLastValidLastValidLastPeakConfirmationBuffer, setLastValidLastValidLastValidLastValidLastPeakConfirmationBuffer] = useState([]);
  const [lastValidLastValidLastValidLastValidLastPeakConfirmationBufferValue, setLastValidLastValidLastValidLastValidLastPeakConfirmationBufferValue] = useState([]);
  const [lastValidLastValidLastValidLastValidLastConfirmedPeak, setLastValidLastValidLastValidLastValidLastConfirmedPeak] = useState(false);
  const [lastValidLastValidLastValidLastValidLastConfirmedPeakValue, setLastValidLastValidLastValidLastValidLastConfirmedPeakValue] = useState(false);
  const [lastValidLastValidLastValidLastValidLastHeartBeatResult, setLastValidLastValidLastValidLastValidLastHeartBeatResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastHeartBeatResultValue, setLastValidLastValidLastValidLastValidLastHeartBeatResultValue] = useState(null);
  const [lastValidLastValidLastValidLastValidLastVitalSignsResult, setLastValidLastValidLastValidLastValidLastVitalSignsResult] = useState(null);
  const [lastValidLastValidLastValidLastValidLastVitalSignsResultValue, setLastValidLastValidLastValidLastValidLastVitalSignsResultValue] = useState(null);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaWindow, setLastValidLastValidLastValidLastValidLastArrhythmiaWindow] = useState(null);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaWindowValue, setLastValidLastValidLastValidLastValidLastArrhythmiaWindowValue] = useState(null);
  const [lastValidLastValidLastValidLastValidLastArrhythmiaCount, setLastValidLastValidLastValidLast
