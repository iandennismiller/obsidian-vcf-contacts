import { App, TFile } from 'obsidian';
import { RelationshipGraph } from './relationshipGraph';
import { RelationshipEventHandler } from './relationshipEventHandler';
import { RelationshipSyncManager } from './relationshipSyncManager';
import { 
  RelationshipUpdate, 
  ConsistencyCheckResult, 
  RelationshipType,
  ContactNote
} from './types';
import { normalizeGender } from './genderUtils';
import { loggingService } from 'src/services/loggingService';

/**
 * Main orchestrator for relationship management - coordinates between different modules
 */
export class RelationshipManager {
  private app: App;
  private graph: RelationshipGraph;
  private eventHandler: RelationshipEventHandler;
  private syncManager: RelationshipSyncManager;
  private contactsFolder: string;
  private isInitialized = false;

  constructor(app: App, contactsFolder: string = 'Contacts') {
    this.app = app;
    this.contactsFolder = contactsFolder;
    this.graph = new RelationshipGraph();
    this.eventHandler = new RelationshipEventHandler(app);
    this.syncManager = new RelationshipSyncManager(app, this.graph);
  }

  /**
   * Initialize the relationship manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    loggingService.info('[RelationshipManager] Initializing relationship manager...');
    
    // Load all contacts into the graph
    await this.initializeGraph();
    
    // Register event handlers
    this.eventHandler.registerHandlers({
      onFileOpen: this.handleFileOpen.bind(this),
      onActiveLeafChange: this.handleActiveLeafChange.bind(this),
      onEditorChange: this.handleEditorChange.bind(this),
      onLayoutChange: this.handleLayoutChange.bind(this),
      onAppClose: this.handleAppClose.bind(this),
      onConsistencyCheck: this.checkConsistency.bind(this)
    });

    this.isInitialized = true;
    loggingService.info('[RelationshipManager] Relationship manager initialized');
  }

  /**
   * Cleanup and unregister handlers
   */
  async cleanup(): Promise<void> {
    this.eventHandler.unregisterHandlers();
    this.isInitialized = false;
    loggingService.info('[RelationshipManager] Relationship manager cleanup completed');
  }

  /**
   * Initialize the graph from all contacts
   */
  async initializeGraph(): Promise<void> {
    const contactFiles = await this.getContactFiles();
    
    loggingService.info(`[RelationshipManager] Loading ${contactFiles.length} contacts into graph...`);
    
    // First pass: Add all nodes
    for (const file of contactFiles) {
      await this.addContactToGraph(file);
    }

    // Second pass: Load relationships
    for (const file of contactFiles) {
      await this.loadContactRelationships(file);
    }

    const stats = this.graph.getStats();
    loggingService.info(`[RelationshipManager] Graph initialized with ${stats.nodes} nodes and ${stats.edges} relationships`);
    
    // Run initial consistency check
    await this.checkConsistency();
  }

  /**
   * Add a relationship
   */
  async addRelationship(update: RelationshipUpdate): Promise<void> {
    await this.eventHandler.withGlobalLock(async () => {
      loggingService.info(`[RelationshipManager] Adding relationship: ${update.sourceUid} -[${update.relationshipType}]-> ${update.targetUid}`);
      
      // Add to graph
      this.graph.addRelationship(update.sourceUid, update.targetUid, update.relationshipType);
      
      // Update front matter for both contacts
      const sourceFile = this.findContactFileByUid(update.sourceUid);
      const targetFile = this.findContactFileByUid(update.targetUid);
      
      if (sourceFile) {
        await this.syncManager.updateFrontmatterFromGraph(sourceFile, update.sourceUid);
      }
      
      if (targetFile) {
        // Add reciprocal relationship if applicable
        const reciprocalType = this.getReciprocalRelationshipType(update.relationshipType);
        if (reciprocalType) {
          this.graph.addRelationship(update.targetUid, update.sourceUid, reciprocalType);
          await this.syncManager.updateFrontmatterFromGraph(targetFile, update.targetUid);
        }
      }
      
      // Update Related lists
      if (sourceFile) {
        await this.syncManager.syncFrontmatterToRelatedList(sourceFile);
      }
      if (targetFile) {
        await this.syncManager.syncFrontmatterToRelatedList(targetFile);
      }
    });
  }

