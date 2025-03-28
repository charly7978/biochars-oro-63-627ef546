
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
				
				// Nuevo gradiente con colores suaves pero definidos
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, 'rgba(147, 39, 143, 0.2)');     // Púrpura suave al inicio
				gradient.addColorStop(0.3, 'rgba(234, 172, 232, 0.15)'); // Rosa pastel
				gradient.addColorStop(0.6, 'rgba(246, 219, 245, 0.1)');  // Rosa muy claro
				gradient.addColorStop(1, 'rgba(9, 132, 227, 0.1)');      // Azul suave al final
				
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Dibujamos la cuadrícula con líneas muy tenues
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(120, 120, 180, 0.05)';
				ctx.lineWidth = 0.3;
				
				// Líneas verticales
				for (let x = 0; x <= displayWidth; x += cellSize) {
					const xPos = Math.floor(x) + 0.5;
					ctx.moveTo(xPos, 0);
					ctx.lineTo(xPos, displayHeight);
				}
				
				// Líneas horizontales
				for (let y = 0; y <= displayHeight; y += cellSize) {
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
				position: 'absolute', 
				top: 0, 
				left: 0, 
				width: '100%', 
				height: '100%', 
				zIndex: -1,
				pointerEvents: 'none'
			}} 
			className="ppg-background-grid"
		/>
	);
};

export default GraphGrid;
