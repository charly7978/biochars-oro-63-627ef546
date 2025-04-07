
/**
 * SelfHealingSystem - Proactive error prevention and automatic recovery
 * 
 * This system continuously monitors for potential issues and takes
 * preventive action before they cause visible errors.
 */

import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity, SystemError } from './ErrorDefenseSystem';
import DependencyManager from './DependencyManager';
import { logSignalProcessing, LogLevel } from '../../utils/signalLogging';

// Preventive Actions
type PreventiveAction = {
  id: string;
  name: string;
  condition: () => boolean;
  action: () => void;
  lastRun: number;
  cooldownMs: number;
  successCount: number;
};

// Error Pattern
type ErrorPattern = {
  pattern: RegExp | string;
  category: ErrorCategory;
  preventiveActions: string[];
  occurrences: number;
  lastSeen: number;
};

class SelfHealingSystem {
  private static instance: SelfHealingSystem;
  private healingInterval: number | null = null;
  private readonly CHECK_INTERVAL = 5000; // 5 seconds
  
  // System health metrics
  private healthMetrics = {
    lastHealingCycle: 0,
    healingCycles: 0,
    preventedIssues: 0,
    recoveredErrors: 0,
    failedRecoveries: 0,
  };
  
  // Known error patterns and preventive actions
  private errorPatterns: ErrorPattern[] = [];
  private preventiveActions: PreventiveAction[] = [];
  
  // Dependencies
  private dependencyManager: DependencyManager;
  private errorSystem: ErrorDefenseSystem;
  
  private constructor() {
    this.dependencyManager = DependencyManager.getInstance();
    this.errorSystem = ErrorDefenseSystem.getInstance();
    
    this.initializeErrorPatterns();
    this.initializePreventiveActions();
    this.startHealingCycle();
    
    console.log('SelfHealingSystem: Initialized for proactive error prevention');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): SelfHealingSystem {
    if (!SelfHealingSystem.instance) {
      SelfHealingSystem.instance = new SelfHealingSystem();
    }
    return SelfHealingSystem.instance;
  }
  