  /**
   * Remove a relationship
   */
  async removeRelationship(update: RelationshipUpdate): Promise<void> {
    await this.eventHandler.withGlobalLock(async () => {
      loggingService.info(`[RelationshipManager] Removing relationship: ${update.sourceUid} -[${update.relationshipType}]-> ${update.targetUid}`);
      
      // Remove from graph
      this.graph.removeRelationship(update.sourceUid, update.targetUid, update.relationshipType);
      
      // Remove reciprocal relationship if applicable
      const reciprocalType = this.getReciprocalRelationshipType(update.relationshipType);
      if (reciprocalType) {
        this.graph.removeRelationship(update.targetUid, update.sourceUid, reciprocalType);
      }
      
      // Update front matter for both contacts
      const sourceFile = this.findContactFileByUid(update.sourceUid);
      const targetFile = this.findContactFileByUid(update.targetUid);
      
      if (sourceFile) {
        await this.syncManager.updateFrontmatterFromGraph(sourceFile, update.sourceUid);
        await this.syncManager.syncFrontmatterToRelatedList(sourceFile);
      }
      
      if (targetFile) {
        await this.syncManager.updateFrontmatterFromGraph(targetFile, update.targetUid);
        await this.syncManager.syncFrontmatterToRelatedList(targetFile);
      }
    });
  }

