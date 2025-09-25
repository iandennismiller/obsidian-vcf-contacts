import { App, TFile } from 'obsidian';
import { RelationshipGraph, Gender, RelationshipType } from './relationshipGraph';
import { RelationshipContentParser, ParsedRelationship } from './relationshipContentParser';
import { RelationshipSet } from './relationshipSet';

/**
 * Manages sync operations between Related lists, front matter, and the relationship graph
 */
export class RelationshipSyncManager {
  private app: App;
  private graph: RelationshipGraph;
  private contentParser: RelationshipContentParser;

  constructor(app: App, graph: RelationshipGraph) {
    this.app = app;
    this.graph = graph;
    this.contentParser = new RelationshipContentParser();
  }

  /**
   * Directly merge Related list relationships with existing front matter
   */
  async mergeRelatedListToFrontmatter(
    file: TFile, 
    relationships: ParsedRelationship[]
  ): Promise<void> {
    if (relationships.length === 0) {
      return;
    }

    // Get current frontmatter
    const cache = this.app.metadataCache.getFileCache(file);
    const currentFrontmatter = cache?.frontmatter || {};

    // Create RelationshipSet from current frontmatter
    const existingSet = RelationshipSet.fromFrontMatter(currentFrontmatter);

    // Add new relationships from Related list
    let addedCount = 0;
    for (const rel of relationships) {
      const targetUid = await this.findOrCreateContactByName(rel.contactName);
      if (targetUid) {
        const value = this.formatRelatedValue(targetUid, rel.contactName);
        if (!existingSet.has(rel.type, value)) {
          existingSet.add(rel.type, value);
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      // Convert back to frontmatter fields and update
      const frontMatterFields = existingSet.toFrontMatterFields();
      for (const [key, value] of Object.entries(frontMatterFields)) {
        await this.updateFrontMatterValue(file, key, value);
      }

      console.log(`[RelationshipSyncManager] Updated front matter for: ${file.path} (${existingSet.size()} total relationships, ${addedCount} new)`);
    } else {
      console.log(`[RelationshipSyncManager] No relationships to write to front matter for: ${file.path}`);
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
      console.log(`[RelationshipSyncManager] No relationships to sync for: ${file.path}`);
      return;
    }

    const content = await this.app.vault.read(file);
    const relationships = relatedFields.map(field => ({
      type: field.type,
      targetName: this.extractNameFromRelatedValue(field.value),
      targetGender: this.getTargetGender(field.value)
    }));

    const updatedContent = this.contentParser.updateRelatedSection(content, relationships);

    if (updatedContent !== content) {
      await this.app.vault.modify(file, updatedContent);
      console.log(`[RelationshipSyncManager] Updated Related list for: ${file.path}`);
    }
  }

  /**
   * Update the graph from parsed related list - MERGE with existing relationships, don't clear
   */
  async updateGraphFromRelatedList(
    uid: string, 
    relationships: ParsedRelationship[]
  ): Promise<void> {
    for (const rel of relationships) {
      const targetUid = await this.findOrCreateContactByName(rel.contactName);
      if (targetUid && this.graph.getContact(targetUid)) {
        try {
          this.graph.addRelationship(uid, targetUid, rel.type);
        } catch (error) {
          console.warn(`[RelationshipSyncManager] Failed to add relationship ${uid} -> ${targetUid} (${rel.type}):`, error);
        }
      }
    }
  }

  /**
   * Update frontmatter from graph relationships - MERGE with existing relationships, don't replace
   */
  async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    const graphRelatedFields = this.graph.contactToRelatedFields(uid);
    
    if (graphRelatedFields.length === 0) {
      console.log(`[RelationshipSyncManager] No graph relationships to sync for: ${file.path}`);
      return;
    }

    // Get current frontmatter relationships
    const cache = this.app.metadataCache.getFileCache(file);
    const currentFrontmatter = cache?.frontmatter || {};
    const existingSet = RelationshipSet.fromFrontMatter(currentFrontmatter);
    
    // Merge with graph relationships
    const graphSet = RelationshipSet.fromRelatedFields(graphRelatedFields);
    const mergedSet = existingSet.merge(graphSet);

    // Check if there are changes
    if (!existingSet.equals(mergedSet)) {
      // Clear existing RELATED fields
      const existingFields = existingSet.toFrontMatterFields();
      for (const key of Object.keys(existingFields)) {
        if (key.startsWith('RELATED.')) {
          await this.updateFrontMatterValue(file, key, '');
        }
      }

      // Add merged and sanitized RELATED fields
      const frontMatterFields = mergedSet.toFrontMatterFields();
      for (const [key, value] of Object.entries(frontMatterFields)) {
        await this.updateFrontMatterValue(file, key, value);
      }
      
      const addedCount = mergedSet.size() - existingSet.size();
      console.log(`[RelationshipSyncManager] Updated front matter for: ${file.path} (added ${addedCount} new relationships)`);
    } else {
      console.log(`[RelationshipSyncManager] No front matter updates needed for: ${file.path}`);
    }

    // Update REV timestamp
    await this.updateRevTimestamp(file);
  }

  /**
   * Find contact by name or create a stub entry
   */
  async findOrCreateContactByName(name: string): Promise<string | null> {
    // First try to find existing contact by name
    const allContacts = this.graph.getAllContacts();
    const existingContact = allContacts.find(contact => 
      contact.fullName.toLowerCase() === name.toLowerCase()
    );

    if (existingContact) {
      return existingContact.uid;
    }

    // Look for a file with this name
    const normalizedName = name.replace(/[^\w\s-]/g, '').trim();
    const possiblePaths = [
      `${normalizedName}.md`,
      `contacts/${normalizedName}.md`,
      `Contacts/${normalizedName}.md`,
    ];

    for (const path of possiblePaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter?.UID) {
          // Add to graph if not already there
          this.graph.addContact(cache.frontmatter.UID, name, cache.frontmatter.GENDER, file);
          return cache.frontmatter.UID;
        }
      }
    }

