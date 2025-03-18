
import { useRef, useState, useEffect } from 'react';
import { HeartBeatProcessor } from '../../../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { ProcessorRefs, ProcessorState } from './types';

export function useProcessorInitialization(): [
  React.MutableRefObject<HeartBeatProcessor | null>,
  ProcessorRefs,
  ProcessorState
] {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        initializedRef.current = true;
        
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.initAudio();
        // Ensure monitoring is off by default
        processorRef.current.setMonitoring(false);
        isMonitoringRef.current = false;
      }
    } catch (error) {
      console.error('Error initializing HeartBeatProcessor:', error);
      toast.error('Error initializing heartbeat processor');
    }

    return () => {
      console.log('useHeartBeatProcessor: Cleaning up processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        // Ensure monitoring is turned off when unmounting
        processorRef.current.setMonitoring(false);
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  return [
    processorRef, 
    { isMonitoringRef, initializedRef, missedBeepsCounter, sessionId },
    { currentBPM, setCurrentBPM, confidence, setConfidence }
  ];
}
