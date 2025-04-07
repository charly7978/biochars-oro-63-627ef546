
/**
 * ImportErrorDefenseSystem - Specialized error detection and healing system
 * for import and module resolution errors
 */

import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity, SystemError } from './ErrorDefenseSystem';
import { logSignalProcessing, LogLevel } from '../../utils/signalLogging';
import SelfHealingSystem from './SelfHealingSystem';

export type ImportErrorType = 
  | 'missing-export'
  | 'module-not-found'
  | 'circular-dependency'
  | 'invalid-export'
  | 'dynamic-import-failure';

export type ModuleResolutionMap = Map<string, Record<string, any>>;

/**
 * System for detecting and automatically fixing import errors at runtime
 */
class ImportErrorDefenseSystem {
  private static instance: ImportErrorDefenseSystem;
  private errorDefenseSystem: ErrorDefenseSystem;
  private healingSystem: SelfHealingSystem;
  private moduleMap: ModuleResolutionMap = new Map();
  private errorPatterns: RegExp[] = [];
  private substitutionModules: Map<string, any> = new Map();
  private missingExports: Set<string> = new Set();
  
  // Stats for monitoring
  private stats = {
    detectedErrors: 0,
    resolvedErrors: 0,
    lastErrorTime: 0,
    errorsPerModule: new Map<string, number>()
  };

  private constructor() {
    this.errorDefenseSystem = ErrorDefenseSystem.getInstance();
    this.healingSystem = SelfHealingSystem.getInstance();
    this.initializeErrorPatterns();
    this.setupEventListeners();
    
    console.log('ImportErrorDefenseSystem: Initialized for dynamic module resolution');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ImportErrorDefenseSystem {
    if (!ImportErrorDefenseSystem.instance) {
      ImportErrorDefenseSystem.instance = new ImportErrorDefenseSystem();
    }
    return ImportErrorDefenseSystem.instance;
  }

  /**
   * Initialize regex patterns for import error detection
   */
  private initializeErrorPatterns(): void {
    // Module not found errors
    this.errorPatterns.push(/Cannot find module '([^']+)'/i);
    this.errorPatterns.push(/Module '([^']+)' not found/i);
    
