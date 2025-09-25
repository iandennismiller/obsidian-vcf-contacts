import { App, TFile } from 'obsidian';
import { RelationshipGraph } from './relationshipGraph';
import { RelationshipType, Gender, RelatedListItem, ContactNote } from './types';
import { parseRelationshipListItem, formatRelationshipListItem, normalizeGender } from './genderUtils';
import { loggingService } from 'src/services/loggingService';

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
   * Parse the Related section from markdown content
   */
  parseRelatedSection(content: string): RelatedListItem[] {
    const relationships: RelatedListItem[] = [];
    
    // Find the Related section - more flexible regex pattern
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$/im);
    if (!relatedMatch) {
      return relationships;
    }

    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => /^#{1,6}\s*related\s*$/i.test(line));
    if (startIndex === -1) {
      return relationships;
    }

    // Find the end of the section
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].match(/^#{1,6}\s/)) {
        endIndex = i;
        break;
      }
    }

    // Parse the lines in the section
    for (let i = startIndex + 1; i < endIndex; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('-')) {
        const parsed = parseRelationshipListItem(trimmed);
        if (parsed) {
          relationships.push(parsed);
        }
      }
    }

    return relationships;
  }

  /**
   * Extract the Related section from content
   */
  extractRelatedSection(content: string): string | null {
    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => /^#{1,6}\s*related\s*$/i.test(line));
    if (startIndex === -1) {
      return null;
    }

    // Find the end of the section
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].match(/^#{1,6}\s/)) {
        endIndex = i;
        break;
      }
    }

    return lines.slice(startIndex, endIndex).join('\n').trim();
  }

  /**
   * Update the graph from parsed related list - MERGE with existing relationships, don't clear
   */
  async updateGraphFromRelatedList(
    uid: string, 
    relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[]
  ): Promise<void> {
    if (!this.graph.getNode(uid)) {
      loggingService.warning(`[RelationshipSyncManager] Node ${uid} not found in graph`);
      return;
    }

    for (const rel of relationships) {
      try {
        // Find or create the target contact
        const targetUid = await this.findOrCreateContactByName(rel.contactName);
        if (!targetUid) {
          loggingService.warning(`[RelationshipSyncManager] Could not find or create contact: ${rel.contactName}`);
          continue;
        }

        // Update target's gender if implied
        if (rel.impliedGender) {
          await this.updateContactGender(targetUid, rel.impliedGender);
        }

        // Add the relationship to the graph
        this.graph.addRelationship(uid, targetUid, rel.type);
        
      } catch (error) {
        loggingService.error(`[RelationshipSyncManager] Error processing relationship ${uid} -> ${rel.contactName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Update frontmatter from graph relationships - MERGE with existing relationships, don't replace
   */
  async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    try {
      const relatedFields = this.graph.contactToRelatedFields(uid);
      if (relatedFields.length === 0) {
        return; // No relationships to sync
      }

      // Group relationships by type
      const relationshipsByType: Record<string, string[]> = {};
      for (const field of relatedFields) {
        const key = `RELATED[${field.type}]`;
        if (!relationshipsByType[key]) {
          relationshipsByType[key] = [];
        }
        relationshipsByType[key].push(field.value);
      }

      // Sort each array for consistent ordering
      Object.keys(relationshipsByType).forEach(key => {
        relationshipsByType[key].sort();
      });

      // Read current front matter
      const cache = this.app.metadataCache.getFileCache(file);
      const currentFrontmatter = cache?.frontmatter || {};
      
      // Check if anything actually changed
      let hasChanges = false;
      for (const [key, values] of Object.entries(relationshipsByType)) {
        const currentValues = currentFrontmatter[key];
        if (!currentValues || !this.arraysEqual(currentValues, values)) {
          hasChanges = true;
          break;
        }
      }

      if (!hasChanges) {
        return; // No changes needed
      }

      // Update front matter
      await this.updateFrontMatter(file, relationshipsByType);
      
      loggingService.info(`[RelationshipSyncManager] Updated front matter for ${file.path}`);
      
    } catch (error) {
      loggingService.error(`[RelationshipSyncManager] Error updating front matter for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      targetName: this.getContactNameFromUid(field.value)
    }));

    const updatedContent = this.updateRelatedSectionInContent(content, relationships);
    
    if (updatedContent !== content) {
      await this.app.vault.modify(file, updatedContent);
      loggingService.info(`[RelationshipSyncManager] Synced front matter to Related list for ${file.path}`);
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
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\\s\\S]*?)(?=^#{1,6}|$)/im);
    
    if (relatedMatch) {
      // Replace existing section
      return content.replace(relatedMatch[0], relatedSection.trim());
    } else {
      // Add new section at the end
      return content.trim() + relatedSection;
    }
  }

  /**
   * Find contact by name or create a stub entry
   */
  async findOrCreateContactByName(name: string): Promise<string | null> {
    // First, check if we can find an existing contact by name
    const nodes = this.graph.getNodes();
    for (const node of nodes) {
      if (node.fullName === name) {
        return node.uid;
      }
    }

    // Check if there's a file with this name
    const contactsFolder = this.getContactsFolder();
    const possiblePath = `${contactsFolder}/${name}.md`;
    const file = this.app.vault.getAbstractFileByPath(possiblePath);
    
    if (file instanceof TFile) {
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      if (uid) {
        // Add to graph if not already there
        this.graph.addNode(uid, name, undefined, file);
        return uid;
      }
    }

    // For now, we'll create a placeholder node with the name as UID
    // In a real implementation, you might want to create an actual contact file
    const placeholderUid = `name:${name}`;
    this.graph.addNode(placeholderUid, name);
    
    loggingService.info(`[RelationshipSyncManager] Created placeholder node for: ${name}`);
    return placeholderUid;
  }

  /**
   * Update a contact's gender information
   */
  private async updateContactGender(uid: string, gender: Gender): Promise<void> {
    const node = this.graph.getNode(uid);
    if (!node || !node.file) return;

    try {
      const cache = this.app.metadataCache.getFileCache(node.file);
      const currentGender = cache?.frontmatter?.GENDER;
      
      if (currentGender !== gender) {
        await this.updateFrontMatter(node.file, { GENDER: gender });
        
        // Update the node in the graph
        this.graph.addNode(uid, node.fullName, gender, node.file);
        
        loggingService.info(`[RelationshipSyncManager] Updated gender for ${uid}: ${gender}`);
      }
    } catch (error) {
      loggingService.error(`[RelationshipSyncManager] Error updating gender for ${uid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get contact name from UID or related value
   */
  private getContactNameFromUid(relatedValue: string): string {
    if (relatedValue.startsWith('name:')) {
      return relatedValue.substring(5);
    }
    
    const uid = relatedValue.replace(/^(urn:uuid:|uid:)/, '');
    const node = this.graph.getNode(uid);
    return node?.fullName || uid;
  }

  /**
   * Update front matter fields
   */
  private async updateFrontMatter(file: TFile, updates: Record<string, any>): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      
      let frontMatterStart = -1;
      let frontMatterEnd = -1;
      
      // Find front matter bounds
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          if (frontMatterStart === -1) {
            frontMatterStart = i;
          } else {
            frontMatterEnd = i;
            break;
          }
        }
      }

      if (frontMatterStart === -1 || frontMatterEnd === -1) {
        loggingService.warning(`[RelationshipSyncManager] No front matter found in ${file.path}`);
        return;
      }

      // Parse current front matter
      const frontMatterContent = lines.slice(frontMatterStart + 1, frontMatterEnd).join('\n');
      const frontMatter = this.parseFrontMatter(frontMatterContent);
      
      // Apply updates
      Object.assign(frontMatter, updates);
      
      // Update REV timestamp
      frontMatter.REV = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      // Serialize front matter
      const newFrontMatterContent = this.serializeFrontMatter(frontMatter);
      
      // Replace front matter in content
      const newLines = [
        ...lines.slice(0, frontMatterStart + 1),
        ...newFrontMatterContent.split('\n'),
        ...lines.slice(frontMatterEnd)
      ];
      
      await this.app.vault.modify(file, newLines.join('\n'));
      
    } catch (error) {
      loggingService.error(`[RelationshipSyncManager] Error updating front matter for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simple front matter parser (basic YAML-like parsing)
   */
  private parseFrontMatter(content: string): Record<string, any> {
    const frontMatter: Record<string, any> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Handle quoted strings
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        frontMatter[key] = value;
      }
    }
    
    return frontMatter;
  }

  /**
   * Serialize front matter back to YAML-like format
   */
  private serializeFrontMatter(frontMatter: Record<string, any>): string {
    const lines: string[] = [];
    
    // Sort keys for consistent output
    const sortedKeys = Object.keys(frontMatter).sort();
    
    for (const key of sortedKeys) {
      const value = frontMatter[key];
      if (Array.isArray(value)) {
        // Handle arrays
        lines.push(`${key}:`);
        for (const item of value.sort()) {
          lines.push(`  - ${this.formatValue(item)}`);
        }
      } else {
        lines.push(`${key}: ${this.formatValue(value)}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format a value for front matter serialization
   */
  private formatValue(value: any): string {
    if (typeof value === 'string' && (value.includes(':') || value.includes(' '))) {
      return `"${value}"`;
    }
    return String(value);
  }

  /**
   * Check if two arrays are equal
   */
  private arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Get contacts folder from settings
   */
  private getContactsFolder(): string {
    // This would normally come from plugin settings
    // For now, we'll use a default
    return 'Contacts';
  }
}