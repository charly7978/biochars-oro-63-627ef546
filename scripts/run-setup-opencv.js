
/**
 * Simple script to run the OpenCV setup
 */
console.log('Running OpenCV setup script...');

// Get the directory of the current script
const path = require('path');
const fs = require('fs');
const scriptDir = path.dirname(__filename);

// Use explicit path
const setupScriptPath = path.join(scriptDir, 'setup-opencv.js');
console.log(`Trying to import setup script from: ${setupScriptPath}`);

// Check if the file exists first
if (!fs.existsSync(setupScriptPath)) {
  console.error(`Setup script not found at: ${setupScriptPath}`);
  process.exit(1);
}

// Use CommonJS require
try {
  require(setupScriptPath);
  console.log('OpenCV setup script completed successfully.');
} catch (error) {
  console.error('Failed to run OpenCV setup script:', error);
  process.exit(1);
}
