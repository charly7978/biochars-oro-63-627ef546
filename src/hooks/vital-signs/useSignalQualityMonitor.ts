
import { useRef } from 'react';
import { ProcessorConfig } from '../../modules/vital-signs/ProcessorConfig';
import { SignalAnalyzer } from '../../modules/signal-analysis/SignalAnalyzer';

export function useSignalQualityMonitor() {
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = ProcessorConfig.WEAK_SIGNAL_THRESHOLD * 0.7; // 30% more permissive
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5; // Increased from 3 to 5
  
  // NEW: Add history to prevent rapid fluctuations
  const signalStrengthHistoryRef = useRef<number[]>([]);
  const MAX_HISTORY_SIZE = 5;
  
  // NEW: Signal presence counter for minimal detection
  const signalPresenceCounterRef = useRef<number>(0);
  const MIN_PRESENCE_COUNT = 3;
  
  const checkSignalQuality = (value: number) => {
    // NEW: Track any signal presence
    if (Math.abs(value) > 0.001) {
      signalPresenceCounterRef.current = Math.min(10, signalPresenceCounterRef.current + 1);
    } else {
      signalPresenceCounterRef.current = Math.max(0, signalPresenceCounterRef.current - 1);
    }
    
    // Check for weak signal to detect finger removal
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
      
      // Add to history
      signalStrengthHistoryRef.current.push(0); // 0 = weak
      if (signalStrengthHistoryRef.current.length > MAX_HISTORY_SIZE) {
        signalStrengthHistoryRef.current.shift();
      }
      
      // If too many weak signals, return zeros
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
        console.log("SignalQualityMonitor: Too many weak signals, returning zeros", {
          weakSignals: consecutiveWeakSignalsRef.current,
          threshold: MAX_CONSECUTIVE_WEAK_SIGNALS,
          value,
          historyStrength: calculateHistoryStrength()
        });
        
        // NEW: BUT if we have detected signal presence consistently, don't return zeros yet
        if (signalPresenceCounterRef.current >= MIN_PRESENCE_COUNT) {
          return {
            isWeakSignal: false,
            isMinimalSignal: true,
            weakSignalCount: consecutiveWeakSignalsRef.current,
            signalStrength: 15 // Minimal strength
          };
        }
        
        return {
          isWeakSignal: true,
          result: SignalAnalyzer.createEmptyResult()
        };
      }
    } else {
      // Reset weak signal counter
      consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 1);
      
      // Add to history
      signalStrengthHistoryRef.current.push(1); // 1 = strong
      if (signalStrengthHistoryRef.current.length > MAX_HISTORY_SIZE) {
        signalStrengthHistoryRef.current.shift();
      }
    }
    
    return {
      isWeakSignal: false,
      isMinimalSignal: signalPresenceCounterRef.current >= MIN_PRESENCE_COUNT,
      weakSignalCount: consecutiveWeakSignalsRef.current,
      historyStrength: calculateHistoryStrength(),
      signalPresence: signalPresenceCounterRef.current
    };
  };
  
  // NEW: Calculate weighted history strength (recent values count more)
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
  };
  
  return {
    checkSignalQuality,
    reset,
    weakSignalCount: () => consecutiveWeakSignalsRef.current,
    signalPresence: () => signalPresenceCounterRef.current,
    historyStrength: calculateHistoryStrength
  };
}
