export class MovingAverage {
    private buffer: number[] = [];
    private sum: number = 0;
    private maxSize: number;

    /**
     * Crea una instancia de MovingAverage.
     * @param size El número máximo de valores a mantener en el buffer.
     */
    constructor(size: number) {
        // Asegurarse de que el tamaño sea al menos 1
        this.maxSize = Math.max(1, size);
    }

    /**
     * Añade un nuevo valor al buffer. Si el buffer excede maxSize,
     * el valor más antiguo se elimina.
     * @param value El valor numérico a añadir.
     */
    add(value: number): void {
        if (isNaN(value)) {
             console.warn("MovingAverage: Se intentó añadir un valor NaN.");
             return; // No añadir NaN
        }
        this.buffer.push(value);
        this.sum += value;
        if (this.buffer.length > this.maxSize) {
            // shift() elimina el primer elemento y lo devuelve.
            // Usamos el operador '!' para indicar a TypeScript que sabemos que no será undefined
            // porque acabamos de comprobar que length > maxSize (y maxSize >= 1).
            this.sum -= this.buffer.shift()!;
        }
    }

    /**
     * Obtiene el promedio actual de los valores en el buffer.
     * @returns El promedio, o 0 si el buffer está vacío.
     */
    getAverage(): number {
        if (this.buffer.length === 0) {
            return 0;
        }
        return this.sum / this.buffer.length;
    }

    /**
     * Obtiene una copia de todos los valores actualmente en el buffer.
     * @returns Un array con los valores del buffer.
     */
    getValues(): number[] {
        // Devolver una copia para evitar modificaciones externas del buffer interno
        return [...this.buffer];
    }

    /**
     * Limpia el buffer y resetea la suma.
     */
    clear(): void {
        this.buffer = [];
        this.sum = 0;
    }

    /**
     * Devuelve el número actual de elementos en el buffer.
     * @returns El tamaño actual del buffer.
     */
    size(): number {
        return this.buffer.length;
    }

    /**
     * Verifica si el buffer está lleno (ha alcanzado maxSize).
     * @returns true si el buffer está lleno, false en caso contrario.
     */
    isFull(): boolean {
        return this.buffer.length === this.maxSize;
    }
} 