
/**
 * Gestor de Rollback
 * 
 * Implementa mecanismos de reversión automática si se detectan problemas,
 * mantiene puntos de restauración seguros.
 */

import { RestorePoint } from './types';

export class RollbackManager {
  private restorePoints: Map<string, RestorePoint[]> = new Map();
  private maxRestorePointsPerFile: number = 5;
  
  constructor() {
    console.log('Gestor de Rollback inicializado');
  }
  
  /**
   * Crea un punto de restauración para un archivo
   */
  public createRestorePoint(fileName: string, originalCode: string): void {
    const timestamp = new Date();
    const restorePoint: RestorePoint = {
      fileName,
      originalCode,
      timestamp
    };
    
    // Obtener puntos de restauración existentes para este archivo
    const fileRestorePoints = this.restorePoints.get(fileName) || [];
    
    // Agregar el nuevo punto de restauración
    fileRestorePoints.push(restorePoint);
    
    // Limitar la cantidad de puntos de restauración por archivo
    if (fileRestorePoints.length > this.maxRestorePointsPerFile) {
      fileRestorePoints.shift();
    }
    
    // Actualizar el mapa de puntos de restauración
    this.restorePoints.set(fileName, fileRestorePoints);
    
    console.log(`Punto de restauración creado para ${fileName} (${timestamp.toISOString()})`);
  }
  
  /**
   * Prepara un rollback para un archivo
   */
  public prepareRollback(fileName: string): void {
    const fileRestorePoints = this.restorePoints.get(fileName);
    
    if (!fileRestorePoints || fileRestorePoints.length === 0) {
      console.warn(`No hay puntos de restauración disponibles para ${fileName}`);
      return;
    }
    
    console.log(`Rollback preparado para ${fileName}`);
  }
  
  /**
   * Realiza un rollback para un archivo
   */
  public async rollback(fileName: string): Promise<boolean> {
    const fileRestorePoints = this.restorePoints.get(fileName);
    
    if (!fileRestorePoints || fileRestorePoints.length === 0) {
      console.error(`No hay puntos de restauración disponibles para ${fileName}`);
      return false;
    }
    
    // Obtener el punto de restauración más reciente
    const latestRestorePoint = fileRestorePoints[fileRestorePoints.length - 1];
    
    try {
      console.log(`Realizando rollback para ${fileName} a ${latestRestorePoint.timestamp.toISOString()}`);
      
      // En una implementación real, aquí restauraríamos el archivo
      // Por ahora, simulamos un rollback exitoso
      
      // Eliminar el punto de restauración utilizado
      fileRestorePoints.pop();
      this.restorePoints.set(fileName, fileRestorePoints);
      
      return true;
    } catch (error) {
      console.error(`Error durante el rollback de ${fileName}:`, error);
      return false;
    }
  }
  
  /**
   * Obtiene un punto de restauración para un archivo
   */
  public getRestorePoint(fileName: string): RestorePoint | null {
    const fileRestorePoints = this.restorePoints.get(fileName);
    
    if (!fileRestorePoints || fileRestorePoints.length === 0) {
      return null;
    }
    
    return fileRestorePoints[fileRestorePoints.length - 1];
  }
  
  /**
   * Obtiene todos los puntos de restauración para un archivo
   */
  public getRestorePointsForFile(fileName: string): RestorePoint[] {
    return this.restorePoints.get(fileName) || [];
  }
  
  /**
   * Limpia puntos de restauración antiguos
   */
  public cleanupOldRestorePoints(maxAgeInHours: number = 24): void {
    const now = new Date();
    const maxAgeInMs = maxAgeInHours * 60 * 60 * 1000;
    
    for (const [fileName, fileRestorePoints] of this.restorePoints.entries()) {
      const filteredPoints = fileRestorePoints.filter(point => {
        const ageInMs = now.getTime() - point.timestamp.getTime();
        return ageInMs <= maxAgeInMs;
      });
      
      if (filteredPoints.length < fileRestorePoints.length) {
        console.log(`Eliminados ${fileRestorePoints.length - filteredPoints.length} puntos de restauración antiguos para ${fileName}`);
        this.restorePoints.set(fileName, filteredPoints);
      }
    }
  }
}
