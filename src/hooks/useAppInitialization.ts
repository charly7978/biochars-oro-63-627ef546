
/**
 * Hook for initializing critical application systems
 * with improved error prevention and recovery
 */

import { useEffect } from 'react';
import ErrorDefenseSystem from '../core/error-defense/ErrorDefenseSystem';
import { ErrorCategory, ErrorSeverity } from '../core/error-defense/ErrorDefenseSystem';
import DependencyManager from '../core/error-defense/DependencyManager';
import SelfHealingSystem from '../core/error-defense/SelfHealingSystem';
import { logSignalProcessing, LogLevel } from '../utils/signalLogging';

export function useAppInitialization() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing application systems...');
        
        // Initialize in correct order to prevent dependency issues
        
        // 1. First initialize error defense system
        const errorSystem = ErrorDefenseSystem.getInstance();
        console.log('ErrorDefenseSystem initialized');
        
        // 2. Initialize dependency manager
        const dependencyManager = DependencyManager.getInstance();
        console.log('DependencyManager initialized');
        
        // 3. Initialize self-healing system
        const healingSystem = SelfHealingSystem.getInstance();
        console.log('SelfHealingSystem initialized');
        
        // 4. Verify all critical dependencies
        const dependencyResults = await dependencyManager.initializeAllDependencies();
        logSignalProcessing(
          LogLevel.INFO,
          'AppInitialization',
          'Critical dependencies initialized',
          { results: Object.fromEntries(dependencyResults) }
        );
        
        // 5. Initial self-healing cycle
        healingSystem.triggerHealingCycle();
        
        console.log('Application initialization complete');
      } catch (error) {
        console.error('Error during application initialization:', error);
        
        // Report to error system
        const errorSystem = ErrorDefenseSystem.getInstance();
        errorSystem.reportError({
          id: '',
          timestamp: Date.now(),
          category: ErrorCategory.OPERATIONAL,
          severity: ErrorSeverity.HIGH,
          message: 'Error during application initialization',
          source: 'AppInitialization',
          stack: error instanceof Error ? error.stack : undefined,
          metadata: { error: String(error) }
        });
      }
    };
    
    initializeApp();
    
    return () => {
      // Shutdown systems in reverse order
      if (typeof SelfHealingSystem !== 'undefined') {
        const healingSystem = SelfHealingSystem.getInstance();
        healingSystem.shutdown();
      }
      
      if (typeof DependencyManager !== 'undefined') {
        const dependencyManager = DependencyManager.getInstance();
        dependencyManager.shutdown();
      }
      
      console.log('Application systems shutdown complete');
    };
  }, []);
  
  return {
    isInitialized: true
  };
}
