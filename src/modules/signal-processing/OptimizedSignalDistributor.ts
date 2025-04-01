
/**
 * Optimized Signal Distributor
 * Processes and distributes PPG signals to specialized channels with priority-based scheduling
 */
import { OptimizedSignalChannel } from './channels/OptimizedSignalChannel';
import { GlucoseChannel } from './channels/GlucoseChannel';
import { LipidsChannel } from './channels/LipidsChannel';
import { BloodPressureChannel } from './channels/BloodPressureChannel';
import { SpO2Channel } from './channels/SpO2Channel';
import { CardiacChannel } from './channels/CardiacChannel';

// Define priority levels
type Priority = 'high' | 'medium' | 'low';

// Signal point with priority assignment
interface PrioritizedSignal {
  value: number;
  timestamp: number;
  priority: Priority;
}

// Configuration for distributor
interface DistributorConfig {
  enableGlucose?: boolean;
  enableLipids?: boolean;
  enableCardiac?: boolean;
  enableSpO2?: boolean;
  enableBloodPressure?: boolean;
  priorityBudget?: { high: number; medium: number; low: number };
}

/**
 * Main distributor class for signal processing
 */
export class OptimizedSignalDistributor {
  private channels: Map<string, any> = new Map();
  private signalQueue: PrioritizedSignal[] = [];
  private isProcessing: boolean = false;
  private processingInterval: number | null = null;
  private priorityBudget: { high: number; medium: number; low: number };
  private priorityUsage: { high: number; medium: number; low: number } = { high: 0, medium: 0, low: 0 };
  
  // Singleton instance
  private static instance: OptimizedSignalDistributor | null = null;
  
  /**
   * Get the singleton instance
   */
  public static getInstance(config?: DistributorConfig): OptimizedSignalDistributor {
    if (!OptimizedSignalDistributor.instance) {
      OptimizedSignalDistributor.instance = new OptimizedSignalDistributor(config);
    }
    return OptimizedSignalDistributor.instance;
  }
  
  /**
   * Private constructor for singleton
   */
  private constructor(config?: DistributorConfig) {
    // Configure priority budgets (operations per second)
    this.priorityBudget = config?.priorityBudget || {
      high: 30,   // High priority: 30 ops/sec
      medium: 10, // Medium priority: 10 ops/sec
      low: 5      // Low priority: 5 ops/sec
    };
    
    // Initialize channels based on configuration
    this.initializeChannels(config);
  }
  
  /**
   * Initialize processing channels
   */
  private initializeChannels(config?: DistributorConfig): void {
    // Initialize required channels
    if (config?.enableGlucose !== false) {
      this.registerChannel('glucose', new GlucoseChannel());
    }
    
    if (config?.enableLipids !== false) {
      this.registerChannel('lipids', new LipidsChannel());
    }
    
    if (config?.enableBloodPressure !== false) {
      this.registerChannel('bloodPressure', new BloodPressureChannel());
    }
    
    if (config?.enableSpO2 !== false) {
      this.registerChannel('spo2', new SpO2Channel());
    }
    
    if (config?.enableCardiac !== false) {
      this.registerChannel('cardiac', new CardiacChannel());
    }
  }
  
  /**
   * Register a new processing channel
   */
  private registerChannel(name: string, channel: any): void {
    this.channels.set(name, channel);
    console.log(`Channel registered: ${name}`);
  }
  
  /**
   * Add a signal to be processed
   */
  public addSignal(value: number, priority: Priority = 'medium'): void {
    this.signalQueue.push({
      value,
      timestamp: Date.now(),
      priority
    });
    
    // Ensure processing is active
    this.ensureProcessing();
  }
  
  /**
   * Start the processing loop if not active
   */
  private ensureProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingInterval = window.setInterval(() => this.processQueue(), 100);
  }
  
  /**
   * Process signals in the queue based on priority
   */
  private processQueue(): void {
    if (this.signalQueue.length === 0) {
      // Stop processing if queue is empty
      this.stopProcessing();
      return;
    }
    
    // Reset priority usage at the beginning of each second
    const now = Math.floor(Date.now() / 1000);
    const lastSecond = Math.floor((this.signalQueue[0].timestamp - 1) / 1000);
    
    if (now !== lastSecond) {
      this.priorityUsage = { high: 0, medium: 0, low: 0 };
    }
    
    // Sort queue by priority
    this.signalQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // Process signals based on priority budgets
    let processedCount = 0;
    const signalsToProcess = [...this.signalQueue];
    this.signalQueue = [];
    
    for (const signal of signalsToProcess) {
      // Check if we've exceeded the budget for this priority
      if (this.priorityUsage[signal.priority] >= this.priorityBudget[signal.priority]) {
        // Put back in queue if over budget
        this.signalQueue.push(signal);
        continue;
      }
      
      // Process the signal with all channels
      this.distributeSignal(signal.value);
      
      // Update priority usage
      this.priorityUsage[signal.priority]++;
      processedCount++;
    }
    
    // Log processing stats occasionally
    if (processedCount > 0 && Math.random() < 0.1) {
      console.log(`Processed ${processedCount} signals, queue size: ${this.signalQueue.length}`);
    }
  }
  
  /**
   * Distribute a signal to all registered channels
   */
  private distributeSignal(value: number): void {
    this.channels.forEach((channel, name) => {
      try {
        channel.processSignal(value);
      } catch (error) {
        console.error(`Error processing signal in channel ${name}:`, error);
      }
    });
  }
  
  /**
   * Stop the processing loop
   */
  private stopProcessing(): void {
    if (this.processingInterval !== null) {
      window.clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }
  
  /**
   * Get results from a specific channel
   */
  public getResults(channelName: string): any {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Channel not found: ${channelName}`);
    }
    return channel.getResults();
  }
  
  /**
   * Get results from all channels
   */
  public getAllResults(): Record<string, any> {
    const results: Record<string, any> = {};
    this.channels.forEach((channel, name) => {
      results[name] = channel.getResults();
    });
    return results;
  }
  
  /**
   * Reset all channels
   */
  public reset(): void {
    this.channels.forEach(channel => {
      channel.reset();
    });
    this.signalQueue = [];
    this.stopProcessing();
  }
}
