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
    const content = await this.app.vault.read(contactFile);
    const relationshipsMarkdown = await this.relationshipManager.renderRelationshipsMarkdown(contactFile);
    
    const updatedContent = this.replaceRelationshipsSection(content, relationshipsMarkdown);
    
    if (updatedContent !== content) {
      await this.app.vault.modify(contactFile, updatedContent);
    }
  }

  /**
   * Syncs relationship changes from the markdown content back to frontmatter.
   * @param contactFile The contact file to sync
   * @param reRenderAfterSync Whether to re-render the relationships section after sync (default: false for user edits)
   */
  async syncRelationshipsFromContent(contactFile: TFile, reRenderAfterSync: boolean = false): Promise<void> {
    const content = await this.app.vault.read(contactFile);
    const relationshipsSection = this.extractRelationshipsSection(content);
    
    if (relationshipsSection) {
      await this.relationshipManager.syncRelationshipsFromMarkdown(contactFile, relationshipsSection);
      
      // Only re-render if explicitly requested (e.g., during manual refresh commands)
      if (reRenderAfterSync) {
        await this.updateRelationshipsSection(contactFile);
      }
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
    const relationshipsSection = this.extractRelationshipsSection(content);
    
    if (relationshipsSection) {
      // Parse the relationships from markdown
      const lines = relationshipsSection.split('\n').filter(line => line.trim().startsWith('-'));
      const currentRelationships = await this.relationshipManager.getContactRelationships(contactFile);
      
      // Parse relationships from markdown
      const markdownRelationships = lines
        .map(line => parseRelationshipMarkdown(line))
        .filter(rel => rel !== null) as Array<{ contactName: string; relationshipType: string }>;
      
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

  /**
   * Private helper methods
   */

  private replaceRelationshipsSection(content: string, newRelationshipsMarkdown: string): string {
    // Find the relationships section using case-insensitive regex
    const relationshipsSectionRegex = /^## [Rr]elationships?\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m;
    
    if (relationshipsSectionRegex.test(content)) {
      // Replace existing relationships section, ensuring we preserve the standardized header
      return content.replace(relationshipsSectionRegex, newRelationshipsMarkdown.trim());
    } else {
      // Find where to insert the relationships section
      // Look for the Notes section or other common sections
      const notesSectionRegex = /^#### Notes\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m;
      const match = content.match(notesSectionRegex);
      
      if (match) {
        // Insert after the Notes section
        const notesEnd = match.index! + match[0].length;
        return content.slice(0, notesEnd) + '\n\n' + newRelationshipsMarkdown + content.slice(notesEnd);
      } else {
        // Insert before the final hashtags if no Notes section
        const hashtagMatch = content.match(/\n(#\w+[\s#\w]*)\s*$/);
        if (hashtagMatch) {
          const hashtagStart = hashtagMatch.index!;
          return content.slice(0, hashtagStart) + '\n\n' + newRelationshipsMarkdown + content.slice(hashtagStart);
        } else {
          // Append at the end
          return content + '\n\n' + newRelationshipsMarkdown;
        }
      }
    }
  }

  private extractRelationshipsSection(content: string): string | null {
    // Use case-insensitive regex to match relationships header
    const relationshipsSectionRegex = /^## [Rr]elationships?\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m;
    const match = content.match(relationshipsSectionRegex);
    return match ? match[1].trim() : null;
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