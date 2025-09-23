import { TFile } from 'obsidian';
import { loggingService } from 'src/services/loggingService';
import { updateFrontMatterValue } from 'src/contacts/contactFrontmatter';
import { getApp } from 'src/context/sharedAppContext';

/**
 * Debounces REV field updates to prevent excessive timestamp updates
 */
export class RevDebouncer {
  private pendingUpdates = new Map<string, number>();
  private readonly debounceTime: number;

  constructor(debounceTime: number = 2000) {
    this.debounceTime = debounceTime;
  }

  /**
   * Schedule a REV field update with debouncing
   */
  scheduleRevUpdate(file: TFile): void {
    const fileId = file.path;
    
    // Clear any existing timeout for this file
    if (this.pendingUpdates.has(fileId)) {
      clearTimeout(this.pendingUpdates.get(fileId)!);
    }

    // Schedule new update
    const timeout = setTimeout(async () => {
      try {
        await this.updateRevField(file);
        this.pendingUpdates.delete(fileId);
      } catch (error) {
        loggingService.error(`Error updating REV field for ${file.name}: ${error}`);
        this.pendingUpdates.delete(fileId);
      }
    }, this.debounceTime) as any;

    this.pendingUpdates.set(fileId, timeout);
    loggingService.info(`Scheduled REV update for ${file.name} in ${this.debounceTime}ms`);
  }

  /**
   * Immediately update REV field and cancel any pending updates
   */
  async forceRevUpdate(file: TFile): Promise<void> {
    const fileId = file.path;
    
    // Cancel pending update
    if (this.pendingUpdates.has(fileId)) {
      clearTimeout(this.pendingUpdates.get(fileId)!);
      this.pendingUpdates.delete(fileId);
    }

    await this.updateRevField(file);
  }

  /**
   * Cancel all pending REV updates
   */
  cancelAllUpdates(): void {
    this.pendingUpdates.forEach(timeout => clearTimeout(timeout));
    this.pendingUpdates.clear();
    loggingService.info('Cancelled all pending REV updates');
  }

  /**
   * Cancel REV update for a specific file
   */
  cancelRevUpdate(file: TFile): void {
    const fileId = file.path;
    if (this.pendingUpdates.has(fileId)) {
      clearTimeout(this.pendingUpdates.get(fileId)!);
      this.pendingUpdates.delete(fileId);
      loggingService.info(`Cancelled REV update for ${file.name}`);
    }
  }

  /**
   * Actually update the REV field
   */
  private async updateRevField(file: TFile): Promise<void> {
    const app = getApp();
    const timestamp = new Date().toISOString();
    
    await updateFrontMatterValue(file, 'REV', timestamp, app);
    loggingService.info(`Updated REV field for ${file.name} to ${timestamp}`);
  }

  /**
   * Get status of pending updates
   */
  getPendingUpdates(): string[] {
    return Array.from(this.pendingUpdates.keys());
  }
}

// Global debouncer instance
export const revDebouncer = new RevDebouncer();