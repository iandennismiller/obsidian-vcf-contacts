import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { RelationshipGraph, RelationshipType, Gender } from './relationshipGraph';
import { RelationshipSyncManager } from './relationshipSyncManager';
import { RelationshipContentParser, ParsedRelationship } from './relationshipContentParser';
import { RelationshipEventHandler } from './relationshipEventHandler';
import { ContactUtils } from './contactUtils';
import { RelationshipSet } from './relationshipSet';
import { getReciprocalRelationshipType } from './genderUtils';

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
    this.graph = new RelationshipGraph();
    this.eventHandler = new RelationshipEventHandler();
    this.contentParser = new RelationshipContentParser();
    this.syncManager = new RelationshipSyncManager(app, this.graph);
    this.contactUtils = new ContactUtils(app, settings);
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
      console.log('[RelationshipManager] Starting comprehensive initialization and sync...');
      
      const contactFiles = this.contactUtils.getAllContactFiles();

      console.log(`[RelationshipManager] Found ${contactFiles.length} potential contact files`);

      // PHASE 1: Load all contacts into graph (contacts first, relationships after)
      console.log('[RelationshipManager] PHASE 1: Building relationship graph from front matter...');

      // First pass: Load all contacts into the graph
      for (const file of contactFiles) {
        await this.loadContactIntoGraph(file);
      }
      
      console.log(`[RelationshipManager] Loaded ${this.graph.getAllContacts().length} contacts into graph`);
      
      // Second pass: Add relationships now that all contacts exist in the graph
      console.log('[RelationshipManager] Adding relationships from front matter...');
      let addedRelationships = 0;
      
      for (const file of contactFiles) {
        const addedCount = await this.loadRelationshipsFromFrontmatter(file);
        addedRelationships += addedCount;
      }
      
      console.log(`[RelationshipManager] Added ${addedRelationships} relationships from front matter`);

      // PHASE 2: Comprehensive sync
      console.log('[RelationshipManager] PHASE 2: Performing comprehensive sync...');
      await this.performComprehensiveSync(contactFiles);

      // PHASE 3: Find and correct missing reciprocals
      console.log('[RelationshipManager] PHASE 3: Finding and correcting missing reciprocal relationships...');
      await this.findAndCorrectMissingReciprocals();

      const stats = this.graph.getStats();
      console.log(`[RelationshipManager] Initialization complete. Graph stats: ${stats.contacts} contacts, ${stats.relationships} relationships`);
    });
  }

  /**
   * Perform comprehensive sync on all contact files
   * Examines Related lists and ensures they are reflected in graph and front matter
   */
  private async performComprehensiveSync(contactFiles: TFile[]): Promise<void> {
    console.log('[RelationshipManager] Starting comprehensive sync of Related lists...');
    
    let processedFiles = 0;
    let totalRelationshipsFound = 0;

    for (const file of contactFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;

      if (!uid) continue;

      try {
        // Parse Related list from content
        const content = await this.app.vault.read(file);
        const parseResult = this.contentParser.parseRelatedList(content);

        if (parseResult.relationships.length > 0) {
          console.log(`[RelationshipManager] Found ${parseResult.relationships.length} relationships in Related list for: ${file.path}`);
          totalRelationshipsFound += parseResult.relationships.length;

          // Sync Related list to graph
          await this.syncManager.updateGraphFromRelatedList(uid, parseResult.relationships);

          // Sync Related list to frontmatter
          await this.syncManager.mergeRelatedListToFrontmatter(file, parseResult.relationships);
        }

        processedFiles++;
      } catch (error) {
        console.warn(`[RelationshipManager] Error processing file ${file.path}:`, error);
      }
    }

    console.log(`[RelationshipManager] Comprehensive sync complete. Processed ${processedFiles} files, found ${totalRelationshipsFound} relationships in Related lists`);
  }

  /**
   * Find and correct missing reciprocal relationships
   * Ensures all relationships in the graph are bidirectional and reflected in both contacts
   */
  private async findAndCorrectMissingReciprocals(sourceUIDs: string[] = []): Promise<void> {
    console.log('[RelationshipManager] Checking for missing reciprocal relationships...');
    
    const contactFilesByUID = new Map<string, TFile>();
    for (const file of this.contactUtils.getAllContactFiles()) {
      const uid = this.contactUtils.getContactUID(file);
      if (uid) {
        contactFilesByUID.set(uid, file);
      }
    }

    const sourceUIDsToCheck = sourceUIDs.length > 0 ? sourceUIDs : Array.from(contactFilesByUID.keys());
    let correctedRelationships = 0;

    for (const sourceUID of sourceUIDsToCheck) {
      const relationships = this.graph.getContactRelationships(sourceUID);
      
      for (const relationship of relationships) {
        const targetUID = relationship.targetUid;
        const reciprocalType = getReciprocalRelationshipType(relationship.type);
        
        if (reciprocalType && contactFilesByUID.has(targetUID)) {
          // Check if the reciprocal relationship exists
          const targetRelationships = this.graph.getContactRelationships(targetUID);
          const hasReciprocal = targetRelationships.some(rel => 
            rel.targetUid === sourceUID && rel.type === reciprocalType
          );

          if (!hasReciprocal) {
            console.log(`[RelationshipManager] Adding missing reciprocal: ${targetUID} -[${reciprocalType}]-> ${sourceUID}`);
            
            try {
              // Add to graph
              this.graph.addRelationship(targetUID, sourceUID, reciprocalType!);
              console.log(`[RelationshipManager] Added reciprocal relationship: ${targetUID} -[${reciprocalType}]-> ${sourceUID}`);
            } catch (error) {
              console.warn(`[RelationshipManager] Failed to add reciprocal relationship ${targetUID} -[${reciprocalType}]-> ${sourceUID}: ${error instanceof Error ? error.message : String(error)}`);
              continue;
            }

            // Update frontmatter for target contact
            const targetFile = contactFilesByUID.get(targetUID);
            if (targetFile) {
              try {
                await this.syncManager.updateFrontmatterFromGraph(targetFile, targetUID);
                correctedRelationships++;
              } catch (error) {
                console.warn(`[RelationshipManager] Failed to update frontmatter for reciprocal relationship in ${targetFile.path}:`, error);
              }
            }
          }
        }
      }
    }

    console.log(`[RelationshipManager] Corrected ${correctedRelationships} missing reciprocal relationships`);
  }

  /**
   * Load a contact into the graph from its file
   */
  private async loadContactIntoGraph(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;
    const fullName = cache?.frontmatter?.FN;
    const gender = cache?.frontmatter?.GENDER as Gender;

    if (!uid || !fullName) {
      console.warn(`[RelationshipManager] Skipping file without UID or FN: ${file.path}`);
      return;
    }

    this.graph.addContact(uid, fullName, gender, file);
  }

  /**
   * Load relationships from frontmatter into the graph
   */
  private async loadRelationshipsFromFrontmatter(file: TFile): Promise<number> {
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;

    if (!uid || !cache?.frontmatter) return 0;

    const relationshipSet = RelationshipSet.fromFrontMatter(cache.frontmatter);
    const relatedFields = relationshipSet.toRelatedFields();

    let addedCount = 0;
    for (const field of relatedFields) {
      const targetUid = this.parseRelatedValue(field.value);
      if (targetUid && this.graph.getContact(targetUid)) {
        try {
          this.graph.addRelationship(uid, targetUid, field.type);
          addedCount++;
        } catch (error) {
          console.warn(`[RelationshipManager] Failed to add relationship from frontmatter: ${uid} -> ${targetUid} (${field.type})`, error);
        }
      } else if (targetUid) {
        // Store pending relationship for later processing
        if (!this.pendingRelationships.has(uid)) {
          this.pendingRelationships.set(uid, []);
        }
        this.pendingRelationships.get(uid)!.push({ type: field.type, value: field.value });
      }
    }

    return addedCount;
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

      const relationshipLine = `- ${type} [[${contactName}]]`;

      if (relatedSectionStart === -1) {
        // No Related section exists, add it at the end
        if (!content.endsWith('\n')) {
          lines.push('');
        }
        lines.push('## Related');
        lines.push(relationshipLine);
        lines.push('');
      } else {
        // Check if relationship already exists
        const existingLines = lines.slice(relatedSectionStart + 1, relatedSectionEnd);
        const exists = existingLines.some(line => line.trim() === relationshipLine.trim());
        
        if (!exists) {
          // Add the relationship to the Related section
          lines.splice(relatedSectionEnd, 0, relationshipLine);
        }
      }

      const updatedContent = lines.join('\n');
      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        console.log(`[RelationshipManager] Added relationship to Related list in: ${file.path}`);
      }
    } catch (error) {
      console.error(`[RelationshipManager] Error updating Related list in ${file.path}:`, error);
    }
  }

  /**
   * Parse a related value to extract the target UID
   */
  private parseRelatedValue(value: string): string | null {
    if (value.startsWith('urn:uuid:')) {
      return value.substring(9);
    }
    if (value.startsWith('uid:')) {
      return value.substring(4);
    }
    if (value.startsWith('name:')) {
      return value.substring(5);
    }
    return null;
  }

  /**
   * Get the relationship graph (for external access)
   */
  getGraph(): RelationshipGraph {
    return this.graph;
  }

  /**
   * Get the sync manager (for external access)
   */
  getSyncManager(): RelationshipSyncManager {
    return this.syncManager;
  }

  /**
   * Get the content parser (for external access)
   */
  getContentParser(): RelationshipContentParser {
    return this.contentParser;
  }
}