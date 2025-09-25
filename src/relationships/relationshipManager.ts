import { App, TFile } from 'obsidian';
import { loggingService } from 'src/services/loggingService';
import { ContactsPluginSettings } from 'src/settings/settings.d';
import { RelationshipGraph, RelationshipType } from './relationshipGraph';
import { RelationshipSyncManager } from './relationshipSyncManager';
import { RelationshipEventHandler } from './relationshipEventHandler';
import { RelationshipContentParser } from './relationshipContentParser';
import { ContactUtils } from './contactUtils';
import { getReciprocalType } from './relationshipUtils';

/**
 * Main orchestrator for relationship management - coordinates between different modules
 */
export class RelationshipManager {
  private graph: RelationshipGraph;
  private app: App;
  private settings: ContactsPluginSettings;
  private eventHandler: RelationshipEventHandler;
  private contentParser: RelationshipContentParser;
  private syncManager: RelationshipSyncManager;
  private contactUtils: ContactUtils;
  private pendingRelationships = new Map<string, { type: RelationshipType; value: string }[]>();

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
    
    // Initialize core components
    this.graph = new RelationshipGraph();
    this.contactUtils = new ContactUtils(app);
    this.contentParser = new RelationshipContentParser();
    this.syncManager = new RelationshipSyncManager(app, this.graph);
    this.eventHandler = new RelationshipEventHandler(app, this.graph, this.syncManager);
  }

  /**
   * Initialize the relationship system
   */
  async initialize(): Promise<void> {
    loggingService.info('[RelationshipManager] Initializing relationship management system...');
    
    // Initialize event handlers
    this.eventHandler.initialize();
    
    // Build initial relationship graph from existing contacts
    await this.initializeFromVault();
    
    loggingService.info('[RelationshipManager] Relationship management system initialized');
  }

  /**
   * Clean up the relationship system
   */
  destroy(): void {
    loggingService.info('[RelationshipManager] Cleaning up relationship management system...');
    
    // Clean up event handlers
    this.eventHandler.destroy();
    
    // Clear the graph
    this.graph.clear();
    
    loggingService.info('[RelationshipManager] Relationship management system cleaned up');
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
      
      const contactFiles = this.contactUtils.getAllContactFiles();

      loggingService.info(`[RelationshipManager] Found ${contactFiles.length} potential contact files`);

      // PHASE 1: Load all contacts into graph (contacts first, relationships after)
      loggingService.info('[RelationshipManager] PHASE 1: Building relationship graph from front matter...');
      
      let validContacts = 0;
      this.pendingRelationships.clear();

      for (const file of contactFiles) {
        if (!this.contactUtils.isValidContact(file)) {
          continue;
        }

        const uid = this.contactUtils.extractUIDFromFile(file);
        const fullName = this.contactUtils.extractFullNameFromFile(file);
        const gender = this.contactUtils.extractGenderFromFile(file);

        if (!uid && !fullName) {
          continue;
        }

        // Add contact to graph (use UID as identifier, or fallback to name)
        const identifier = uid || fullName!;
        this.graph.addContact(identifier, fullName || identifier, file, gender);
        validContacts++;

        // Collect relationships for later processing
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter) {
          const relationships: { type: RelationshipType; value: string }[] = [];
          
          for (const [key, value] of Object.entries(cache.frontmatter)) {
            if (key.startsWith('RELATED')) {
              const typeMatch = key.match(/RELATED(?:;TYPE=([^;]+))?/);
              if (typeMatch && value) {
                const type = typeMatch[1] || 'relative';
                relationships.push({ type: type as RelationshipType, value: value as string });
              }
            }
          }

          if (relationships.length > 0) {
            this.pendingRelationships.set(identifier, relationships);
          }
        }
      }

      loggingService.info(`[RelationshipManager] Added ${validContacts} valid contacts to graph`);

      // PHASE 2: Process relationships
      loggingService.info('[RelationshipManager] PHASE 2: Processing relationships from front matter...');
      
      let addedRelationships = 0;
      for (const [sourceUID, relationships] of this.pendingRelationships) {
        for (const rel of relationships) {
          // Try to find the target contact by UID or name
          const targetContact = this.graph.getAllContacts().find(c => 
            c.uid === rel.value || c.fullName === rel.value
          );
          
          if (targetContact) {
            try {
              this.graph.addRelationship(sourceUID, targetContact.uid, rel.type);
              addedRelationships++;
            } catch (error) {
              loggingService.warning(`[RelationshipManager] Failed to add relationship ${sourceUID} -[${rel.type}]-> ${targetContact.uid}: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            loggingService.debug(`[RelationshipManager] Target contact not found for relationship: ${rel.value}`);
          }
        }
      }

      loggingService.info(`[RelationshipManager] Added ${addedRelationships} relationships to graph`);

      // PHASE 3: Check and correct missing reciprocal relationships
      loggingService.info('[RelationshipManager] PHASE 3: Checking for missing reciprocal relationships...');
      await this.findAndCorrectMissingReciprocals();

      // PHASE 4: Sync Related lists from graph and front matter
      loggingService.info('[RelationshipManager] PHASE 4: Syncing Related lists with front matter and graph...');
      await this.performComprehensiveSync();

      const stats = this.graph.getStats();
      loggingService.info(`[RelationshipManager] Initialization complete - Graph has ${stats.nodes} contacts and ${stats.edges} relationships`);
    });
  }

  /**
   * Perform comprehensive sync on all contact files
   */
  private async performComprehensiveSync(): Promise<void> {
    const contactFiles = this.contactUtils.getAllContactFiles();
    
    for (const file of contactFiles) {
      if (!this.contactUtils.isValidContact(file)) {
        continue;
      }

      try {
        const uid = this.contactUtils.extractUIDFromFile(file);
        if (!uid) continue;

        // Sync front matter to Related list
        await this.syncManager.syncFrontmatterToRelatedList(file);
        
        // Then sync Related list back to front matter (to catch any additions)
        const content = await this.app.vault.read(file);
        const relatedListRelationships = this.contentParser.parseRelatedSection(content);
        
        if (relatedListRelationships.length > 0) {
          await this.syncManager.mergeRelatedListToFrontmatter(file, relatedListRelationships);
        }

      } catch (error) {
        loggingService.error(`[RelationshipManager] Error syncing file ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Find and correct missing reciprocal relationships
   * Ensures all relationships in the graph are bidirectional and reflected in both contacts
   * @param sourceUIDs - Array of contact UIDs to process, or empty array to process all contacts
   */
  private async findAndCorrectMissingReciprocals(sourceUIDs: string[] = []): Promise<void> {
    const contactFiles = this.contactUtils.getAllContactFiles();
    const contactFilesByUID = new Map<string, TFile>();
    
    for (const file of contactFiles) {
      const uid = this.contactUtils.extractUIDFromFile(file);
      if (uid) {
        contactFilesByUID.set(uid, file);
      }
    }
    
    let addedReciprocals = 0;
    
    // Process all contacts if no specific UIDs provided
    const uidsToProcess = sourceUIDs.length > 0 ? sourceUIDs : this.graph.getAllContacts().map(c => c.uid);
    
    // Check each relationship in the specified UIDs for missing reciprocals
    for (const sourceUID of uidsToProcess) {
      const sourceRelationships = this.graph.getContactRelationships(sourceUID);
      
      for (const rel of sourceRelationships) {
        const targetUID = rel.targetUid;
        const relationshipType = rel.type;
        
        // Get the reciprocal relationship type
        const reciprocalType = getReciprocalType(relationshipType);
        if (!reciprocalType) continue;
        
        // Check if the target has the reciprocal relationship
        const targetRelationships = this.graph.getContactRelationships(targetUID);
        const hasReciprocal = targetRelationships.some((r: { type: RelationshipType; targetUid: string; targetName: string }) => 
          r.targetUid === sourceUID && r.type === reciprocalType
        );
        
        if (!hasReciprocal) {
          loggingService.info(`[RelationshipManager] Missing reciprocal: ${targetUID} should have ${reciprocalType} -> ${sourceUID}`);
          
          // Add the reciprocal relationship to the graph
          try {
            this.graph.addRelationship(targetUID, sourceUID, reciprocalType!);
            loggingService.debug(`[RelationshipManager] Added reciprocal relationship: ${targetUID} -[${reciprocalType}]-> ${sourceUID}`);
          } catch (error) {
            loggingService.warning(`[RelationshipManager] Failed to add reciprocal relationship ${targetUID} -[${reciprocalType}]-> ${sourceUID}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
          
          // Update the target contact's front matter
          const targetFile = contactFilesByUID.get(targetUID);
          if (targetFile) {
            try {
              await this.syncManager.updateFrontmatterFromGraph(targetFile, targetUID);
              addedReciprocals++;
              loggingService.info(`[RelationshipManager] Updated front matter for reciprocal relationship: ${targetFile.path}`);
            } catch (error) {
              loggingService.error(`[RelationshipManager] Failed to update front matter for ${targetFile.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }
    }

    if (addedReciprocals > 0) {
      loggingService.info(`[RelationshipManager] Added ${addedReciprocals} missing reciprocal relationships`);
    } else {
      loggingService.info('[RelationshipManager] No missing reciprocal relationships found');
    }
  }

  /**
   * Manually rebuild the graph from all contacts (useful for fixing inconsistencies)
   */
  async rebuildGraph(): Promise<void> {
    return this.eventHandler.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Rebuilding relationship graph from scratch...');
      
      // Clear existing graph
      this.graph.clear();
      
      // Rebuild from vault
      await this.initializeFromVault();
      
      loggingService.info('[RelationshipManager] Graph rebuild complete');
    });
  }

  /**
   * Get the relationship graph (for external access)
   */
  getGraph(): RelationshipGraph {
    return this.graph;
  }

  /**
   * Get graph statistics
   */
  getStats(): { nodes: number; edges: number } {
    return this.graph.getStats();
  }

  /**
   * Check if the system is currently locked (performing operations)
   */
  isLocked(): boolean {
    return this.eventHandler.isLocked;
  }
}