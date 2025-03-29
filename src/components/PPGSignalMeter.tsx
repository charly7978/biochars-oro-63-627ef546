
// Modify the detectPeaks method to detect peaks pointing upwards
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
    
    // Invert the peak detection logic to find upward peaks
    for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
      if (points[j].value <= currentPoint.value) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak) {
      for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
        if (j < points.length && points[j].value >= currentPoint.value) {
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
      
      beatDispatcher.dispatchBeat(peak.time / 1000, peak.value / verticalScale);
    }
  }
  
  peaksRef.current.sort((a, b) => a.time - b.time);
  
  peaksRef.current = peaksRef.current
    .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
    .slice(-MAX_PEAKS_TO_DISPLAY);
}, [MIN_PEAK_DISTANCE_MS, WINDOW_WIDTH_MS, verticalScale]);
