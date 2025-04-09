
/**
 * Service container for dependency injection
 * Centralized management of service instances
 */

type ServiceFactory<T> = (...args: any[]) => T;

export class ServiceContainer {
  private services: Map<string, any> = new Map();
  private factories: Map<string, ServiceFactory<any>> = new Map();
  
  /**
   * Register a service instance
   */
  public register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }
  
  /**
   * Register a service factory
   */
  public registerFactory<T>(key: string, factory: ServiceFactory<T>): void {
    this.factories.set(key, factory);
  }
  
  /**
   * Get a service instance
   * Lazily creates the service if it doesn't exist and a factory is registered
   */
  public get<T>(key: string, ...args: any[]): T {
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }
    
    const factory = this.factories.get(key);
    if (factory) {
      const instance = factory(...args);
      this.services.set(key, instance);
      return instance;
    }
    
    throw new Error(`Service not registered: ${key}`);
  }
  
  /**
   * Check if a service is registered
   */
  public has(key: string): boolean {
    return this.services.has(key) || this.factories.has(key);
  }
  
  /**
   * Remove a service
   */
  public remove(key: string): boolean {
    return this.services.delete(key) || this.factories.delete(key);
  }
  
  /**
   * Reset the container
   */
  public reset(): void {
    // Dispose services if they have a dispose method
    this.services.forEach(service => {
      if (typeof service.dispose === 'function') {
        service.dispose();
      }
    });
    
    this.services.clear();
  }
}

// Create and export the global service container
export const container = new ServiceContainer();
