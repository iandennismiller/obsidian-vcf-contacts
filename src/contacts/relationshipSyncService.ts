/**
 * @fileoverview Service that syncs relationship data between frontmatter and markdown content.
 * 
 * This service handles:
 * - Updating relationship markdown when frontmatter changes
 * - Parsing relationship changes from markdown and updating frontmatter
 * - Maintaining consistency between the relationships section and RELATED fields
 * - Prevention of recursive sync loops through graph-based synchronization
 */

import { App, TFile } from 'obsidian';
import { RelationshipManager } from './relationshipManager';
import { RelationshipGraphSync } from './relationshipGraphSync';
import { parseRelationshipMarkdown } from './relationships';
import { 
  syncYAMLToMarkdown, 
  syncMarkdownToYAML,
  extractRelationshipsFromMarkdown,
  replaceRelationshipsInMarkdown
} from './yamlMarkdownMapper';

export class RelationshipSyncService {
  private app: App;
  private relationshipManager: RelationshipManager;
  private graphSync: RelationshipGraphSync;

  constructor(app: App) {
    this.app = app;
    this.relationshipManager = new RelationshipManager(app);
    this.graphSync = new RelationshipGraphSync(app);
  }

  /**
   * Updates the relationships section in a contact note based on frontmatter.
   * Uses graph sync to prevent recursive updates.
   */
  async updateRelationshipsSection(contactFile: TFile): Promise<void> {
    await this.graphSync.syncFromFileOpen(contactFile);
  }

  /**
   * Syncs relationship changes from the markdown content back to frontmatter.
   * @param contactFile The contact file to sync
   * @param reRenderAfterSync Whether to re-render the relationships section after sync (default: false for user edits)
   */
  async syncRelationshipsFromContent(contactFile: TFile, reRenderAfterSync: boolean = false): Promise<void> {
    if (reRenderAfterSync) {
      // Manual refresh - full graph sync
      await this.graphSync.syncManualRefresh(contactFile);
    } else {
      // User edit - controlled propagation
      await this.graphSync.syncFromUserEdit(contactFile);
    }
  }

  /**
   * Handles file modification events to detect relationship changes.
   * Uses graph sync to prevent cascading updates.
   */
  async handleFileModification(contactFile: TFile): Promise<void> {
    // First, try to upgrade any name-based relationships that might now have available UIDs
    await this.relationshipManager.upgradeNameBasedRelationships(contactFile);
    
    // Check if the file has relationship changes in the markdown
    const content = await this.app.vault.read(contactFile);
    const markdownRelationships = extractRelationshipsFromMarkdown(content);
    
    if (markdownRelationships.length > 0) {
      // Parse the relationships from current frontmatter
      const currentRelationships = await this.relationshipManager.getContactRelationships(contactFile);
      
      const hasChanges = this.hasRelationshipChanges(currentRelationships, markdownRelationships);
      
      if (hasChanges) {
        // When user is editing, use controlled graph sync to prevent loops
        await this.graphSync.syncFromUserEdit(contactFile);
      }
    } else {
      // Even if there's no relationships section, we should still try to upgrade
      // and update the section with any existing relationships
      await this.graphSync.syncFromFileOpen(contactFile);
    }
  }

  /**
   * Emergency function to clear all sync locks.
   * Useful if the system gets into a deadlocked state.
   */
  clearSyncLocks(): void {
    this.graphSync.clearAllLocks();
  }

  /**
   * Validates relationship graph consistency.
   * Useful for debugging and testing.
   */
  async validateGraphConsistency(): Promise<boolean> {
    return await this.graphSync.validateGraphConsistency();
  }

  private hasRelationshipChanges(
    currentRelationships: Array<{contactName: string; relationshipType: string}>,
    markdownRelationships: Array<{contactName: string; relationshipType: string}>
  ): boolean {
    if (currentRelationships.length !== markdownRelationships.length) {
      return true;
    }

    return !currentRelationships.every(current =>
      markdownRelationships.some(markdown =>
        markdown.contactName === current.contactName &&
        markdown.relationshipType === current.relationshipType
      )
    );
  }
}