
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
				
				// Rainbow gradient background with glassmorphism effect
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				
				// Rainbow colors from top to bottom (soft at top, more intense at bottom)
				gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');        // White at top
				gradient.addColorStop(0.15, 'rgba(200, 230, 255, 0.7)');     // Light blue
				gradient.addColorStop(0.3, 'rgba(170, 200, 255, 0.7)');      // Blue
				gradient.addColorStop(0.45, 'rgba(160, 220, 180, 0.7)');     // Green
				gradient.addColorStop(0.6, 'rgba(255, 255, 150, 0.7)');      // Yellow
				gradient.addColorStop(0.75, 'rgba(255, 180, 140, 0.7)');     // Orange
				gradient.addColorStop(0.9, 'rgba(240, 140, 140, 0.7)');      // Red
				gradient.addColorStop(1, 'rgba(220, 120, 240, 0.7)');        // Purple at bottom
				
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality and glassmorphism effect
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(70,80,130,0.12)'; // More transparent for glass effect
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
				
				// Add an enhanced grid with major lines - glass effect
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(50,70,120,0.15)'; // More transparent for major grid
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
				
				// Add subtle glow points at intersections for glass effect
				ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					for (let y = 0; y <= displayHeight; y += cellSize * 5) {
						ctx.beginPath();
						ctx.arc(x, y, 1, 0, Math.PI * 2);
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
