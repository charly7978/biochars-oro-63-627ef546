
// OpenCV initialization script
var Module = {
  onRuntimeInitialized: function() {
    console.log('OpenCV.js runtime initialized.');
    // Dispatch event when OpenCV is ready
    window.dispatchEvent(new CustomEvent('opencv-ready'));
    // Also set a global flag for easier checking
    window.cv_ready = true;
  },
  preRun: [],
  postRun: [],
  print: function(text) { console.log('OpenCV.js:', text); },
  printErr: function(text) { console.warn('OpenCV.js Error:', text); }
};
console.log('OpenCV.js initialization script loaded.');
