
/**
 * Sistema de observables para procesamiento de señales
 * Implementa el patrón Observable para desacoplar la producción y el consumo de datos
 */

/**
 * Función de suscripción a un observable
 */
export type ObserverFunction<T> = (value: T) => void;

/**
 * Función de transformación de datos
 */
export type OperatorFunction<T, R> = (source: Observable<T>) => Observable<R>;

/**
 * Predicate para filtrado
 */
export type PredicateFunction<T> = (value: T) => boolean;

/**
 * Implementación del patrón Observable
 */
export class Observable<T> {
  private observers: ObserverFunction<T>[] = [];
  private subscribeHandler?: (observer: ObserverFunction<T>) => () => void;
  
  constructor(subscribeHandler?: (observer: ObserverFunction<T>) => () => void) {
    this.subscribeHandler = subscribeHandler;
  }
  
  /**
   * Método para crear un nuevo Observable a partir de un valor o array
   */
  public static of<R>(...values: R[]): Observable<R> {
    return new Observable<R>(observer => {
      values.forEach(value => observer(value));
      return () => {}; // Función de limpieza
    });
  }
  
  /**
   * Crea un observable a partir de eventos
   */
  public static fromEvent(target: EventTarget, eventName: string): Observable<Event> {
    return new Observable<Event>(observer => {
      const handler = (event: Event) => observer(event);
      target.addEventListener(eventName, handler);
      
      return () => {
        target.removeEventListener(eventName, handler);
      };
    });
  }
  
  /**
   * Crea un observable a partir de una promesa
   */
  public static fromPromise<R>(promise: Promise<R>): Observable<R> {
    return new Observable<R>(observer => {
      promise.then(value => {
        observer(value);
      });
      
      return () => {}; // No podemos cancelar una promesa
    });
  }
  
  /**
   * Suscribe una función al observable
   */
  public subscribe(observer: ObserverFunction<T>): () => void {
    this.observers.push(observer);
    
    // Si hay función de suscripción personalizada, usarla
    if (this.subscribeHandler) {
      return this.subscribeHandler(observer);
    }
    
    // Devolver función para desuscribirse
    return () => {
      const index = this.observers.indexOf(observer);
      if (index !== -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  /**
   * Emite un valor a todos los suscriptores
   */
  public next(value: T): void {
    this.observers.forEach(observer => {
      try {
        observer(value);
      } catch (error) {
        console.error('Error en observador:', error);
      }
    });
  }
  
  /**
   * Mapea valores usando una función de transformación
   */
  public map<R>(project: (value: T) => R): Observable<R> {
    const source = this;
    return new Observable<R>(observer => {
      const subscription = source.subscribe(value => {
        try {
          const result = project(value);
          observer(result);
        } catch (error) {
          console.error('Error en operador map:', error);
        }
      });
      
      return subscription;
    });
  }
  
  /**
   * Filtra valores usando un predicado
   */
  public filter(predicate: PredicateFunction<T>): Observable<T> {
    const source = this;
    return new Observable<T>(observer => {
      const subscription = source.subscribe(value => {
        try {
          if (predicate(value)) {
            observer(value);
          }
        } catch (error) {
          console.error('Error en operador filter:', error);
        }
      });
      
      return subscription;
    });
  }
  
  /**
   * Buffer valores hasta alcanzar un tamaño específico
   */
  public buffer(count: number): Observable<T[]> {
    const source = this;
    return new Observable<T[]>(observer => {
      const buffer: T[] = [];
      
      const subscription = source.subscribe(value => {
        buffer.push(value);
        
        if (buffer.length >= count) {
          observer([...buffer]);
          buffer.length = 0; // Limpiar buffer
        }
      });
      
      return subscription;
    });
  }
  
  /**
   * Combina este observable con otro
   */
  public merge<R>(other: Observable<R>): Observable<T | R> {
    const source = this;
    return new Observable<T | R>(observer => {
      const subscription1 = source.subscribe(value => observer(value));
      const subscription2 = other.subscribe(value => observer(value));
      
      return () => {
        subscription1();
        subscription2();
      };
    });
  }
  
  /**
   * Aplica un operador a este observable
   */
  public pipe<R>(operator: OperatorFunction<T, R>): Observable<R> {
    return operator(this);
  }
}

/**
 * Subject - Observable que permite emitir valores programáticamente
 */
export class Subject<T> extends Observable<T> {
  constructor() {
    super();
  }
  
  /**
   * Emite un valor a todos los suscriptores
   */
  public override next(value: T): void {
    super.next(value);
  }
}

/**
 * BehaviorSubject - Mantiene el último valor y lo emite a los nuevos suscriptores
 */
export class BehaviorSubject<T> extends Subject<T> {
  constructor(private currentValue: T) {
    super();
  }
  
  /**
   * Obtiene el valor actual
   */
  public getValue(): T {
    return this.currentValue;
  }
  
  /**
   * Actualiza el valor actual y lo emite
   */
  public override next(value: T): void {
    this.currentValue = value;
    super.next(value);
  }
  
  /**
   * Sobrescribe el método subscribe para emitir el valor actual
   */
  public override subscribe(observer: ObserverFunction<T>): () => void {
    // Emitir valor actual al suscribirse
    observer(this.currentValue);
    
    // Continuar con la suscripción normal
    return super.subscribe(observer);
  }
}

/**
 * Operadores comunes para observables
 */
export const operators = {
  /**
   * Mapea valores usando una función
   */
  map: <T, R>(project: (value: T) => R): OperatorFunction<T, R> => 
    (source: Observable<T>) => source.map(project),
  
  /**
   * Filtra valores usando un predicado
   */
  filter: <T>(predicate: PredicateFunction<T>): OperatorFunction<T, T> => 
    (source: Observable<T>) => source.filter(predicate),
  
  /**
   * Acumula valores usando una función reductora
   */
  scan: <T, R>(accumulator: (acc: R, value: T) => R, seed: R): OperatorFunction<T, R> => 
    (source: Observable<T>) => {
      let state = seed;
      return source.map(value => {
        state = accumulator(state, value);
        return state;
      });
    },
  
  /**
   * Limita la tasa de emisión
   */
  throttleTime: <T>(time: number): OperatorFunction<T, T> => 
    (source: Observable<T>) => {
      let lastEmitTime = 0;
      return new Observable<T>(observer => {
        const subscription = source.subscribe(value => {
          const now = Date.now();
          if (now - lastEmitTime >= time) {
            lastEmitTime = now;
            observer(value);
          }
        });
        
        return subscription;
      });
    }
};
