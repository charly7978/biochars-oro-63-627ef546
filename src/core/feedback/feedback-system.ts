
/**
 * Bidirectional feedback system for vital signs monitoring
 * Provides real-time feedback to the user and collects usage data
 */

export type FeedbackLevel = 'info' | 'warning' | 'error' | 'success';

export interface FeedbackMessage {
  id: string;
  message: string;
  level: FeedbackLevel;
  timestamp: number;
  context?: Record<string, any>;
  resolved?: boolean;
}

export interface UserAction {
  action: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface FeedbackListener {
  onFeedbackAdded: (message: FeedbackMessage) => void;
  onFeedbackResolved: (id: string) => void;
  onFeedbacksCleared: () => void;
}

export class FeedbackSystem {
  private messages: FeedbackMessage[] = [];
  private userActions: UserAction[] = [];
  private listeners: FeedbackListener[] = [];
  private uniqueIdCounter = 0;
  
  /**
   * Add a feedback message
   */
  public addFeedback(message: string, level: FeedbackLevel = 'info', context?: Record<string, any>): string {
    const id = `feedback-${Date.now()}-${this.uniqueIdCounter++}`;
    
    const feedbackMessage: FeedbackMessage = {
      id,
      message,
      level,
      timestamp: Date.now(),
      context,
      resolved: false
    };
    
    this.messages.push(feedbackMessage);
    
    // Notify listeners
    this.listeners.forEach(listener => {
      listener.onFeedbackAdded(feedbackMessage);
    });
    
    return id;
  }
  
  /**
   * Mark a feedback message as resolved
   */
  public resolveFeedback(id: string): boolean {
    const message = this.messages.find(m => m.id === id);
    
    if (message && !message.resolved) {
      message.resolved = true;
      
      // Notify listeners
      this.listeners.forEach(listener => {
        listener.onFeedbackResolved(id);
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Get all active (unresolved) feedback messages
   */
  public getActiveFeedbacks(): FeedbackMessage[] {
    return this.messages.filter(m => !m.resolved);
  }
  
  /**
   * Get all feedback messages
   */
  public getAllFeedbacks(): FeedbackMessage[] {
    return [...this.messages];
  }
  
  /**
   * Clear all feedback messages
   */
  public clearFeedbacks(): void {
    this.messages = [];
    
    // Notify listeners
    this.listeners.forEach(listener => {
      listener.onFeedbacksCleared();
    });
  }
  
  /**
   * Record a user action
   */
  public recordUserAction(action: string, context?: Record<string, any>): void {
    this.userActions.push({
      action,
      timestamp: Date.now(),
      context
    });
  }
  
  /**
   * Get user action history
   */
  public getUserActions(): UserAction[] {
    return [...this.userActions];
  }
  
  /**
   * Add a feedback listener
   */
  public addListener(listener: FeedbackListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove a feedback listener
   */
  public removeListener(listener: FeedbackListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Reset the feedback system
   */
  public reset(): void {
    this.messages = [];
    this.userActions = [];
    
    // Notify listeners
    this.listeners.forEach(listener => {
      listener.onFeedbacksCleared();
    });
  }
}
