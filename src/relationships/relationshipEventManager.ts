/**
 * @fileoverview Relationship Events Manager
 * 
 * This module handles event-driven synchronization between the relationship graph,
 * contact front matter, and the Related list in contact notes.
 */

import { App, TFile, MarkdownView, debounce, parseYaml, stringifyYaml } from 'obsidian';
import { RelationshipGraphService, ContactNode } from './relationshipGraph';
import { updateFrontMatterValue } from 'src/contacts/contactFrontmatter';
import { loggingService } from 'src/services/loggingService';

export interface RelationshipItem {
  kind: string;
  contactName: string;
}

/**
 * Manages relationship-related events and synchronization
 */
export class RelationshipEventManager {
  private app: App;
  private relationshipGraph: RelationshipGraphService;
  private isUpdating = new Set<string>(); // Track files being updated to prevent cascades
  private lastRelatedContent = new Map<string, string>(); // Track last content to detect changes
  
  constructor(app: App) {
    this.app = app;
    this.relationshipGraph = new RelationshipGraphService();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for relationship management
   */
  private setupEventListeners(): void {
    // On file open: render front matter as Related list
    this.app.workspace.on('file-open', (file: TFile | null) => {
      if (file && this.isContactFile(file)) {
        this.syncFrontMatterToRelatedSection(file);
      }
    });

    // On active leaf change: handle focus changes
    this.app.workspace.on('active-leaf-change', () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file && this.isContactFile(activeView.file)) {
        this.syncFrontMatterToRelatedSection(activeView.file);
      }
    });

