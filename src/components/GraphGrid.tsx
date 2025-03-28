
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
				
				// Clear the canvas
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				
				// Gradiente con colores MUCHO más intensos y visibles
				const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
				gradient.addColorStop(0, 'rgba(147, 39, 143, 0.8)');     // Púrpura intenso
				gradient.addColorStop(0.3, 'rgba(234, 172, 232, 0.75)'); // Rosa fuerte
				gradient.addColorStop(0.6, 'rgba(246, 219, 245, 0.7)');  // Rosa medio
				gradient.addColorStop(1, 'rgba(9, 132, 227, 0.6)');      // Azul más visible
				
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, displayWidth, displayHeight);
				
				// Cuadrícula con líneas más visibles
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Líneas blancas más visibles
				ctx.lineWidth = 0.5;
				
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
				
				// Líneas principales cada 5 celdas
				ctx.beginPath();
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Líneas principales más destacadas
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
				
				// Puntos de brillo en intersecciones
				ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
				for (let x = 0; x <= displayWidth; x += cellSize * 5) {
					for (let y = 0; y <= displayHeight; y += cellSize * 5) {
						ctx.beginPath();
						ctx.arc(x, y, 1.5, 0, Math.PI * 2);
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
				position: 'fixed', // Cambiado a fixed para asegurar que está sobre todo
				top: 0, 
				left: 0, 
				width: '100vw', 
				height: '100vh',
				zIndex: -1, // Detrás de otros elementos pero visible
				pointerEvents: 'none',
				opacity: 1 // Asegurar visibilidad completa
			}} 
			className="ppg-background-grid"
		/>
	);
};

export default GraphGrid;
