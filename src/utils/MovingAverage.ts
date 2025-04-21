export class MovingAverage {
    private buffer: number[] = [];
    private sum: number = 0;
    private maxSize: number;

    constructor(size: number) {
        this.maxSize = size;
    }

    add(value: number): void {
        this.buffer.push(value);
        this.sum += value;
        if (this.buffer.length > this.maxSize) {
            this.sum -= this.buffer.shift()!;
        }
    }

    getAverage(): number {
        if (this.buffer.length === 0) return 0;
        return this.sum / this.buffer.length;
    }

    getValues(): number[] {
        return [...this.buffer];
    }

    clear(): void {
        this.buffer = [];
        this.sum = 0;
    }

    size(): number {
        return this.buffer.length;
    }
} 