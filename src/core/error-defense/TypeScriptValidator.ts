
/**
 * TypeScriptValidator - Provides real-time validation of TypeScript code
 * to catch errors before they become runtime issues
 */

import ErrorDefenseSystem, { ErrorCategory, ErrorSeverity } from './ErrorDefenseSystem';

interface ValidationResult {
  passed: boolean;
  message: string;
  severity: 'warning' | 'error' | 'critical';
  location?: {
    line: number;
    column: number;
  };
  code?: string;
  suggestion?: string;
}

// Simple type definitions for IDE integration
interface EditorState {
  filePath: string;
  content: string;
  selection?: {
    start: { line: number, column: number },
    end: { line: number, column: number }
  };
}

class TypeScriptValidator {
  private static instance: TypeScriptValidator;
  private patterns: Array<{
    pattern: RegExp;
    message: string;
    severity: 'warning' | 'error' | 'critical';
    suggestion?: string;
  }> = [];
  
  private constructor() {
    this.initializePatterns();
  }
  
  public static getInstance(): TypeScriptValidator {
    if (!TypeScriptValidator.instance) {
      TypeScriptValidator.instance = new TypeScriptValidator();
    }
    return TypeScriptValidator.instance;
  }
  
  private initializePatterns(): void {
    // React/JSX patterns
    this.patterns = [
      {
        pattern: /useState\([^)]*\)\s*(?!\s*const\s*\[)/g, 
        message: "useState result should be destructured with const",
        severity: 'warning',
        suggestion: "const [value, setValue] = useState(initialValue)"
      },
      {
        pattern: /<([A-Z][A-Za-z0-9]*)\s+[^>]*>(?:(?!<\/\1>).)*$/gm,
        message: "JSX tag is not closed properly",
        severity: 'error',
        suggestion: "Ensure all JSX tags are properly closed"
      },
      {
        pattern: /props\.children(?!\s*as\s*)/g,
        message: "props.children should be typed explicitly",
        severity: 'warning',
        suggestion: "children: ReactNode in your props interface"
      },
      {
        pattern: /useEffect\([^,)]*\)/g,
        message: "useEffect missing dependency array",
        severity: 'warning',
        suggestion: "useEffect(() => { ... }, [])"
      },
      
      // TypeScript patterns
      {
        pattern: /:\s*any\b/g,
        message: "Avoid using 'any' type",
        severity: 'warning',
        suggestion: "Use a more specific type or unknown"
      },
      {
        pattern: /\(\s*\)\s*=>\s*{\s*}/g,
        message: "Empty arrow function",
        severity: 'warning',
        suggestion: "Implement the function or use a meaningful default"
      },
      {
        pattern: /as\s+any/g,
        message: "Type assertion to 'any' should be avoided",
        severity: 'warning',
        suggestion: "Use a more specific type assertion or type guard"
      },
      
      // Import patterns
      {
        pattern: /import\s+{[^}]*}\s+from\s+['"](?:\.\/|\.\.\/)[^'"]*['"]/g,
        message: "Check import path",
        severity: 'warning',
        suggestion: "Verify that the imported file exists at this path"
      },
      {
        pattern: /import\s+(?:{[^}]*})?\s*from\s*['"][^'"]*\.jsx?['"];/g,
        message: "Importing from .js/.jsx file in TypeScript project",
        severity: 'warning',
        suggestion: "Consider using .ts/.tsx files for consistency"
      },
      
      // Potential bug patterns
      {
        pattern: /(?:if|for|while)\s*\([^)]*\)\s*(?!{)/g,
        message: "Control statement without block",
        severity: 'warning',
        suggestion: "Use {} blocks with control statements for clarity"
      },
      {
        pattern: /===\s*undefined/g,
        message: "Consider using optional chaining or nullish coalescing",
        severity: 'warning',
        suggestion: "Use obj?.prop or obj ?? defaultValue"
      },
      {
        pattern: /!==\s*null\s*&&\s*[^&\n]+!==\s*undefined/g,
        message: "Consider using optional chaining",
        severity: 'warning',
        suggestion: "Use obj?.prop instead of obj !== null && obj !== undefined && obj.prop"
      },
      
      // Performance patterns
      {
        pattern: /useCallback\(\s*\(\)\s*=>\s*{\s*(?:setInterval|setTimeout)\(/g,
        message: "Timer inside useCallback without cleanup",
        severity: 'warning',
        suggestion: "Remember to clear timer with clearTimeout/clearInterval"
      },
      {
        pattern: /new\s+Array\(\d+\)/g,
        message: "Using new Array() constructor",
        severity: 'warning',
        suggestion: "Consider using array literal [] syntax"
      },
      
      // Security patterns
      {
        pattern: /dangerouslySetInnerHTML/g,
        message: "Using dangerouslySetInnerHTML - security risk",
        severity: 'error',
        suggestion: "Avoid using dangerouslySetInnerHTML when possible"
      },
      {
        pattern: /eval\(/g,
        message: "Using eval() - security risk",
        severity: 'critical',
        suggestion: "Avoid using eval - it's a security risk"
      }
    ];
  }
  
  /**
   * Validate TypeScript code
   */
  public validateCode(code: string, filePath: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Apply all patterns
    for (const { pattern, message, severity, suggestion } of this.patterns) {
      // Reset regex lastIndex to ensure proper matching
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(code)) !== null) {
        // Calculate line and column position
        const upToMatch = code.substring(0, match.index);
        const lines = upToMatch.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        
        results.push({
          passed: false,
          message,
          severity,
          location: { line, column },
          code: match[0],
          suggestion
        });
      }
    }
    
    // Report critical issues to error defense system
    const criticalIssues = results.filter(r => r.severity === 'critical');
    if (criticalIssues.length > 0) {
      const errorSystem = ErrorDefenseSystem.getInstance();
      
      criticalIssues.forEach(issue => {
        errorSystem.reportError({
          id: '',
          timestamp: Date.now(),
          category: ErrorCategory.CODE_QUALITY,
          severity: ErrorSeverity.HIGH,
          message: `Code Guardian: ${issue.message} in ${filePath}`,
          source: 'TypeScriptValidator',
          metadata: {
            filePath,
            line: issue.location?.line,
            column: issue.location?.column,
            code: issue.code
          }
        });
      });
    }
    
    return results;
  }
  
  /**
   * Process editor state in real-time
   * This would be called by IDE extensions
   */
  public validateEditorState(state: EditorState): ValidationResult[] {
    return this.validateCode(state.content, state.filePath);
  }
  
  /**
   * Get message templates for common TypeScript errors
   */
  public getSuggestionTemplates(): Array<{
    error: string;
    suggestion: string;
  }> {
    return this.patterns.map(p => ({
      error: p.pattern.toString(),
      suggestion: p.suggestion || p.message
    }));
  }
}

export default TypeScriptValidator;
