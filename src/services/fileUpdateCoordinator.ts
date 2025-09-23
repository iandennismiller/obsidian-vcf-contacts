/**
 * Coordination service to prevent race conditions between VCFolderWatcher and RelationshipManager.
 * 
 * This service ensures that only one service at a time can modify a contact file's front matter,
 * preventing the race condition where both services try to update the same file simultaneously.
 */
export class FileUpdateCoordinator {
  private static instance: FileUpdateCoordinator;
  private updatingFiles = new Set<string>();
  private updateQueue = new Map<string, (() => void)[]>();

  private constructor() {}

  public static getInstance(): FileUpdateCoordinator {
    if (!FileUpdateCoordinator.instance) {
      FileUpdateCoordinator.instance = new FileUpdateCoordinator();
    }
    return FileUpdateCoordinator.instance;
  }

  /**
   * Acquire lock for updating a file
   * @param filePath The path of the file to lock
   * @returns Promise that resolves when lock is acquired
   */
  async acquireUpdateLock(filePath: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.updatingFiles.has(filePath)) {
        // File is already being updated, queue this request
        if (!this.updateQueue.has(filePath)) {
          this.updateQueue.set(filePath, []);
        }
        this.updateQueue.get(filePath)!.push(resolve);
      } else {
        // File is not being updated, acquire lock immediately
        this.updatingFiles.add(filePath);
        resolve();
      }
    });
  }

  /**
   * Release lock for updating a file
   * @param filePath The path of the file to unlock
   */
  releaseUpdateLock(filePath: string): void {
    this.updatingFiles.delete(filePath);
    
    // Process queue for this file
    const queue = this.updateQueue.get(filePath);
    if (queue && queue.length > 0) {
      const nextResolve = queue.shift()!;
      this.updatingFiles.add(filePath);
      nextResolve();
      
      // Clean up queue if empty
      if (queue.length === 0) {
        this.updateQueue.delete(filePath);
      }
    }
  }

  /**
   * Check if a file is currently being updated
   * @param filePath The path of the file to check
   * @returns true if the file is currently being updated
   */
  isFileBeingUpdated(filePath: string): boolean {
    return this.updatingFiles.has(filePath);
  }

  /**
   * Execute a function with exclusive file access
   * @param filePath The path of the file to lock
   * @param updateFunction The function to execute with exclusive access
   * @returns Promise that resolves with the result of updateFunction
   */
  async withExclusiveAccess<T>(filePath: string, updateFunction: () => Promise<T>): Promise<T> {
    await this.acquireUpdateLock(filePath);
    
    try {
      return await updateFunction();
    } finally {
      this.releaseUpdateLock(filePath);
    }
  }
}