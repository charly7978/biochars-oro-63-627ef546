
/**
 * useCodeGuardian - React hook for integrating Code Guardian validation
 * into components and tools without showing information to the user
 */

import { useState, useEffect, useCallback } from 'react';
import DependencyManager from '../core/error-defense/DependencyManager';

export interface ValidationIssue {
  id: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
  affectedFiles?: string[];
  rule: string;
  suggestions?: string[];
  timestamp: number;
}

export function useCodeGuardian(options: { autoValidate?: boolean; silent?: boolean } = {}) {
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidated, setLastValidated] = useState<number | null>(null);
  
  // Siempre operamos en modo silencioso como solicitó el usuario
  const opts = {
    autoValidate: options.autoValidate ?? true,
    silent: true // Forzar modo silencioso siempre
  };
  
  // Get dependency manager instance
  const dependencyManager = DependencyManager.getInstance();
  
  // Transform validation results to issues
  const transformResults = useCallback((results: any[]) => {
    return results
      .filter(r => !r.passed)
      .map((result, index) => ({
        id: `validation-${Date.now()}-${index}`,
        message: result.message,
        severity: result.severity,
        affectedFiles: result.affectedFiles || [],
        rule: result.rule || 'unknown-rule',
        suggestions: result.suggestion ? [result.suggestion] : [],
        timestamp: Date.now()
      }));
  }, []);
  
  // Run validation manually
  const runValidation = useCallback(() => {
    setIsValidating(true);
    
    try {
      const results = dependencyManager.validateCodebase();
      const issues = transformResults(results);
      setValidationIssues(issues);
      setLastValidated(Date.now());
      
      // Solo log a consola, invisible para el usuario
      if (issues.length > 0) {
        console.warn('Code Guardian found issues:', issues);
      }
      
      return issues;
    } catch (error) {
      console.error('Error during code validation:', error);
      return [];
    } finally {
      setIsValidating(false);
    }
  }, [dependencyManager, transformResults]);
  
  // Validate code changes before commit
  const validateChanges = useCallback((changedFiles: string[], additions: Record<string, string[]>, removals: Record<string, string[]>) => {
    setIsValidating(true);
    
    try {
      const results = dependencyManager.validateCodeChanges(changedFiles, additions, removals);
      const issues = transformResults(results);
      
      if (issues.length > 0) {
        setValidationIssues(prev => [...prev, ...issues]);
        setLastValidated(Date.now());
        
        // Solo log a consola, invisible para el usuario
        console.warn('Code Guardian found issues in changes:', issues);
      }
      
      return issues.length === 0;
    } catch (error) {
      console.error('Error validating changes:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [dependencyManager, transformResults]);
  
  // Validate TypeScript code
  const validateTypeScript = useCallback((code: string, filePath: string) => {
    try {
      const results = dependencyManager.validateTypeScript(code, filePath);
      const issues = transformResults(results);
      
      if (issues.length > 0) {
        setValidationIssues(prev => [...prev, ...issues]);
        
        // Solo log a consola, invisible para el usuario
        console.warn(`Code Guardian found TypeScript issues in ${filePath}:`, issues);
      }
      
      return issues;
    } catch (error) {
      console.error('Error validating TypeScript:', error);
      return [];
    }
  }, [dependencyManager, transformResults]);
  
  // Auto-validate on mount if enabled
  useEffect(() => {
    if (opts.autoValidate) {
      runValidation();
    }
  }, [opts.autoValidate, runValidation]);
  
  return {
    validationIssues,
    isValidating,
    lastValidated,
    runValidation,
    validateChanges,
    validateTypeScript,
    clearIssues: () => setValidationIssues([]),
    dismissIssue: (id: string) => setValidationIssues(prev => prev.filter(issue => issue.id !== id))
  };
}

export default useCodeGuardian;
