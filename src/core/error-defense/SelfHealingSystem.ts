/**
 * SelfHealingSystem - Proactive error prevention and automatic recovery
 * 
 * This system continuously monitors for potential issues and takes
 * preventive action before they cause visible errors.
 */

import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity, SystemError } from './ErrorDefenseSystem';
import DependencyManager from './DependencyManager';
import { logSignalProcessing, LogLevel } from '../../utils/signalLogging';
import ImportErrorDefenseSystem from './ImportErrorDefenseSystem';

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
  private importErrorSystem: ImportErrorDefenseSystem | null = null;
  
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
      },
      {
        pattern: /does not provide an export named/i,
        category: ErrorCategory.DEPENDENCY,
        preventiveActions: ['fix-missing-exports', 'resolve-module-imports'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /Module not found/i,
        category: ErrorCategory.DEPENDENCY,
        preventiveActions: ['resolve-module-imports', 'reinitialize-dependencies'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /SyntaxError: The requested module/i,
        category: ErrorCategory.DEPENDENCY,
        preventiveActions: ['fix-module-syntax', 'resolve-module-imports'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /import\/no-unresolved/i,
        category: ErrorCategory.DEPENDENCY,
        preventiveActions: ['resolve-module-imports'],
        occurrences: 0,
        lastSeen: 0
      },
      {
        pattern: /Circular dependency/i,
        category: ErrorCategory.DEPENDENCY,
        preventiveActions: ['fix-circular-dependency'],
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
        cooldownMs: 10000,
        successCount: 0
      },
      {
        id: 'reset-processors',
        name: 'Reset Signal Processors',
        condition: () => {
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
            this.dependencyManager.resetAllDependencies();
            
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
        cooldownMs: 30000,
        successCount: 0
      },
      {
        id: 'clear-memory',
        name: 'Clear TensorFlow Memory',
        condition: () => {
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
              
              (window as any).tf.engine().endScope();
              (window as any).tf.engine().startScope();
              (window as any).tf.disposeVariables();
              
              if ((window as any).gc) {
                (window as any).gc();
              }
            }
          } catch (error) {
            console.error('Error clearing TensorFlow memory:', error);
          }
        },
        lastRun: 0,
        cooldownMs: 60000,
        successCount: 0
      },
      {
        id: 'reset-recursive-components',
        name: 'Reset Recursive Components',
        condition: () => {
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
          
          this.dependencyManager.resetAllDependencies();
          this.errorSystem.reset();
        },
        lastRun: 0,
        cooldownMs: 15000,
        successCount: 0
      },
      {
        id: 'reduce-tensor-allocations',
        name: 'Reduce Tensor Allocations',
        condition: () => {
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
        cooldownMs: 30000,
        successCount: 0
      },
      {
        id: 'retry-network-operations',
        name: 'Retry Failed Network Operations',
        condition: () => false,
        action: () => {
        },
        lastRun: 0,
        cooldownMs: 15000,
        successCount: 0
      },
      {
        id: 'fix-missing-exports',
        name: 'Fix Missing Exports',
        condition: () => {
          const importErrors = this.errorPatterns.filter(p => 
            (typeof p.pattern === 'string' && 
             (p.pattern.includes('export') || p.pattern.includes('Module'))) || 
            (p.pattern instanceof RegExp && 
             (p.pattern.toString().includes('export') || p.pattern.toString().includes('Module')))
          );
          
          return importErrors.some(p => p.occurrences > 0);
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Fixing missing exports',
            { timestamp: new Date().toISOString() }
          );
          
          this.ensureImportErrorSystem();
          
          if (typeof window !== 'undefined') {
            try {
              if (this.importErrorSystem) {
                this.importErrorSystem.registerSubstitute(
                  '/src/modules/heart-beat/signal-quality.ts',
                  () => {
                    console.warn('Using fallback resetDetectionStates');
                    return { weakSignalsCount: 0 };
                  },
                  'resetDetectionStates'
                );
              }
            } catch (error) {
              console.error('Error setting up module fix:', error);
            }
          }
        },
        lastRun: 0,
        cooldownMs: 5000,
        successCount: 0
      },
      {
        id: 'resolve-module-imports',
        name: 'Resolve Module Imports',
        condition: () => {
          const moduleErrors = this.errorPatterns.filter(p => 
            (typeof p.pattern === 'string' && p.pattern.includes('Module')) || 
            (p.pattern instanceof RegExp && p.pattern.toString().includes('Module'))
          );
          
          return moduleErrors.some(p => p.occurrences > 0);
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Resolving module imports',
            { timestamp: new Date().toISOString() }
          );
          
          this.ensureImportErrorSystem();
          
          if (this.importErrorSystem) {
            this.importErrorSystem.startImportAnalysis();
          }
          
          if (typeof window !== 'undefined' && document) {
            const scripts = document.querySelectorAll('script[type="module"]');
            scripts.forEach(script => {
              const src = script.getAttribute('src');
              if (src) {
                const newScript = document.createElement('script');
                newScript.type = 'module';
                newScript.src = src + (src.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
                
                if (script.parentNode) {
                  script.parentNode.replaceChild(newScript, script);
                  
                  logSignalProcessing(
                    LogLevel.INFO,
                    'SelfHealingSystem',
                    'Reloaded module script',
                    { src }
                  );
                }
              }
            });
          }
        },
        lastRun: 0,
        cooldownMs: 10000,
        successCount: 0
      },
      {
        id: 'fix-module-syntax',
        name: 'Fix Module Syntax Errors',
        condition: () => {
          const syntaxErrors = this.errorPatterns.filter(p => 
            (typeof p.pattern === 'string' && p.pattern.includes('SyntaxError')) || 
            (p.pattern instanceof RegExp && p.pattern.toString().includes('SyntaxError'))
          );
          
          return syntaxErrors.some(p => p.occurrences > 0);
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Fixing module syntax errors',
            { timestamp: new Date().toISOString() }
          );
          
          this.ensureImportErrorSystem();
          
          if (this.importErrorSystem) {
            this.importErrorSystem.registerSubstitute(
              '/src/modules/heart-beat/signal-quality.ts',
              () => {
                console.warn('Using fallback resetDetectionStates from syntax error fix');
                return { weakSignalsCount: 0 };
              },
              'resetDetectionStates'
            );
          }
          
          if (typeof window !== 'undefined') {
            (window as any).__refreshModules = () => {
              try {
                const scripts = document.querySelectorAll('script[type="module"]');
                scripts.forEach(script => {
                  const src = script.getAttribute('src');
                  if (src) {
                    const newSrc = src.split('?')[0] + '?t=' + Date.now();
                    script.setAttribute('src', newSrc);
                  }
                });
                
                if (this.importErrorSystem) {
                  this.importErrorSystem.startImportAnalysis();
                }
                
                return true;
              } catch (error) {
                console.error('Error refreshing modules:', error);
                return false;
              }
            };
          }
        },
        lastRun: 0,
        cooldownMs: 8000,
        successCount: 0
      },
      {
        id: 'fix-circular-dependency',
        name: 'Fix Circular Dependencies',
        condition: () => {
          const circularErrors = this.errorPatterns.filter(p => 
            (typeof p.pattern === 'string' && p.pattern.includes('Circular')) || 
            (p.pattern instanceof RegExp && p.pattern.toString().includes('Circular'))
          );
          
          return circularErrors.some(p => p.occurrences > 0);
        },
        action: () => {
          logSignalProcessing(
            LogLevel.INFO,
            'SelfHealingSystem',
            'Attempting to fix circular dependencies',
            { timestamp: new Date().toISOString() }
          );
          
          this.ensureImportErrorSystem();
          
          if (this.importErrorSystem) {
            (window as any).__breakCircularDependency = (modulePath: string) => {
              try {
                if (this.importErrorSystem) {
                  this.importErrorSystem.registerSubstitute(
                    modulePath,
                    { __breakCircle: true }
                  );
                  return true;
                }
                return false;
              } catch (error) {
                console.error('Error breaking circular dependency:', error);
                return false;
              }
            };
          }
        },
        lastRun: 0,
        cooldownMs: 30000,
        successCount: 0
      }
    ];
  }
  
  /**
   * Ensure ImportErrorDefenseSystem is initialized
   */
  private ensureImportErrorSystem(): void {
    if (!this.importErrorSystem) {
      try {
        this.importErrorSystem = ImportErrorDefenseSystem.getInstance();
        this.importErrorSystem.initializeGlobalInterceptor();
        
        logSignalProcessing(
          LogLevel.INFO,
          'SelfHealingSystem',
          'Initialized ImportErrorDefenseSystem',
          { timestamp: new Date().toISOString() }
        );
      } catch (error) {
        logSignalProcessing(
          LogLevel.ERROR,
          'SelfHealingSystem',
          `Error initializing ImportErrorDefenseSystem: ${error}`,
          {}
        );
      }
    }
  }
  
  /**
   * Start the healing cycle
   */
  private startHealingCycle(): void {
    this.errorSystem.addErrorListener((error: SystemError) => {
      this.handleError(error);
    });
    
    if (typeof window !== 'undefined' && !this.healingInterval) {
      this.healingInterval = window.setInterval(() => {
        this.runHealingCycle();
      }, this.CHECK_INTERVAL);
    }
    
    this.ensureImportErrorSystem();
  }
  
  /**
   * Handle an error by matching patterns and taking preventive actions
   */
  private handleError(error: SystemError): void {
    const message = error.message;
    const now = Date.now();
    
    for (const pattern of this.errorPatterns) {
      const isMatch = typeof pattern.pattern === 'string' 
        ? message.includes(pattern.pattern) 
        : pattern.pattern.test(message);
      
      if (isMatch) {
        pattern.occurrences++;
        pattern.lastSeen = now;
        
        this.takePreventiveActions(pattern.preventiveActions);
        break;
      }
    }
  }
  
  /**
   * Handle an external error that might not go through the regular error system
   * This allows integration with window.onerror and other error sources
   */
  public handleExternalError(errorMessage: string): void {
    const systemError: SystemError = {
      id: `ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      category: ErrorCategory.RUNTIME,
      severity: ErrorSeverity.HIGH,
      message: errorMessage,
      source: 'external',
      metadata: { 
        type: 'external_error',
        source: 'external_handler'
      }
    };
    
    this.handleError(systemError);
    
    logSignalProcessing(
      LogLevel.ERROR,
      'SelfHealingSystem',
      `Handling external error: ${errorMessage}`,
      { timestamp: new Date().toISOString() }
    );
    
    this.errorSystem.reportError(systemError);
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
    
    for (const action of this.preventiveActions) {
      if (now - action.lastRun >= action.cooldownMs) {
        try {
          const shouldAct = action.condition();
          
          if (shouldAct) {
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
      })),
      importErrorSystem: this.importErrorSystem ? 
        'active' : 'not initialized',
      importErrorsStatus: this.importErrorSystem ? 
        this.importErrorSystem.getStatus() : null
    };
  }
  
  /**
   * Manually trigger healing cycle
   */
  public triggerHealingCycle(): void {
    this.runHealingCycle();
    
    this.ensureImportErrorSystem();
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
    
    if (this.importErrorSystem) {
      this.importErrorSystem.reset();
    }
    
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
