import { App, TFile, WorkspaceLeaf } from 'obsidian';
import { loggingService } from 'src/services/loggingService';

/**
 * Manages event handling and lifecycle for relationship sync operations
 */
export class RelationshipEventHandler {
  private app: App;
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

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Register event handlers
   */
  registerHandlers(callbacks: {
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

    // Register Obsidian event handlers
    this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange.bind(this));
    this.app.workspace.on('layout-change', this.handleLayoutChange.bind(this));
    this.app.workspace.on('editor-change', this.handleEditorChange.bind(this));
    
    // Handle app close events
    window.addEventListener('beforeunload', this.handleAppClose.bind(this));
  }

  /**
   * Unregister event handlers
   */
  unregisterHandlers(): void {
    this.app.workspace.off('active-leaf-change', this.handleActiveLeafChange.bind(this));
    this.app.workspace.off('layout-change', this.handleLayoutChange.bind(this));
    this.app.workspace.off('editor-change', this.handleEditorChange.bind(this));
    
    window.removeEventListener('beforeunload', this.handleAppClose.bind(this));

    // Clear any pending timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    if (this.consistencyCheckTimer) {
      clearTimeout(this.consistencyCheckTimer);
      this.consistencyCheckTimer = null;
    }
  }

  private handleActiveLeafChange(): void {
    const activeFile = this.getActiveContactFile();
    
    // If we switched from one contact to another
    if (this.currentContactFile && this.currentContactFile !== activeFile) {
      // Handle the previous file closing
      this.debounceSync(this.currentContactFile, () => {
        if (this.onFileOpen) {
          this.onFileOpen(null); // Signal file close
        }
      });
    }
    
    // Update current file and handle new file opening
    this.currentContactFile = activeFile;
    
    if (activeFile) {
      this.debounceSync(activeFile, () => {
        if (this.onFileOpen) {
          this.onFileOpen(activeFile);
        }
      });
    }
    
    if (this.onActiveLeafChange) {
      this.onActiveLeafChange();
    }
  }

  private handleEditorChange(file: TFile): void {
    if (!this.isContactFile(file)) return;
    
    this.debounceSync(file, () => {
      if (this.onEditorChange) {
        this.onEditorChange(file);
      }
    });
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
    const activeLeaf = this.app.workspace.activeLeaf;
    if (!activeLeaf) return null;
    
    const view = activeLeaf.view;
    if (view.getViewType() !== 'markdown') return null;
    
    const file = (view as any).file as TFile;
    return this.isContactFile(file) ? file : null;
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile | null): boolean {
    if (!file) return false;
    
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID);
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
        try {
          await this.withGlobalLock(async () => {
            await this.onConsistencyCheck!();
          });
        } catch (error) {
          loggingService.error(`[RelationshipEventHandler] Consistency check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      this.consistencyCheckTimer = null;
    }, 5000); // 5 second delay
  }

  /**
   * Debounce sync operations
   */
  private debounceSync(file: TFile, operation: () => Promise<void> | void, delay = 1000): void {
    const path = file.path;
    
    // Clear existing timer
    if (this.debounceTimers.has(path)) {
      clearTimeout(this.debounceTimers.get(path)!);
    }
    
    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(path);
      try {
        await operation();
      } catch (error) {
        loggingService.error(`[RelationshipEventHandler] Debounced sync failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, delay);
    
    this.debounceTimers.set(path, timer);
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