  /**
   * Check for consistency issues
   */
  async checkConsistency(): Promise<ConsistencyCheckResult> {
    return await this.eventHandler.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Running consistency check...');
      
      const graphConsistency = this.graph.checkConsistency();
      const contactFiles = await this.getContactFiles();
      const inconsistentContacts: string[] = [];
      
      // Check each contact's front matter consistency with graph
      for (const file of contactFiles) {
        const uid = this.extractUidFromFile(file);
        if (!uid) continue;
        
        const isConsistent = await this.checkContactConsistency(file, uid);
        if (!isConsistent) {
          inconsistentContacts.push(uid);
        }
      }
      
      const result: ConsistencyCheckResult = {
        totalContacts: contactFiles.length,
        inconsistentContacts,
        missingReciprocals: graphConsistency.missingReciprocals,
        duplicateEdges: graphConsistency.duplicateEdges
      };
      
      loggingService.info(`[RelationshipManager] Consistency check complete. Issues: ${inconsistentContacts.length} inconsistent contacts, ${result.missingReciprocals.length} missing reciprocals, ${result.duplicateEdges.length} duplicate edges`);
      
      return result;
    });
  }

  /**
   * Fix consistency issues
   */
  async fixConsistency(): Promise<void> {
    await this.eventHandler.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Fixing consistency issues...');
      
      const consistencyResult = await this.checkConsistency();
      
      // Fix missing reciprocals
      for (const missing of consistencyResult.missingReciprocals) {
        this.graph.addRelationship(missing.targetUid, missing.sourceUid, missing.reciprocalType);
        
        const targetFile = this.findContactFileByUid(missing.targetUid);
        if (targetFile) {
          await this.syncManager.updateFrontmatterFromGraph(targetFile, missing.targetUid);
        }
      }
      
      // Remove duplicate edges (keep first occurrence)
      for (const duplicate of consistencyResult.duplicateEdges) {
        this.graph.removeRelationship(duplicate.sourceUid, duplicate.targetUid, duplicate.relationshipType);
      }
      
      loggingService.info('[RelationshipManager] Consistency issues fixed');
    });
  }

  /**
   * Manually rebuild the graph from contacts
   */
  async rebuildGraph(): Promise<void> {
    await this.eventHandler.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Rebuilding relationship graph...');
      
      this.graph.clear();
      await this.initializeGraph();
      
      loggingService.info('[RelationshipManager] Graph rebuild completed');
    });
  }

  /**
   * Get relationship statistics
   */
  getStats(): { nodes: number; edges: number } {
    return this.graph.getStats();
  }

  // Event handlers

  private async handleFileOpen(file: TFile | null): Promise<void> {
    if (!file) return;
    
    const uid = this.extractUidFromFile(file);
    if (!uid) return;
    
    loggingService.debug(`[RelationshipManager] Contact file opened: ${file.path}`);
    
    // Sync from front matter to Related list if needed
    await this.syncFromFrontMatterToRelatedList(file, uid);
  }

  private async handleActiveLeafChange(): Promise<void> {
    // Handle active leaf changes if needed
    loggingService.debug('[RelationshipManager] Active leaf changed');
  }

  private async handleEditorChange(file: TFile): Promise<void> {
    const uid = this.extractUidFromFile(file);
    if (!uid) return;
    
    loggingService.debug(`[RelationshipManager] Editor changed for contact: ${file.path}`);
    
    // Parse the Related list and update graph
    await this.syncFromRelatedListToGraph(file, uid);
  }

  private async handleLayoutChange(): Promise<void> {
    // Handle layout changes if needed
    loggingService.debug('[RelationshipManager] Layout changed');
  }

  private async handleAppClose(): Promise<void> {
    loggingService.info('[RelationshipManager] App closing, performing final sync...');
    
    const activeFile = this.eventHandler.currentFile;
    if (activeFile) {
      const uid = this.extractUidFromFile(activeFile);
      if (uid) {
        await this.syncFromRelatedListToFrontMatter(activeFile, uid);
      }
    }
  }

  // Helper methods

  private async getContactFiles(): Promise<TFile[]> {
    const contactFiles: TFile[] = [];
    const folder = this.app.vault.getAbstractFileByPath(this.contactsFolder);
    
    if (!folder) {
      loggingService.warning(`[RelationshipManager] Contacts folder not found: ${this.contactsFolder}`);
      return contactFiles;
    }

    const processFolder = async (folderPath: string): Promise<void> => {
      const files = this.app.vault.getMarkdownFiles();
      for (const file of files) {
        if (file.path.startsWith(folderPath) && this.isContactFile(file)) {
          contactFiles.push(file);
        }
      }
    };

    await processFolder(this.contactsFolder);
    return contactFiles;
  }

  private isContactFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID);
  }

  private extractUidFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.UID || null;
  }

  private findContactFileByUid(uid: string): TFile | null {
    const node = this.graph.getNode(uid);
    return node?.file || null;
  }

  private async addContactToGraph(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.UID) return;

    const uid = cache.frontmatter.UID;
    const fullName = this.extractFullName(cache.frontmatter);
    const gender = normalizeGender(cache.frontmatter.GENDER || '');

    this.graph.addNode(uid, fullName, gender, file);
  }

  private async loadContactRelationships(file: TFile): Promise<void> {
    const uid = this.extractUidFromFile(file);
    if (!uid) return;

    const content = await this.app.vault.read(file);
    const relationships = this.syncManager.parseRelatedSection(content);
    
    await this.syncManager.updateGraphFromRelatedList(uid, relationships);
  }

  private extractFullName(frontMatter: Record<string, any>): string {
    const fn = frontMatter['N.FN'] || frontMatter.FN;
    const gn = frontMatter['N.GN'] || frontMatter.GN;
    
    if (fn && gn) {
      return `${gn} ${fn}`;
    }
    return fn || gn || frontMatter.UID || 'Unknown';
  }

  private async checkContactConsistency(file: TFile, uid: string): Promise<boolean> {
    // Implementation would check if front matter matches graph relationships
    // For now, return true
    return true;
  }

  private async syncFromFrontMatterToRelatedList(file: TFile, uid: string): Promise<void> {
    await this.syncManager.syncFrontmatterToRelatedList(file);
  }

  private async syncFromRelatedListToGraph(file: TFile, uid: string): Promise<void> {
    const content = await this.app.vault.read(file);
    const relationships = this.syncManager.parseRelatedSection(content);
    await this.syncManager.updateGraphFromRelatedList(uid, relationships);
  }

  private async syncFromRelatedListToFrontMatter(file: TFile, uid: string): Promise<void> {
    // First sync Related list to graph
    await this.syncFromRelatedListToGraph(file, uid);
    // Then sync graph to front matter
    await this.syncManager.updateFrontmatterFromGraph(file, uid);
  }

  private getReciprocalRelationshipType(type: RelationshipType): RelationshipType | null {
    const reciprocals: Record<RelationshipType, RelationshipType> = {
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      spouse: 'spouse',
      friend: 'friend',
      colleague: 'colleague',
      relative: 'relative',
      auncle: 'nibling',
      nibling: 'auncle',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
      cousin: 'cousin',
      partner: 'partner'
    };
    
    return reciprocals[type] || null;
  }
}