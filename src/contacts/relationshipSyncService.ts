/**
 * @fileoverview Service that syncs relationship data between frontmatter and markdown content.
 * 
 * This service handles:
 * - Updating relationship markdown when frontmatter changes
 * - Parsing relationship changes from markdown and updating frontmatter
 * - Maintaining consistency between the relationships section and RELATED fields
 */

import { App, TFile } from 'obsidian';
import { RelationshipManager } from './relationshipManager';
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

  constructor(app: App) {
    this.app = app;
    this.relationshipManager = new RelationshipManager(app);
  }

  /**
   * Updates the relationships section in a contact note based on frontmatter.
   */
  async updateRelationshipsSection(contactFile: TFile): Promise<void> {
    await syncYAMLToMarkdown(contactFile, this.app, async (uid: string) => {
      return await this.relationshipManager.getContactNameByUID(uid);
    });
  }

  /**
   * Syncs relationship changes from the markdown content back to frontmatter.
   * @param contactFile The contact file to sync
   * @param reRenderAfterSync Whether to re-render the relationships section after sync (default: false for user edits)
   */
  async syncRelationshipsFromContent(contactFile: TFile, reRenderAfterSync: boolean = false): Promise<void> {
    await syncMarkdownToYAML(contactFile, this.app, async (contactName: string) => {
      return await this.relationshipManager.getContactUIDByName(contactName);
    });
    
    // Only re-render if explicitly requested (e.g., during manual refresh commands)
    if (reRenderAfterSync) {
      await this.updateRelationshipsSection(contactFile);
    }
  }

  /**
   * Handles file modification events to detect relationship changes.
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
        // When user is editing, don't re-render immediately - respect their markdown changes
        await this.syncRelationshipsFromContent(contactFile, false);
      }
    } else {
      // Even if there's no relationships section, we should still try to upgrade
      // and update the section with any existing relationships
      await this.updateRelationshipsSection(contactFile);
    }
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