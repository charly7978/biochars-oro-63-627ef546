
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
			optimizeCanvas(canvas, width, height);
			
			const ctx = canvas.getContext('2d');
			if (ctx) {
				// Get the actual drawing size adjusted for device pixel ratio
				const displayWidth = canvas.width;
				const displayHeight = canvas.height;
				
				// Clear with high-quality clearing
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				
				// Significantly intensified glassmorphism gradient with higher contrast and vibrance
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, 'rgba(245, 250, 255, 0.9)'); // Almost white at top, very opaque
				gradient.addColorStop(0.3, 'rgba(237, 244, 253, 0.9)'); // Light blue transition
				gradient.addColorStop(0.6, 'rgba(235, 225, 255, 0.9)'); // Strong transition to vibrant violet
				gradient.addColorStop(1, 'rgba(220, 190, 255, 0.9)'); // Deep saturated lilac at bottom, highly opaque
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality and glassmorphism effect
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(70,80,130,0.2)'; // More visible grid lines
				ctx.lineWidth = 0.6; // Thinner lines for glass effect
				
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
				
				// Add an enhanced grid with major lines - more visible glass effect
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(50,70,120,0.25)'; // Even more visible major grid lines
				ctx.lineWidth = 1;
				
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
				
				// Add more pronounced glow points at intersections for glass effect
				ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; // Brighter, more visible glow points
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					for (let y = 0; y <= displayHeight; y += cellSize * 5) {
						ctx.beginPath();
						ctx.arc(x, y, 2, 0, Math.PI * 2); // Larger glow points
						ctx.fill();
					}
				}
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
				borderRadius: '8px',
				boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
			}} 
			className="ppg-graph gpu-accelerated rendering-optimized"
		/>
	);
};

export default GraphGrid;
