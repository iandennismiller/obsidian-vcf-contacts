import * as path from 'path';

/**
 * Manages a write queue for controlled VCard file updates
 * Prevents concurrent writes and ensures ordered processing
 */
export class VCardWriteQueue {
  private writeQueue: Map<string, { vcardData: string; timestamp: number }> = new Map();
  private processingQueue: boolean = false;

  constructor(
    private getWatchFolder: () => string,
    private findVCFFileByUID: (uid: string) => Promise<string | null>,
    private writeVCFFile: (filename: string, content: string) => Promise<string | null>
  ) {}

  /**
   * Add a VCard to the write queue for controlled updates.
   * If the VCard is already in the queue, it moves to the end.
   * 
   * @param uid - Unique identifier for the VCard
   * @param vcardData - VCard data to write
   * @returns Promise that resolves when the VCard is queued
   */
  async queueVcardWrite(uid: string, vcardData: string): Promise<void> {
    // Remove existing entry if present (moves to end of queue)
    if (this.writeQueue.has(uid)) {
      this.writeQueue.delete(uid);
    }
    
    // Add to end of queue
    this.writeQueue.set(uid, {
      vcardData,
      timestamp: Date.now()
    });
    
    console.log(`[VCardWriteQueue] Queued VCard write for UID: ${uid} (queue size: ${this.writeQueue.size})`);
    
    // Process the queue if not already processing
    if (!this.processingQueue) {
      this.processWriteQueue();
    }
  }

  /**
   * Process the write queue by writing VCards to the filesystem
   */
  private async processWriteQueue(): Promise<void> {
    if (this.processingQueue || this.writeQueue.size === 0) {
      return;
    }

    this.processingQueue = true;
    console.log(`[VCardWriteQueue] Processing write queue with ${this.writeQueue.size} items`);

    try {
      // Process all items in the queue
      const queueEntries = Array.from(this.writeQueue.entries());
      
      for (const [uid, queueItem] of queueEntries) {
        try {
          // Find existing VCard file by UID
          const existingPath = await this.findVCFFileByUID(uid);
          let targetPath: string;

          if (existingPath) {
            // Update existing file
            targetPath = existingPath;
          } else {
            // Create new file with UID-based name
            const filename = `contact-${uid}.vcf`;
            targetPath = path.join(this.getWatchFolder(), filename);
          }

          // Write VCard data to file
          const success = await this.writeVCFFile(path.basename(targetPath), queueItem.vcardData);
          
          if (success) {
            console.log(`[VCardWriteQueue] Successfully wrote VCard to: ${targetPath}`);
            this.writeQueue.delete(uid);
          } else {
            console.log(`[VCardWriteQueue] Failed to write VCard for UID: ${uid}`);
          }
          
        } catch (error: any) {
          console.log(`[VCardWriteQueue] Error writing VCard for UID ${uid}: ${error.message}`);
          this.writeQueue.delete(uid); // Remove failed items
        }
      }
      
    } catch (error: any) {
      console.log(`[VCardWriteQueue] Error processing write queue: ${error.message}`);
    } finally {
      this.processingQueue = false;
      
      // If there are still items in the queue, schedule another processing
      if (this.writeQueue.size > 0) {
        setTimeout(() => this.processWriteQueue(), 1000);
      }
    }
  }

  /**
   * Get the current write queue status
   */
  getStatus(): { size: number; processing: boolean } {
    return {
      size: this.writeQueue.size,
      processing: this.processingQueue
    };
  }

  /**
   * Clear the write queue (for testing or emergency purposes)
   */
  clear(): void {
    this.writeQueue.clear();
    console.log(`[VCardWriteQueue] Write queue cleared`);
  }
}