    // Create a stub contact for now (should be handled by the calling code)
    const stubUid = `stub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.graph.addContact(stubUid, name);
    console.warn(`[RelationshipSyncManager] Created stub contact for: ${name} (${stubUid})`);
    
    return stubUid;
  }

  /**
   * Format a related value for vCard RELATED field
   */
  private formatRelatedValue(targetUid: string, targetName: string): string {
    // Check if targetUid is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(targetUid)) {
      return `urn:uuid:${targetUid}`;
    }
    
    // Check if it's a custom UID (not a name fallback or stub)
    if (targetUid !== targetName && !targetUid.startsWith('stub-')) {
      return `uid:${targetUid}`;
    }
    
    // Fallback to name format
    return `name:${targetName}`;
  }

  /**
   * Extract name from related value
   */
  private extractNameFromRelatedValue(value: string): string {
    if (value.startsWith('urn:uuid:')) {
      const uuid = value.substring(9);
      const contact = this.graph.getContact(uuid);
      return contact?.fullName || uuid;
    }
    if (value.startsWith('uid:')) {
      const uid = value.substring(4);
      const contact = this.graph.getContact(uid);
      return contact?.fullName || uid;
    }
    if (value.startsWith('name:')) {
      return value.substring(5);
    }
    return value;
  }

  /**
   * Get target gender from related value
   */
  private getTargetGender(value: string): Gender | undefined {
    if (value.startsWith('urn:uuid:')) {
      const uuid = value.substring(9);
      const contact = this.graph.getContact(uuid);
      return contact?.gender;
    }
    if (value.startsWith('uid:')) {
      const uid = value.substring(4);
      const contact = this.graph.getContact(uid);
      return contact?.gender;
    }
    return undefined;
  }

  /**
   * Update a frontmatter value
   */
  private async updateFrontMatterValue(file: TFile, key: string, value: string): Promise<void> {
    // This is a simplified implementation - in a real plugin you'd use the app's frontmatter API
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    
    // Find frontmatter section
    let fmStart = -1;
    let fmEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (fmStart === -1) {
          fmStart = i;
        } else {
          fmEnd = i;
          break;
        }
      }
    }

    if (fmStart === -1 || fmEnd === -1) {
      // No frontmatter found, add it
      if (value.trim()) {
        const newFrontmatter = ['---', `${key}: "${value}"`, '---', ''];
        await this.app.vault.modify(file, newFrontmatter.join('\n') + content);
      }
      return;
    }

    // Update existing frontmatter
    const frontmatterLines = lines.slice(fmStart + 1, fmEnd);
    const otherLines = [...lines.slice(0, fmStart + 1), ...lines.slice(fmEnd)];
    
    // Remove existing key if present
    const filteredFmLines = frontmatterLines.filter(line => {
      const lineKey = line.split(':')[0]?.trim().replace(/^["']|["']$/g, '');
      return lineKey !== key;
    });

    // Add new value if not empty
    if (value.trim()) {
      filteredFmLines.push(`${key}: "${value}"`);
    }

    const newContent = [
      ...lines.slice(0, fmStart + 1),
      ...filteredFmLines,
      ...lines.slice(fmEnd)
    ].join('\n');

    await this.app.vault.modify(file, newContent);
  }

  /**
   * Update REV timestamp in frontmatter
   */
  private async updateRevTimestamp(file: TFile): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '').slice(0, -1);
    await this.updateFrontMatterValue(file, 'REV', timestamp);
  }
}