import { App, TFile, Plugin } from 'obsidian';
import { RelationshipGraph } from './relationshipGraph';
import { RelationshipSyncManager } from './relationshipSyncManager';
import { RelationshipEventHandler } from './relationshipEventHandler';
import { RelationshipContentParser } from './relationshipContentParser';
import { ContactUtils } from './contactUtils';
import { RelationshipType, Gender } from './relationshipTypes';
import { loggingService } from '../services/loggingService';
import { ContactsPluginSettings } from '../settings/settings.d';

/**
 * Main orchestrator for relationship management - coordinates between different modules
 */
export class RelationshipManager {
  private app: App;
  private plugin: Plugin;
  private settings: ContactsPluginSettings;
  private graph: RelationshipGraph;
  private syncManager: RelationshipSyncManager;
  private eventHandler: RelationshipEventHandler;
  private contentParser: RelationshipContentParser;
  private contactUtils: ContactUtils;
  private initialized = false;

  constructor(app: App, plugin: Plugin, settings: ContactsPluginSettings) {
    this.app = app;
    this.plugin = plugin;
    this.settings = settings;
    
    // Initialize core components
    this.graph = new RelationshipGraph();
    this.contactUtils = new ContactUtils(app, settings);
    this.contentParser = new RelationshipContentParser(app);
    this.syncManager = new RelationshipSyncManager(app, this.graph, this.contentParser, this.contactUtils);
    this.eventHandler = new RelationshipEventHandler(app, this.contactUtils);
    
    // Set up event callbacks
    this.eventHandler.setCallbacks({
      onFileOpen: this.handleFileOpen.bind(this),
      onActiveLeafChange: this.handleActiveLeafChange.bind(this),
      onEditorChange: this.handleEditorChange.bind(this),
      onLayoutChange: this.handleLayoutChange.bind(this),
      onAppClose: this.handleAppClose.bind(this),
      onConsistencyCheck: this.performConsistencyCheck.bind(this)
    });
  }

  /**
   * Initialize the relationship manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      loggingService.warn('[RelationshipManager] Already initialized');
      return;
    }

    loggingService.info('[RelationshipManager] Initializing relationship management system...');
    
    try {
      // Initialize event handlers
      this.eventHandler.initialize();
      
      // Load all contacts into the graph
      await this.loadAllContacts();
      
      // Register Obsidian commands
      this.registerCommands();
      
      // Perform initial consistency check
      this.eventHandler.scheduleConsistencyCheck();
      
      this.initialized = true;
      loggingService.info('[RelationshipManager] Relationship management system initialized');
    } catch (error) {
      loggingService.error(`[RelationshipManager] Failed to initialize: ${error}`);
      throw error;
    }
  }

  /**
   * Clean up and shutdown
   */
  cleanup(): void {
    if (!this.initialized) {
      return;
    }
    
    this.eventHandler.cleanup();
    this.graph.clear();
    this.initialized = false;
    
    loggingService.info('[RelationshipManager] Relationship management system cleaned up');
  }

  /**
   * Update settings
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
    this.contactUtils.updateSettings(settings);
  }

  /**
   * Load all contacts into the graph
   */
  private async loadAllContacts(): Promise<void> {
    const contactFiles = this.contactUtils.getContactFiles();
    loggingService.info(`[RelationshipManager] Loading ${contactFiles.length} contacts into graph...`);
    
    for (const file of contactFiles) {
      try {
        const uid = this.contactUtils.extractUIDFromFile(file);
        if (uid) {
          const name = this.contactUtils.getContactName(file);
          const gender = this.contactUtils.getContactGender(file) as Gender;
          
          // Add contact to graph
          this.graph.addContact(uid, name, gender, file);
          
          // Load relationships from front matter
          const cache = this.app.metadataCache.getFileCache(file);
          if (cache?.frontmatter) {
            const relatedFields = this.contentParser.parseRelatedFromFrontmatter(cache.frontmatter);
            if (relatedFields.length > 0) {
              try {
                this.graph.updateContactFromRelatedFields(uid, relatedFields);
              } catch (error) {
                loggingService.warn(`[RelationshipManager] Could not load relationships for ${uid}: ${error}`);
              }
            }
          }
        }
      } catch (error) {
        loggingService.error(`[RelationshipManager] Error loading contact ${file.path}: ${error}`);
      }
    }
    
    const stats = this.graph.getStatistics();
    loggingService.info(`[RelationshipManager] Loaded ${stats.contactCount} contacts with ${stats.relationshipCount} relationships`);
  }

