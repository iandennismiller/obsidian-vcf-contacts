import { TFile, App } from 'obsidian';
import { RelationshipGraph, RelationshipType, Gender } from './relationshipGraph';
import { RelationshipSet } from './relationshipSet';
import { updateFrontMatterValue } from '../contacts/contactFrontmatter';
import { normalizeGender, formatRelationshipListItem } from './genderUtils';
import { loggingService } from '../services/loggingService';

/**
 * Manages sync operations between Related lists, front matter, and the relationship graph
 */
export class RelationshipSyncManager {
  private app: App;
  private graph: RelationshipGraph;

  constructor(app: App, graph: RelationshipGraph) {
    this.app = app;
    this.graph = graph;
  }

  /**
   * Directly merge Related list relationships with existing front matter
   */
  async mergeRelatedListToFrontmatter(
    file: TFile, 
    relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[]
  ): Promise<void> {
    loggingService.info(`[RelationshipSyncManager] Starting direct merge for ${file.path} with ${relationships.length} Related list relationships`);
    
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Get existing front matter relationships
    const existingFrontMatterSet = RelationshipSet.fromFrontMatter(cache?.frontmatter || {});
    loggingService.info(`[RelationshipSyncManager] Existing front matter relationships: ${existingFrontMatterSet.size()}`);
    
    // Log existing relationships for debugging
    for (const entry of existingFrontMatterSet.getEntries()) {
      loggingService.info(`[RelationshipSyncManager] Existing: ${entry.type} -> ${entry.value}`);
    }
    
    // Convert Related list relationships to RelationshipSet format
    const relatedListEntries: { type: RelationshipType; value: string }[] = [];
    for (const rel of relationships) {
      loggingService.info(`[RelationshipSyncManager] Processing Related list item: ${rel.type} -> ${rel.contactName}`);
      
      // Find the target contact to get proper UID/name for front matter
      const targetUid = await this.findOrCreateContactByName(rel.contactName);
      const value = targetUid || rel.contactName; // Use UID if available, otherwise name
      
      loggingService.info(`[RelationshipSyncManager] Resolved contact: ${rel.contactName} -> ${targetUid ? `UID:${targetUid}` : `NAME:${value}`}`);
      relatedListEntries.push({ type: rel.type, value });
    }
    
    const relatedListSet = new RelationshipSet(relatedListEntries);
    loggingService.info(`[RelationshipSyncManager] Related list set size: ${relatedListSet.size()}`);
    
    // Log related list relationships for debugging
    for (const entry of relatedListSet.getEntries()) {
      loggingService.info(`[RelationshipSyncManager] Related list: ${entry.type} -> ${entry.value}`);
    }
    
    // Merge: start with existing front matter, add any missing relationships from Related list
    const mergedSet = existingFrontMatterSet.clone();
    let addedCount = 0;
    
    for (const entry of relatedListSet.getEntries()) {
      // Only add if this exact relationship doesn't already exist
      const existingEntries = mergedSet.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      loggingService.info(`[RelationshipSyncManager] Checking if ${entry.type}:${entry.value} already exists: ${alreadyExists}`);
      
      if (!alreadyExists) {
        // Check for blank values before adding
        const stringValue = String(entry.value || '').trim();
        if (stringValue && stringValue !== 'null' && stringValue !== 'undefined') {
          mergedSet.add(entry.type, entry.value);
          addedCount++;
          loggingService.info(`[RelationshipSyncManager] Added new relationship: ${entry.type} -> ${entry.value}`);
        } else {
          loggingService.info(`[RelationshipSyncManager] Skipped blank/invalid value: ${entry.type} -> ${entry.value}`);
        }
      }
    }
    
    loggingService.info(`[RelationshipSyncManager] Direct merge - existing: ${existingFrontMatterSet.size()}, related list: ${relatedListSet.size()}, merged: ${mergedSet.size()}, added: ${addedCount}`);
    
    // Always update front matter to ensure consistent indexing (even if no new relationships)
    if (mergedSet.size() > 0) {
      // Clear existing RELATED fields
      if (cache?.frontmatter) {
        for (const key of Object.keys(cache.frontmatter)) {
          if (key.startsWith('RELATED')) {
            await updateFrontMatterValue(file, key, '', this.app);
          }
        }
      }

      // Add merged and sanitized RELATED fields using RelationshipSet for consistent indexing
      const frontMatterFields = mergedSet.toFrontMatterFields();
      for (const [key, value] of Object.entries(frontMatterFields)) {
        await updateFrontMatterValue(file, key, value, this.app);
        loggingService.info(`[RelationshipSyncManager] Set front matter: ${key} = ${value}`);
      }
      
      loggingService.info(`[RelationshipSyncManager] Updated front matter for: ${file.path} (${mergedSet.size()} total relationships, ${addedCount} new)`);
    } else {
      loggingService.info(`[RelationshipSyncManager] No relationships to write to front matter for: ${file.path}`);
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
      targetName: this.graph.getContact(field.value.replace(/^(urn:uuid:|uid:|name:)/, ''))?.fullName || field.value
    }));

    const newContent = this.updateRelatedSectionInContent(content, relationships);
    
    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
      loggingService.info(`[RelationshipSyncManager] Updated Related section in: ${file.path}`);
    }
  }

  /**
   * Update the Related section in content
   */
  private updateRelatedSectionInContent(
    content: string, 
    relationships: { type: RelationshipType; targetUid: string; targetName: string }[]
  ): string {
    const relatedListItems = relationships.map(rel => {
      // Get target contact from the relationship graph (we need access to it)
      // For now, we'll pass undefined for gender and let the caller handle this
      return formatRelationshipListItem(rel.type, rel.targetName, undefined);
    });

    const relatedSection = relatedListItems.length > 0 
      ? `\n## Related\n${relatedListItems.join('\n')}\n`
      : '\n## Related\n\n';

    // Replace or add the Related section
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\s\S]*?)(?=^#{1,6}|$)/im);
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

      // Check if this relationship already exists
      const relationshipKey = `${rel.type}:${targetUid}`;
      if (existingSet.has(relationshipKey)) {
        loggingService.info(`[RelationshipSyncManager] Relationship already exists in graph: ${relationshipKey}`);
        continue;
      }

      // Update target contact's gender if implied
      if (rel.impliedGender) {
        const targetContact = this.graph.getContact(targetUid);
        if (targetContact && targetContact.file) {
          await this.updateContactGender(targetContact.file, rel.impliedGender);
        }
      }

      // Add the new relationship
      loggingService.info(`[RelationshipSyncManager] Adding new relationship to graph: ${relationshipKey}`);
      this.graph.addRelationship(uid, targetUid, rel.type);
    }
  }

  /**
   * Update frontmatter from graph relationships - MERGE with existing relationships, don't replace
   */
  async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Get relationships from both graph and existing front matter
    const graphRelatedFields = this.graph.contactToRelatedFields(uid);
    const existingFrontMatter = cache?.frontmatter || {};
    
    loggingService.info(`[RelationshipSyncManager] Merging front matter - graph: ${graphRelatedFields.length}, existing front matter relationships: ${Object.keys(existingFrontMatter).filter(k => k.startsWith('RELATED')).length}`);
    
    // Get existing front matter relationships using RelationshipSet
    const existingSet = RelationshipSet.fromFrontMatter(existingFrontMatter);
    
    // Convert graph fields to RelationshipSet format
    const graphEntries = graphRelatedFields.map(field => ({ type: field.type, value: field.value }));
    const graphSet = new RelationshipSet(graphEntries);
    
    // Merge: start with existing front matter, add missing graph relationships
    const mergedSet = existingSet.clone();
    let addedCount = 0;
    
    for (const entry of graphSet.getEntries()) {
      // Only add if this exact relationship doesn't already exist
      const existingEntries = mergedSet.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      if (!alreadyExists) {
        // Check for blank values before adding
        const stringValue = String(entry.value || '').trim();
        if (stringValue && stringValue !== 'null' && stringValue !== 'undefined') {
          mergedSet.add(entry.type, entry.value);
          addedCount++;
        }
      }
    }
    
    loggingService.info(`[RelationshipSyncManager] Front matter merge complete - existing: ${existingSet.size()}, graph: ${graphSet.size()}, merged: ${mergedSet.size()}, added: ${addedCount}`);
    
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
   * Find contact by name or create a stub entry
   */
  async findOrCreateContactByName(name: string): Promise<string | null> {
    loggingService.info(`[RelationshipSyncManager] Looking up contact: ${name}`);
    
    // First, try to find existing contact by name
    const allContacts = this.graph.getAllContacts();
    const existing = allContacts.find(c => c.fullName === name);
    if (existing) {
      loggingService.info(`[RelationshipSyncManager] Found existing contact in graph: ${name} -> ${existing.uid}`);
      return existing.uid;
    }

    // Try different contact file paths
    const possiblePaths = [
      `Contacts/${name}.md`,
      `contacts/${name}.md`,
      `People/${name}.md`,
      `people/${name}.md`
    ];
    
    for (const path of possiblePaths) {
      const contactFile = this.app.vault.getAbstractFileByPath(path);
      // Check if it's a TFile using duck typing instead of instanceof to avoid test issues
      if (contactFile && typeof contactFile === 'object' && 'path' in contactFile) {
        // Load the contact into the graph
        const cache = this.app.metadataCache.getFileCache(contactFile);
        if (cache?.frontmatter?.UID) {
          const fullName = cache.frontmatter.FN || name;
          const gender = cache.frontmatter.GENDER || '';
          this.graph.addContact(cache.frontmatter.UID, fullName, gender, contactFile);
          loggingService.info(`[RelationshipSyncManager] Loaded contact from file: ${path} -> ${cache.frontmatter.UID}`);
          return cache.frontmatter.UID;
        }
      }
    }

    // Try to find by partial name match in existing contacts
    const partialMatch = allContacts.find(c => 
      c.fullName.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(c.fullName.toLowerCase())
    );
    if (partialMatch) {
      loggingService.info(`[RelationshipSyncManager] Found partial match: ${name} -> ${partialMatch.fullName} (${partialMatch.uid})`);
      return partialMatch.uid;
    }

    // Contact not found - return null but this is OK, we'll use the name as value
    loggingService.info(`[RelationshipSyncManager] Contact not found, will use name as value: ${name}`);
    return null;
  }

  /**
   * Update a contact's gender in their front matter
   */
  async updateContactGender(file: TFile, gender: Gender): Promise<void> {
    const normalizedGender = normalizeGender(gender);
    if (normalizedGender) {
      await updateFrontMatterValue(file, 'GENDER', normalizedGender, this.app);
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
    const now = new Date().toISOString();
    await updateFrontMatterValue(file, 'REV', now, this.app);
  }

  /**
   * Check if two relationship arrays are equivalent
   */
  areRelationshipsEquivalent(
    a: { type: RelationshipType; value: string }[], 
    b: { type: RelationshipType; value: string }[]
  ): boolean {
    if (a.length !== b.length) return false;
    
    const aSet = new Set(a.map(r => `${r.type}:${r.value}`));
    const bSet = new Set(b.map(r => `${r.type}:${r.value}`));
    
    return aSet.size === bSet.size && [...aSet].every(item => bSet.has(item));
  }

  /**
   * Extract the Related section from markdown content
   */
  private extractRelatedSection(content: string): string | null {
    const relatedMatch = content.match(/^#{1,6}\s*related\s*$([^]*?)(?=^#{1,6}|$)/im);
    return relatedMatch ? relatedMatch[1].trim() : null;
  }

  /**
   * Parse relationships from Related section content
   */
  private parseRelatedSection(sectionContent: string): { type: RelationshipType; contactName: string; impliedGender?: Gender }[] {
    const { parseRelationshipListItem } = require('./genderUtils');
    const relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[] = [];
    
    const lines = sectionContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const parsed = parseRelationshipListItem(trimmed);
        if (parsed) {
          relationships.push({
            type: parsed.type,
            contactName: parsed.contactName,
            impliedGender: parsed.impliedGender
          });
        }
      }
    }
    
    return relationships;
  }
  getSyncStats(file: TFile): Promise<{
    frontMatterCount: number;
    graphCount: number;
    relatedListCount: number;
    inconsistencies: string[];
  }> {
    return new Promise(async (resolve) => {
      const stats = {
        frontMatterCount: 0,
        graphCount: 0,
        relatedListCount: 0,
        inconsistencies: [] as string[]
      };

      try {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter?.UID) {
          resolve(stats);
          return;
        }

        const uid = cache.frontmatter.UID;

        // Count front matter relationships
        const frontMatterRelationships = Object.keys(cache.frontmatter).filter(k => k.startsWith('RELATED'));
        stats.frontMatterCount = frontMatterRelationships.length;

        // Count graph relationships
        const graphRelationships = this.graph.getContactRelationships(uid);
        stats.graphCount = graphRelationships.length;

        // Count Related list relationships
        const content = await this.app.vault.read(file);
        const relatedSection = this.extractRelatedSection(content);
        if (relatedSection) {
          const relatedListRelationships = this.parseRelatedSection(relatedSection);
          stats.relatedListCount = relatedListRelationships.length;
        }

        // Check for inconsistencies
        if (stats.frontMatterCount !== stats.relatedListCount) {
          stats.inconsistencies.push(`Front matter (${stats.frontMatterCount}) != Related list (${stats.relatedListCount})`);
        }
        if (stats.graphCount !== stats.relatedListCount) {
          stats.inconsistencies.push(`Graph (${stats.graphCount}) != Related list (${stats.relatedListCount})`);
        }

      } catch (error) {
        stats.inconsistencies.push(`Error gathering stats: ${error.message}`);
      }

      resolve(stats);
    });
  }
}