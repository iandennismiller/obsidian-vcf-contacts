import { App, TFile } from 'obsidian';
import { ContactUtils } from './contactUtils';
import { loggingService } from '../services/loggingService';

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

  /**
   * Initialize event handlers
   */
  initialize(): void {
    // Register file open events
    this.app.workspace.on('file-open', this.handleFileOpen.bind(this));
    
    // Register active leaf change events
    this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange.bind(this));
    
    // Register editor change events (for debounced sync)
    this.app.vault.on('modify', this.handleFileModify.bind(this));
    
    // Register layout change events
    this.app.workspace.on('layout-change', this.handleLayoutChange.bind(this));
    
    // Register app close events
    this.app.workspace.on('quit', this.handleAppClose.bind(this));
    
    loggingService.info('[RelationshipEventHandler] Event handlers initialized');
  }

  /**
   * Clean up event handlers
   */
  cleanup(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    if (this.consistencyCheckTimer) {
      clearTimeout(this.consistencyCheckTimer);
      this.consistencyCheckTimer = null;
    }
    
    // Remove event handlers
    this.app.workspace.off('file-open', this.handleFileOpen.bind(this));
    this.app.workspace.off('active-leaf-change', this.handleActiveLeafChange.bind(this));
    this.app.vault.off('modify', this.handleFileModify.bind(this));
    this.app.workspace.off('layout-change', this.handleLayoutChange.bind(this));
    this.app.workspace.off('quit', this.handleAppClose.bind(this));
    
    loggingService.info('[RelationshipEventHandler] Event handlers cleaned up');
  }

  private handleFileOpen(file: TFile | null): void {
    this.currentContactFile = file && this.contactUtils.isContactFile(file) ? file : null;
    
    if (this.onFileOpen) {
      this.onFileOpen(file);
    }
    
    loggingService.info(`[RelationshipEventHandler] File opened: ${file?.path || 'none'} (is contact: ${!!this.currentContactFile})`);
  }

  private handleActiveLeafChange(): void {
    const activeFile = this.getActiveContactFile();
    this.currentContactFile = activeFile;
    
    if (this.onActiveLeafChange) {
      this.onActiveLeafChange();
    }
    
    loggingService.info(`[RelationshipEventHandler] Active leaf changed, contact file: ${activeFile?.path || 'none'}`);
  }

  private handleFileModify(file: TFile): void {
    // Only handle contact files
    if (!this.contactUtils.isContactFile(file)) {
      return;
    }
    
    // Prevent handling while we're syncing this file
    if (this.syncingFiles.has(file.path)) {
      loggingService.info(`[RelationshipEventHandler] Skipping modify event for syncing file: ${file.path}`);
      return;
    }
    
    // Debounce the editor change event
    this.debounceSync(file, () => {
      if (this.onEditorChange) {
        this.onEditorChange(file);
      }
    });
    
    loggingService.info(`[RelationshipEventHandler] File modified (debounced): ${file.path}`);
  }

  private handleLayoutChange(): void {
    if (this.onLayoutChange) {
      this.onLayoutChange();
    }
  }

  private handleAppClose(): void {
    if (this.onAppClose) {
      this.onAppClose();
    }
  }

  /**
   * Get the currently active contact file
   */
  private getActiveContactFile(): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && this.contactUtils.isContactFile(activeFile)) {
      return activeFile;
    }
    return null;
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
      this.consistencyCheckTimer = null;
      if (this.onConsistencyCheck) {
        try {
          await this.onConsistencyCheck();
        } catch (error) {
          loggingService.error(`[RelationshipEventHandler] Error in consistency check: ${error}`);
        }
      }
    }, 5000); // 5 second delay
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