import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  preserveResults?: boolean;
  isArrhythmia?: boolean;
}

interface PPGDataPointExtended extends PPGDataPoint {
  isArrhythmia?: boolean;
}

const PPGSignalMeter = memo(({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false,
  isArrhythmia = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer<PPGDataPointExtended> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean, beepPlayed?: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arrhythmiaSegmentsRef = useRef<Array<{startTime: number, endTime: number | null}>>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const pendingBeepPeakIdRef = useRef<number | null>(null);

  // Buffer to store complete arrhythmia waveforms
  const completeArrhythmiaWaveformsRef = useRef<Array<{
    startTime: number;
    endTime: number | null;
    points: PPGDataPointExtended[];
  }>>([]);
  
  const WINDOW_WIDTH_MS = 3500;
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 600;
  const GRID_SIZE_X = 25;
  const GRID_SIZE_Y = 5;
  const verticalScale = 35.0;
  const SMOOTHING_FACTOR = 1.5;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 250;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;
  const QUALITY_HISTORY_SIZE = 9;
  const REQUIRED_FINGER_FRAMES = 3;
  const USE_OFFSCREEN_CANVAS = true;
  // Store more data points for arrhythmia visualization
  const ARRHYTHMIA_MEMORY_BUFFER_SIZE = 1200;
  const MAX_ARRHYTHMIA_SEGMENTS = 5;

  const BEEP_PRIMARY_FREQUENCY = 880;
  const BEEP_SECONDARY_FREQUENCY = 440;
  const BEEP_DURATION = 80;
  const BEEP_VOLUME = 0.9;
  const MIN_BEEP_INTERVAL_MS = 350;

  useEffect(() => {
    const initAudio = async () => {
      try {
        if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
          console.log("PPGSignalMeter: Inicializando Audio Context");
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
          
          if (audioContextRef.current.state !== 'running') {
            await audioContextRef.current.resume();
          }
          
          await playBeep(0.01);
        }
      } catch (err) {
        console.error("PPGSignalMeter: Error inicializando audio context:", err);
      }
    };
    
    initAudio();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error("PPGSignalMeter: Error cerrando audio context:", err);
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  const playBeep = useCallback(async (volume = BEEP_VOLUME) => {
    try {
      const now = Date.now();
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
        console.log("PPGSignalMeter: Beep bloqueado por intervalo mínimo", {
          timeSinceLastBeep: now - lastBeepTimeRef.current,
          minInterval: MIN_BEEP_INTERVAL_MS
        });
        return false;
      }
      
      if (!audioContextRef.current || audioContextRef.current.state !== 'running') {
        if (audioContextRef.current) {
          await audioContextRef.current.resume();
        } else {
          audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
        }
        
        if (audioContextRef.current.state !== 'running') {
          console.warn("PPGSignalMeter: No se pudo activar el contexto de audio");
          return false;
        }
      }
      
      console.log("PPGSignalMeter: Reproduciendo beep para círculo dibujado, volumen:", volume);
      
      const primaryOscillator = audioContextRef.current.createOscillator();
      const primaryGain = audioContextRef.current.createGain();
      
      const secondaryOscillator = audioContextRef.current.createOscillator();
      const secondaryGain = audioContextRef.current.createGain();
      
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        BEEP_PRIMARY_FREQUENCY,
        audioContextRef.current.currentTime
      );
      
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        BEEP_SECONDARY_FREQUENCY,
        audioContextRef.current.currentTime
      );
      
      const adjustedVolume = Math.min(volume * 2.0, 1.0);
      
      primaryGain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        adjustedVolume,
        audioContextRef.current.currentTime + 0.0005
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioContextRef.current.currentTime + BEEP_DURATION / 1000
      );
      
      secondaryGain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        adjustedVolume * 0.8,
        audioContextRef.current.currentTime + 0.0005
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioContextRef.current.currentTime + BEEP_DURATION / 1000
      );
      
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(audioContextRef.current.destination);
      secondaryGain.connect(audioContextRef.current.destination);
      
      primaryOscillator.start(audioContextRef.current.currentTime);
      secondaryOscillator.start(audioContextRef.current.currentTime);
      primaryOscillator.stop(audioContextRef.current.currentTime + BEEP_DURATION / 1000 + 0.02);
      secondaryOscillator.stop(audioContextRef.current.currentTime + BEEP_DURATION / 1000 + 0.02);
      
      lastBeepTimeRef.current = now;
      pendingBeepPeakIdRef.current = null;
      
      return true;
    } catch (err) {
      console.error("PPGSignalMeter: Error reproduciendo beep:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults, isFingerDetected]);

  useEffect(() => {
    qualityHistoryRef.current.push(quality);
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    if (isFingerDetected) {
      consecutiveFingerFramesRef.current++;
    } else {
      consecutiveFingerFramesRef.current = 0;
    }
  }, [quality, isFingerDetected]);

  // Track arrhythmia events for visualization
  useEffect(() => {
    if (isArrhythmia && dataBufferRef.current) {
      const now = Date.now();
      
      // If this is a new arrhythmia event
      if (now - lastArrhythmiaTime.current > 1000) {
        console.log("New arrhythmia event detected, starting segment tracking");
        
        // Start a new arrhythmia segment
        const newSegment = {
          startTime: now,
          endTime: null,
          points: [] as PPGDataPointExtended[]
        };
        
        // Capture already existing points from before the arrhythmia started (pre-arrhythmia context)
        const existingPoints = dataBufferRef.current.getPoints();
        const preArrhythmiaPoints = existingPoints.slice(-30); // Get last 30 points for context
        
        // Add pre-arrhythmia points to the segment
        newSegment.points.push(...preArrhythmiaPoints.map(p => ({...p})));
        
        // Add to waveform collection
        completeArrhythmiaWaveformsRef.current.push(newSegment);
        
        // Add visual marker
        arrhythmiaSegmentsRef.current.push({
          startTime: now,
          endTime: null
        });
        
        // Limit saved arrhythmia segments
        if (completeArrhythmiaWaveformsRef.current.length > MAX_ARRHYTHMIA_SEGMENTS) {
          completeArrhythmiaWaveformsRef.current.shift();
        }
        if (arrhythmiaSegmentsRef.current.length > MAX_ARRHYTHMIA_SEGMENTS) {
          arrhythmiaSegmentsRef.current.shift();
        }
      }
      
      // Update the last arrhythmia timestamp
      lastArrhythmiaTime.current = now;
      
      // Update active arrhythmia segment with new data points
      const activeSegment = completeArrhythmiaWaveformsRef.current[completeArrhythmiaWaveformsRef.current.length - 1];
      if (activeSegment && !activeSegment.endTime) {
        // Add current point to the segment
        if (dataBufferRef.current) {
          const latestPoints = dataBufferRef.current.getPoints().slice(-1);
          if (latestPoints.length > 0) {
            // Mark this point as part of an arrhythmia
            const pointWithArrhythmia = {...latestPoints[0], isArrhythmia: true};
            activeSegment.points.push(pointWithArrhythmia);
          }
        }
      }
    } else if (lastArrhythmiaTime.current > 0 && Date.now() - lastArrhythmiaTime.current > 1000) {
      // If arrhythmia has ended, close the active segment
      const activeSegment = completeArrhythmiaWaveformsRef.current[completeArrhythmiaWaveformsRef.current.length - 1];
      if (activeSegment && !activeSegment.endTime) {
        activeSegment.endTime = Date.now();
        console.log("Arrhythmia event ended, capturing complete waveform", {
          startTime: new Date(activeSegment.startTime).toISOString(),
          endTime: new Date(activeSegment.endTime).toISOString(),
          pointsCount: activeSegment.points.length
        });
        
        // Add post-arrhythmia context (continue capturing for a short time after arrhythmia ends)
        const capturePostArrhythmiaContext = () => {
          if (dataBufferRef.current && activeSegment) {
            const latestPoints = dataBufferRef.current.getPoints().slice(-1);
            if (latestPoints.length > 0) {
              activeSegment.points.push({...latestPoints[0]});
            }
            
            // Continue capturing for half a second after arrhythmia ends
            if (activeSegment.points.length < 50 || 
                Date.now() - (activeSegment.endTime || 0) < 500) {
              requestAnimationFrame(capturePostArrhythmiaContext);
            } else {
              console.log("Post-arrhythmia context capture complete", {
                totalPoints: activeSegment.points.length
              });
              
              // Close the visual segment marker
              const activeVisualSegment = arrhythmiaSegmentsRef.current[arrhythmiaSegmentsRef.current.length - 1];
              if (activeVisualSegment && !activeVisualSegment.endTime) {
                activeVisualSegment.endTime = Date.now();
              }
            }
          }
        };
        
        capturePostArrhythmiaContext();
      }
    }
  }, [isArrhythmia]);

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    offscreenCanvasRef.current = offscreen;
    
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = CANVAS_WIDTH;
    gridCanvas.height = CANVAS_HEIGHT;
    const gridCtx = gridCanvas.getContext('2d', { alpha: false });
    
    if(gridCtx) {
      drawGrid(gridCtx);
      gridCanvasRef.current = gridCanvas;
    }
  }, []);

  const getAverageQuality = useCallback(() => {
    if (qualityHistoryRef.current.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    qualityHistoryRef.current.forEach((q, index) => {
      const weight = index + 1;
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }, []);

  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality]);

  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    
    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality]);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    // Create a more sophisticated gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E5DEFF'); // Soft purple (top)
    gradient.addColorStop(0.3, '#FDE1D3'); // Soft peach (upper middle)
    gradient.addColorStop(0.7, '#F2FCE2'); // Soft green (lower middle)
    gradient.addColorStop(1, '#D3E4FD'); // Soft blue (bottom)
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Add subtle texture pattern
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    // Draw improved grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)'; // More subtle grid lines
    ctx.lineWidth = 0.5;
    
    // Draw vertical grid lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    
    // Draw horizontal grid lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), 15, y + 3);
      }
    }
    ctx.stroke();
    
    // Draw center line (baseline) with improved style
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]); // Dashed line for the center
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid line
    
    // Draw arrhythmia status if present
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        // Create a highlight box for the first arrhythmia
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 350, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 350, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('¡PRIMERA ARRITMIA DETECTADA!', 45, 95);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        // Create a highlight box for multiple arrhythmias
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(30, 70, 250, 40);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 70, 250, 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        const redPeaksCount = peaksRef.current.filter(peak => peak.isArrhythmia).length;
        ctx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia || false
        });
      }
    }
    
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia,
          beepPlayed: false
        });
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  // This is the critical function that needs fixing - completely revised to properly
  // highlight only the red waveform sections with red background
  const drawArrhythmiaRegions = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    // Get only the active arrhythmia segments that are visible in the current time window
    const activeArrhythmiaSegments = arrhythmiaSegmentsRef.current.filter(
      segment => (segment.endTime === null || now - segment.endTime < WINDOW_WIDTH_MS) && 
                 (now - segment.startTime < WINDOW_WIDTH_MS)
    );
    
    // CRITICAL FIX: Draw arrhythmia background regions PRECISELY
    // Only highlight regions where RED waveforms appear - nowhere else
    for (const segment of activeArrhythmiaSegments) {
      // Calculate the x positions that correspond exactly to the red waveform start and end
      const startX = CANVAS_WIDTH - ((now - segment.startTime) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
      
      // Use segment's end time if it exists, otherwise use current time (for active segments)
      const endX = segment.endTime
        ? CANVAS_WIDTH - ((now - segment.endTime) * CANVAS_WIDTH / WINDOW_WIDTH_MS)
        : CANVAS_WIDTH;
    
      // Only draw if the segment is at least partially visible
      if (startX < CANVAS_WIDTH && endX > 0) {
        console.log(`Drawing arrhythmia segment: startX=${startX}, endX=${endX}, width=${endX-startX}`);
        
        // Draw a semi-transparent red rectangle ONLY for the arrhythmia segment
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';  // Light red, semi-transparent
        ctx.fillRect(
          Math.max(0, startX), 
          0, 
          Math.min(endX - startX, CANVAS_WIDTH - startX), 
          CANVAS_HEIGHT
        );
        
        // Add visible boundaries with dashed lines at start and end points
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';  // Darker red
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);  // Dashed line
    
        // Left boundary (segment start) if visible - RED WAVEFORM START
        if (startX >= 0 && startX <= CANVAS_WIDTH) {
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX, CANVAS_HEIGHT);
          ctx.stroke();
        }
        
        // Right boundary (segment end) if visible - RED WAVEFORM END
        if (segment.endTime && endX >= 0 && endX <= CANVAS_WIDTH) {
          ctx.beginPath();
          ctx.moveTo(endX, 0);
          ctx.lineTo(endX, CANVAS_HEIGHT);
          ctx.stroke();
        }
        
        ctx.setLineDash([]);  // Reset dash pattern
        
        // Add "ARRITMIA DETECTADA" label
        // FIXED: Only draw label if enough space and ensure it's centered in the segment
        if (Math.abs(endX - startX) > 80) {
          const labelX = (startX + endX) / 2;
          const labelY = 70; // Position the label higher to make it more visible
          
          // Draw label background with higher contrast
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // More intense red background
          const labelWidth = 200;
          const labelHeight = 26;
          ctx.fillRect(labelX - labelWidth/2, labelY - labelHeight/2, labelWidth, labelHeight);
          
          // Draw label text with larger font and stroke for better visibility
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px Inter';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('ARRITMIA DETECTADA', labelX, labelY);
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 0.5;
          ctx.strokeText('ARRITMIA DETECTADA', labelX, labelY);
        }
      }
    }
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, WINDOW_WIDTH_MS]);

  // Function to visualize all arrhythmia waveforms
  const visualizeArrhythmiaWaveforms = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    // Draw saved arrhythmia segments as overlay
    if (completeArrhythmiaWaveformsRef.current.length > 0) {
      // Draw the complete waveform of the last arrhythmia
      const lastArrhythmia = completeArrhythmiaWaveformsRef.current[completeArrhythmiaWaveformsRef.current.length - 1];
      
      // Only show the waveform if it's recent or if it's complete and we're not actively monitoring
      if (lastArrhythmia && ((now - (lastArrhythmia.endTime || now) < WINDOW_WIDTH_MS) || (!isFingerDetected && preserveResults))) {
        // Draw the complete arrhythmia waveform with a special highlight
        if (lastArrhythmia.points.length > 1) {
          // First, draw a special background for this arrhythmia region
          const startX = CANVAS_WIDTH - ((now - lastArrhythmia.startTime) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
          const endX = lastArrhythmia.endTime 
            ? CANVAS_WIDTH - ((now - lastArrhythmia.endTime) * CANVAS_WIDTH / WINDOW_WIDTH_MS)
            : CANVAS_WIDTH;
          
          if (startX < CANVAS_WIDTH && endX > 0) {
            // Draw full waveform with highlight
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#DC2626'; // Strong red for arrhythmia line
            
            // Draw each point of the waveform
            let isFirstPoint = true;
            for (const point of lastArrhythmia.points) {
              const x = CANVAS_WIDTH - ((now - point.time) * CANVAS_WIDTH / WINDOW_WIDTH_MS);
              const y = CANVAS_HEIGHT / 2 - point.value;
              
              if (x >= 0 && x <= CANVAS_WIDTH) {
                if (isFirstPoint) {
                  ctx.moveTo(x, y);
                  isFirstPoint = false;
                } else {
                  ctx.lineTo(x, y);
                }
              }
            }
            
            ctx.stroke();
            
            // Add glow effect to highlight the arrhythmia waveform
            ctx.shadowColor = 'rgba(220, 38, 38, 0.7)';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            
            // Add a label over the arrhythmia
            if (Math.abs(endX - startX) > 80) {
              const labelX = (startX + endX) / 2;
              const labelY = 50;
              
              // Draw label background
              ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
              const labelWidth = 100;
              ctx.fillRect(labelX - labelWidth/2, labelY - 10, labelWidth, 20);
              
              // Draw label text
              ctx.fillStyle = 'white';
              ctx.font = 'bold 12px Inter';
              ctx.textAlign = 'center';
              ctx.fillText('ARRITMIA DETECTADA', labelX, labelY + 4);
            }
          }
        }
      }
    }
  }, [isFingerDetected, preserveResults]);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const renderCtx = USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current ? 
      offscreenCanvasRef.current.getContext('2d', { alpha: false }) : 
      canvas.getContext('2d', { alpha: false });
    
    if (!renderCtx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    if (gridCanvasRef.current) {
      renderCtx.drawImage(gridCanvasRef.current, 0, 0);
    } else {
      drawGrid(renderCtx);
    }
    
    // Draw arrhythmia regions first so they appear behind the signal
    drawArrhythmiaRegions(renderCtx, now);
    
    if (preserveResults && !isFingerDetected) {
      // If preserving results but no finger detected, draw the saved arrhythmia waveforms
      visualizeArrhythmiaWaveforms(renderCtx, now);
      
      if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
        const visibleCtx = canvas.getContext('2d', { alpha: false });
        if (visibleCtx) {
          visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
        }
      }
      
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef
