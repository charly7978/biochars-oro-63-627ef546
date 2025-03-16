
import React, { useRef, useEffect } from 'react';
import { optimizeCanvas } from '../utils/displayOptimizer';

interface GraphGridProps {
	width?: number;
	height?: number;
	cellSize?: number;
}

const GraphGrid: React.FC<GraphGridProps> = ({ width = 1000, height = 900, cellSize = 20 }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			// Optimize the canvas for device pixel ratio
			optimizeCanvas(canvas);
			
			const ctx = canvas.getContext('2d', { alpha: false });
			if (ctx) {
				// Get the actual drawing size adjusted for device pixel ratio
				const displayWidth = canvas.width;
				const displayHeight = canvas.height;
				
				// Clear with high-quality clearing
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				
				// Enhanced background with more vibrant gradient and blue-lilac tone transition
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, '#F0F5FD'); // Light blue at top
				gradient.addColorStop(0.3, '#E6EEFB'); // Slightly darker blue
				gradient.addColorStop(0.55, '#E9E5F9'); // Transition to light lilac
				gradient.addColorStop(0.75, '#E5DEFF'); // Soft lilac
				gradient.addColorStop(0.9, '#DCD3FA'); // Deeper lilac
				gradient.addColorStop(1, '#D6BCFA'); // Bottom with vivid lilac accent
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(80,90,150,0.12)'; // More lilac-blue tone, subtle
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
				ctx.strokeStyle = 'rgba(60,70,130,0.18)'; // Darker lines for major grid with lilac tint
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
				imageRendering: 'crisp-edges'
			}} 
			className="ppg-graph performance-boost"
		/>
	);
};

export default GraphGrid;
