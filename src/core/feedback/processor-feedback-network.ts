
/**
 * Processor Feedback Network
 * Implements bidirectional communication between processors for improved signal quality
 */

import { FeedbackSystem, FeedbackMessage } from './feedback-system';
import { QualityResult } from '../signal/unified-quality-evaluator';

export interface ProcessorFeedback {
  sourceProcessor: string;
  targetProcessor: string;
  qualityResult?: QualityResult;
  parameters?: Record<string, number>;
  suggestions?: Array<{
    parameter: string;
    value: number;
    confidence: number;
  }>;
  timestamp: number;
}

export interface ProcessorFeedbackListener {
  onFeedbackReceived: (feedback: ProcessorFeedback) => void;
}

/**
 * Network for bidirectional feedback between vital sign processors
 * Allows processors to share quality metrics and parameter suggestions
 */
export class ProcessorFeedbackNetwork {
  private feedbackSystem: FeedbackSystem;
  private processorListeners: Map<string, ProcessorFeedbackListener[]> = new Map();
  private feedbackHistory: Map<string, ProcessorFeedback[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 20;
  
  constructor(feedbackSystem: FeedbackSystem) {
    this.feedbackSystem = feedbackSystem;
  }
  
  /**
   * Register a processor as a feedback listener
   */
  public registerProcessor(
    processorId: string, 
    listener: ProcessorFeedbackListener
  ): void {
    if (!this.processorListeners.has(processorId)) {
      this.processorListeners.set(processorId, []);
    }
    
    this.processorListeners.get(processorId)?.push(listener);
    this.feedbackHistory.set(processorId, []);
    
    // Log registration
    this.feedbackSystem.addFeedback(
      `Processor ${processorId} registered for feedback`,
      'info',
      { processorId }
    );
  }
  
  /**
   * Unregister a processor as a feedback listener
   */
  public unregisterProcessor(
    processorId: string, 
    listener: ProcessorFeedbackListener
  ): void {
    if (!this.processorListeners.has(processorId)) return;
    
    const listeners = this.processorListeners.get(processorId) || [];
    const index = listeners.indexOf(listener);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    if (listeners.length === 0) {
      this.processorListeners.delete(processorId);
      this.feedbackHistory.delete(processorId);
    }
  }
  
  /**
   * Send feedback from one processor to another
   */
  public sendFeedback(feedback: ProcessorFeedback): void {
    // Add timestamp if not present
    if (!feedback.timestamp) {
      feedback.timestamp = Date.now();
    }
    
    // Store feedback in history
    this.addToHistory(feedback);
    
    // Deliver feedback to target processor
    const targetListeners = this.processorListeners.get(feedback.targetProcessor) || [];
    
    targetListeners.forEach(listener => {
      listener.onFeedbackReceived(feedback);
    });
    
    // Log feedback for monitoring
    this.feedbackSystem.addFeedback(
      `Processor ${feedback.sourceProcessor} sent feedback to ${feedback.targetProcessor}`,
      'info',
      { 
        source: feedback.sourceProcessor,
        target: feedback.targetProcessor,
        qualityScore: feedback.qualityResult?.score
      }
    );
    
    // Broadcast quality information to all processors if it's a quality update
    if (feedback.qualityResult) {
      this.broadcastQualityUpdate(feedback);
    }
  }
  
  /**
   * Add feedback to history
   */
  private addToHistory(feedback: ProcessorFeedback): void {
    // Get history for source processor
    const history = this.feedbackHistory.get(feedback.sourceProcessor) || [];
    
    // Add feedback
    history.push(feedback);
    
    // Limit history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
    
    // Update history
    this.feedbackHistory.set(feedback.sourceProcessor, history);
  }
  
  /**
   * Broadcast quality update to all processors
   */
  private broadcastQualityUpdate(feedback: ProcessorFeedback): void {
    // Skip if no quality result
    if (!feedback.qualityResult) return;
    
    // Broadcast to all processors except source and target
    this.processorListeners.forEach((listeners, processorId) => {
      if (processorId !== feedback.sourceProcessor && processorId !== feedback.targetProcessor) {
        const broadcastFeedback: ProcessorFeedback = {
          sourceProcessor: feedback.sourceProcessor,
          targetProcessor: processorId,
          qualityResult: feedback.qualityResult,
          timestamp: feedback.timestamp
        };
        
        listeners.forEach(listener => {
          listener.onFeedbackReceived(broadcastFeedback);
        });
      }
    });
  }
  
  /**
   * Get feedback history for a processor
   */
  public getProcessorHistory(processorId: string): ProcessorFeedback[] {
    return [...(this.feedbackHistory.get(processorId) || [])];
  }
  
  /**
   * Get all feedback messages related to processors
   */
  public getAllFeedbackMessages(): FeedbackMessage[] {
    return this.feedbackSystem.getAllFeedbacks().filter(msg => 
      msg.context && 
      (msg.context.source || msg.context.processorId)
    );
  }
  
  /**
   * Reset the feedback network
   */
  public reset(): void {
    this.feedbackHistory.clear();
    
    // Log reset
    this.feedbackSystem.addFeedback(
      'Processor feedback network reset',
      'info'
    );
  }
}
