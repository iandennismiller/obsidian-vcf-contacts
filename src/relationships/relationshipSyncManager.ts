import { App, TFile } from 'obsidian';
import { loggingService } from 'src/services/loggingService';
import { updateFrontMatterValue } from 'src/contacts/contactFrontmatter';
import { RelationshipGraph, Gender, RelationshipType } from './relationshipGraph';
import { RelationshipContentParser } from './relationshipContentParser';
import { RelationshipSet } from './relationshipSet';
import { ContactUtils } from './contactUtils';
import { formatRelationshipListItem } from './relationshipUtils';

/**
 * Manages sync operations between Related lists, front matter, and the relationship graph
 */
export class RelationshipSyncManager {
  private app: App;
  private graph: RelationshipGraph;
  private contentParser: RelationshipContentParser;
  private contactUtils: ContactUtils;

  constructor(app: App, graph: RelationshipGraph) {
    this.app = app;
    this.graph = graph;
    this.contentParser = new RelationshipContentParser();
    this.contactUtils = new ContactUtils(app);
  }

  /**
   * Directly merge Related list relationships with existing front matter
   */
  async mergeRelatedListToFrontmatter(
    file: TFile, 
    relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[]
  ): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Merging ${relationships.length} relationships from Related list to front matter: ${file.path}`);
    
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Get existing front matter relationships
    const existingSet = RelationshipSet.fromFrontMatter(cache?.frontmatter || {});
    
    let addedCount = 0;
    
    // Convert contact names to proper values and add to set
    for (const rel of relationships) {
      const contactFile = this.contactUtils.findContactByName(rel.contactName);
      let value: string;
      
      if (contactFile) {
        const uid = this.contactUtils.extractUIDFromFile(contactFile);
        const name = this.contactUtils.extractFullNameFromFile(contactFile);
        value = this.formatRelatedValue(uid || name || rel.contactName, name || rel.contactName);
      } else {
        // Use name format for non-existent contacts
        value = `name:${rel.contactName}`;
      }
      
      if (!existingSet.has(rel.type, value)) {
        existingSet.add(rel.type, value);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      // Clear existing RELATED fields
      if (cache?.frontmatter) {
        for (const key of Object.keys(cache.frontmatter)) {
          if (key.startsWith('RELATED')) {
            await updateFrontMatterValue(file, key, '', this.app);
          }
        }
      }

      // Add merged and sanitized RELATED fields
      const frontMatterFields = existingSet.toFrontMatterFields();
      for (const [key, value] of Object.entries(frontMatterFields)) {
        await updateFrontMatterValue(file, key, value, this.app);
      }
      
      loggingService.info(`[RelationshipSyncManager] Merged ${addedCount} new relationships to front matter: ${file.path}`);
    } else {
      loggingService.info(`[RelationshipSyncManager] No new relationships to merge for: ${file.path}`);
    }

    // Update REV timestamp
    await this.updateRevTimestamp(file);
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
    const relationships = relatedFields.map(field => ({
      type: field.type,
      targetUid: field.value.replace(/^(urn:uuid:|uid:|name:)/, ''),
      targetName: this.getTargetNameFromValue(field.value)
    }));

    const updatedContent = this.updateRelatedSectionInContent(content, relationships);
    
    if (updatedContent !== content) {
      await this.app.vault.modify(file, updatedContent);
      loggingService.info(`[RelationshipSyncManager] Updated Related list for: ${file.path}`);
    }
  }

  /**
   * Update the graph from parsed related list - MERGE with existing relationships, don't clear
   */
  async updateGraphFromRelatedList(
    uid: string, 
    relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[]
  ): Promise<void> {
    const contact = this.graph.getContact(uid);
    if (!contact) return;

    loggingService.info(`[RelationshipSyncManager] Merging ${relationships.length} relationships from Related list into graph for: ${uid}`);

    // Get existing relationships to avoid clearing them
    const existingRelationships = this.graph.getContactRelationships(uid);
    const existingSet = new Set(existingRelationships.map(r => `${r.type}:${r.targetUid}`));

    // Only add new relationships that don't already exist
    for (const rel of relationships) {
      // Find or create the target contact
      const targetUid = await this.findOrCreateContactByName(rel.contactName);
      if (!targetUid) continue;

      const relationshipKey = `${rel.type}:${targetUid}`;
      if (!existingSet.has(relationshipKey)) {
        try {
          this.graph.addRelationship(uid, targetUid, rel.type);
          loggingService.debug(`[RelationshipSyncManager] Added relationship: ${uid} -[${rel.type}]-> ${targetUid}`);
        } catch (error) {
          loggingService.warning(`[RelationshipSyncManager] Failed to add relationship: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  /**
   * Update frontmatter from graph relationships - MERGE with existing relationships, don't replace
   */
  async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    const graphRelationships = this.graph.getContactRelationships(uid);
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Get existing front matter relationships
    const existingSet = RelationshipSet.fromFrontMatter(cache?.frontmatter || {});
    const mergedSet = existingSet.clone();
    