    // On file modify: sync Related list back to front matter (debounced)
    this.app.vault.on('modify', debounce((file: TFile) => {
      if (this.isContactFile(file) && !this.isUpdating.has(file.path)) {
        this.syncRelatedSectionToFrontMatter(file);
      }
    }, 1000, true));
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile): boolean {
    // Simple check - could be enhanced with more sophisticated logic
    return file.extension === 'md' && !file.path.includes('templates');
  }

  /**
   * Sync front matter RELATED fields to the Related section in the note
   */
  private async syncFrontMatterToRelatedSection(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const frontmatter = this.parseFrontmatter(content);
      
      if (!frontmatter) return;

      // Get UID for this contact
      const uid = frontmatter.UID;
      if (!uid) return;

      // Parse front matter into graph
      this.relationshipGraph.frontMatterToGraph(uid, frontmatter);
      
      // Generate the Related section content
      const relatedMarkdown = this.generateRelatedMarkdown(uid);
      
      // Update the note with the Related section
      await this.updateRelatedSection(file, content, relatedMarkdown);
      
    } catch (error) {
      loggingService.error(`Error syncing front matter to Related section: ${error.message}`);
    }
  }

  /**
   * Sync the Related section back to front matter
   */
  private async syncRelatedSectionToFrontMatter(file: TFile): Promise<void> {
    try {
      this.isUpdating.add(file.path);
      
      const content = await this.app.vault.read(file);
      const frontmatter = this.parseFrontmatter(content);
      
      if (!frontmatter?.UID) return;
      
      const uid = frontmatter.UID;
      const relatedItems = this.parseRelatedSection(content);
      
      // Check if the related content actually changed
      const currentContent = JSON.stringify(relatedItems);
      if (this.lastRelatedContent.get(file.path) === currentContent) {
        return; // No change detected
      }
      this.lastRelatedContent.set(file.path, currentContent);

      // Update relationships in the graph
      await this.updateRelationshipsFromList(uid, relatedItems, file);
      
      // Update front matter with new relationships
      await this.updateFrontMatterFromGraph(uid, file);
      
      // Propagate changes to related contacts
      await this.propagateRelationshipChanges(uid);
      
    } catch (error) {
      loggingService.error(`Error syncing Related section to front matter: ${error.message}`);
    } finally {
      this.isUpdating.delete(file.path);
    }
  }

  /**
   * Parse front matter from content
   */
  private parseFrontmatter(content: string): Record<string, any> | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;
    
    try {
      return parseYaml(frontmatterMatch[1]) || {};
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse the Related section from note content
   */
  private parseRelatedSection(content: string): RelationshipItem[] {
    const relationships: RelationshipItem[] = [];
    
    // Find the Related section
    const relatedMatch = content.match(/^## Related\s*\n(.*?)(?=\n## |\n#### |\n---|\n\n\#|\s*$)/ms);
    if (!relatedMatch) return relationships;
    
    const relatedContent = relatedMatch[1];
    const lines = relatedContent.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^- (\w+) \[\[([^\]]+)\]\]$/);
      if (match) {
        const [, kind, contactName] = match;
        relationships.push({ kind: kind.toLowerCase(), contactName });
      }
    }
    
    return relationships;
  }

  /**
   * Generate Related markdown from graph relationships
   */
  private generateRelatedMarkdown(uid: string): string {
    const relationships = this.relationshipGraph.getRelationships(uid);
    
    if (relationships.length === 0) {
      return '';
    }

    const sortedRelationships = relationships
      .map(rel => ({
        ...rel,
        displayName: this.getContactDisplayName(rel.targetUID)
      }))
      .filter(rel => rel.displayName)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.displayName!.localeCompare(b.displayName!));

    const listItems = sortedRelationships.map(rel => 
      `- ${rel.kind} [[${rel.displayName}]]`
    );

    return listItems.join('\n');
  }

  /**
   * Get display name for a contact by UID
   */
  private getContactDisplayName(uid: string): string | null {
    // For name: format, extract the name
    if (uid.startsWith('name:')) {
      return uid.substring(5);
    }
    
    // For UID format, try to find the contact file and get the name
    // This is a simplified approach - in practice, we'd maintain a UID->name mapping
    const contactNode = this.relationshipGraph.getAllContacts().find(c => c.uid === uid);
    return contactNode?.name || `[UID: ${uid.substring(0, 8)}...]`;
  }

  /**
   * Update the Related section in the note content
   */
  private async updateRelatedSection(file: TFile, content: string, relatedMarkdown: string): Promise<void> {
    let updatedContent = content;
    
    // Check if Related section exists
    const relatedSectionRegex = /^## Related.*?(?=\n## |\n#### |\n---|\s*$)/ms;
    
    if (relatedSectionRegex.test(content)) {
      // Update existing Related section
      updatedContent = content.replace(relatedSectionRegex, `## Related\n${relatedMarkdown}\n`);
    } else {
      // Add Related section after front matter and Notes
      const insertAfterNotesRegex = /(^#### Notes.*?(?=\n## |\n#### |\n\n\#|\s*$))/ms;
      const insertAfterFrontmatterRegex = /(^---\n[\s\S]*?\n---\n)/;
      
      if (insertAfterNotesRegex.test(content)) {
        updatedContent = content.replace(insertAfterNotesRegex, `$1\n\n## Related\n${relatedMarkdown}\n`);
      } else if (insertAfterFrontmatterRegex.test(content)) {
        updatedContent = content.replace(insertAfterFrontmatterRegex, `$1\n## Related\n${relatedMarkdown}\n`);
      }
    }
    
    // Only update if content actually changed
    if (updatedContent !== content) {
      await this.app.vault.modify(file, updatedContent);
    }
  }

  /**
   * Update relationships from the parsed list
   */
  private async updateRelationshipsFromList(uid: string, relationships: RelationshipItem[], sourceFile: TFile): Promise<void> {
    // Clear existing relationships for this contact
    if (this.relationshipGraph.getAllContacts().some(c => c.uid === uid)) {
      // Remove all outbound relationships for this contact
      // (Implementation would clear from graph)
    }

    // Add contact to graph
    const frontmatter = this.app.metadataCache.getFileCache(sourceFile)?.frontmatter;
    const contactName = frontmatter?.FN || frontmatter?.['N.GN'] + ' ' + frontmatter?.['N.FN'];
    
    this.relationshipGraph.addContact({
      uid,
      name: contactName,
      file: sourceFile,
      gender: frontmatter?.GENDER
    });

    // Add new relationships
    for (const rel of relationships) {
      const { kind, inferredGender } = this.relationshipGraph.parseRelationshipTerm(rel.kind);
      
      // Try to find target contact UID
      const targetUID = await this.findOrCreateTargetUID(rel.contactName, inferredGender);
      if (targetUID) {
        this.relationshipGraph.addRelationship(uid, targetUID, kind);
      }
    }
  }

  /**
   * Find target contact UID or create placeholder
   */
  private async findOrCreateTargetUID(contactName: string, inferredGender?: 'male' | 'female'): Promise<string | null> {
    // Try to find existing contact by name
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      
      if (frontmatter) {
        const fullName = frontmatter.FN || 
          (frontmatter['N.GN'] && frontmatter['N.FN'] ? 
           `${frontmatter['N.GN']} ${frontmatter['N.FN']}` : null);
        
        if (fullName === contactName && frontmatter.UID) {
          // Update gender if inferred
          if (inferredGender && !frontmatter.GENDER) {
            await updateFrontMatterValue(file, 'GENDER', inferredGender);
          }
          return frontmatter.UID;
        }
      }
    }
    
    // Return name: format for missing contacts
    return `name:${contactName}`;
  }

  /**
   * Update front matter from current graph state
   */
  private async updateFrontMatterFromGraph(uid: string, file: TFile): Promise<void> {
    const relatedEntries = this.relationshipGraph.relationshipsToFrontMatter(uid);
    
    // Get current front matter
    const content = await this.app.vault.read(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return;
    
    let frontmatter = parseYaml(frontmatterMatch[1]) || {};
    
    // Remove existing RELATED fields
    Object.keys(frontmatter).forEach(key => {
      if (key.startsWith('RELATED[')) {
        delete frontmatter[key];
      }
    });
    
    // Add new RELATED fields
    relatedEntries.forEach(([key, value]) => {
      frontmatter[key] = value;
    });
    
    // Update REV timestamp
    frontmatter.REV = new Date().toISOString();
    
    // Update the file
    const newFrontmatterYaml = stringifyYaml(frontmatter);
    const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newFrontmatterYaml}---`);
    
    await this.app.vault.modify(file, newContent);
  }

  /**
   * Propagate relationship changes to related contacts
   */
  private async propagateRelationshipChanges(sourceUID: string): Promise<void> {
    const relationships = this.relationshipGraph.getRelationships(sourceUID);
    
    for (const rel of relationships) {
      if (!rel.targetUID.startsWith('name:')) {
        // Find the target contact file and update it
        const targetFile = await this.findContactFileByUID(rel.targetUID);
        if (targetFile && !this.isUpdating.has(targetFile.path)) {
          // Add reciprocal relationship if needed
          await this.ensureReciprocalRelationship(sourceUID, rel.targetUID, rel.kind, targetFile);
        }
      }
    }
  }

  /**
   * Ensure reciprocal relationship exists
   */
  private async ensureReciprocalRelationship(
    sourceUID: string, 
    targetUID: string, 
    relationshipKind: string,
    targetFile: TFile
  ): Promise<void> {
    // Implementation would check if reciprocal relationship exists
    // and add it if missing, then sync to front matter
  }

  /**
   * Find contact file by UID
   */
  private async findContactFileByUID(uid: string): Promise<TFile | null> {
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID === uid) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Initialize relationships from all contacts
   */
  async initializeFromVault(): Promise<void> {
    loggingService.info('Initializing relationship graph from vault contacts...');
    
    const allFiles = this.app.vault.getMarkdownFiles();
    
    // First pass: add all contacts to graph
    for (const file of allFiles) {
      if (this.isContactFile(file)) {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        
        if (frontmatter?.UID) {
          const contactName = frontmatter.FN || 
            (frontmatter['N.GN'] && frontmatter['N.FN'] ? 
             `${frontmatter['N.GN']} ${frontmatter['N.FN']}` : null);
          
          this.relationshipGraph.addContact({
            uid: frontmatter.UID,
            name: contactName,
            file,
            gender: frontmatter.GENDER
          });
          
          // Parse relationships from front matter
          this.relationshipGraph.frontMatterToGraph(frontmatter.UID, frontmatter);
        }
      }
    }
    
    // Check consistency and fix missing reciprocals
    const missingReciprocals = this.relationshipGraph.checkConsistency();
    if (missingReciprocals.length > 0) {
      loggingService.info(`Found ${missingReciprocals.length} missing reciprocal relationships. Adding them...`);
      
      for (const missing of missingReciprocals) {
        this.relationshipGraph.addRelationship(missing.sourceUID, missing.targetUID, missing.kind);
        
        // Update front matter for the contact with missing reciprocal
        const targetFile = await this.findContactFileByUID(missing.sourceUID);
        if (targetFile) {
          await this.updateFrontMatterFromGraph(missing.sourceUID, targetFile);
        }
      }
    }
    
    loggingService.info('Relationship graph initialization complete');
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Clean up event listeners if needed
    this.relationshipGraph.clear();
    this.lastRelatedContent.clear();
    this.isUpdating.clear();
  }
}