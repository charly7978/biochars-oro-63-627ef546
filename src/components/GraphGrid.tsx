
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
				
				// Create the gradient according to the reference image - purple to turquoise to green
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, 'rgba(220, 180, 255, 0.9)'); // Purple at top
				gradient.addColorStop(0.3, 'rgba(180, 200, 255, 0.8)'); // Light blue-purple
				gradient.addColorStop(0.5, 'rgba(100, 220, 255, 0.8)'); // Turquoise
				gradient.addColorStop(0.7, 'rgba(80, 230, 220, 0.8)'); // Turquoise-green
				gradient.addColorStop(0.9, 'rgba(100, 255, 180, 0.8)'); // Light green
				gradient.addColorStop(1, 'rgba(150, 255, 150, 0.8)'); // Green at bottom
				
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality for better visibility
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(100, 100, 180, 0.25)'; // More visible grid lines
				ctx.lineWidth = 0.5; // Thinner lines for better aesthetics
				
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
				
				// Add major grid lines for better reference
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(120, 120, 200, 0.35)'; // More visible major grid
				ctx.lineWidth = 1;
				
				// Major vertical lines every 5 cells
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					const xPos = Math.floor(x) + 0.5;
					ctx.moveTo(xPos, 0);
					ctx.lineTo(xPos, displayHeight);
					
					// Add numbers on the left side
					if (x === 0) {
						const yNumbers = [6.9, 6.4, 6.0, 5.6, 5.1, 4.7, 4.2, 3.8, 3.3, 2.9, 2.4, 2.0, 1.6, 1.1, 0.7, 0.2, -0.2, -0.7, -1.1];
						yNumbers.forEach((num, i) => {
							const yPos = Math.floor((i + 1) * cellSize * 3.5) + 0.5;
							ctx.font = 'bold 14px Arial';
							ctx.fillStyle = 'rgba(80, 80, 140, 0.8)';
							ctx.textAlign = 'left';
							ctx.fillText(num.toString(), 5, yPos + 5);
						});
					}
				}
				
				// Major horizontal lines every 5 cells
				for (let y = 0; y <= displayHeight; y += cellSize * 5) {
					const yPos = Math.floor(y) + 0.5;
					ctx.moveTo(0, yPos);
					ctx.lineTo(displayWidth, yPos);
				}
				ctx.stroke();
				
				// Add text message in the center when waiting for signal
				ctx.font = 'bold 24px Arial';
				ctx.fillStyle = 'rgba(100, 100, 150, 0.6)';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('Esperando señal válida...', displayWidth / 2, displayHeight / 2);
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
				borderRadius: '0px',
				boxShadow: 'none'
			}} 
			className="ppg-graph gpu-accelerated rendering-optimized"
		/>
	);
};

export default GraphGrid;