  /**
   * Initialize known error patterns to watch for
   */
  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      {
        pattern: /Dependencia no disponible/i,
        category: ErrorCategory.DEPENDENCY,
        preventiveActions: ['reinitialize-dependencies'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /Cannot read properties of (undefined|null)/i,
        category: ErrorCategory.RUNTIME,
        preventiveActions: ['reset-processors', 'clear-memory'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /Maximum call stack size exceeded/i,
        category: ErrorCategory.RUNTIME,
        preventiveActions: ['reset-recursive-components'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /memory|out of memory|allocation failed/i,
        category: ErrorCategory.PERFORMANCE,
        preventiveActions: ['clear-memory', 'reduce-tensor-allocations'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /Failed to fetch|NetworkError|CORS|network request failed/i,
        category: ErrorCategory.OPERATIONAL,
        preventiveActions: ['retry-network-operations'],
        occurrences: 0,
        lastSeen: 0
      }
    ];
  }
  
  /**
   * Initialize preventive actions
   */
  private initializePreventiveActions(): void {
    this.preventiveActions = [
      {
        id: 'reinitialize-dependencies',
        name: 'Reinitialize System Dependencies',
        condition: () => {
          // Check if any critical dependencies are missing
          const criticalDeps = ['vitalSignsProcessor', 'signalProcessor', 'heartBeatProcessor'];
          return criticalDeps.some(dep => !this.dependencyManager.isDependencyAvailable(dep));
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Proactively reinitializing dependencies',
            { timestamp: new Date().toISOString() }
          );
          
          this.dependencyManager.initializeAllDependencies();
        },
        lastRun: 0,
        cooldownMs: 10000, // 10 seconds
        successCount: 0
      },
      {
        id: 'reset-processors',
        name: 'Reset Signal Processors',
        condition: () => {
          // Check for error symptoms in the system status
          const status = this.errorSystem.getSystemStatus();
          return !status.isHealthy || status.recentErrors.high > 0;
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Proactively resetting signal processors',
            { timestamp: new Date().toISOString() }
          );
          
          try {
            // Reset all processing components
            this.dependencyManager.resetAllDependencies();
            
            // Clear local storage entries that might be corrupted
            if (typeof window !== 'undefined' && window.localStorage) {
              const keysToRemove = [
                'signal_processor_state',
                'vital_signs_state',
                'arrhythmia_detection_state'
              ];
              
              keysToRemove.forEach(key => {
                try {
                  localStorage.removeItem(key);
                } catch (e) {
                  console.error(`Error clearing ${key} from localStorage:`, e);
                }
              });
            }
          } catch (error) {
            console.error('Error during processor reset:', error);
          }
        },
        lastRun: 0,
        cooldownMs: 30000, // 30 seconds
        successCount: 0
      },
      {
        id: 'clear-memory',
        name: 'Clear TensorFlow Memory',
        condition: () => {
          // Check if TensorFlow is available
          return typeof window !== 'undefined' && !!(window as any).tf;
        },
        action: () => {
          try {
            if (typeof window !== 'undefined' && (window as any).tf) {
              logSignalProcessing(
                LogLevel.INFO,
                'SelfHealingSystem',
                'Proactively clearing TensorFlow memory',
                { timestamp: new Date().toISOString() }
              );
              
              // Release tensors
              (window as any).tf.engine().endScope();
              (window as any).tf.engine().startScope();
              (window as any).tf.disposeVariables();
              
              // Force garbage collection if available
              if ((window as any).gc) {
                (window as any).gc();
              }
            }
          } catch (error) {
            console.error('Error clearing TensorFlow memory:', error);
          }
        },
        lastRun: 0,
        cooldownMs: 60000, // 1 minute
        successCount: 0
      },
      {
        id: 'reset-recursive-components',
        name: 'Reset Recursive Components',
        condition: () => {
          // Check for stack overflow error symptoms
          const status = this.errorSystem.getSystemStatus();
          return status.recentErrors.critical > 0;
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Breaking potential infinite recursion',
            { timestamp: new Date().toISOString() }
          );
          
          // Reset the system components that might be causing recursion
          this.dependencyManager.resetAllDependencies();
          this.errorSystem.reset();
        },
        lastRun: 0,
        cooldownMs: 15000, // 15 seconds
        successCount: 0
      },
      {
        id: 'reduce-tensor-allocations',
        name: 'Reduce Tensor Allocations',
        condition: () => {
          // Check for memory pressure
          return typeof window !== 'undefined' && 
                 (window as any).tf && 
                 (window as any).tf.memory && 
                 (window as any).tf.memory().numTensors > 1000;
        },
        action: () => {
          try {
            if (typeof window !== 'undefined' && (window as any).tf) {
              const memBefore = (window as any).tf.memory();
              
              logSignalProcessing(
                LogLevel.INFO,
                'SelfHealingSystem',
                'Reducing tensor allocations',
                { 
                  before: memBefore.numTensors,
                  timestamp: new Date().toISOString() 
                }
              );
              
              // Force tensor cleanup
              (window as any).tf.disposeVariables();
              (window as any).tf.engine().endScope();
              (window as any).tf.engine().startScope();
              
              const memAfter = (window as any).tf.memory();
              
              logSignalProcessing(
                LogLevel.INFO,
                'SelfHealingSystem',
                'Tensor allocations reduced',
                { 
                  before: memBefore.numTensors,
                  after: memAfter.numTensors,
                  reduction: memBefore.numTensors - memAfter.numTensors
                }
              );
            }
          } catch (error) {
            console.error('Error reducing tensor allocations:', error);
          }
        },
        lastRun: 0,
        cooldownMs: 30000, // 30 seconds
        successCount: 0
      },
      {
        id: 'retry-network-operations',
        name: 'Retry Failed Network Operations',
        condition: () => false, // Placeholder for network retry logic
        action: () => {
          // Placeholder for network retry logic
        },
        lastRun: 0,
        cooldownMs: 15000, // 15 seconds
        successCount: 0
      }
    ];
  }
  
  /**
   * Start the healing cycle
   */
  private startHealingCycle(): void {
    // Register with the error system to monitor errors
    this.errorSystem.addErrorListener((error: SystemError) => {
      this.handleError(error);
    });
    
    // Start periodic healing cycle
    if (typeof window !== 'undefined' && !this.healingInterval) {
      this.healingInterval = window.setInterval(() => {
        this.runHealingCycle();
      }, this.CHECK_INTERVAL);
    }
  }
  
  /**
   * Handle an error by matching patterns and taking preventive actions
   */
  private handleError(error: SystemError): void {
    const message = error.message;
    const now = Date.now();
    
    // Match against known patterns
    for (const pattern of this.errorPatterns) {
      const isMatch = typeof pattern.pattern === 'string' 
        ? message.includes(pattern.pattern) 
        : pattern.pattern.test(message);
      
      if (isMatch) {
        // Update pattern statistics
        pattern.occurrences++;
        pattern.lastSeen = now;
        
        // Take preventive actions for this pattern
        this.takePreventiveActions(pattern.preventiveActions);
        break;
      }
    }
  }
  
  /**
   * Take specified preventive actions
   */
  private takePreventiveActions(actionIds: string[]): void {
    const now = Date.now();
    
    for (const actionId of actionIds) {
      const action = this.preventiveActions.find(a => a.id === actionId);
      
      if (action && now - action.lastRun >= action.cooldownMs) {
        try {
          // Run the action
          action.action();
          action.lastRun = now;
          action.successCount++;
          this.healthMetrics.preventedIssues++;
          
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            `Executed preventive action: ${action.name}`,
            { 
              actionId,
              successCount: action.successCount,
              timestamp: new Date(now).toISOString()
            }
          );
        } catch (error) {
          logSignalProcessing(
            LogLevel.ERROR,
            'SelfHealingSystem',
            `Error in preventive action: ${action.name}`,
            { actionId, error }
          );
        }
      }
    }
  }
  
  /**
   * Run a complete healing cycle
   */
  private runHealingCycle(): void {
    const now = Date.now();
    this.healthMetrics.lastHealingCycle = now;
    this.healthMetrics.healingCycles++;
    
    // Check conditions for all preventive actions
    for (const action of this.preventiveActions) {
      if (now - action.lastRun >= action.cooldownMs) {
        try {
          // Check if action should be taken
          const shouldAct = action.condition();
          
          if (shouldAct) {
            // Take action
            action.action();
            action.lastRun = now;
            action.successCount++;
            this.healthMetrics.preventedIssues++;
            
            logSignalProcessing(
              LogLevel.INFO,
              'SelfHealingSystem',
              `Proactive healing: ${action.name}`,
              { 
                actionId: action.id,
                cycle: this.healthMetrics.healingCycles,
                timestamp: new Date(now).toISOString()
              }
            );
          }
        } catch (error) {
          logSignalProcessing(
            LogLevel.ERROR,
            'SelfHealingSystem',
            `Error in healing cycle: ${action.name}`,
            { actionId: action.id, error }
          );
        }
      }
    }
  }
  
  /**
   * Get health metrics
   */
  public getHealthMetrics(): any {
    return {
      ...this.healthMetrics,
      errorPatterns: this.errorPatterns.map(p => ({
        pattern: typeof p.pattern === 'string' ? p.pattern : p.pattern.source,
        occurrences: p.occurrences,
        lastSeen: p.lastSeen > 0 ? new Date(p.lastSeen).toISOString() : 'never'
      })),
      preventiveActions: this.preventiveActions.map(a => ({
        id: a.id,
        name: a.name,
        successCount: a.successCount,
        lastRun: a.lastRun > 0 ? new Date(a.lastRun).toISOString() : 'never'
      }))
    };
  }
  
  /**
   * Manually trigger healing cycle
   */
  public triggerHealingCycle(): void {
    this.runHealingCycle();
  }
  
  /**
   * Force specific preventive action
   */
  public forcePreventiveAction(actionId: string): boolean {
    const action = this.preventiveActions.find(a => a.id === actionId);
    
    if (action) {
      try {
        action.action();
        action.lastRun = Date.now();
        action.successCount++;
        this.healthMetrics.preventedIssues++;
        return true;
      } catch (error) {
        logSignalProcessing(
          LogLevel.ERROR,
          'SelfHealingSystem',
          `Error forcing preventive action: ${action.name}`,
          { actionId, error }
        );
      }
    }
    
    return false;
  }
  
  /**
   * Reset the healing system
   */
  public reset(): void {
    for (const pattern of this.errorPatterns) {
      pattern.occurrences = 0;
      pattern.lastSeen = 0;
    }
    
    for (const action of this.preventiveActions) {
      action.lastRun = 0;
      action.successCount = 0;
    }
    
    this.healthMetrics.preventedIssues = 0;
    this.healthMetrics.recoveredErrors = 0;
    this.healthMetrics.failedRecoveries = 0;
    
    logSignalProcessing(
      LogLevel.INFO,
      'SelfHealingSystem',
      'Self-healing system reset',
      { timestamp: new Date().toISOString() }
    );
  }
  
  /**
   * Shutdown and cleanup
   */
  public shutdown(): void {
    if (this.healingInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.healingInterval);
      this.healingInterval = null;
    }
    
    console.log('SelfHealingSystem: Shutdown complete');
  }
}

export default SelfHealingSystem;
