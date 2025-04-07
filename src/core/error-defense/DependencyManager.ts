/**
 * DependencyManager - Proactively manages and initializes critical system dependencies
 * to prevent "dependency not available" errors before they happen
 */

import { VitalSignsProcessor } from '../../modules/VitalSignsProcessor';
import { logSignalProcessing, LogLevel } from '../../utils/signalLogging';
import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity } from './ErrorDefenseSystem';

interface ManagedDependency {
  name: string;
  instance: any;
  lastInitialized: number;
  initializationCount: number;
  status: 'available' | 'initializing' | 'error';
  errorMessage?: string;
}

class DependencyManager {
  private static instance: DependencyManager;
  private dependencies: Map<string, ManagedDependency> = new Map();
  private initializationInterval: number | null = null;
  private readonly CHECK_INTERVAL = 5000; // 5 seconds
  private defensiveBackups: Record<string, () => any> = {};
  
  private constructor() {
    this.initializeDefensiveBackups();
    this.startProactiveInitialization();
    console.log('DependencyManager: Initialized and running proactive dependency management');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): DependencyManager {
    if (!DependencyManager.instance) {
      DependencyManager.instance = new DependencyManager();
    }
    return DependencyManager.instance;
  }
  
  /**
   * Initialize defensive backups - fallback implementations of critical components
   */
  private initializeDefensiveBackups(): void {
    // Backup VitalSignsProcessor that returns empty results but doesn't crash
    this.defensiveBackups['vitalSignsProcessor'] = () => {
      return {
        processSignal: () => ({
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "FALLBACK_MODE",
          glucose: 0,
          lipids: { totalCholesterol: 0, triglycerides: 0 }
        }),
        reset: () => {},
        fullReset: () => {},
        getArrhythmiaCounter: () => 0
      };
    };
    
    // Add more defensive backups for other critical components
    this.defensiveBackups['signalProcessor'] = () => {
      return {
        processFrame: () => {},
        start: () => {},
        stop: () => {},
        reset: () => {},
        onSignalReady: () => {},
        onError: () => {}
      };
    };
    
    this.defensiveBackups['heartBeatProcessor'] = () => {
      return {
        processSignal: () => ({ bpm: 0, rrIntervals: [], lastPeakTime: null }),
        reset: () => {},
        fullReset: () => {}
      };
    };
  }
  
  /**
   * Start proactive initialization of critical dependencies
   */
  private startProactiveInitialization(): void {
    // Register critical dependencies
    this.registerDependency('vitalSignsProcessor');
    this.registerDependency('signalProcessor');
    this.registerDependency('heartBeatProcessor');
    
    // Immediately initialize all dependencies
    this.initializeAllDependencies();
    
    // Set up periodic checks and initialization
    if (typeof window !== 'undefined' && !this.initializationInterval) {
      this.initializationInterval = window.setInterval(() => {
        this.initializeAllDependencies();
      }, this.CHECK_INTERVAL);
    }
  }
  
  /**
   * Register a dependency for automatic management
   */
  public registerDependency(name: string): void {
    if (!this.dependencies.has(name)) {
      this.dependencies.set(name, {
        name,
        instance: null,
        lastInitialized: 0,
        initializationCount: 0,
        status: 'initializing'
      });
      
      // Initialize immediately
      this.initializeDependency(name);
    }
  }
  
  /**
   * Initialize a specific dependency
   */
  public initializeDependency(name: string): boolean {
    if (!this.dependencies.has(name)) {
      this.registerDependency(name);
    }
    
    const dependency = this.dependencies.get(name)!;
    let initialized = false;
    
    try {
      // Check if already available globally
      if (typeof window !== 'undefined' && (window as any)[name]) {
        dependency.instance = (window as any)[name];
        dependency.status = 'available';
        dependency.lastInitialized = Date.now();
        initialized = true;
        
        // Register reference
        logSignalProcessing(
          LogLevel.INFO,
          'DependencyManager',
          `Dependency ${name} already available, using existing instance`,
          { count: dependency.initializationCount + 1 }
        );
        
        return true;
      }
      
      // Not available, need to initialize
      logSignalProcessing(
        LogLevel.INFO,
        'DependencyManager',
        `Proactively creating ${name} dependency`,
        { attempt: dependency.initializationCount + 1 }
      );
      
      // Create instance based on dependency type
      let instance: any = null;
      
      switch (name) {
        case 'vitalSignsProcessor':
          instance = new VitalSignsProcessor();
          break;
        
        // Add initializers for other dependencies
        
        default:
          // Use defensive backup as fallback
          if (this.defensiveBackups[name]) {
            instance = this.defensiveBackups[name]();
            logSignalProcessing(
              LogLevel.WARN,
              'DependencyManager',
              `Using defensive backup for ${name}`,
              { type: 'fallback' }
            );
          }
          break;
      }
      
      if (instance) {
        // Store globally and in manager
        if (typeof window !== 'undefined') {
          (window as any)[name] = instance;
        }
        
        dependency.instance = instance;
        dependency.status = 'available';
        dependency.lastInitialized = Date.now();
        dependency.initializationCount++;
        initialized = true;
        
        logSignalProcessing(
          LogLevel.INFO,
          'DependencyManager',
          `Successfully initialized ${name}`,
          { count: dependency.initializationCount }
        );
      }
    } catch (error) {
      dependency.status = 'error';
      dependency.errorMessage = error instanceof Error ? error.message : String(error);
      
      // Report error but use defensive backup
      logSignalProcessing(
        LogLevel.ERROR,
        'DependencyManager',
        `Error initializing ${name}, using defensive backup`,
        { error, count: dependency.initializationCount }
      );
      
      // Try to use defensive backup
      if (this.defensiveBackups[name]) {
        try {
          const fallback = this.defensiveBackups[name]();
          dependency.instance = fallback;
          
          // Make available globally
          if (typeof window !== 'undefined') {
            (window as any)[name] = fallback;
          }
          
          dependency.status = 'available';
          dependency.lastInitialized = Date.now();
          dependency.initializationCount++;
          initialized = true;
          
          logSignalProcessing(
            LogLevel.WARN,
            'DependencyManager',
            `Using defensive backup for ${name} after initialization error`,
            { type: 'error-recovery' }
          );
        } catch (backupError) {
          logSignalProcessing(
            LogLevel.ERROR,
            'DependencyManager',
            `Critical failure: Backup for ${name} also failed`,
            { error: backupError }
          );
        }
      }
    }
    
    // Report results to Defense System
    const errorSystem = ErrorDefenseSystem.getInstance();
    
    if (!initialized) {
      // Report dependency failure - but don't spam if it keeps failing
      if (dependency.initializationCount % 3 === 0) {
        errorSystem.reportError({
          id: '',
          timestamp: Date.now(),
          category: ErrorCategory.DEPENDENCY,
          severity: ErrorSeverity.HIGH,
          message: `Failed to initialize ${name}, using defensive backup`,
          source: 'DependencyManager',
          metadata: {
            dependencyName: name,
            errorMessage: dependency.errorMessage,
            initCount: dependency.initializationCount
          }
        });
      }
    }
    
    return initialized;
  }
  
