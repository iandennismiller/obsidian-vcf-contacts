import { TFile, App } from 'obsidian';
import { RelationshipGraph, RelationshipType, Gender } from './relationshipGraph';
import { RelationshipEventHandler } from './relationshipEventHandler';
import { RelationshipContentParser } from './relationshipContentParser';
import { RelationshipSyncManager } from './relationshipSyncManager';
import { loggingService } from '../services/loggingService';

/**
 * Main orchestrator for relationship management - coordinates between different modules
 */
export class RelationshipManager {
  private graph: RelationshipGraph;
  private app: App;
  private eventHandler: RelationshipEventHandler;
  private contentParser: RelationshipContentParser;
  private syncManager: RelationshipSyncManager;

  constructor(app: App) {
    this.app = app;
    this.graph = new RelationshipGraph();
    
    // Initialize sub-modules
    this.eventHandler = new RelationshipEventHandler(app);
    this.contentParser = new RelationshipContentParser(app);
    this.syncManager = new RelationshipSyncManager(app, this.graph);
    
    // Set up event callbacks
    this.eventHandler.setCallbacks({
      onFileOpen: (file) => this.handleFileSync(file),
      onActiveLeafChange: () => this.handleActiveLeafChange(),
      onEditorChange: (file) => this.handleEditorChange(file),
      onLayoutChange: () => this.handleLayoutChange(),
      onAppClose: () => this.handleAppClose(),
      onConsistencyCheck: () => this.ensureGraphConsistency()
    });
    
    this.eventHandler.setupEventListeners();
  }

  /**
   * Initialize the relationship graph with existing contacts and ensure consistency
   */
  async initializeFromVault(): Promise<void> {
    return this.eventHandler.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Initializing from vault...');
      
      const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.includes('Contacts/') || file.path.includes('contacts/')
      );

      loggingService.info(`[RelationshipManager] Found ${contactFiles.length} potential contact files`);

      for (const file of contactFiles) {
        await this.loadContactIntoGraph(file);
      }

