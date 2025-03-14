
import React, { useRef, useEffect, memo } from 'react';
import { optimizeCanvas } from '../utils/displayOptimizer';

interface GraphGridProps {
	width?: number;
	height?: number;
	cellSize?: number;
}

// Using memo to prevent unnecessary re-renders
const GraphGrid: React.FC<GraphGridProps> = memo(({ width = 1000, height = 900, cellSize = 20 }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// Store the last render dimensions to avoid unnecessary redraws
	const lastDimensionsRef = useRef({ width, height, cellSize });

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		
		// Check if we actually need to redraw the grid
		const lastDimensions = lastDimensionsRef.current;
		const dimensionsChanged = 
			lastDimensions.width !== width || 
			lastDimensions.height !== height || 
			lastDimensions.cellSize !== cellSize;
		
		if (dimensionsChanged) {
			// Update stored dimensions
			lastDimensionsRef.current = { width, height, cellSize };
			
			// Use requestAnimationFrame to batch the rendering operations
			requestAnimationFrame(() => {
				// Optimize the canvas for device pixel ratio
				optimizeCanvas(canvas);
				
				const ctx = canvas.getContext('2d', { alpha: false });
				if (!ctx) return;
				
				// Get the actual drawing size adjusted for device pixel ratio
				const displayWidth = canvas.width;
				const displayHeight = canvas.height;
				
				// Clear with high-quality clearing
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				
				// Improved background with subtle gradient
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, '#F3F7FC'); // Lighter blue-cream at top
				gradient.addColorStop(1, '#EBF2F9'); // Slightly darker at bottom
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(60,80,120,0.15)'; // More medical blue tone, subtle
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
				ctx.strokeStyle = 'rgba(40,60,100,0.2)'; // Darker lines for major grid
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
			});
		}
	}, [width, height, cellSize]);

	// Clean up resources on unmount
	useEffect(() => {
		return () => {
			// Release any resources
			const canvas = canvasRef.current;
			if (canvas) {
				const ctx = canvas.getContext('2d');
				if (ctx) {
					// Clear any cached resources
					ctx.clearRect(0, 0, canvas.width, canvas.height);
				}
			}
		};
	}, []);

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
});

GraphGrid.displayName = 'GraphGrid';

export default GraphGrid;
