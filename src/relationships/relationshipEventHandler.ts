import { TFile, App, MarkdownView } from 'obsidian';
import { loggingService } from '../services/loggingService';
import { ContactUtils } from './contactUtils';

/**
 * Manages event handling and lifecycle for relationship sync operations
 */
export class RelationshipEventHandler {
  private app: App;
  private contactUtils: ContactUtils;
  private syncingFiles = new Set<string>(); // Prevent infinite loops
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private globalLock = false; // Global lock for graph operations
  private consistencyCheckTimer: NodeJS.Timeout | null = null; // Debounced consistency check
  private operationQueue: Promise<void> = Promise.resolve(); // Serial operation queue
  private currentContactFile: TFile | null = null; // Track the currently active contact file

  // Callback functions to be set by RelationshipManager
  private onFileOpen?: (file: TFile | null) => void;
  private onActiveLeafChange?: () => void;
  private onEditorChange?: (file: TFile) => void;
  private onLayoutChange?: () => void;
  private onAppClose?: () => void;
  private onConsistencyCheck?: () => Promise<void>;

  constructor(app: App, contactUtils: ContactUtils) {
    this.app = app;
    this.contactUtils = contactUtils;
    
    // Try to get the current contact file, but handle cases where workspace is not available (e.g., tests)
    try {
      this.currentContactFile = this.getActiveContactFile();
    } catch (e) {
      this.currentContactFile = null; // Gracefully handle unavailable workspace
    }
  }

  /**
   * Set up event listeners for relationship sync
   * NOTE: Event listeners disabled per user request - sync only on initialization and manual command
   */
  setupEventListeners(): void {
    // Event listeners have been removed - sync now only occurs:
    // 1. Once during plugin initialization via initializeFromVault()
    // 2. Manually via the "Sync Contact Relationships" command
    loggingService.info(`[RelationshipEventHandler] Event listeners disabled - sync only on initialization and manual command`);
  }

  /**
   * Set callback functions
   */
  setCallbacks(callbacks: {
    onFileOpen?: (file: TFile | null) => void;
    onActiveLeafChange?: () => void;
    onEditorChange?: (file: TFile) => void;
    onLayoutChange?: () => void;
    onAppClose?: () => void;
    onConsistencyCheck?: () => Promise<void>;
  }): void {
    this.onFileOpen = callbacks.onFileOpen;
    this.onActiveLeafChange = callbacks.onActiveLeafChange;
    this.onEditorChange = callbacks.onEditorChange;
    this.onLayoutChange = callbacks.onLayoutChange;
    this.onAppClose = callbacks.onAppClose;
    this.onConsistencyCheck = callbacks.onConsistencyCheck;
  }

  private handleFileOpen(file: TFile | null): void {
    if (this.globalLock) return;
    
    // When opening a new file, sync the PREVIOUS file if it was a contact file
    if (this.currentContactFile && this.contactUtils.isContactFile(this.currentContactFile)) {
      const previousFile = this.currentContactFile;
      loggingService.info(`[RelationshipEventHandler] Syncing previous contact file: ${previousFile.path}`);
      this.debounceSync(previousFile, () => this.onFileOpen?.(previousFile), 800);
    }
    
    // Update current file tracking
    this.currentContactFile = this.contactUtils.isContactFile(file) ? file : null;
    if (this.currentContactFile) {
      loggingService.info(`[RelationshipEventHandler] Tracking new contact file: ${this.currentContactFile.path}`);
    }
  }

  private handleActiveLeafChange(): void {
    if (this.globalLock) return;
    
    const activeFile = this.getActiveContactFile();
    
    // If we switched to a different contact file, sync the previous one
    if (this.currentContactFile && this.currentContactFile !== activeFile && this.contactUtils.isContactFile(this.currentContactFile)) {
      const previousFile = this.currentContactFile;
      loggingService.info(`[RelationshipEventHandler] Active leaf change - syncing previous file: ${previousFile.path}`);
      this.debounceSync(previousFile, () => this.onActiveLeafChange?.(), 1000);
    }
    
    this.currentContactFile = activeFile;
  }

  private handleEditorChange(file: TFile): void {
    if (!this.contactUtils.isContactFile(file) || this.globalLock) return;
    
    loggingService.info(`[RelationshipEventHandler] Editor change detected: ${file.path}`);
    // Heavy debounce for editor changes to avoid spam
    this.debounceSync(file, () => this.onEditorChange?.(file), 5000);
  }

  private handleLayoutChange(): void {
    if (this.globalLock) return;
    
    // When layout changes (e.g., tab closing), sync current contact file
    if (this.currentContactFile && this.contactUtils.isContactFile(this.currentContactFile)) {
      loggingService.info(`[RelationshipEventHandler] Layout change - syncing current file: ${this.currentContactFile.path}`);
      this.debounceSync(this.currentContactFile, () => this.onLayoutChange?.(), 500);
    }
  }

  private handleAppClose(): void {
    if (this.currentContactFile && !this.globalLock) {
      // Synchronous sync for app close to ensure it completes
      this.onAppClose?.();
    }
  }

  /**
   * Get the currently active contact file
   */
  private getActiveContactFile(): TFile | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.file) return null;

    const file = activeView.file;
    return this.contactUtils.isContactFile(file) ? file : null;
  }

  /**
   * Execute operation with global lock to prevent race conditions
   */
  async withGlobalLock<T>(operation: () => Promise<T>): Promise<T> {
    // Queue the operation to run serially
    return new Promise<T>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(async () => {
        // Wait for global lock to be released
        while (this.globalLock) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        this.globalLock = true;
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.globalLock = false;
        }
      }).catch(error => {
        // Handle errors in the queue
        reject(error);
      });
    });
  }

  /**
   * Schedule a debounced consistency check
   */
  scheduleConsistencyCheck(): void {
    if (this.consistencyCheckTimer) {
      clearTimeout(this.consistencyCheckTimer);
    }
    
    this.consistencyCheckTimer = setTimeout(async () => {
      if (this.onConsistencyCheck) {
        await this.onConsistencyCheck();
      }
      this.consistencyCheckTimer = null;
    }, 2000); // 2 second debounce
  }

  /**
   * Debounce sync operations
   */
  private debounceSync(file: TFile, operation: () => Promise<void> | void, delay = 1000): void {
    const key = file.path;
    
    // Clear existing timer for this file
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!);
    }
    
    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        await operation();
      } catch (error) {
        loggingService.error(`[RelationshipEventHandler] Error in debounced sync for ${file.path}: ${error.message}`);
      }
    }, delay);
    
    this.debounceTimers.set(key, timer);
  }

  // Getters for state access
  get isSyncingFile(): (path: string) => boolean {
    return (path: string) => this.syncingFiles.has(path);
  }

  get isLocked(): boolean {
    return this.globalLock;
  }

  get currentFile(): TFile | null {
    return this.currentContactFile;
  }

  // Sync file state management
  addSyncingFile(path: string): void {
    this.syncingFiles.add(path);
  }

  removeSyncingFile(path: string): void {
    this.syncingFiles.delete(path);
  }
}