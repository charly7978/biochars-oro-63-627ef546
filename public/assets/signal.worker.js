
// WebWorker for signal processing operations
console.log("[SignalWorker] Advanced signal processing worker initialized");

// Import WASM module
importScripts('/assets/signal-processor.wasm.js');

// Load the ML model (quantized)
let wasmModule = null;
let tensorflowModel = null;
let isProcessing = false;
let processingQueue = [];

// Initialize processing
async function initializeProcessing() {
  try {
    console.log("[SignalWorker] Initializing WebAssembly module");
    wasmModule = await WebAssembly.instantiate(await wasmInstance.wasmModule);
    
    console.log("[SignalWorker] Initializing TensorFlow.js");
    self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js');
    
    // Load optimized model
    console.log("[SignalWorker] Loading quantized ML model");
    tensorflowModel = await tf.loadLayersModel('/assets/optimized-model/model.json');
    
    // Signal ready state
    postMessage({
      type: 'initialized',
      success: true
    });
    
    console.log("[SignalWorker] Signal processing system ready");
  } catch (error) {
    console.error("[SignalWorker] Initialization error:", error);
    postMessage({
      type: 'initialized',
      success: false,
      error: error.message
    });
  }
}

// Process signal using ML model
async function processSignalML(signal) {
  if (!tensorflowModel) {
    return { error: "Model not loaded" };
  }
  
  try {
    // Convert to tensor
    const tensor = tf.tensor2d(signal, [1, signal.length]);
    
    // Run inference with optimized execution
    const result = tf.tidy(() => {
      // Execute model with WebGL acceleration
      return tensorflowModel.predict(tensor);
    });
    
    // Get data and clean up
    const outputData = await result.data();
    result.dispose();
    tensor.dispose();
    
    return {
      processed: Array.from(outputData),
      success: true
    };
  } catch (error) {
    console.error("[SignalWorker] Error processing with ML:", error);
    return {
      error: error.message,
      success: false
    };
  }
}

// Process signal using WASM
function processSignalWASM(signal, options) {
  if (!wasmModule) {
    return { error: "WASM module not loaded" };
  }
  
  try {
    // Create buffer in WASM memory
    const signalLength = signal.length;
    const bytesPerFloat = 4;
    const signalPtr = 0; // Start of memory
    
    // Copy signal to WASM memory
    const memory = new Float32Array(wasmModule.exports.memory.buffer);
    for (let i = 0; i < signalLength; i++) {
      memory[i] = signal[i];
    }
    
    // Process based on operation type
    let result;
    switch (options.operation) {
      case 'filter':
        const outputPtr = wasmModule.exports.filterSignal(signalPtr, signalLength, options.filterType || 1);
        // Read results
        const filtered = new Float32Array(memory.buffer, outputPtr, signalLength);
        result = {
          filtered: Array.from(filtered),
          success: true
        };
        break;
        
      case 'detectPeaks':
        const threshold = options.threshold || 0.5;
        const peaksPtr = wasmModule.exports.detectPeaks(signalPtr, signalLength, threshold);
        // Read peak count and positions
        const peakCount = new Int32Array(memory.buffer, peaksPtr, 1)[0];
        const peaks = new Int32Array(memory.buffer, peaksPtr + bytesPerFloat, peakCount);
        result = {
          peakCount: peakCount,
          peakPositions: Array.from(peaks),
          success: true
        };
        break;
        
      case 'calculateStats':
        const statsPtr = wasmModule.exports.calculateStats(signalPtr, signalLength);
        // Read statistics
        const stats = new Float32Array(memory.buffer, statsPtr, 4);
        result = {
          mean: stats[0],
          variance: stats[1],
          min: stats[2],
          max: stats[3],
          success: true
        };
        break;
        
      default:
        result = { error: "Unknown operation", success: false };
    }
    
    return result;
  } catch (error) {
    console.error("[SignalWorker] Error processing with WASM:", error);
    return {
      error: error.message,
      success: false
    };
  }
}

// Worker message handler
self.onmessage = async function(e) {
  const data = e.data;
  
  switch (data.type) {
    case 'initialize':
      await initializeProcessing();
      break;
      
    case 'process':
      if (isProcessing) {
        // Queue the processing request if busy
        processingQueue.push(data);
        break;
      }
      
      isProcessing = true;
      try {
        let result;
        // Choose processing method based on data
        if (data.useML) {
          result = await processSignalML(data.signal);
        } else {
          result = processSignalWASM(data.signal, data.options);
        }
        
        // Send results back
        postMessage({
          type: 'result',
          id: data.id,
          result: result,
          timestamp: Date.now()
        });
      } catch (error) {
        postMessage({
          type: 'error',
          id: data.id,
          error: error.message
        });
      } finally {
        isProcessing = false;
        
        // Process next item in queue if any
        if (processingQueue.length > 0) {
          const nextItem = processingQueue.shift();
          self.onmessage({ data: nextItem });
        }
      }
      break;
      
    case 'terminate':
      // Clean up resources
      if (tensorflowModel) {
        tensorflowModel.dispose();
      }
      self.close();
      break;
  }
};

// Error handling
self.onerror = function(error) {
  console.error("[SignalWorker] Worker error:", error);
  postMessage({
    type: 'error',
    error: error.message
  });
};

console.log("[SignalWorker] Advanced signal processor ready to receive commands");
