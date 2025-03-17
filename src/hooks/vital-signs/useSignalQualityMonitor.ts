
import { useRef } from 'react';
import { ProcessorConfig } from '../../modules/vital-signs/ProcessorConfig';
import { SignalAnalyzer } from '../../modules/signal-analysis/SignalAnalyzer';

export function useSignalQualityMonitor() {
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = ProcessorConfig.WEAK_SIGNAL_THRESHOLD * 0.5; // 50% more permissive (0.001)
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 8; // Increased from 5 to 8 for greater permissiveness
  
  // History to prevent rapid fluctuations
  const signalStrengthHistoryRef = useRef<number[]>([]);
  const MAX_HISTORY_SIZE = 5;
  
  // Signal presence counter for minimal detection
  const signalPresenceCounterRef = useRef<number>(0);
  const MIN_PRESENCE_COUNT = 2; // Reduced from 3 to 2 for faster detection
  
  // NEW: Threshold adaptation for environment
  const adaptiveThresholdRef = useRef<number>(WEAK_SIGNAL_THRESHOLD);
  const adaptationCounterRef = useRef<number>(0);
  
  // NEW: Signal trend detection
  const signalTrendRef = useRef<number[]>([]);
  const MAX_TREND_SIZE = 15;
  
  const checkSignalQuality = (value: number) => {
    // Track any signal presence - even more sensitive now
    if (Math.abs(value) > 0.0005) { // Reduced from 0.001 to be more sensitive
      signalPresenceCounterRef.current = Math.min(10, signalPresenceCounterRef.current + 1);
    } else {
      signalPresenceCounterRef.current = Math.max(0, signalPresenceCounterRef.current - 0.5); // Slower decay
    }
    
    // NEW: Add to trend history
    signalTrendRef.current.push(Math.abs(value));
    if (signalTrendRef.current.length > MAX_TREND_SIZE) {
      signalTrendRef.current.shift();
    }
    
    // NEW: Adaptive threshold adjustment
    adaptationCounterRef.current++;
    if (adaptationCounterRef.current > 30) { // Adjust every 30 samples
      adaptationCounterRef.current = 0;
      
      if (signalTrendRef.current.length > 10) {
        // Calculate average signal strength
        const avgSignal = signalTrendRef.current.reduce((sum, val) => sum + val, 0) / signalTrendRef.current.length;
        
        // Set a floor for the threshold
        const minThreshold = 0.0008;
        
        // Adapt threshold - make it 40% of average signal, but not less than minimum
        adaptiveThresholdRef.current = Math.max(minThreshold, avgSignal * 0.4);
      }
    }
    
    // Check for weak signal using adaptive threshold
    const currentThreshold = adaptiveThresholdRef.current;
    if (Math.abs(value) < currentThreshold) {
      consecutiveWeakSignalsRef.current++;
      
      // Add to history
      signalStrengthHistoryRef.current.push(0); // 0 = weak
      if (signalStrengthHistoryRef.current.length > MAX_HISTORY_SIZE) {
        signalStrengthHistoryRef.current.shift();
      }
      
      // If too many weak signals, but consider signal presence
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
        // NEW: Check for trend - is signal increasing?
        const isSignalIncreasing = checkSignalTrend();
        
        // Even more permissive finger detection
        if (signalPresenceCounterRef.current >= MIN_PRESENCE_COUNT || isSignalIncreasing) {
          return {
            isWeakSignal: false,
            isMinimalSignal: true,
            weakSignalCount: consecutiveWeakSignalsRef.current,
            signalStrength: 20, // Slightly increased minimal strength
            signalTrend: isSignalIncreasing ? "increasing" : "stable"
          };
        }
        
        console.log("SignalQualityMonitor: Too many weak signals, returning zeros", {
          weakSignals: consecutiveWeakSignalsRef.current,
          threshold: MAX_CONSECUTIVE_WEAK_SIGNALS,
          value,
          adaptiveThreshold: currentThreshold,
          historyStrength: calculateHistoryStrength(),
          signalPresence: signalPresenceCounterRef.current
        });
        
        return {
          isWeakSignal: true,
          result: SignalAnalyzer.createEmptyResult()
        };
      }
    } else {
      // Reset weak signal counter - faster recovery now
      consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 2);
      
      // Add to history
      signalStrengthHistoryRef.current.push(1); // 1 = strong
      if (signalStrengthHistoryRef.current.length > MAX_HISTORY_SIZE) {
        signalStrengthHistoryRef.current.shift();
      }
    }
    
    // NEW: Calculate strength factor based on signal trend
    let strengthFactor = 1.0;
    if (checkSignalTrend()) {
      strengthFactor = 1.2; // Boost if signal is improving
    }
    
    return {
      isWeakSignal: false,
      isMinimalSignal: signalPresenceCounterRef.current >= MIN_PRESENCE_COUNT,
      weakSignalCount: consecutiveWeakSignalsRef.current,
      historyStrength: calculateHistoryStrength(),
      signalPresence: signalPresenceCounterRef.current,
      signalStrength: Math.min(100, Math.max(20, Math.abs(value) * 1000 * strengthFactor)),
      adaptiveThreshold: currentThreshold
    };
  };
  
  // NEW: Check if signal is trending upward (improving)
  const checkSignalTrend = () => {
    if (signalTrendRef.current.length < 5) return false;
    
    const recent = signalTrendRef.current.slice(-5);
    const older = signalTrendRef.current.slice(-10, -5);
    
    if (older.length === 0) return false;
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    // Signal is increasing if recent average is 15% higher than older
    return recentAvg > olderAvg * 1.15;
  };
  
  // Calculate weighted history strength (recent values count more)
  const calculateHistoryStrength = () => {
    if (signalStrengthHistoryRef.current.length === 0) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    signalStrengthHistoryRef.current.forEach((value, index) => {
      const weight = index + 1; // More recent = higher weight
      weightedSum += value * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };
  
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
    signalStrengthHistoryRef.current = [];
    signalPresenceCounterRef.current = 0;
    adaptiveThresholdRef.current = WEAK_SIGNAL_THRESHOLD;
    adaptationCounterRef.current = 0;
    signalTrendRef.current = [];
  };
  
  return {
    checkSignalQuality,
    reset,
    weakSignalCount: () => consecutiveWeakSignalsRef.current,
    signalPresence: () => signalPresenceCounterRef.current,
    historyStrength: calculateHistoryStrength,
    adaptiveThreshold: () => adaptiveThresholdRef.current
  };
}
