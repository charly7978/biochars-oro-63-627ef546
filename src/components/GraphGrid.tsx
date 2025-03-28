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
			optimizeCanvas(canvas, width, height);
			
			const ctx = canvas.getContext('2d');
			if (ctx) {
				const displayWidth = canvas.width;
				const displayHeight = canvas.height;
				
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				
				// Recreate the soft gradient from the image
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, 'rgba(220, 180, 255, 0.3)');     // Soft purple at top
				gradient.addColorStop(0.3, 'rgba(180, 210, 255, 0.3)');   // Light blue
				gradient.addColorStop(0.6, 'rgba(180, 230, 200, 0.3)');   // Soft green
				gradient.addColorStop(1, 'rgba(255, 200, 180, 0.3)');     // Soft orange at bottom
				
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Keep existing grid drawing logic
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(70,80,130,0.12)';
				ctx.lineWidth = 0.6;
				
				for (let x = 0; x <= displayWidth; x += cellSize) {
					const xPos = Math.floor(x) + 0.5;
					ctx.moveTo(xPos, 0);
					ctx.lineTo(xPos, displayHeight);
				}
				
				for (let y = 0; y <= displayHeight; y += cellSize) {
					const yPos = Math.floor(y) + 0.5;
					ctx.moveTo(0, yPos);
					ctx.lineTo(displayWidth, yPos);
				}
				ctx.stroke();
				
				// Major grid lines logic remains the same
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(50,70,120,0.15)';
				ctx.lineWidth = 1;
				
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					const xPos = Math.floor(x) + 0.5;
					ctx.moveTo(xPos, 0);
					ctx.lineTo(xPos, displayHeight);
				}
				
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
