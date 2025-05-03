
// Required for OpenCV setup

// Use ES module import
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Setting up OpenCV.js...");

// Paths for OpenCV files
const sourceDir = path.join(__dirname, '../node_modules/@techstark/opencv-js/opencv.js');
const targetDir = path.join(__dirname, '../public/opencv');
const targetFile = path.join(targetDir, 'opencv.js');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

// Copy the opencv.js file to the public directory
try {
  if (fs.existsSync(sourceDir)) {
    fs.copyFileSync(sourceDir, targetFile);
    console.log(`OpenCV.js copied to: ${targetFile}`);
  } else {
    console.warn(`Warning: OpenCV source file not found at ${sourceDir}`);
    console.log('Creating placeholder file for development...');
    
    // Create a placeholder file for development
    const placeholderContent = '// OpenCV.js placeholder\nconsole.log("OpenCV.js placeholder loaded");';
    fs.writeFileSync(targetFile, placeholderContent);
    console.log(`OpenCV.js placeholder created at: ${targetFile}`);
  }
} catch (error) {
  console.error('Error during OpenCV setup:', error);
  process.exit(1);
}

console.log("OpenCV.js setup complete!");