    let addedCount = 0;
    
    // Add graph relationships to the merged set
    for (const rel of graphRelationships) {
      const value = this.formatRelatedValue(rel.targetUid, rel.targetName);
      if (!mergedSet.has(rel.type, value)) {
        mergedSet.add(rel.type, value);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      // Clear existing RELATED fields
      if (cache?.frontmatter) {
        for (const key of Object.keys(cache.frontmatter)) {
          if (key.startsWith('RELATED')) {
            await updateFrontMatterValue(file, key, '', this.app);
          }
        }
      }

      // Add merged and sanitized RELATED fields
      const frontMatterFields = mergedSet.toFrontMatterFields();
      for (const [key, value] of Object.entries(frontMatterFields)) {
        await updateFrontMatterValue(file, key, value, this.app);
      }
      
      loggingService.info(`[RelationshipSyncManager] Updated front matter for: ${file.path} (added ${addedCount} new relationships)`);
    } else {
      loggingService.info(`[RelationshipSyncManager] No front matter updates needed for: ${file.path}`);
    }

    // Update REV timestamp
    await this.updateRevTimestamp(file);
  }

  /**
   * Update the Related section in content
   */
  private updateRelatedSectionInContent(
    content: string, 
    relationships: { type: RelationshipType; targetUid: string; targetName: string }[]
  ): string {
    const relatedListItems = relationships.map(rel => {
      // Get target contact from the relationship graph to access gender
      const targetContact = this.graph.getContact(rel.targetUid);
      return formatRelationshipListItem(rel.type, rel.targetName, targetContact?.gender);
    });

    const relatedSection = relatedListItems.length > 0 
      ? `\n## Related\n${relatedListItems.join('\n')}\n`
      : '\n## Related\n\n';

    // Replace or add the Related section
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\\s\\S]*?)(?=^#{1,6}|$)/im);
    
    if (relatedMatch) {
      return content.replace(relatedMatch[0], relatedSection.trim());
    } else {
      // Add Related section before any existing sections or at the end
      const firstSectionMatch = content.match(/^#{1,6}\s+/m);
      if (firstSectionMatch) {
        const insertPos = content.indexOf(firstSectionMatch[0]);
        return content.slice(0, insertPos) + relatedSection + content.slice(insertPos);
      } else {
        return content + relatedSection;
      }
    }
  }

  /**
   * Find contact by name or create a stub entry
   */
  async findOrCreateContactByName(name: string): Promise<string | null> {
    // Try to find existing contact
    const existingFile = this.contactUtils.findContactByName(name);
    if (existingFile) {
      return this.contactUtils.extractUIDFromFile(existingFile) || 
             this.contactUtils.extractFullNameFromFile(existingFile);
    }

    // For now, don't auto-create stub contacts - just log and return null
    loggingService.warning(`[RelationshipSyncManager] Contact not found: ${name}`);
    return null;
  }

  /**
   * Get target name from a RELATED field value
   */
  private getTargetNameFromValue(value: string): string {
    if (value.startsWith('name:')) {
      return value.substring(5);
    }
    
    // For UID-based values, try to find the contact
    const uid = value.startsWith('urn:uuid:') ? value.substring(9) : 
                value.startsWith('uid:') ? value.substring(4) : value;
    
    const contact = this.graph.getContact(uid);
    return contact?.fullName || uid;
  }

  /**
   * Format a related value for vCard RELATED field
   */
  private formatRelatedValue(targetUid: string, targetName: string): string {
    // Prefer UID format if it looks like a UUID
    if (targetUid.includes('urn:uuid:') || targetUid.match(/^[0-9a-f-]{36}$/i)) {
      return targetUid.startsWith('urn:uuid:') ? targetUid : `urn:uuid:${targetUid}`;
    }
    // Use UID format for other UIDs
    if (targetUid !== targetName) {
      return `uid:${targetUid}`;
    }
    // Fall back to name format
    return `name:${targetName}`;
  }

  /**
   * Update a contact's gender in their front matter
   */
  async updateContactGender(file: TFile, gender: Gender): Promise<void> {
    await updateFrontMatterValue(file, 'GENDER', gender, this.app);
    loggingService.info(`[RelationshipSyncManager] Updated gender for: ${file.path} to ${gender}`);
  }

  /**
   * Propagate relationship changes to other contacts
   */
  async propagateRelationshipChanges(uid: string): Promise<void> {
    const relationships = this.graph.getContactRelationships(uid);
    
    for (const rel of relationships) {
      const targetFile = this.contactUtils.findContactByUID(rel.targetUid);
      if (targetFile) {
        await this.updateFrontmatterFromGraph(targetFile, rel.targetUid);
      }
    }
  }

  /**
   * Add a single relationship to a file's front matter
   */
  async addRelationshipToFrontMatter(file: TFile, type: RelationshipType, contactName: string): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Adding relationship to front matter: ${file.path} - ${type}: ${contactName}`);
    
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Get existing front matter relationships
    const existingSet = RelationshipSet.fromFrontMatter(cache?.frontmatter || {});
    
    // Add the new relationship
    existingSet.add(type, contactName);
    
    // Clear existing RELATED fields and write the updated set
    if (cache?.frontmatter) {
      for (const key of Object.keys(cache.frontmatter)) {
        if (key.startsWith('RELATED')) {
          await updateFrontMatterValue(file, key, '', this.app);
        }
      }
    }

    // Add updated RELATED fields
    const frontMatterFields = existingSet.toFrontMatterFields();
    for (const [key, value] of Object.entries(frontMatterFields)) {
      await updateFrontMatterValue(file, key, value, this.app);
    }

    // Update REV timestamp
    await this.updateRevTimestamp(file);
  }

  /**
   * Update REV timestamp
   */
  async updateRevTimestamp(file: TFile): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    await updateFrontMatterValue(file, 'REV', timestamp, this.app);
  }

  /**
   * Check if two relationship arrays are equivalent
   */
  areRelationshipsEquivalent(
    a: { type: RelationshipType; value: string }[], 
    b: { type: RelationshipType; value: string }[]
  ): boolean {
    if (a.length !== b.length) return false;
    
    const sortedA = a.sort((x, y) => `${x.type}:${x.value}`.localeCompare(`${y.type}:${y.value}`));
    const sortedB = b.sort((x, y) => `${x.type}:${x.value}`.localeCompare(`${y.type}:${y.value}`));
    
    for (let i = 0; i < sortedA.length; i++) {
      if (sortedA[i].type !== sortedB[i].type || sortedA[i].value !== sortedB[i].value) {
        return false;
      }
    }
    
    return true;
  }
}