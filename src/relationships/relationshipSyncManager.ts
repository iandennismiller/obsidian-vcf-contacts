import { App, TFile } from 'obsidian';
import { RelationshipGraph } from './relationshipGraph';
import { RelationshipContentParser } from './relationshipContentParser';
import { ContactUtils } from './contactUtils';
import { RelationshipSet } from './relationshipSet';
import { RelationshipType, Gender, ParsedRelationship } from './relationshipTypes';
import { updateFrontMatterValue, updateFrontMatterValues, generateRevTimestamp, hasFrontMatterChanged } from './frontMatterUtils';
import { normalizeGender, formatRelatedValue, parseRelatedValue } from './relationshipUtils';
import { loggingService } from '../services/loggingService';

/**
 * Manages sync operations between Related lists, front matter, and the relationship graph
 */
export class RelationshipSyncManager {
  private app: App;
  private graph: RelationshipGraph;
  private contentParser: RelationshipContentParser;
  private contactUtils: ContactUtils;

  constructor(
    app: App, 
    graph: RelationshipGraph, 
    contentParser: RelationshipContentParser,
    contactUtils: ContactUtils
  ) {
    this.app = app;
    this.graph = graph;
    this.contentParser = contentParser;
    this.contactUtils = contactUtils;
  }

  /**
   * Update the graph from parsed related list - MERGE with existing relationships, don't clear
   */
  async updateGraphFromRelatedList(
    uid: string, 
    relationships: ParsedRelationship[]
  ): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Updating graph from Related list for UID: ${uid}`);
    
    for (const rel of relationships) {
      try {
        // Find or create the target contact
        const targetUid = await this.findOrCreateContactByName(rel.contactName);
        if (!targetUid) {
          loggingService.warn(`[RelationshipSyncManager] Could not resolve contact: ${rel.contactName}`);
          continue;
        }

        const relationshipKey = `${rel.type}:${targetUid}`;
        
        // Check if relationship already exists in graph
        const existingRelationships = this.graph.getContactRelationships(uid);
        const alreadyExists = existingRelationships.some(existing => 
          existing.type === rel.type && existing.targetUid === targetUid
        );
        
        if (alreadyExists) {
          loggingService.info(`[RelationshipSyncManager] Relationship already exists in graph: ${relationshipKey}`);
          continue;
        }

        // Update target contact's gender if implied
        if (rel.impliedGender) {
          const targetContact = this.contactUtils.findContactByUID(targetUid);
          if (targetContact) {
            await this.updateContactGender(targetContact, rel.impliedGender);
          }
        }

        // Add the new relationship to graph
        loggingService.info(`[RelationshipSyncManager] Adding new relationship to graph: ${relationshipKey}`);
        this.graph.addRelationship(uid, targetUid, rel.type);
      } catch (error) {
        loggingService.error(`[RelationshipSyncManager] Error processing relationship ${rel.type} -> ${rel.contactName}: ${error}`);
      }
    }
  }

  /**
   * Update frontmatter from graph relationships - MERGE with existing relationships, don't replace
   */
  async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Updating frontmatter from graph for: ${file.path}`);
    
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) {
      loggingService.warn(`[RelationshipSyncManager] No frontmatter found for: ${file.path}`);
      return;
    }

    // Get existing relationships from front matter
    const existingRelated = this.contentParser.parseRelatedFromFrontmatter(cache.frontmatter);
    const existingSet = new RelationshipSet(existingRelated);
    
    // Get relationships from graph
    const graphRelationships = this.graph.getContactRelationships(uid);
    const graphEntries = graphRelationships.map(rel => ({ 
      type: rel.type, 
      value: this.formatRelatedValue(rel.targetUid, rel.targetName) 
    }));
    const graphSet = new RelationshipSet(graphEntries);
    
    // Merge the sets
    const mergedSet = existingSet.clone();
    mergedSet.merge(graphSet);
    
    // Check if anything changed
    if (existingSet.equals(mergedSet)) {
      loggingService.info(`[RelationshipSyncManager] No changes needed for frontmatter: ${file.path}`);
      return;
    }
    
    // Convert merged set back to front matter format
    const mergedFrontMatter = mergedSet.toFrontMatter();
    
    // Clear existing RELATED fields and add new ones
    const updates: Record<string, string | null> = {};
    
    // Remove all existing RELATED fields
    for (const key of Object.keys(cache.frontmatter)) {
      if (key.startsWith('RELATED[')) {
        updates[key] = null;
      }
    }
    
    // Add new RELATED fields
    for (const [key, value] of Object.entries(mergedFrontMatter)) {
      updates[key] = value;
    }
    
    // Update REV timestamp
    updates.REV = generateRevTimestamp();
    
    await updateFrontMatterValues(file, updates, this.app);
    loggingService.info(`[RelationshipSyncManager] Updated frontmatter for: ${file.path}`);
  }

  /**
   * Merge Related list relationships directly into frontmatter
   */
  async mergeRelatedListToFrontmatter(file: TFile, relationships: ParsedRelationship[]): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Merging ${relationships.length} relationships to frontmatter: ${file.path}`);
    
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) {
      loggingService.warn(`[RelationshipSyncManager] No frontmatter found for: ${file.path}`);
      return;
    }

    // Get existing relationships from front matter
    const existingRelated = this.contentParser.parseRelatedFromFrontmatter(cache.frontmatter);
    const existingSet = new RelationshipSet(existingRelated);
    
    // Convert parsed relationships to relationship entries
    const newEntries: { type: RelationshipType; value: string }[] = [];
    for (const rel of relationships) {
      const targetUid = await this.findOrCreateContactByName(rel.contactName);
      if (targetUid) {
        newEntries.push({
          type: rel.type,
          value: this.formatRelatedValue(targetUid, rel.contactName)
        });
      }
    }
    
    const newSet = new RelationshipSet(newEntries);
    
    // Merge with existing
    const mergedSet = existingSet.clone();
    mergedSet.merge(newSet);
    
    // Check if anything changed
    if (existingSet.equals(mergedSet)) {
      loggingService.info(`[RelationshipSyncManager] No changes needed for frontmatter merge: ${file.path}`);
      return;
    }
    
    // Convert merged set to front matter
    const mergedFrontMatter = mergedSet.toFrontMatter();
    
    // Prepare updates
    const updates: Record<string, string | null> = {};
    
    // Remove existing RELATED fields
    for (const key of Object.keys(cache.frontmatter)) {
      if (key.startsWith('RELATED[')) {
        updates[key] = null;
      }
    }
    
    // Add merged RELATED fields
    for (const [key, value] of Object.entries(mergedFrontMatter)) {
      updates[key] = value;
    }
    
    // Update REV timestamp
    updates.REV = generateRevTimestamp();
    
    await updateFrontMatterValues(file, updates, this.app);
    loggingService.info(`[RelationshipSyncManager] Merged relationships to frontmatter: ${file.path}`);
  }

  /**
   * Sync frontmatter to the Related list in markdown
   */
  async syncFrontmatterToRelatedList(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.UID) return;

    const uid = cache.frontmatter.UID;
    const relatedFields = this.graph.contactToRelatedFields(uid);
    
    if (relatedFields.length === 0) {
      loggingService.info(`[RelationshipSyncManager] No relationships to sync for: ${file.path}`);
      return;
    }

    const content = await this.app.vault.read(file);
    const relationships = relatedFields.map(field => {
      const parsedValue = parseRelatedValue(field.value);
      const targetContact = parsedValue ? this.graph.getContact(parsedValue.uid) : null;
      return {
        type: field.type,
        targetUid: parsedValue?.uid || '',
        targetName: targetContact?.fullName || parsedValue?.name || parsedValue?.uid || ''
      };
    }).filter(rel => rel.targetUid && rel.targetName);

    const updatedContent = this.contentParser.updateRelatedSectionInContent(content, relationships);
    if (updatedContent !== content) {
      await this.app.vault.modify(file, updatedContent);
      loggingService.info(`[RelationshipSyncManager] Updated Related list for: ${file.path}`);
    }
  }

  /**
   * Find contact by name or create a stub entry
   */
  async findOrCreateContactByName(name: string): Promise<string | null> {
    // First try to find existing contact
    let contact = this.contactUtils.findContactByName(name);
    
    if (contact) {
      const uid = this.contactUtils.extractUIDFromFile(contact);
      if (uid) {
        // Make sure contact is in graph
        const contactName = this.contactUtils.getContactName(contact);
        const gender = this.contactUtils.getContactGender(contact);
        this.graph.addContact(uid, contactName, gender as Gender, contact);
        return uid;
      }
    }
    
    // Try to create a stub contact
    contact = await this.contactUtils.createContactStub(name);
    if (contact) {
      const uid = this.contactUtils.extractUIDFromFile(contact);
      if (uid) {
        // Add to graph
        this.graph.addContact(uid, name, undefined, contact);
        return uid;
      }
    }
    
    loggingService.warn(`[RelationshipSyncManager] Could not find or create contact: ${name}`);
    return null;
  }

  /**
   * Update a contact's gender in their front matter
   */
  async updateContactGender(file: TFile, gender: Gender): Promise<void> {
    const normalizedGender = normalizeGender(gender);
    if (normalizedGender) {
      await updateFrontMatterValue(file, 'GENDER', normalizedGender, this.app);
      await this.updateRevTimestamp(file);
      loggingService.info(`[RelationshipSyncManager] Updated gender for ${file.path}: ${normalizedGender}`);
    }
  }

  /**
   * Propagate relationship changes to other contacts
   */
  async propagateRelationshipChanges(uid: string): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Propagating relationship changes from: ${uid}`);
    
    const relationships = this.graph.getContactRelationships(uid);
    for (const rel of relationships) {
      const targetContact = this.graph.getContact(rel.targetUid);
      if (targetContact?.file) {
        // Update the target contact's front matter to include the reciprocal relationship
        await this.updateFrontmatterFromGraph(targetContact.file, rel.targetUid);
      }
    }
  }

  /**
   * Update REV timestamp
   */
  async updateRevTimestamp(file: TFile): Promise<void> {
    await updateFrontMatterValue(file, 'REV', generateRevTimestamp(), this.app);
  }

  /**
   * Format a related value for vCard RELATED field
   */
  private formatRelatedValue(targetUid: string, targetName: string): string {
    return formatRelatedValue(targetUid, targetName);
  }

  /**
   * Check if two relationship arrays are equivalent
   */
  areRelationshipsEquivalent(
    a: { type: RelationshipType; value: string }[], 
    b: { type: RelationshipType; value: string }[]
  ): boolean {
    const setA = new RelationshipSet(a);
    const setB = new RelationshipSet(b);
    return setA.equals(setB);
  }
}

// No longer need the helper function at the end since we import directly