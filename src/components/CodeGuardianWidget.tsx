
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck, FileWarning, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useCodeGuardian, { ValidationIssue } from '@/hooks/useCodeGuardian';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeGuardianWidgetProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoValidate?: boolean;
  minimal?: boolean;
}

/**
 * CodeGuardianWidget - UI component that shows code validation issues
 * and provides suggestions before they become problems
 */
export function CodeGuardianWidget({ 
  position = 'bottom-right',
  autoValidate = true,
  minimal = false
}: CodeGuardianWidgetProps) {
  const {
    validationIssues,
    isValidating,
    lastValidated,
    runValidation,
    clearIssues,
    dismissIssue
  } = useCodeGuardian({ autoValidate });
  
  const [isOpen, setIsOpen] = useState(false);
  const hasIssues = validationIssues.length > 0;
  
  // Auto-open when there are critical issues
  useEffect(() => {
    const hasCritical = validationIssues.some(issue => issue.severity === 'critical');
    if (hasCritical && !minimal) {
      setIsOpen(true);
    }
  }, [validationIssues, minimal]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  }[position];
  
  // Render minimal indicator when collapsed
  if (minimal && !isOpen) {
    return (
      <div 
        className={`fixed ${positionClasses} z-50 flex flex-col items-end`}
      >
        <Button 
          variant="outline"
          size="sm"
          className={`rounded-full px-2 shadow-md flex items-center gap-1 ${
            hasIssues ? 'bg-amber-50 text-amber-700 border-amber-200' : 
            'bg-green-50 text-green-700 border-green-200'
          }`}
          onClick={() => setIsOpen(true)}
        >
          {hasIssues ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{validationIssues.length} issues</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Code Guardian</span>
            </>
          )}
        </Button>
      </div>
    );
  }
  
  // Render expanded widget
  return (
    <div 
      className={`fixed ${positionClasses} z-50 w-96 bg-background/95 backdrop-blur-sm rounded-lg border shadow-lg overflow-hidden transition-all duration-300 ${
        isOpen ? 'max-h-[70vh]' : 'max-h-12'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <FileWarning className="h-4 w-4 text-amber-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-green-500" />
          )}
          <h3 className="font-medium text-sm">
            Code Guardian {hasIssues ? `(${validationIssues.length})` : ''}
          </h3>
        </div>
        
        <div className="flex items-center gap-1">
          {!minimal && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={() => runValidation()}
            >
              <span className="sr-only">Refresh</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="sr-only">Toggle</span>
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
          
          {!minimal && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <span className="sr-only">Close</span>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <CollapsibleContent forceMount className={isOpen ? 'block' : 'hidden'}>
        <ScrollArea className="p-3 max-h-[60vh]">
          {validationIssues.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <ShieldCheck className="h-10 w-10 text-green-500 mb-2" />
              <h3 className="font-medium">Code looks good!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No issues detected in your codebase
              </p>
              {lastValidated && (
                <p className="text-xs text-muted-foreground mt-4">
                  Last checked: {new Date(lastValidated).toLocaleTimeString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {validationIssues.map((issue) => (
                <Issue 
                  key={issue.id} 
                  issue={issue}
                  onDismiss={() => dismissIssue(issue.id)}
                />
              ))}
              
              <div className="pt-2 flex justify-between items-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => clearIssues()}
                  className="text-xs"
                >
                  Dismiss All
                </Button>
                
                {lastValidated && (
                  <p className="text-xs text-muted-foreground">
                    Checked: {new Date(lastValidated).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </CollapsibleContent>
    </div>
  );
}

// Individual issue component
function Issue({ issue, onDismiss }: { issue: ValidationIssue, onDismiss: () => void }) {
  const [isExpanded, setIsExpanded] = useState(issue.severity === 'critical');
  
  // Style based on severity
  const severityStyles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    critical: 'bg-red-100 border-red-300 text-red-900'
  }[issue.severity];
  
  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className={`rounded border ${severityStyles}`}
    >
      <div className="p-2 flex items-start justify-between">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{issue.message}</p>
            <p className="text-xs opacity-80">Rule: {issue.rule}</p>
          </div>
        </div>
        
        <div className="flex gap-1">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <Button 
            variant="ghost" 
            size="icon"
            className="h-6 w-6"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <CollapsibleContent className="px-2 pb-2">
        {issue.affectedFiles && issue.affectedFiles.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium mb-1">Affected Files:</p>
            <ul className="text-xs space-y-1">
              {issue.affectedFiles.map((file, i) => (
                <li key={i} className="ml-4 list-disc">{file}</li>
              ))}
            </ul>
          </div>
        )}
        
        {issue.suggestions && issue.suggestions.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium mb-1">Suggestions:</p>
            <ul className="text-xs space-y-1">
              {issue.suggestions.map((suggestion, i) => (
                <li key={i} className="ml-4 list-disc">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default CodeGuardianWidget;
