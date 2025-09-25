/**
 * Handles relationship events and manages global locks to prevent conflicts
 */
export class RelationshipEventHandler {
  private globalLock = false;
  private lockQueue: (() => void)[] = [];

  /**
   * Execute a function with global lock to prevent concurrent modifications
   */
  async withGlobalLock<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        if (this.globalLock) {
          this.lockQueue.push(execute);
          return;
        }

        this.globalLock = true;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.globalLock = false;
          this.processLockQueue();
        }
      };

      execute();
    });
  }

  /**
   * Process queued lock requests
   */
  private processLockQueue(): void {
    if (this.lockQueue.length > 0) {
      const nextFn = this.lockQueue.shift();
      if (nextFn) {
        setTimeout(nextFn, 0);
      }
    }
  }

  /**
   * Check if currently locked
   */
  isLocked(): boolean {
    return this.globalLock;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.lockQueue.length;
  }

  /**
   * Clear the lock queue (emergency use only)
   */
  clearQueue(): void {
    this.lockQueue = [];
    this.globalLock = false;
  }
}