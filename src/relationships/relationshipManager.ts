/**
 * Main orchestrator for relationship management - coordinates between different modules
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { RelationshipGraph } from './relationshipGraph';
import { GenderManager } from './genderManager';
import { ContactUtils } from './contactUtils';
import { 
  ContactNote, 
  RelationshipUpdate, 
  ConsistencyCheckResult, 
  RelatedListItem,
  GenderlessKind,
  Gender,
  RelatedField
} from './types';
import { 
  parseRelatedFromFrontMatter,
  relatedFieldsToFrontMatter,
  parseRelatedSection,
  extractRelatedSection,
  updateRelatedSection,
  cleanupRelatedSections,
  generateRevTimestamp,
  hasMeaningfulChanges
} from './relationshipUtils';

export class RelationshipManager {
  private app: App;
  private settings: ContactsPluginSettings;
  private graph: RelationshipGraph;
  private genderManager: GenderManager;
  private contactUtils: ContactUtils;
  private isInitialized = false;
  private globalLock = false;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
    this.graph = new RelationshipGraph();
    this.genderManager = new GenderManager();
    this.contactUtils = new ContactUtils(app, settings);
  }

  /**
   * Initialize the relationship graph from all contacts
   */
  async initializeGraph(): Promise<void> {
    if (this.isInitialized) return;

    await this.withGlobalLock(async () => {
      console.log('Initializing relationship graph...');
      
      this.graph.clear();
      const contactFiles = this.contactUtils.getContactFiles();
      
      // First pass: Add all nodes
      for (const file of contactFiles) {
        const contactNote = await this.contactUtils.loadContactNote(file);
        if (contactNote) {
          this.graph.addNode(contactNote.uid, contactNote.fullName, contactNote.gender);
        }
      }

      // Second pass: Add relationships
      for (const file of contactFiles) {
        const contactNote = await this.contactUtils.loadContactNote(file);
        if (contactNote) {
          const relatedFields = parseRelatedFromFrontMatter(contactNote.frontMatter);
          if (relatedFields.length > 0) {
            try {
              this.graph.updateContactFromRelatedFields(contactNote.uid, relatedFields);
            } catch (error) {
              console.warn(`Failed to load relationships for ${contactNote.fullName}:`, error);
            }
          }
        }
      }

      console.log(`Graph initialized with ${this.graph.getStats().nodes} nodes and ${this.graph.getStats().edges} relationships`);
      this.isInitialized = true;
    });
  }

  /**
   * Add a relationship between two contacts
   */
  async addRelationship(update: RelationshipUpdate): Promise<void> {
    await this.withGlobalLock(async () => {
      // Ensure both contacts exist in the graph
      if (!this.graph.hasNode(update.sourceUid) || !this.graph.hasNode(update.targetUid)) {
        throw new Error(`Cannot add relationship: missing contact(s)`);
      }

      // Add the relationship to the graph
      this.graph.addRelationship(update.sourceUid, update.targetUid, update.kind);

      // Update front matter for both contacts
      await this.syncContactFrontMatter(update.sourceUid);
      await this.syncContactFrontMatter(update.targetUid);

      // Update Related sections
      await this.syncContactRelatedSection(update.sourceUid);
      await this.syncContactRelatedSection(update.targetUid);
    });
  }

  /**
   * Remove a relationship between two contacts
   */
  async removeRelationship(update: RelationshipUpdate): Promise<void> {
    await this.withGlobalLock(async () => {
      // Remove the relationship from the graph
      this.graph.removeRelationship(update.sourceUid, update.targetUid, update.kind);

      // Update front matter for both contacts
      await this.syncContactFrontMatter(update.sourceUid);
      await this.syncContactFrontMatter(update.targetUid);

      // Update Related sections
      await this.syncContactRelatedSection(update.sourceUid);
      await this.syncContactRelatedSection(update.targetUid);
    });
  }

  /**
   * Sync a contact's Related list to the graph and propagate changes
   */
  async syncContactFromRelatedList(file: TFile): Promise<void> {
    const contactNote = await this.contactUtils.loadContactNote(file);
    if (!contactNote) return;

    await this.withGlobalLock(async () => {
      // Parse the Related section
      const relatedSection = extractRelatedSection(contactNote.content);
      const relatedItems = relatedSection ? parseRelatedSection(relatedSection) : [];

      // Process each relationship
      const newRelationships: RelatedField[] = [];
      
      for (const item of relatedItems) {
        const genderInfo = this.genderManager.inferGenderFromRelationship(item.type);
        const genderlessKind = genderInfo.genderlessKind;

        // Find or create target contact
        let targetFile = this.contactUtils.findContactByName(item.targetName);
        let targetUid: string;

        if (targetFile) {
          targetUid = this.contactUtils.extractUIDFromFile(targetFile)!;
          
          // Update target's gender if we can infer it
          if (genderInfo.inferredGender && !this.contactUtils.extractGenderFromFile(targetFile)) {
            await this.contactUtils.updateFrontMatter(targetFile, {
              GENDER: genderInfo.inferredGender,
              REV: generateRevTimestamp()
            });
            this.graph.updateContactGender(targetUid, genderInfo.inferredGender);
          }
        } else {
          // Create placeholder contact
          targetFile = await this.contactUtils.createContactFile(item.targetName, {
            frontMatter: {
              GENDER: genderInfo.inferredGender || '',
              REV: generateRevTimestamp()
            }
          });
          
          if (targetFile) {
            targetUid = this.contactUtils.extractUIDFromFile(targetFile)!;
            this.graph.addNode(targetUid, item.targetName, genderInfo.inferredGender);
          } else {
            console.warn(`Failed to create contact for ${item.targetName}`);
            continue;
          }
        }

        // Add to graph
        if (!this.graph.hasNode(targetUid)) {
          const targetNote = await this.contactUtils.loadContactNote(targetFile);
          if (targetNote) {
            this.graph.addNode(targetNote.uid, targetNote.fullName, targetNote.gender);
          }
        }

        this.graph.addRelationship(contactNote.uid, targetUid, genderlessKind);

        // Add reciprocal relationship if applicable
        const reciprocalKind = this.genderManager.getReciprocalKind(genderlessKind);
        if (reciprocalKind && !this.graph.hasRelationship(targetUid, contactNote.uid, reciprocalKind)) {
          this.graph.addRelationship(targetUid, contactNote.uid, reciprocalKind);
          await this.syncContactFrontMatter(targetUid);
          await this.syncContactRelatedSection(targetUid);
        }

        newRelationships.push({
          type: genderlessKind,
          value: this.graph.parseRelatedValue(`uid:${targetUid}`) || `uid:${targetUid}`
        });
      }

      // Update this contact's front matter and Related section
      await this.syncContactFrontMatter(contactNote.uid);
    });
  }

  /**
   * Sync contact's front matter from graph
   */
  private async syncContactFrontMatter(uid: string): Promise<void> {
    const file = this.contactUtils.findContactByUID(uid);
    if (!file) return;

    const relatedFields = this.graph.contactToRelatedFields(uid);
    const newFrontMatterFields = relatedFieldsToFrontMatter(relatedFields);

    const cache = this.app.metadataCache.getFileCache(file);
    const oldFrontMatter = cache?.frontmatter || {};

    // Remove old RELATED fields
    const updatedFrontMatter = { ...oldFrontMatter };
    for (const key of Object.keys(updatedFrontMatter)) {
      if (key.startsWith('RELATED[') || key === 'RELATED') {
        delete updatedFrontMatter[key];
      }
    }

    // Add new RELATED fields
    Object.assign(updatedFrontMatter, newFrontMatterFields);

    // Check if there are meaningful changes
    if (hasMeaningfulChanges(oldFrontMatter, updatedFrontMatter)) {
      updatedFrontMatter.REV = generateRevTimestamp();
      await this.contactUtils.updateFrontMatter(file, updatedFrontMatter);
    }
  }

  /**
   * Sync contact's Related section from graph
   */
  private async syncContactRelatedSection(uid: string): Promise<void> {
    const file = this.contactUtils.findContactByUID(uid);
    if (!file) return;

    const relationships = this.graph.getContactRelationships(uid);
    const relatedItems: RelatedListItem[] = [];

    for (const rel of relationships) {
      const targetNode = this.graph.getNode(rel.target);
      if (targetNode) {
        relatedItems.push({
          type: this.genderManager.decodeToGendered(rel.type, targetNode.gender) as any,
          targetName: targetNode.fullName
        });
      }
    }

    const currentContent = await this.app.vault.read(file);
    const cleanedContent = cleanupRelatedSections(currentContent);
    const updatedContent = updateRelatedSection(cleanedContent, relatedItems);

    if (updatedContent !== currentContent) {
      await this.contactUtils.updateContent(file, updatedContent);
    }
  }

  /**
   * Check consistency between graph and contact files
   */
  async checkConsistency(): Promise<ConsistencyCheckResult> {
    return await this.withGlobalLock(async () => {
      const contactFiles = this.contactUtils.getContactFiles();
      const result: ConsistencyCheckResult = {
        totalContacts: contactFiles.length,
        inconsistentContacts: [],
        missingBacklinks: [],
        orphanedRelationships: []
      };

      for (const file of contactFiles) {
        const contactNote = await this.contactUtils.loadContactNote(file);
        if (!contactNote) continue;

        // Check if front matter matches graph
        const frontMatterFields = parseRelatedFromFrontMatter(contactNote.frontMatter);
        const graphFields = this.graph.contactToRelatedFields(contactNote.uid);

        if (!this.fieldsMatch(frontMatterFields, graphFields)) {
          result.inconsistentContacts.push(contactNote.uid);
        }

        // Check for missing reciprocal relationships
        for (const field of graphFields) {
          const targetUid = this.graph.parseRelatedValue(field.value);
          if (targetUid) {
            const reciprocalKind = this.genderManager.getReciprocalKind(field.type);
            if (reciprocalKind && !this.graph.hasRelationship(targetUid, contactNote.uid, reciprocalKind)) {
              result.missingBacklinks.push({
                sourceUid: contactNote.uid,
                targetUid,
                kind: reciprocalKind
              });
            }
          }
        }
      }

      return result;
    });
  }

  /**
   * Fix consistency issues
   */
  async fixConsistency(): Promise<void> {
    const issues = await this.checkConsistency();

    await this.withGlobalLock(async () => {
      // Fix missing backlinks
      for (const backlink of issues.missingBacklinks) {
        if (this.graph.hasNode(backlink.targetUid)) {
          this.graph.addRelationship(backlink.targetUid, backlink.sourceUid, backlink.kind);
          await this.syncContactFrontMatter(backlink.targetUid);
          await this.syncContactRelatedSection(backlink.targetUid);
        }
      }

      // Resync inconsistent contacts
      for (const uid of issues.inconsistentContacts) {
        await this.syncContactFrontMatter(uid);
        await this.syncContactRelatedSection(uid);
      }
    });
  }

  /**
   * Manual sync for a specific contact file
   */
  async syncFile(file: TFile): Promise<void> {
    if (!this.contactUtils.isContactFile(file)) return;
    await this.syncContactFromRelatedList(file);
  }

  /**
   * Manual sync for the currently active contact file
   */
  async syncCurrentFile(): Promise<void> {
    const activeFile = this.contactUtils.getCurrentContactFile();
    if (activeFile) {
      await this.syncFile(activeFile);
    }
  }

  /**
   * Rebuild the entire graph from contacts
   */
  async rebuildGraph(): Promise<void> {
    this.isInitialized = false;
    await this.initializeGraph();
  }

  /**
   * Get graph statistics
   */
  getGraphStats(): { nodes: number; edges: number } {
    return this.graph.getStats();
  }

  /**
   * Execute operation with global lock to prevent race conditions
   */
  private async withGlobalLock<T>(operation: () => Promise<T>): Promise<T> {
    while (this.globalLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.globalLock = true;
    try {
      return await operation();
    } finally {
      this.globalLock = false;
    }
  }

  /**
   * Compare two arrays of RelatedField for equality
   */
  private fieldsMatch(fields1: RelatedField[], fields2: RelatedField[]): boolean {
    if (fields1.length !== fields2.length) return false;

    const sorted1 = [...fields1].sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`));
    const sorted2 = [...fields2].sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`));

    for (let i = 0; i < sorted1.length; i++) {
      if (sorted1[i].type !== sorted2[i].type || sorted1[i].value !== sorted2[i].value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(uid: string): Array<{
    kind: GenderlessKind;
    targetUid: string;
    targetName: string;
    targetGender?: Gender;
  }> {
    const relationships = this.graph.getContactRelationships(uid);
    return relationships.map(rel => {
      const targetNode = this.graph.getNode(rel.target);
      return {
        kind: rel.type,
        targetUid: rel.target,
        targetName: targetNode?.fullName || rel.target,
        targetGender: targetNode?.gender
      };
    });
  }
}