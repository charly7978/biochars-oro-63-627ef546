
// Let's just fix the timeoutId property in the task interface
export interface WorkerTask<T = any> {
  resolve: (value: WorkerProcessingResult<T> | PromiseLike<WorkerProcessingResult<T>>) => void;
  reject: (reason?: any) => void;
  startTime: number;
  config: WorkerTaskConfig;
  timeoutId?: number; // Make this property optional
}
