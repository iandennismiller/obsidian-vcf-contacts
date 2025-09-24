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
    
    // Note: Event listeners are disabled - sync only occurs during initialization and manual commands
  }

  /**
   * Initialize the relationship graph with existing contacts and perform comprehensive sync
   * This method does everything needed for relationship consistency in one go:
   * 1. Build relationship graph from all contacts' front matter
   * 2. Check for missing reciprocal relationships
   * 3. Sync Related lists to front matter and graph
   * 4. Ensure all relationships are bidirectional
   */
  async initializeFromVault(): Promise<void> {
    return this.eventHandler.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Starting comprehensive initialization and sync...');
      
      const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.includes('Contacts/') || file.path.includes('contacts/')
      );

      loggingService.info(`[RelationshipManager] Found ${contactFiles.length} potential contact files`);

      // PHASE 1: Load all contacts into graph based on front matter
      loggingService.info('[RelationshipManager] PHASE 1: Building relationship graph from front matter...');
      for (const file of contactFiles) {
        await this.loadContactIntoGraph(file);
      }
      loggingService.info(`[RelationshipManager] Graph initialized with relationships from ${contactFiles.length} contacts`);

      // PHASE 2: Comprehensive sync - examine Related lists and ensure consistency
      loggingService.info('[RelationshipManager] PHASE 2: Performing comprehensive relationship sync...');
      await this.performComprehensiveSync(contactFiles);
      
      // PHASE 3: Find and correct missing reciprocal relationships
      loggingService.info('[RelationshipManager] PHASE 3: Finding and correcting missing reciprocal relationships...');
      await this.findAndCorrectMissingReciprocals(contactFiles);
      
      loggingService.info('[RelationshipManager] Comprehensive initialization and sync complete');
    });
  }

  /**
   * Perform comprehensive sync on all contact files
   * Examines Related lists and ensures they are reflected in graph and front matter
   */
  private async performComprehensiveSync(contactFiles: TFile[]): Promise<void> {
    loggingService.info(`[RelationshipManager] Starting comprehensive sync on ${contactFiles.length} contact files...`);
    
    let syncedFiles = 0;
    
    for (const file of contactFiles) {
      try {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter?.UID) continue;
        
        const uid = cache.frontmatter.UID;
        const content = await this.app.vault.read(file);
        
        // Parse relationships from Related list in content
        const relatedSection = this.contentParser.extractRelatedSection(content);
        const relatedListRelationships = relatedSection ? this.contentParser.parseRelatedSection(relatedSection) : [];
        
        if (relatedListRelationships.length > 0) {
          loggingService.info(`[RelationshipManager] Processing ${file.path}: ${relatedListRelationships.length} relationships in Related list`);
          
          // Update graph with Related list relationships (merge, don't replace)
          await this.syncManager.updateGraphFromRelatedList(uid, relatedListRelationships);
          
          // Merge Related list relationships with existing front matter (never remove, only add)
          await this.syncManager.mergeRelatedListToFrontmatter(file, relatedListRelationships);
          
          syncedFiles++;
        } else {
          loggingService.info(`[RelationshipManager] ${file.path}: No Related list found`);
        }
        
      } catch (error) {
        loggingService.error(`[RelationshipManager] Error syncing ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    loggingService.info(`[RelationshipManager] Comprehensive sync complete: ${syncedFiles} files had Related list relationships`);
  }

  /**
   * Find and correct missing reciprocal relationships
   * Ensures all relationships in the graph are bidirectional and reflected in both contacts
   */
  private async findAndCorrectMissingReciprocals(contactFiles: TFile[]): Promise<void> {
    loggingService.info(`[RelationshipManager] Finding missing reciprocal relationships...`);
    
    const contactFilesByUID = new Map<string, TFile>();
    
    // Build UID to file mapping
    for (const file of contactFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID) {
        contactFilesByUID.set(cache.frontmatter.UID, file);
      }
    }
    
    let addedReciprocals = 0;
    
    // Check each relationship in the graph for missing reciprocals
    for (const sourceUID of this.graph.getAllContactUIDs()) {
      const relationships = this.graph.getContactRelationships(sourceUID);
      
      for (const relationship of relationships) {
        const targetUID = relationship.targetUid;
        const reciprocalType = this.getReciprocalRelationshipType(relationship.type);
        
        if (reciprocalType && contactFilesByUID.has(targetUID)) {
          // Check if the reciprocal relationship exists
          const targetRelationships = this.graph.getContactRelationships(targetUID);
          const hasReciprocal = targetRelationships.some((r: { type: RelationshipType; targetUid: string; targetName: string }) => 
            r.targetUid === sourceUID && r.type === reciprocalType
          );
          
          if (!hasReciprocal) {
            loggingService.info(`[RelationshipManager] Missing reciprocal: ${targetUID} should have ${reciprocalType} -> ${sourceUID}`);
            
            // Add the reciprocal relationship to the graph
            const sourceFile = contactFilesByUID.get(sourceUID);
            const targetFile = contactFilesByUID.get(targetUID);
            
            if (sourceFile && targetFile && reciprocalType) {
              const sourceCache = this.app.metadataCache.getFileCache(sourceFile);
              const sourceName = sourceCache?.frontmatter?.FN || sourceFile.basename;
              
              // Add to graph
              this.graph.addRelationship(targetUID, reciprocalType, sourceUID);
              
              // Add to target file's front matter
              await this.syncManager.addRelationshipToFrontMatter(targetFile, reciprocalType, sourceName);
              
              // Add to target file's Related list
              await this.addRelationshipToRelatedList(targetFile, reciprocalType, sourceName);
              
              addedReciprocals++;
            }
          }
        }
      }
    }
    
    loggingService.info(`[RelationshipManager] Added ${addedReciprocals} missing reciprocal relationships`);
  }

  /**
   * Get the reciprocal relationship type for a given type
   */
  private getReciprocalRelationshipType(type: RelationshipType): RelationshipType | null {
    const reciprocals: Record<RelationshipType, RelationshipType> = {
      'parent': 'child',
      'child': 'parent',
      'sibling': 'sibling',
      'spouse': 'spouse',
      'partner': 'partner',
      'friend': 'friend',
      'colleague': 'colleague',
      'relative': 'relative',
      'auncle': 'nibling',
      'nibling': 'auncle',
      'grandparent': 'grandchild',
      'grandchild': 'grandparent',
      'cousin': 'cousin'
    };
    
    return reciprocals[type] || null;
  }

  /**
   * Add a relationship to a file's Related list
   */
  private async addRelationshipToRelatedList(file: TFile, type: RelationshipType, contactName: string): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      
      // Find or create Related section
      let relatedSectionStart = -1;
      let relatedSectionEnd = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '## Related') {
          relatedSectionStart = i;
          // Find the end of the Related section
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith('##') || lines[j].startsWith('#')) {
              relatedSectionEnd = j;
              break;
            }
          }
          if (relatedSectionEnd === -1) {
            relatedSectionEnd = lines.length;
          }
          break;
        }
      }
      
      const relationshipLine = `- ${type}: [[${contactName}]]`;
      
      if (relatedSectionStart === -1) {
        // No Related section exists, create it at the end
        lines.push('', '## Related', '', relationshipLine, '');
      } else {
        // Related section exists, check if relationship already exists
        const relatedLines = lines.slice(relatedSectionStart + 1, relatedSectionEnd);
        const alreadyExists = relatedLines.some(line => 
          line.includes(`${type}:`) && line.includes(`[[${contactName}]]`)
        );
        
        if (!alreadyExists) {
          // Insert the new relationship
          let insertIndex = relatedSectionStart + 1;
          while (insertIndex < relatedSectionEnd && lines[insertIndex].trim() === '') {
            insertIndex++;
          }
          lines.splice(insertIndex, 0, relationshipLine);
        }
      }
      
      const newContent = lines.join('\n');
      await this.app.vault.modify(file, newContent);
      
      loggingService.info(`[RelationshipManager] Added ${type}: ${contactName} to Related list in ${file.path}`);
      
    } catch (error) {
      loggingService.error(`[RelationshipManager] Error adding relationship to Related list in ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
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