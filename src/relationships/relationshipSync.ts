/**
 * @fileoverview Relationship synchronization service
 */

import type { TFile, App } from 'obsidian';
import { parseYaml, stringifyYaml } from 'obsidian';
import { RelationshipGraph } from './relationshipGraph';
import { 
  frontMatterToRelationships, 
  relationshipsToFrontMatter,
  extractInferredGender 
} from './relatedFieldUtils';
import { 
  extractRelatedSection, 
  parseAllRelatedItems, 
  formatRelatedListItem,
  buildMarkdownWithRelatedSection,
  needsRelatedSection,
  cleanupDuplicateRelatedHeadings 
} from './markdownRelated';
import { RelationshipTriple, RelationshipSyncOptions } from './types';
import { getApp } from 'src/context/sharedAppContext';
import { updateFrontMatterValue } from 'src/contacts/contactFrontmatter';

export class RelationshipSync {
  private graph: RelationshipGraph;
  private app: App;
  private syncInProgress = new Set<string>();  // Prevent cascade loops
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  // Add shared tracking with VCF folder watcher to prevent conflicts
  private static globalUpdatingFiles = new Set<string>();

  constructor(app?: App) {
    this.app = app || getApp();
    this.graph = new RelationshipGraph(this.app);
  }

  /**
   * Initialize the graph by loading all existing contacts
   */
  async initializeFromVault(): Promise<void> {
    const { metadataCache } = this.app;
    const contacts = this.app.vault.getMarkdownFiles();

    this.graph.clear();

    for (const file of contacts) {
      const frontMatter = metadataCache.getFileCache(file)?.frontmatter;
      if (this.isContactFile(frontMatter)) {
        await this.loadContactIntoGraph(file, frontMatter);
      }
    }

    // Check for missing reciprocal relationships and add them
    await this.ensureConsistency();
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(frontMatter: any): boolean {
    return frontMatter && (
      (frontMatter['N.GN'] && frontMatter['N.FN']) || 
      frontMatter['FN'] ||
      frontMatter['UID']
    );
  }

  /**
   * Load a contact into the graph
   */
  private async loadContactIntoGraph(file: TFile, frontMatter: any): Promise<void> {
    const uid = frontMatter.UID || file.basename;
    const name = frontMatter.FN || file.basename;
    const gender = frontMatter.GENDER;

    this.graph.addOrUpdateContactNode(uid, name, gender, true);

    // Load relationships from front matter
    const relationships = frontMatterToRelationships(frontMatter, uid);
    relationships.forEach(rel => {
      this.graph.addRelationship(rel.subject, rel.object, rel.relationshipKind);
    });
  }

  /**
   * Sync relationships FROM markdown Related list TO front matter and graph
   */
  async syncFromMarkdownToFrontMatter(file: TFile, options?: Partial<RelationshipSyncOptions>): Promise<void> {
    const opts: RelationshipSyncOptions = {
      debounceMs: 1000,
      preventCascade: false,
      ...options
    };

    const uid = await this.getContactUid(file);
    if (!uid || this.syncInProgress.has(uid)) {
      return;
    }

    if (opts.debounceMs > 0) {
      // Debounce multiple rapid changes
      if (this.debounceTimers.has(uid)) {
        clearTimeout(this.debounceTimers.get(uid));
      }

      return new Promise<void>((resolve) => {
        const timer = setTimeout(async () => {
          this.debounceTimers.delete(uid);
          await this.performSyncFromMarkdown(file, uid, opts);
          resolve();
        }, opts.debounceMs);
        this.debounceTimers.set(uid, timer);
      });
    } else {
      await this.performSyncFromMarkdown(file, uid, opts);
    }
  }

  /**
   * Perform the actual sync from markdown
   */
  private async performSyncFromMarkdown(file: TFile, uid: string, options: RelationshipSyncOptions): Promise<void> {
    this.syncInProgress.add(uid);
    RelationshipSync.globalUpdatingFiles.add(file.path);

    try {
      const content = await this.app.vault.read(file);
      const { relatedLines } = extractRelatedSection(content);
      const parsedItems = parseAllRelatedItems(relatedLines);

      // Extract valid relationships
      const newRelationships: RelationshipTriple[] = [];
      const genderInferences: { uid: string; gender: 'M' | 'F' }[] = [];

      for (const item of parsedItems) {
        if (item.isValid) {
          // Try to find the contact by name
          const relatedContact = await this.findContactByName(item.contactName);
          if (relatedContact) {
            newRelationships.push({
              subject: uid,
              relationshipKind: item.relationshipKind,
              object: relatedContact.uid
            });

            // Check for gender inference
            const inferredGender = extractInferredGender(item.relationshipKind);
            if (inferredGender) {
              genderInferences.push({
                uid: relatedContact.uid,
                gender: inferredGender
              });
            }
          }
        }
      }

      // Update the graph
      const existingRelationships = this.graph.getContactRelationships(uid);
      
      // Remove old relationships
      existingRelationships.forEach(rel => {
        this.graph.removeRelationship(rel.subject, rel.object, rel.relationshipKind);
      });

      // Add new relationships
      newRelationships.forEach(rel => {
        this.graph.addRelationship(rel.subject, rel.object, rel.relationshipKind);
      });

      // Update front matter
      await this.updateContactFrontMatter(file, uid, newRelationships);

      // Apply gender inferences
      for (const inference of genderInferences) {
        await this.updateContactGender(inference.uid, inference.gender);
      }

      // Propagate to related contacts (if not preventing cascade)
      if (!options.preventCascade) {
        await this.propagateToRelatedContacts(newRelationships);
      }

    } finally {
      this.syncInProgress.delete(uid);
      RelationshipSync.globalUpdatingFiles.delete(file.path);
    }
  }

  /**
   * Sync relationships FROM front matter TO markdown Related list
   */
  async syncFromFrontMatterToMarkdown(file: TFile): Promise<void> {
    const uid = await this.getContactUid(file);
    if (!uid) return;

    // Skip if file is being updated by another system (like VCF folder watcher)
    if (RelationshipSync.globalUpdatingFiles.has(file.path)) {
      return;
    }

    const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontMatter) return;

    const relationships = frontMatterToRelationships(frontMatter, uid);
    const content = await this.app.vault.read(file);

    // Build the Related section
    const relatedItems: string[] = [];
    for (const rel of relationships) {
      const relatedContact = this.graph.getContact(rel.object);
      const relatedName = relatedContact?.name || rel.object;
      const relatedGender = relatedContact?.gender;

      relatedItems.push(formatRelatedListItem(rel.relationshipKind, relatedName, relatedGender));
    }

    // Update the markdown content
    await this.updateMarkdownRelatedSection(file, content, relatedItems);
  }

