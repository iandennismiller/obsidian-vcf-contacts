import { App, TFile, EventRef } from 'obsidian';
import { loggingService } from 'src/services/loggingService';
import { RelationshipGraph, RelationshipType, RelatedField } from './relationshipGraph';
import { RelationshipSyncManager } from './relationshipSyncManager';
import { RelationshipContentParser } from './relationshipContentParser';
import { ContactUtils } from './contactUtils';

/**
 * Manages event handling and lifecycle for relationship sync operations
 */
export class RelationshipEventHandler {
  private app: App;
  private graph: RelationshipGraph;
  private syncManager: RelationshipSyncManager;
  private contentParser: RelationshipContentParser;
  private contactUtils: ContactUtils;

  // State management
  private globalLock = false;
  private operationQueue = Promise.resolve();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private syncingFiles = new Set<string>();
  private currentContactFile: TFile | null = null;

  // Event references for cleanup
  private eventRefs: EventRef[] = [];

  constructor(
    app: App, 
    graph: RelationshipGraph, 
    syncManager: RelationshipSyncManager
  ) {
    this.app = app;
    this.graph = graph;
    this.syncManager = syncManager;
    this.contentParser = new RelationshipContentParser();
    this.contactUtils = new ContactUtils(app);
  }

  /**
   * Initialize event handlers
   */
  initialize(): void {
    loggingService.info('[RelationshipEventHandler] Initializing relationship event handlers...');

    // File modification events
    this.eventRefs.push(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && this.contactUtils.isValidContact(file)) {
          this.handleFileModified(file);
        }
      })
    );

    // File deletion events
    this.eventRefs.push(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile) {
          this.handleFileDeleted(file);
        }
      })
    );

    // Layout change events (file switching)
    this.eventRefs.push(
      this.app.workspace.on('layout-change', () => {
        this.handleLayoutChange();
      })
    );

    // App close event
    this.eventRefs.push(
      this.app.workspace.on('quit', () => {
        this.handleAppClose();
      })
    );

    loggingService.info('[RelationshipEventHandler] Event handlers initialized');
  }

  /**
   * Clean up event handlers
   */
  destroy(): void {
    loggingService.info('[RelationshipEventHandler] Cleaning up relationship event handlers...');

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Unregister event handlers
    for (const eventRef of this.eventRefs) {
      this.app.vault.offref(eventRef);
    }
    this.eventRefs = [];

    loggingService.info('[RelationshipEventHandler] Event handlers cleaned up');
  }

  /**
   * Handle file modification
   */
  private handleFileModified(file: TFile): void {
    if (this.syncingFiles.has(file.path)) {
      return; // Skip if we're already syncing this file
    }

    loggingService.debug(`[RelationshipEventHandler] File modified: ${file.path}`);

    // Debounce sync operations
    this.debounceSync(file, async () => {
      await this.withGlobalLock(async () => {
        await this.syncFileOnModification(file);
      });
    });
  }

  /**
   * Handle file deletion
   */
  private handleFileDeleted(file: TFile): void {
    const uid = this.contactUtils.extractUIDFromFile(file);
    if (uid) {
      loggingService.info(`[RelationshipEventHandler] Contact deleted: ${file.path} (UID: ${uid})`);
      
      // Remove from graph
      this.graph.removeContact(uid);
      
      // Clear any pending timers for this file
      this.debounceTimers.delete(file.path);
      this.syncingFiles.delete(file.path);
    }
  }

  /**
   * Sync file relationships on modification
   */
  private async syncFileOnModification(file: TFile): Promise<void> {
    try {
      this.addSyncingFile(file.path);

      const uid = this.contactUtils.extractUIDFromFile(file);
      if (!uid) {
        loggingService.debug(`[RelationshipEventHandler] File has no UID, skipping: ${file.path}`);
        return;
      }

      // Ensure contact exists in graph
      const fullName = this.contactUtils.extractFullNameFromFile(file) || uid;
      const gender = this.contactUtils.extractGenderFromFile(file);
      this.graph.addContact(uid, fullName, file, gender);

      // Read and parse Related list
      const content = await this.app.vault.read(file);
      const relatedListRelationships = this.contentParser.parseRelatedSection(content);

      if (relatedListRelationships.length > 0) {
        loggingService.info(`[RelationshipEventHandler] Found ${relatedListRelationships.length} relationships in Related list for: ${file.path}`);

        // 1. Update graph from Related list
        await this.syncManager.updateGraphFromRelatedList(uid, relatedListRelationships);

        // 2. Update front matter from graph
        await this.syncManager.updateFrontmatterFromGraph(file, uid);

        // 3. Propagate changes to related contacts
        await this.syncManager.propagateRelationshipChanges(uid);
      } else {
        // No relationships in Related list, but still sync front matter to graph
        await this.syncFrontmatterToGraph(file);
      }

    } catch (error) {
      loggingService.error(`[RelationshipEventHandler] Error syncing file ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.removeSyncingFile(file.path);
    }
  }

  /**
   * Sync front matter relationships to graph
   */
  private async syncFrontmatterToGraph(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.UID) return;

    const uid = cache.frontmatter.UID;
    
    // Parse RELATED fields from front matter
    const relatedFields: { type: RelationshipType; value: string }[] = [];
    for (const [key, value] of Object.entries(cache.frontmatter)) {
      if (key.startsWith('RELATED')) {
        const typeMatch = key.match(/RELATED(?:;TYPE=([^;]+))?/);
        if (typeMatch && value) {
          const type = typeMatch[1] || 'relative';
          relatedFields.push({ type: type as RelationshipType, value: value as string });
        }
      }
    }

    if (relatedFields.length > 0) {
      this.graph.updateContactFromRelatedFields(uid, relatedFields);
      loggingService.debug(`[RelationshipEventHandler] Updated graph from ${relatedFields.length} front matter relationships for: ${uid}`);
    }
  }

  private handleLayoutChange(): void {
    // Track current contact file for debounced operations
    const activeFile = this.getActiveContactFile();
    if (activeFile !== this.currentContactFile) {
      this.currentContactFile = activeFile;
      
      if (this.currentContactFile) {
        loggingService.debug(`[RelationshipEventHandler] Active contact changed to: ${this.currentContactFile.path}`);
      }
    }
  }

  private handleAppClose(): void {
    loggingService.info('[RelationshipEventHandler] App closing, performing final sync...');
    
    // Cancel all pending operations
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Get the currently active contact file
   */
  private getActiveContactFile(): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && this.contactUtils.isValidContact(activeFile)) {
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
    this.debounceSync({ path: '__global_consistency__' } as TFile, async () => {
      await this.withGlobalLock(async () => {
        loggingService.info('[RelationshipEventHandler] Performing scheduled consistency check...');
        // TODO: Implement global consistency check if needed
      });
    }, 5000); // Longer delay for global operations
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
        loggingService.error(`[RelationshipEventHandler] Error in debounced sync for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
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