  /**
   * Register Obsidian commands
   */
  private registerCommands(): void {
    // Command to rebuild the relationship graph
    this.plugin.addCommand({
      id: 'vcf-contacts-rebuild-relationship-graph',
      name: 'Rebuild Relationship Graph',
      callback: () => {
        this.rebuildRelationshipGraph();
      }
    });

    // Command to perform comprehensive sync
    this.plugin.addCommand({
      id: 'vcf-contacts-sync-relationships',
      name: 'Sync All Relationships',
      callback: () => {
        this.performComprehensiveSync();
      }
    });

    // Command to check relationship consistency
    this.plugin.addCommand({
      id: 'vcf-contacts-check-relationship-consistency',
      name: 'Check Relationship Consistency',
      callback: () => {
        this.performConsistencyCheck();
      }
    });

    loggingService.info('[RelationshipManager] Registered relationship commands');
  }

  /**
   * Handle file open events
   */
  private async handleFileOpen(file: TFile | null): Promise<void> {
    if (!file || !this.contactUtils.isContactFile(file)) {
      return;
    }
    
    loggingService.info(`[RelationshipManager] Contact file opened: ${file.path}`);
    
    // Check if contact needs a Related section
    const content = await this.app.vault.read(file);
    const hasRelatedSection = content.match(/^#{1,6}\s*related\s*$/im);
    
    if (!hasRelatedSection) {
      // Check if contact has relationships in front matter or graph
      const uid = this.contactUtils.extractUIDFromFile(file);
      if (uid && this.graph.hasContact(uid)) {
        const relationships = this.graph.getContactRelationships(uid);
        if (relationships.length > 0) {
          // Add Related section
          await this.addRelatedSectionToFile(file);
        }
      }
    }
  }

  /**
   * Handle active leaf change events
   */
  private handleActiveLeafChange(): void {
    // Could be used for UI updates in the future
  }

  /**
   * Handle editor change events
   */
  private async handleEditorChange(file: TFile): Promise<void> {
    if (!this.contactUtils.isContactFile(file)) {
      return;
    }
    
    // Sync the Related list to front matter
    await this.syncRelatedListToFrontmatter(file);
  }

  /**
   * Handle layout change events
   */
  private handleLayoutChange(): void {
    // Could be used for UI updates in the future
  }

  /**
   * Handle app close events
   */
  private handleAppClose(): void {
    this.cleanup();
  }

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
      const uid = this.contactUtils.extractUIDFromFile(file);
      if (!uid) {
        loggingService.info(`[RelationshipManager] No UID in frontmatter: ${file.path}`);
        return;
      }
      
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
        
        // Propagate changes to related contacts
        await this.syncManager.propagateRelationshipChanges(uid);
      } finally {
        this.eventHandler.removeSyncingFile(file.path);
      }
    });
  }

  /**
   * Add a Related section to a file
   */
  private async addRelatedSectionToFile(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    
    // Check if Related section already exists
    if (content.match(/^#{1,6}\s*related\s*$/im)) {
      return;
    }
    
    // Add Related section before any existing sections or at the end
    const firstSectionMatch = content.match(/^#{1,6}\s+/m);
    let newContent: string;
    
    if (firstSectionMatch) {
      const insertPos = content.indexOf(firstSectionMatch[0]);
      newContent = content.slice(0, insertPos) + '\n## Related\n\n' + content.slice(insertPos);
    } else {
      newContent = content + '\n\n## Related\n\n';
    }
    
    await this.app.vault.modify(file, newContent);
    loggingService.info(`[RelationshipManager] Added Related section to: ${file.path}`);
  }

  /**
   * Rebuild the entire relationship graph from contacts
   */
  async rebuildRelationshipGraph(): Promise<void> {
    loggingService.info('[RelationshipManager] Rebuilding relationship graph...');
    
    await this.eventHandler.withGlobalLock(async () => {
      // Clear the graph
      this.graph.clear();
      
      // Reload all contacts
      await this.loadAllContacts();
      
      // Schedule consistency check
      this.eventHandler.scheduleConsistencyCheck();
    });
    
    loggingService.info('[RelationshipManager] Relationship graph rebuilt');
  }

  /**
   * Perform comprehensive sync on all contact files
   */
  async performComprehensiveSync(): Promise<void> {
    const contactFiles = this.contactUtils.getContactFiles();
    loggingService.info(`[RelationshipManager] Starting comprehensive sync on ${contactFiles.length} contact files...`);
    
    await this.eventHandler.withGlobalLock(async () => {
      let syncedFiles = 0;
      
      for (const file of contactFiles) {
        try {
          const uid = this.contactUtils.extractUIDFromFile(file);
          if (!uid) continue;
          
          const content = await this.app.vault.read(file);
          
          // Parse relationships from Related list in content
          const relatedSection = this.contentParser.extractRelatedSection(content);
          const relatedListRelationships = relatedSection ? this.contentParser.parseRelatedSection(relatedSection) : [];
          
          if (relatedListRelationships.length > 0) {
            this.eventHandler.addSyncingFile(file.path);
            try {
              // Update graph from Related list
              await this.syncManager.updateGraphFromRelatedList(uid, relatedListRelationships);
              
              // Update front matter from graph
              await this.syncManager.updateFrontmatterFromGraph(file, uid);
              
              syncedFiles++;
            } finally {
              this.eventHandler.removeSyncingFile(file.path);
            }
          }
        } catch (error) {
          loggingService.error(`[RelationshipManager] Error syncing ${file.path}: ${error}`);
        }
      }
      
      loggingService.info(`[RelationshipManager] Comprehensive sync completed. Synced ${syncedFiles} files.`);
    });
  }

  /**
   * Perform consistency check on the relationship graph
   */
  async performConsistencyCheck(): Promise<void> {
    loggingService.info('[RelationshipManager] Performing relationship consistency check...');
    
    await this.eventHandler.withGlobalLock(async () => {
      // Check graph internal consistency
      const graphCheck = this.graph.checkConsistency();
      if (graphCheck.issues.length > 0) {
        loggingService.warn(`[RelationshipManager] Found ${graphCheck.issues.length} graph consistency issues`);
        for (const issue of graphCheck.issues) {
          loggingService.warn(`[RelationshipManager] Graph issue: ${issue}`);
        }
      }
      
      // Check consistency between graph and front matter
      const contactFiles = this.contactUtils.getContactFiles();
      let inconsistencies = 0;
      
      for (const file of contactFiles) {
        try {
          const uid = this.contactUtils.extractUIDFromFile(file);
          if (!uid || !this.graph.hasContact(uid)) continue;
          
          const cache = this.app.metadataCache.getFileCache(file);
          if (!cache?.frontmatter) continue;
          
          // Get relationships from front matter and graph
          const frontMatterRelationships = this.contentParser.parseRelatedFromFrontmatter(cache.frontmatter);
          const graphRelationships = this.graph.contactToRelatedFields(uid);
          
          // Compare using RelationshipSet
          const frontMatterSet = new (require('./relationshipSet').RelationshipSet)(frontMatterRelationships);
          const graphSet = new (require('./relationshipSet').RelationshipSet)(graphRelationships);
          
          if (!frontMatterSet.equals(graphSet)) {
            inconsistencies++;
            loggingService.info(`[RelationshipManager] Fixing inconsistency for: ${file.path}`);
            
            // Fix by updating front matter from graph
            await this.syncManager.updateFrontmatterFromGraph(file, uid);
          }
        } catch (error) {
          loggingService.error(`[RelationshipManager] Error checking consistency for ${file.path}: ${error}`);
        }
      }
      
      const stats = this.graph.getStatistics();
      loggingService.info(`[RelationshipManager] Consistency check completed. Fixed ${inconsistencies} inconsistencies. Graph: ${stats.contactCount} contacts, ${stats.relationshipCount} relationships`);
    });
  }
}