  /**
   * Update the markdown Related section
   */
  private async updateMarkdownRelatedSection(file: TFile, content: string, relatedItems: string[]): Promise<void> {
    const cleanedContent = cleanupDuplicateRelatedHeadings(content);
    const { beforeSection, afterSection, hasRelatedHeading, relatedHeadingLine } = extractRelatedSection(cleanedContent);

    let newContent: string;
    
    if (relatedItems.length > 0) {
      // Add or update Related section
      newContent = buildMarkdownWithRelatedSection(beforeSection, relatedItems, afterSection, relatedHeadingLine);
    } else if (hasRelatedHeading) {
      // Remove empty Related section
      newContent = beforeSection.trim() + (afterSection.trim() ? '\n' + afterSection : '');
    } else {
      // No changes needed
      return;
    }

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
      // Don't update REV here - let the front matter update handle it
      // This prevents double REV updates when both markdown and front matter change
    }
  }

  /**
   * Update contact front matter with relationships
   */
  private async updateContactFrontMatter(file: TFile, uid: string, relationships: RelationshipTriple[]): Promise<void> {
    const relatedFrontMatter = relationshipsToFrontMatter(relationships, uid);
    const content = await this.app.vault.read(file);
    
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) return;

    const yamlObj = parseYaml(match[1]) || {};
    const originalYaml = JSON.stringify(yamlObj); // For comparison
    
    // Remove existing RELATED fields
    Object.keys(yamlObj).forEach(key => {
      if (key.startsWith('RELATED')) {
        delete yamlObj[key];
      }
    });

    // Add new RELATED fields
    Object.assign(yamlObj, relatedFrontMatter);

    // Only update REV if we actually changed the front matter content
    const newYaml = JSON.stringify(yamlObj);
    const hasChanges = originalYaml !== newYaml;
                      
    if (hasChanges) {
      // Update REV timestamp only when there are actual changes
      yamlObj.REV = new Date().toISOString();
    }

    const body = content.slice(match[0].length);
    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    // Only modify if content actually changed
    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }

  /**
   * Find contact by name
   */
  private async findContactByName(name: string): Promise<{ uid: string; file: TFile } | null> {
    const contacts = this.app.vault.getMarkdownFiles();
    
    for (const file of contacts) {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (this.isContactFile(frontMatter)) {
        const contactName = frontMatter?.FN || file.basename;
        if (contactName === name || file.basename === name) {
          const uid = frontMatter?.UID || file.basename;
          return { uid, file };
        }
      }
    }
    
    return null;
  }

  /**
   * Get contact UID from file
   */
  private async getContactUid(file: TFile): Promise<string | null> {
    const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!this.isContactFile(frontMatter)) {
      return null;
    }
    return frontMatter?.UID || file.basename;
  }

  /**
   * Update contact gender
   */
  private async updateContactGender(uid: string, gender: 'M' | 'F'): Promise<void> {
    const contacts = this.app.vault.getMarkdownFiles();
    
    for (const file of contacts) {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (this.isContactFile(frontMatter) && (frontMatter?.UID === uid || file.basename === uid)) {
        if (!frontMatter?.GENDER || frontMatter.GENDER !== gender) {
          await updateFrontMatterValue(file, 'GENDER', gender, this.app);
          await this.updateRevTimestamp(file);
          this.graph.addOrUpdateContactNode(uid, frontMatter?.FN || file.basename, gender, true);
        }
        break;
      }
    }
  }

  /**
   * Update REV timestamp
   */
  private async updateRevTimestamp(file: TFile): Promise<void> {
    await updateFrontMatterValue(file, 'REV', new Date().toISOString(), this.app);
  }

  /**
   * Propagate relationship changes to related contacts
   */
  private async propagateToRelatedContacts(relationships: RelationshipTriple[]): Promise<void> {
    for (const rel of relationships) {
      // Find the related contact file and sync its front matter
      const contacts = this.app.vault.getMarkdownFiles();
      for (const file of contacts) {
        const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (this.isContactFile(frontMatter)) {
          const uid = frontMatter?.UID || file.basename;
          if (uid === rel.object) {
            await this.syncFromFrontMatterToMarkdown(file);
            break;
          }
        }
      }
    }
  }

  /**
   * Ensure graph consistency by adding missing reciprocal relationships
   */
  async ensureConsistency(): Promise<void> {
    const missing = this.graph.findMissingReciprocalRelationships();
    
    for (const rel of missing) {
      // Add the missing relationship to the graph
      this.graph.addRelationship(rel.subject, rel.object, rel.relationshipKind);
      
      // Update the front matter of the affected contact
      await this.syncContactFrontMatterFromGraph(rel.subject);
    }
  }

  /**
   * Sync a contact's front matter from the graph
   */
  private async syncContactFrontMatterFromGraph(uid: string): Promise<void> {
    const relationships = this.graph.getContactRelationships(uid);
    const contacts = this.app.vault.getMarkdownFiles();
    
    for (const file of contacts) {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (this.isContactFile(frontMatter)) {
        const contactUid = frontMatter?.UID || file.basename;
        if (contactUid === uid) {
          await this.updateContactFrontMatter(file, uid, relationships);
          break;
        }
      }
    }
  }

  /**
   * Get graph statistics
   */
  getGraphStats(): { nodes: number; edges: number } {
    return this.graph.getStats();
  }

  /**
   * Clear all relationship data
   */
  clear(): void {
    this.graph.clear();
    this.syncInProgress.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Check if a file is currently being updated by the relationship system
   */
  static isFileBeingUpdated(filePath: string): boolean {
    return RelationshipSync.globalUpdatingFiles.has(filePath);
  }

  /**
   * Mark a file as being updated (for external coordination)
   */
  static markFileAsUpdating(filePath: string): void {
    RelationshipSync.globalUpdatingFiles.add(filePath);
  }

  /**
   * Unmark a file as being updated (for external coordination)
   */
  static unmarkFileAsUpdating(filePath: string): void {
    RelationshipSync.globalUpdatingFiles.delete(filePath);
  }
}