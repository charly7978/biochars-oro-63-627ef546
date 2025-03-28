
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
				
				// EXTREMADAMENTE intensificado gradiente con máximo contraste y visibilidad
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, 'rgba(245, 250, 255, 1.0)'); // Blanco puro arriba, 100% opaco
				gradient.addColorStop(0.3, 'rgba(227, 240, 255, 1.0)'); // Azul claro, 100% opaco
				gradient.addColorStop(0.6, 'rgba(225, 210, 255, 1.0)'); // Transición a violeta vibrante, 100% opaco
				gradient.addColorStop(1, 'rgba(200, 160, 255, 1.0)'); // Lila saturado intenso abajo, 100% opaco
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Draw grid with improved quality and glassmorphism effect
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(70,80,130,0.3)'; // Líneas de cuadrícula más visibles
				ctx.lineWidth = 0.8; // Líneas un poco más gruesas para mejor visibilidad
				
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
				ctx.strokeStyle = 'rgba(50,70,120,0.4)'; // Líneas principales mucho más visibles
				ctx.lineWidth = 1.5; // Líneas más gruesas
				
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
				ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Puntos de brillo mucho más visibles
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					for (let y = 0; y <= displayHeight; y += cellSize * 5) {
						ctx.beginPath();
						ctx.arc(x, y, 3, 0, Math.PI * 2); // Puntos más grandes
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
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 0,
				borderRadius: '0px', // Eliminamos el border radius para asegurar cobertura completa
				boxShadow: 'none' // Eliminamos sombras que puedan afectar la visualización
			}} 
			className="ppg-graph gpu-accelerated rendering-optimized"
		/>
	);
};

export default GraphGrid;