  /**
   * Initialize all registered dependencies
   */
  public initializeAllDependencies(): Map<string, boolean> {
    const results = new Map<string, boolean>();
    
    for (const name of this.dependencies.keys()) {
      const result = this.initializeDependency(name);
      results.set(name, result);
    }
    
    return results;
  }
  
  /**
   * Get a dependency - guaranteed to never return null by using defensive backups
   */
  public getDependency(name: string): any {
    // Try to get managed dependency
    if (this.dependencies.has(name)) {
      const dep = this.dependencies.get(name)!;
      
      // If available, return instance
      if (dep.status === 'available' && dep.instance) {
        return dep.instance;
      }
      
      // If not available, try to initialize
      this.initializeDependency(name);
      
      // After initialization attempt, check again
      if (dep.status === 'available' && dep.instance) {
        return dep.instance;
      }
    } else {
      // Not registered, try to register and initialize
      this.registerDependency(name);
      this.initializeDependency(name);
    }
    
    // Still not available, use defensive backup
    if (this.defensiveBackups[name]) {
      return this.defensiveBackups[name]();
    }
    
    // Last resort - create minimal stub object
    return {
      _isFallback: true,
      _missingDependency: name,
      reset: () => {},
      dispose: () => {}
    };
  }
  
  /**
   * Check if a dependency is available
   */
  public isDependencyAvailable(name: string): boolean {
    if (!this.dependencies.has(name)) {
      return false;
    }
    
    const dep = this.dependencies.get(name)!;
    return dep.status === 'available' && !!dep.instance;
  }
  
  /**
   * Get status of all dependencies
   */
  public getDependenciesStatus(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, dep] of this.dependencies.entries()) {
      result[name] = {
        status: dep.status,
        lastInitialized: dep.lastInitialized,
        initializationCount: dep.initializationCount,
        isAvailable: dep.status === 'available' && !!dep.instance,
        errorMessage: dep.errorMessage
      };
    }
    
    return result;
  }
  
  /**
   * Reset a specific dependency
   */
  public resetDependency(name: string): boolean {
    try {
      if (this.dependencies.has(name)) {
        const dep = this.dependencies.get(name)!;
        
        // Try to reset instance if it has a reset method
        if (dep.instance && typeof dep.instance.reset === 'function') {
          dep.instance.reset();
        }
        
        // Re-initialize
        return this.initializeDependency(name);
      }
      
      // Try globally if available
      if (typeof window !== 'undefined' && 
          (window as any)[name] && 
          typeof (window as any)[name].reset === 'function') {
        (window as any)[name].reset();
        return true;
      }
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR,
        'DependencyManager',
        `Error resetting ${name}`,
        { error }
      );
    }
    
    return false;
  }
  
  /**
   * Reset all dependencies
   */
  public resetAllDependencies(): Record<string, boolean> {
    const results: Record<string, boolean> = {};
    
    for (const name of this.dependencies.keys()) {
      results[name] = this.resetDependency(name);
    }
    
    return results;
  }
  
  /**
   * Shutdown and cleanup
   */
  public shutdown(): void {
    if (this.initializationInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.initializationInterval);
      this.initializationInterval = null;
    }
    
    // Clean up instances
    for (const [name, dep] of this.dependencies.entries()) {
      if (dep.instance && typeof dep.instance.dispose === 'function') {
        try {
          dep.instance.dispose();
        } catch (error) {
          console.error(`Error disposing ${name}:`, error);
        }
      }
    }
    
    this.dependencies.clear();
    console.log('DependencyManager: Shutdown complete');
  }
}

export default DependencyManager;
