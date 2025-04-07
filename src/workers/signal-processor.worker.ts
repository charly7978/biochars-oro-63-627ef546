
/**
 * Web Worker for offloading signal processing to prevent UI freezing
 */

// Process buffer size adjustment for performance
const DEFAULT_BUFFER_SIZE = 128;
let bufferSizes = {
  filter: 64,
  signal: 512,
  result: 512
};

// Pre-allocated buffers for efficient processing
let filterBuffer: Float32Array;
let signalBuffer: Float32Array;
let resultBuffer: Float32Array;

// Setup worker buffers to minimize allocations during processing
function initializeBuffers(config: any) {
  if (config && config.bufferSizes) {
    bufferSizes = {
      ...bufferSizes,
      ...config.bufferSizes
    };
  }
  
  filterBuffer = new Float32Array(bufferSizes.filter);
  signalBuffer = new Float32Array(bufferSizes.signal);
  resultBuffer = new Float32Array(bufferSizes.result);
  
  self.postMessage({
    type: 'initialized',
    bufferSizes
  });
}

// Apply various filters to signal data
function applyFilters(values: number[], config: any) {
  // Copy input to buffer to minimize allocation
  const len = Math.min(values.length, signalBuffer.length);
  for (let i = 0; i < len; i++) {
    signalBuffer[i] = values[i];
  }
  
  // Apply moving average filter
  const windowSize = config?.windowSize || 5;
  for (let i = windowSize; i < len; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += signalBuffer[i - j];
    }
    resultBuffer[i] = sum / windowSize;
  }
  
  // Copy results back to array for return
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = i < windowSize ? signalBuffer[i] : resultBuffer[i];
  }
  
  return result;
}

// Process PPG signal with optimized algorithms
function processSignal(signal: number[], sampleRate: number = 30) {
  if (!signal || signal.length === 0) {
    return { bpm: 0, confidence: 0 };
  }
  
  // Low-pass filter to remove high-frequency noise
  let filtered = signal.slice();
  
  // Very simple peak detection algorithm for worker demonstration
  const peaks: number[] = [];
  for (let i = 2; i < filtered.length - 2; i++) {
    if (filtered[i] > filtered[i-1] && 
        filtered[i] > filtered[i-2] &&
        filtered[i] > filtered[i+1] && 
        filtered[i] > filtered[i+2]) {
      peaks.push(i);
    }
  }
  
  // Calculate heart rate from peak intervals
  let intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // If we don't have enough intervals, return zero
  if (intervals.length < 2) {
    return { bpm: 0, confidence: 0.1 };
  }
  
  // Convert intervals to BPM
  const beatsPerSample = intervals.map(interval => 1 / interval);
  const avgBeatsPerSample = beatsPerSample.reduce((a, b) => a + b, 0) / beatsPerSample.length;
  const bpm = avgBeatsPerSample * sampleRate * 60;
  
  // Calculate confidence based on interval consistency
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const coeffOfVar = stdDev / mean;
  const confidence = Math.max(0, Math.min(1, 1 - coeffOfVar));
  
  return {
    bpm: bpm > 40 && bpm < 200 ? Math.round(bpm) : 0,
    confidence,
    peaks,
    intervals
  };
}

// Worker message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      initializeBuffers(data);
      break;
      
    case 'filter-data':
      const filtered = applyFilters(data.values, data.config);
      self.postMessage({
        type: 'filter-result',
        filtered,
        id: data.id
      });
      break;
      
    case 'process-signal':
      const result = processSignal(data.signal, data.sampleRate);
      self.postMessage({
        type: 'process-result',
        result,
        id: data.id
      });
      break;
      
    case 'reset':
      // Reset all buffers and state
      for (let i = 0; i < filterBuffer.length; i++) filterBuffer[i] = 0;
      for (let i = 0; i < signalBuffer.length; i++) signalBuffer[i] = 0;
      for (let i = 0; i < resultBuffer.length; i++) resultBuffer[i] = 0;
      
      self.postMessage({
        type: 'reset-complete'
      });
      break;
  }
};
