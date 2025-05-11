
const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENCV_URL = 'https://docs.opencv.org/4.6.0/opencv.js';
const OUTPUT_DIR = path.join(path.resolve(__dirname, '..'), 'public', 'opencv');
const OPENCV_PATH = path.join(OUTPUT_DIR, 'opencv.js');
const OPENCV_INIT_PATH = path.join(OUTPUT_DIR, 'opencv-init.js');

console.log('Starting OpenCV setup...');
console.log(`Output directory: ${OUTPUT_DIR}`);

// Create directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created directory: ${OUTPUT_DIR}`);
}

// Init script content
const initScriptContent = `
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
`;

// Write init script
fs.writeFileSync(OPENCV_INIT_PATH, initScriptContent);
console.log(`OpenCV init script written to: ${OPENCV_INIT_PATH}`);

// Check if OpenCV.js already exists
if (fs.existsSync(OPENCV_PATH)) {
  console.log(`OpenCV.js already exists at: ${OPENCV_PATH}`);
  console.log('Setup complete!');
  return;
}

// Download OpenCV.js
console.log(`Downloading OpenCV.js from: ${OPENCV_URL}`);
console.log(`This might take a few moments...`);

const file = fs.createWriteStream(OPENCV_PATH);
https.get(OPENCV_URL, response => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download OpenCV.js: HTTP status ${response.statusCode}`);
    if (fs.existsSync(OPENCV_PATH)) {
      fs.unlinkSync(OPENCV_PATH); // Remove partial download
    }
    process.exit(1);
  }
  
  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    console.log(`✅ OpenCV.js downloaded to: ${OPENCV_PATH}`);
    console.log('Setup complete!');
    console.log(`
    Next steps:
    1. Make sure you include the initialization script in your index.html:
       <script src="/opencv/opencv-init.js"></script>
    2. Include the main OpenCV.js after:
       <script async src="/opencv/opencv.js"></script>
    3. Use the 'opencv-ready' event to know when OpenCV is ready to use
    `);
  });

  file.on('error', err => {
    console.error(`Error writing OpenCV.js: ${err.message}`);
    if (fs.existsSync(OPENCV_PATH)) {
      fs.unlinkSync(OPENCV_PATH); // Remove partial download
    }
    process.exit(1);
  });
}).on('error', err => {
  console.error(`Error downloading OpenCV.js: ${err.message}`);
  if (fs.existsSync(OPENCV_PATH)) {
    fs.unlinkSync(OPENCV_PATH); // Remove partial download
  }
  process.exit(1);
});
