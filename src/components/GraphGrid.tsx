
import React, { useRef, useEffect } from 'react';
import { optimizeCanvas } from '../utils/displayOptimizer';

interface GraphGridProps {
	width?: number;
	height?: number;
	cellSize?: number;
}

const GraphGrid: React.FC<GraphGridProps> = ({ width = 1200, height = 1080, cellSize = 20 }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			// Optimize the canvas for device pixel ratio with maximum resolution
			optimizeCanvas(canvas);
			
			const ctx = canvas.getContext('2d');
			if (ctx) {
				// Get the actual drawing size adjusted for device pixel ratio
				const displayWidth = canvas.width;
				const displayHeight = canvas.height;
				
				// Clear with high-quality clearing
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				
				// Enhanced background with subtle gradient and lilac-blue tone transition
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, '#F3F7FC'); // Lighter blue-cream at top
				gradient.addColorStop(0.4, '#EDF4F9'); // Slightly darker at middle
				gradient.addColorStop(0.6, '#F1EEF8'); // Start transitioning to subtle lilac
				gradient.addColorStop(1, '#F0E6FF'); // Subtle lilac tone at bottom
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(70,80,130,0.15)'; // More medical blue tone, subtle
				ctx.lineWidth = 0.8; // Slightly thicker for better visibility
				
				// Draw vertical grid lines with better precision
				for (let x = 0; x <= displayWidth; x += cellSize) {
					// Ensure pixel-perfect lines
					const xPos = Math.floor(x) + 0.5;
					ctx.moveTo(xPos, 0);
					ctx.lineTo(xPos, displayHeight);
				}
				
				// Draw horizontal grid lines with better precision
				for (let y = 0; y <= displayHeight; y += cellSize) {
					// Ensure pixel-perfect lines
					const yPos = Math.floor(y) + 0.5;
					ctx.moveTo(0, yPos);
					ctx.lineTo(displayWidth, yPos);
				}
				ctx.stroke();
				
				// Add an enhanced grid with major lines
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(50,70,120,0.2)'; // Darker lines for major grid
				ctx.lineWidth = 1.2;
				
				// Major vertical lines every 5 cells
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					const xPos = Math.floor(x) + 0.5;
					ctx.moveTo(xPos, 0);
					ctx.lineTo(xPos, displayHeight);
				}
				
				// Major horizontal lines every 5 cells
				for (let y = 0; y <= displayHeight; y += cellSize * 5) {
					const yPos = Math.floor(y) + 0.5;
					ctx.moveTo(0, yPos);
					ctx.lineTo(displayWidth, yPos);
				}
				ctx.stroke();
			}
		}
	}, [width, height, cellSize]);

	return (
		<canvas 
			ref={canvasRef} 
			style={{ 
				width: '100%', 
				height: 'auto', 
				display: 'block',
			}} 
			className="ppg-graph gpu-accelerated rendering-optimized"
		/>
	);
};

export default GraphGrid;
