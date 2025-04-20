import { MovingAverage } from '../utils/MovingAverage';export class MovingAverage {
    private window: number[];
    private size: number;

    constructor(size: number) {
        this.size = size;
        this.window = [];
    }

    add(value: number) {
        this.window.push(value);
        if (this.window.length > this.size) {
            this.window.shift();
        }
    }

    getAverage(): number {
        if (this.window.length === 0) return 0;
        return this.window.reduce((a, b) => a + b, 0) / this.window.length;
    }

    clear() {
        this.window = [];
    }
}