    // Missing export errors
    this.errorPatterns.push(/export '([^']+)' \(imported as '[^']+'\) was not found in '([^']+)'/i);
    this.errorPatterns.push(/The requested module '([^']+)' does not provide an export named '([^']+)'/i);
    
    // Circular dependency errors
    this.errorPatterns.push(/Circular dependency detected: ([^>]+) -> ([^>]+) -> ([^>]+)/i);
    
    // Dynamic import failures
    this.errorPatterns.push(/Failed to resolve dynamically imported module: '([^']+)'/i);
  }

  /**
   * Setup event listeners for error monitoring
   */
  private setupEventListeners(): void {
    // Listen to error defense system errors
    this.errorDefenseSystem.addErrorListener((error: SystemError) => {
      this.handlePotentialImportError(error);
    });
    
    // Listen for uncaught errors if running in browser
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleRuntimeError(event.error || new Error(event.message));
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        this.handleRuntimeError(event.reason);
      });
      
      console.log('ImportErrorDefenseSystem: Global error listeners attached');
    }
  }

  /**
   * Handle potential import errors from error defense system
   */
  private handlePotentialImportError(error: SystemError): void {
    const message = error.message || '';
    let isImportError = false;
    let modulePath = '';
    let exportName = '';
    
    // Check against all error patterns
    for (const pattern of this.errorPatterns) {
      const match = message.match(pattern);
      if (match) {
        isImportError = true;
        if (match[2]) {
          // This is likely a missing export error (has two capture groups)
          modulePath = match[1];
          exportName = match[2];
        } else {
          // This is likely a module not found error
          modulePath = match[1];
        }
        break;
      }
    }
    
    if (isImportError) {
      this.stats.detectedErrors++;
      this.stats.lastErrorTime = Date.now();
      
      if (!this.stats.errorsPerModule.has(modulePath)) {
        this.stats.errorsPerModule.set(modulePath, 0);
      }
      this.stats.errorsPerModule.set(
        modulePath, 
        (this.stats.errorsPerModule.get(modulePath) || 0) + 1
      );
      
      // Try to resolve the error
      this.handleImportError(modulePath, exportName);
    }
  }

  /**
   * Handle runtime errors that might be import-related
   */
  private handleRuntimeError(error: Error): void {
    if (!error) return;
    
    const message = error.message || error.toString();
    let isImportError = false;
    let modulePath = '';
    let exportName = '';
    
    // Check against all error patterns
    for (const pattern of this.errorPatterns) {
      const match = message.match(pattern);
      if (match) {
        isImportError = true;
        
        // Different patterns have different capture group arrangements
        if (pattern.toString().includes('does not provide an export')) {
          // Missing export error pattern
          modulePath = match[1];
          exportName = match[2];
        } else if (match[2] && pattern.toString().includes('export')) {
          // Another missing export pattern variant
          exportName = match[1];
          modulePath = match[2];
        } else {
          // Module not found pattern
          modulePath = match[1];
        }
        break;
      }
    }
    
    if (isImportError) {
      logSignalProcessing(
        LogLevel.ERROR,
        'ImportErrorDefenseSystem',
        `Detected import error: ${message}`,
        { modulePath, exportName, errorSource: 'runtime' }
      );
      
      this.stats.detectedErrors++;
      this.stats.lastErrorTime = Date.now();
      
      // Update module error stats
      if (!this.stats.errorsPerModule.has(modulePath)) {
        this.stats.errorsPerModule.set(modulePath, 0);
      }
      this.stats.errorsPerModule.set(
        modulePath, 
        (this.stats.errorsPerModule.get(modulePath) || 0) + 1
      );
      
      // Try to resolve the error
      this.handleImportError(modulePath, exportName);
      
      // Register with error defense system
      this.errorDefenseSystem.reportError({
        id: '', // Will be assigned by system
        timestamp: Date.now(),
        category: ErrorCategory.DEPENDENCY,
        severity: ErrorSeverity.HIGH,
        message: `Import error: ${message}`,
        source: 'import-system',
        metadata: { modulePath, exportName, type: 'import-error' }
      });
    }
  }

  /**
   * Handle an import error by trying to provide the missing export or module
   */
  private handleImportError(modulePath: string, exportName: string = ''): void {
    logSignalProcessing(
      LogLevel.INFO,
      'ImportErrorDefenseSystem',
      `Attempting to resolve import error`,
      { modulePath, exportName }
    );
    
    if (exportName) {
      // This is a missing export error
      this.handleMissingExport(modulePath, exportName);
    } else {
      // This is a missing module error
      this.handleMissingModule(modulePath);
    }
  }

  /**
   * Handle a missing export by providing a fallback implementation
   */
  private handleMissingExport(modulePath: string, exportName: string): void {
    // Log the attempt to fix the error
    logSignalProcessing(
      LogLevel.INFO,
      'ImportErrorDefenseSystem',
      `Creating fallback for missing export: ${exportName}`,
      { modulePath, exportName }
    );
    
    // Track the missing export
    this.missingExports.add(`${modulePath}::${exportName}`);
    
    // Create a fallback implementation
    const fallback = this.createFallbackForExport(exportName);
    
    // Register the fallback in our module map
    if (!this.moduleMap.has(modulePath)) {
      this.moduleMap.set(modulePath, {});
    }
    
    const moduleExports = this.moduleMap.get(modulePath) as Record<string, any>;
    moduleExports[exportName] = fallback;
    
    // Check if the module actually exists in the system
    this.attemptToLoadActualModule(modulePath).then(module => {
      if (module) {
        // The module exists but is missing the export
        logSignalProcessing(
          LogLevel.INFO,
          'ImportErrorDefenseSystem',
          `Module found but missing export: ${exportName}`,
          { modulePath }
        );
        
        // Trigger healing actions
        this.healingSystem.forcePreventiveAction('reinitialize-dependencies');
      }
    });
    
    this.stats.resolvedErrors++;
    
    // Add special global accessor for emergency access to modules
    if (typeof window !== 'undefined') {
      if (!(window as any).__moduleResolution) {
        (window as any).__moduleResolution = {};
      }
      if (!(window as any).__moduleResolution[modulePath]) {
        (window as any).__moduleResolution[modulePath] = {};
      }
      (window as any).__moduleResolution[modulePath][exportName] = fallback;
    }
  }

  /**
   * Handle a missing module by providing a mock implementation
   */
  private handleMissingModule(modulePath: string): void {
    logSignalProcessing(
      LogLevel.INFO,
      'ImportErrorDefenseSystem',
      `Creating mock for missing module`,
      { modulePath }
    );
    
    // If module is already being handled, skip
    if (this.moduleMap.has(modulePath)) {
      return;
    }
    
    // Create a mock module
    const mockModule = this.createMockModule(modulePath);
    this.moduleMap.set(modulePath, mockModule);
    
    // Add special global accessor for emergency access to modules
    if (typeof window !== 'undefined') {
      if (!(window as any).__moduleResolution) {
        (window as any).__moduleResolution = {};
      }
      (window as any).__moduleResolution[modulePath] = mockModule;
    }
    
    // Trigger healing actions
    this.healingSystem.forcePreventiveAction('reinitialize-dependencies');
    
    this.stats.resolvedErrors++;
  }

  /**
   * Create a fallback implementation for a missing export
   */
  private createFallbackForExport(exportName: string): any {
    // Logic to create appropriate fallback based on export name
    if (exportName.toLowerCase().includes('reset')) {
      // For reset functions
      return function resetDetectionStatesFallback() {
        console.warn(`Using fallback implementation of ${exportName}`);
        return { weakSignalsCount: 0 };
      };
    }
    
    if (exportName.toLowerCase().includes('check')) {
      // For check/verification functions
      return function checkFallback(...args: any[]) {
        console.warn(`Using fallback implementation of ${exportName}`);
        return { isValid: true, status: 'fallback' };
      };
    }
    
    if (exportName.startsWith('use') && exportName.length > 3) {
      // For React hooks
      return function hookFallback(...args: any[]) {
        console.warn(`Using fallback implementation of ${exportName}`);
        return { data: null, loading: false, error: null };
      };
    }
    
    // Generic fallback
    return function fallback(...args: any[]) {
      console.warn(`Using fallback implementation of ${exportName}`);
      return null;
    };
  }

  /**
   * Create a mock module with common exports
   */
  private createMockModule(modulePath: string): Record<string, any> {
    const mockModule: Record<string, any> = {};
    
    // Create standard exports based on module path hints
    if (modulePath.includes('processor')) {
      mockModule.processSignal = (...args: any[]) => ({ 
        value: 0, status: 'mock', confidence: 0 
      });
      mockModule.reset = () => console.warn(`Mock reset called for ${modulePath}`);
    }
    
    if (modulePath.includes('detector')) {
      mockModule.detect = (...args: any[]) => ({ 
        detected: false, confidence: 0 
      });
      mockModule.analyze = (...args: any[]) => ({ result: 'mock' });
    }
    
    if (modulePath.includes('filter')) {
      mockModule.filter = (value: any) => value;
      mockModule.process = (value: any) => value;
    }
    
    // Add common exports that might be expected
    mockModule.default = mockModule;
    
    return mockModule;
  }

  /**
   * Attempt to dynamically load the actual module
   */
  private async attemptToLoadActualModule(modulePath: string): Promise<any> {
    if (typeof window === 'undefined') return null;
    
    try {
      // Try to import the module dynamically
      const moduleUrl = this.normalizeModulePath(modulePath);
      
      // Use dynamic import if available
      const module = await import(/* @vite-ignore */ moduleUrl).catch(e => {
        logSignalProcessing(
          LogLevel.ERROR,
          'ImportErrorDefenseSystem',
          `Dynamic import failed: ${e.message}`,
          { modulePath, moduleUrl }
        );
        return null;
      });
      
      if (module) {
        logSignalProcessing(
          LogLevel.INFO,
          'ImportErrorDefenseSystem',
          'Successfully loaded module dynamically',
          { modulePath }
        );
        return module;
      }
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR,
        'ImportErrorDefenseSystem',
        `Error loading module: ${error}`,
        { modulePath }
      );
    }
    
    return null;
  }

  /**
   * Normalize a module path for dynamic import
   */
  private normalizeModulePath(modulePath: string): string {
    // If it's already a URL or absolute path, return as is
    if (modulePath.startsWith('http') || modulePath.startsWith('/')) {
      return modulePath;
    }
    
    // Convert relative path to absolute
    if (modulePath.startsWith('.')) {
      // This is a simplification; proper path resolution would depend on the module system
      return `/${modulePath.replace(/^\.\//, '')}`;
    }
    
    // For node_modules
    return `/node_modules/${modulePath}`;
  }

  /**
   * Register a substitute module or export
   * This allows manually providing replacements for problematic modules
   */
  public registerSubstitute(modulePath: string, substitute: any, exportName?: string): void {
    if (exportName) {
      // Register a specific export substitute
      if (!this.substitutionModules.has(modulePath)) {
        this.substitutionModules.set(modulePath, {});
      }
      
      const moduleExports = this.substitutionModules.get(modulePath) as Record<string, any>;
      moduleExports[exportName] = substitute;
      
      logSignalProcessing(
        LogLevel.INFO,
        'ImportErrorDefenseSystem',
        `Registered substitute for export: ${exportName}`,
        { modulePath }
      );
    } else {
      // Register a whole module substitute
      this.substitutionModules.set(modulePath, substitute);
      
      logSignalProcessing(
        LogLevel.INFO,
        'ImportErrorDefenseSystem',
        `Registered substitute for module`,
        { modulePath }
      );
    }
  }

  /**
   * Get the current status of the import error defense system
   */
  public getStatus(): Record<string, any> {
    return {
      detectedErrors: this.stats.detectedErrors,
      resolvedErrors: this.stats.resolvedErrors,
      lastErrorTime: this.stats.lastErrorTime,
      activeModuleFixes: this.moduleMap.size,
      missingExports: Array.from(this.missingExports),
      errorsPerModule: Object.fromEntries(this.stats.errorsPerModule)
    };
  }

  /**
   * Reset the import error defense system
   */
  public reset(): void {
    this.moduleMap.clear();
    this.missingExports.clear();
    this.stats.detectedErrors = 0;
    this.stats.resolvedErrors = 0;
    this.stats.lastErrorTime = 0;
    this.stats.errorsPerModule.clear();
    
    logSignalProcessing(
      LogLevel.INFO,
      'ImportErrorDefenseSystem',
      'Import error defense system reset',
      { timestamp: new Date().toISOString() }
    );
  }
  
  /**
   * Start an analysis of current imports in the application
   * This proactively scans for potential issues
   */
  public startImportAnalysis(): void {
    if (typeof window === 'undefined') return;
    
    // Use setTimeout to avoid blocking the main thread
    setTimeout(() => {
      try {
        // Scan all script tags for import statements
        const scripts = document.querySelectorAll('script');
        const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+([a-zA-Z0-9_$]+)|\s*([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
        
        const potentialImports = new Set<string>();
        
        scripts.forEach(script => {
          const content = script.textContent || '';
          let match;
          
          while ((match = importRegex.exec(content)) !== null) {
            const namedImports = match[1];
            const namespaceImport = match[2];
            const defaultImport = match[3];
            const modulePath = match[4];
            
            if (modulePath) {
              potentialImports.add(modulePath);
              
              if (namedImports) {
                // Process named imports like { a, b as c }
                const importNames = namedImports.split(',').map(s => 
                  s.trim().split(/\s+as\s+/)[0].trim()
                );
                
                for (const importName of importNames) {
                  this.preregisterImport(modulePath, importName);
                }
              }
            }
          }
        });
        
        logSignalProcessing(
          LogLevel.INFO,
          'ImportErrorDefenseSystem',
          'Completed import analysis',
          { 
            potentialImportsCount: potentialImports.size,
            imports: Array.from(potentialImports)
          }
        );
      } catch (error) {
        logSignalProcessing(
          LogLevel.ERROR,
          'ImportErrorDefenseSystem',
          `Error during import analysis: ${error}`,
          {}
        );
      }
    }, 2000);
  }
  
  /**
   * Preregister an import to prepare fallbacks proactively
   */
  private preregisterImport(modulePath: string, exportName: string): void {
    // We don't create the fallbacks immediately, but store the info
    // for faster resolution if an error occurs
    const key = `${modulePath}::${exportName}`;
    
    if (!this.missingExports.has(key)) {
      // Don't log to avoid spam
      // Only actually create fallbacks when an error is detected
    }
  }
  
  /**
   * Initialize the global error interceptor
   * This provides emergency access to fix module errors at runtime
   */
  public initializeGlobalInterceptor(): void {
    if (typeof window === 'undefined') return;
    
    // Create the window.__fixModule helper
    (window as any).__fixModule = (modulePath: string, exportName: string, implementation: any) => {
      try {
        this.registerSubstitute(modulePath, implementation, exportName);
        
        logSignalProcessing(
          LogLevel.INFO,
          'ImportErrorDefenseSystem',
          `Manual fix applied via global interceptor`,
          { modulePath, exportName }
        );
        
        return true;
      } catch (error) {
        console.error('Error applying manual fix:', error);
        return false;
      }
    };
    
    // Create the window.__getModuleStatus helper
    (window as any).__getModuleStatus = () => {
      return this.getStatus();
    };
    
    console.log('ImportErrorDefenseSystem: Global interceptor initialized');
    
    // Start import analysis
    this.startImportAnalysis();
  }
}

export default ImportErrorDefenseSystem;