      loggingService.info('[RelationshipManager] Graph initialized with contacts, performing consistency check...');
      await this.performStartupConsistencyCheck(contactFiles);
      loggingService.info('[RelationshipManager] Initialization complete');
    });
  }

  /**
   * Perform startup consistency check on all contact files
   */
  private async performStartupConsistencyCheck(contactFiles: TFile[]): Promise<void> {
    loggingService.info(`[RelationshipManager] Starting consistency check on ${contactFiles.length} contact files...`);
    
    let inconsistentFiles = 0;
    
    for (const file of contactFiles) {
      try {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter?.UID) continue;
        
        const uid = cache.frontmatter.UID;
        const content = await this.app.vault.read(file);
        
        // Parse relationships from Related list in content
        const relatedSection = this.contentParser.extractRelatedSection(content);
        const relatedListRelationships = relatedSection ? this.contentParser.parseRelatedSection(relatedSection) : [];
        
        // Parse relationships from front matter  
        const frontMatterRelationships = this.contentParser.parseRelatedFromFrontmatter(cache.frontmatter);
        
        // Check for inconsistencies
        const relatedListSet = new Set(relatedListRelationships.map(r => `${r.type}:${r.contactName}`));
        const frontMatterSet = new Set(frontMatterRelationships.map(r => `${r.type}:${r.value}`));
        
        // Count items in Related list not in front matter
        const missingInFrontMatter = [...relatedListSet].filter(item => !frontMatterSet.has(item));
        
        if (missingInFrontMatter.length > 0) {
          loggingService.info(`[RelationshipManager] Inconsistency in ${file.path}: ${missingInFrontMatter.length} relationships in Related list missing from front matter`);
          
          // Update graph with Related list relationships (merge, don't replace)
          await this.syncManager.updateGraphFromRelatedList(uid, relatedListRelationships);
          
          // Direct merge with existing front matter (never remove, only add)
          await this.syncManager.mergeRelatedListToFrontmatter(file, relatedListRelationships);
          
          inconsistentFiles++;
        }
        
      } catch (error) {
        loggingService.error(`[RelationshipManager] Error checking consistency for ${file.path}: ${error.message}`);
      }
    }
    
    loggingService.info(`[RelationshipManager] Startup consistency check complete. Fixed ${inconsistentFiles} inconsistent files.`);
  }

  /**
   * Load a contact file into the relationship graph
   */
  private async loadContactIntoGraph(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return;

    const { UID, FN, N, GENDER } = cache.frontmatter;
    if (!UID) return;

    // Add contact to graph
    const fullName = FN || (N ? `${N.split(';')[1] || ''} ${N.split(';')[0] || ''}`.trim() : '') || file.basename;
    const gender = GENDER || '';
    
    this.graph.addContact(UID, fullName, gender, file);

    // Add relationships from front matter
    const relationships = this.contentParser.parseRelatedFromFrontmatter(cache.frontmatter);
    for (const rel of relationships) {
      // Try to find the target contact
      const targetContact = this.graph.getAllContacts().find(c => 
        c.uid === rel.value || c.fullName === rel.value
      );
      
      if (targetContact) {
        this.graph.addRelationship(UID, targetContact.uid, rel.type);
      }
    }
  }

  /**
   * Public API methods
   */
  
  /**
   * Manually trigger sync for the currently active contact file
   */
  public async syncCurrentFile(): Promise<void> {
    const currentFile = this.eventHandler.currentFile;
    if (currentFile) {
      loggingService.info(`[RelationshipManager] Manual sync triggered for current file: ${currentFile.path}`);
      await this.syncRelatedListToFrontmatter(currentFile);
    } else {
      loggingService.info(`[RelationshipManager] No current contact file to sync`);
    }
  }

  /**
   * Manually trigger sync for a specific file
   */
  public async syncFile(file: TFile): Promise<void> {
    if (this.isContactFile(file) && !this.eventHandler.isLocked) {
      loggingService.info(`[RelationshipManager] Manual sync triggered for file: ${file.path}`);
      await this.syncRelatedListToFrontmatter(file);
    }
  }

  /**
   * Event handlers
   */
  
  private async handleFileSync(file: TFile): Promise<void> {
    if (file && this.isContactFile(file)) {
      await this.syncRelatedListToFrontmatter(file);
    }
  }

  private async handleActiveLeafChange(): Promise<void> {
    const currentFile = this.eventHandler.currentFile;
    if (currentFile) {
      await this.syncRelatedListToFrontmatter(currentFile);
    }
  }

  private async handleEditorChange(file: TFile): Promise<void> {
    if (this.isContactFile(file)) {
      await this.syncRelatedListToFrontmatter(file);
    }
  }

  private async handleLayoutChange(): Promise<void> {
    const currentFile = this.eventHandler.currentFile;
    if (currentFile) {
      await this.syncRelatedListToFrontmatter(currentFile);
    }
  }

  private handleAppClose(): void {
    const currentFile = this.eventHandler.currentFile;
    if (currentFile) {
      // Synchronous sync for app close
      this.syncRelatedListToFrontmatter(currentFile);
    }
  }

  /**
   * Core sync operations
   */
  
  /**
   * Sync the Related list in markdown to frontmatter
   */
  private async syncRelatedListToFrontmatter(file: TFile): Promise<void> {
    loggingService.info(`[RelationshipManager] syncRelatedListToFrontmatter called for: ${file.path}`);
    
    if (this.eventHandler.isSyncingFile(file.path) || this.eventHandler.isLocked) {
      loggingService.info(`[RelationshipManager] Skipping sync - already syncing or locked: ${file.path}`);
      return;
    }

    await this.eventHandler.withGlobalLock(async () => {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter?.UID) {
        loggingService.info(`[RelationshipManager] No UID in frontmatter: ${file.path}`);
        return;
      }

      const uid = cache.frontmatter.UID;
      const content = await this.app.vault.read(file);
      
      loggingService.info(`[RelationshipManager] Processing relationships for UID: ${uid}`);
      
      // Find and parse the Related section
      const relatedSection = this.contentParser.extractRelatedSection(content);
      if (!relatedSection) {
        loggingService.info(`[RelationshipManager] No Related section found: ${file.path}`);
        return;
      }

      const relationships = this.contentParser.parseRelatedSection(relatedSection);
      loggingService.info(`[RelationshipManager] Found ${relationships.length} relationships in: ${file.path}`);
      
      this.eventHandler.addSyncingFile(file.path);
      try {
        // Update graph with new relationships (merge, don't replace)
        await this.syncManager.updateGraphFromRelatedList(uid, relationships);
        
        // DIRECT merge: combine Related list relationships with existing front matter
        await this.syncManager.mergeRelatedListToFrontmatter(file, relationships);
        
        loggingService.info(`[RelationshipManager] Successfully synced: ${file.path}`);
        
        // Schedule consistency check and propagation (debounced)
        this.eventHandler.scheduleConsistencyCheck();
        await this.syncManager.propagateRelationshipChanges(uid);

      } finally {
        this.eventHandler.removeSyncingFile(file.path);
      }
    });
  }

  /**
   * Utility methods
   */
  
  private isContactFile(file: TFile | null): boolean {
    if (!file) return false;
    
    // Check if it's in a contacts directory or has UID in front matter
    if (file.path.includes('Contacts/') || file.path.includes('contacts/')) {
      return true;
    }
    
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID);
  }

  private async ensureGraphConsistency(): Promise<void> {
    loggingService.info('[RelationshipManager] Ensuring graph consistency...');
    
    // Basic consistency checks and fixes
    const allContacts = this.graph.getAllContacts();
    for (const contact of allContacts) {
      if (contact.file) {
        const cache = this.app.metadataCache.getFileCache(contact.file);
        if (cache?.frontmatter?.UID && cache.frontmatter.UID !== contact.uid) {
          // UID mismatch - update graph
          loggingService.info(`[RelationshipManager] Fixing UID mismatch for ${contact.file.path}`);
          // Could add more sophisticated reconciliation here
        }
      }
    }
  }

  /**
   * Get access to sub-modules for testing or advanced usage
   */
  get modules() {
    return {
      graph: this.graph,
      eventHandler: this.eventHandler,
      contentParser: this.contentParser,
      syncManager: this.syncManager
    };
  }
}