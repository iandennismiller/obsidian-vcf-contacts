/**
 * @fileoverview Event handling for relationship synchronization
 */

import type { App, EventRef, WorkspaceLeaf, View } from 'obsidian';
import { TFile, MarkdownView } from 'obsidian';
import { RelationshipSync } from './relationshipSync';
import { extractRelatedSection, needsRelatedSection } from './markdownRelated';
import { getApp } from 'src/context/sharedAppContext';
import { loggingService } from 'src/services/loggingService';

export class RelationshipEventHandler {
  private app: App;
  private relationshipSync: RelationshipSync;
  private eventRefs: EventRef[] = [];
  private activeFile: TFile | null = null;
  private lastRelatedContent = new Map<string, string>();  // Track changes
  private isEnabled = true;

  constructor(app?: App) {
    this.app = app || getApp();
    this.relationshipSync = new RelationshipSync(this.app);
  }

  /**
   * Initialize the relationship system
   */
  async initialize(): Promise<void> {
    loggingService.info('Initializing relationship management system...');
    
    try {
      await this.relationshipSync.initializeFromVault();
      this.registerEventHandlers();
      
      const stats = this.relationshipSync.getGraphStats();
      loggingService.info(`Relationship graph initialized: ${stats.nodes} contacts, ${stats.edges} relationships`);
    } catch (error) {
      loggingService.error('Failed to initialize relationship system: ' + error);
    }
  }

  /**
   * Register event handlers
   */
  private registerEventHandlers(): void {
    // Handle file open events - sync FROM front matter TO markdown
    this.eventRefs.push(
      this.app.workspace.on('file-open', (file) => {
        if (file && this.isContactFile(file)) {
          this.handleFileOpen(file);
        }
      })
    );

    // Handle active leaf changes - useful for tracking focus changes
    this.eventRefs.push(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        const view = leaf?.view;
        if (view instanceof MarkdownView && view.file) {
          const file = view.file;
          if (this.isContactFile(file)) {
            this.handleFileGainFocus(file);
          } else if (this.activeFile) {
            // Lost focus from a contact file
            this.handleFileLoseFocus(this.activeFile);
          }
        } else if (this.activeFile) {
          // Lost focus from a contact file
          this.handleFileLoseFocus(this.activeFile);
        }
      })
    );

    // Handle file modifications - watch for Related section changes
    this.eventRefs.push(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && this.isContactFile(file) && file === this.activeFile) {
          this.handleFileModification(file);
        }
      })
    );

    // Handle file creation
    this.eventRefs.push(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && this.isContactFile(file)) {
          this.handleFileCreate(file);
        }
      })
    );

    // Handle file deletion
    this.eventRefs.push(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && this.isContactFile(file)) {
          this.handleFileDelete(file);
        }
      })
    );

    // Handle file rename
    this.eventRefs.push(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && this.isContactFile(file)) {
          this.handleFileRename(file, oldPath);
        }
      })
    );
  }

  /**
   * Handle file open - sync from front matter to markdown
   */
  private async handleFileOpen(file: TFile): Promise<void> {
    try {
      await this.relationshipSync.syncFromFrontMatterToMarkdown(file);
      this.updateLastRelatedContent(file);
    } catch (error) {
      loggingService.error(`Failed to sync relationships on file open: ${file.path} - ${error}`);
    }
  }

  /**
   * Handle file gaining focus
   */
  private handleFileGainFocus(file: TFile): void {
    this.activeFile = file;
    this.updateLastRelatedContent(file);
  }

  /**
   * Handle file losing focus - sync from markdown to front matter
   */
  private async handleFileLoseFocus(file: TFile): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Check if the Related section changed
      const content = await this.app.vault.read(file);
      const { relatedLines } = extractRelatedSection(content);
      const currentRelatedContent = relatedLines.join('\n');
      const lastContent = this.lastRelatedContent.get(file.path) || '';

      if (currentRelatedContent !== lastContent) {
        loggingService.info(`Related section changed in ${file.basename}, syncing to front matter...`);
        await this.relationshipSync.syncFromMarkdownToFrontMatter(file, {
          preventCascade: false,
          debounceMs: 500
        });
        this.lastRelatedContent.set(file.path, currentRelatedContent);
      }
    } catch (error) {
      loggingService.error(`Failed to sync relationships on file focus loss: ${file.path} - ${error}`);
    }

    this.activeFile = null;
  }

  /**
   * Handle file modification - watch for Related section changes
   */
  private async handleFileModification(file: TFile): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const content = await this.app.vault.read(file);
      const { relatedLines } = extractRelatedSection(content);
      const currentRelatedContent = relatedLines.join('\n');
      const lastContent = this.lastRelatedContent.get(file.path) || '';

      if (currentRelatedContent !== lastContent) {
        // Debounced sync from markdown to front matter
        await this.relationshipSync.syncFromMarkdownToFrontMatter(file, {
          preventCascade: true,  // Prevent cascades during active editing
          debounceMs: 2000  // Longer debounce for live editing
        });
        this.lastRelatedContent.set(file.path, currentRelatedContent);
      }

      // Check if we need to add a Related section
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const hasRelationships = frontMatter && Object.keys(frontMatter).some(key => key.startsWith('RELATED'));
      
      if (needsRelatedSection(content, !!hasRelationships)) {
        await this.addRelatedSection(file);
      }

    } catch (error) {
      loggingService.error(`Failed to handle file modification: ${file.path} - ${error}`);
    }
  }

  /**
   * Handle file creation
   */
  private async handleFileCreate(file: TFile): Promise<void> {
    try {
      // Wait a bit for metadata to be available
      setTimeout(async () => {
        const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (this.isContactFile(file, frontMatter)) {
          await this.relationshipSync.syncFromFrontMatterToMarkdown(file);
          this.updateLastRelatedContent(file);
        }
      }, 1000);
    } catch (error) {
      loggingService.error(`Failed to handle file creation: ${file.path} - ${error}`);
    }
  }

  /**
   * Handle file deletion
   */
  private handleFileDelete(file: TFile): void {
    this.lastRelatedContent.delete(file.path);
    if (this.activeFile === file) {
      this.activeFile = null;
    }
  }

  /**
   * Handle file rename
   */
  private handleFileRename(file: TFile, oldPath: string): void {
    const oldContent = this.lastRelatedContent.get(oldPath);
    if (oldContent) {
      this.lastRelatedContent.delete(oldPath);
      this.lastRelatedContent.set(file.path, oldContent);
    }
  }

  /**
   * Add a Related section to a contact file
   */
  private async addRelatedSection(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const { hasRelatedHeading } = extractRelatedSection(content);
      
      if (!hasRelatedHeading) {
        const newContent = content.trim() + '\n\n## Related\n';
        await this.app.vault.modify(file, newContent);
        loggingService.info(`Added Related section to ${file.basename}`);
      }
    } catch (error) {
      loggingService.error(`Failed to add Related section to ${file.path} - ${error}`);
    }
  }

  /**
   * Update the last known Related content for a file
   */
  private async updateLastRelatedContent(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const { relatedLines } = extractRelatedSection(content);
      this.lastRelatedContent.set(file.path, relatedLines.join('\n'));
    } catch (error) {
      loggingService.error(`Failed to update last related content for ${file.path} - ${error}`);
    }
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile, frontMatter?: any): boolean {
    if (!file.path.endsWith('.md')) return false;
    
    const fm = frontMatter || this.app.metadataCache.getFileCache(file)?.frontmatter;
    return fm && (
      (fm['N.GN'] && fm['N.FN']) || 
      fm['FN'] ||
      fm['UID']
    );
  }

  /**
   * Enable or disable the event handler
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    loggingService.info(`Relationship event handler ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Force consistency check across all contacts
   */
  async forceConsistencyCheck(): Promise<void> {
    loggingService.info('Running relationship consistency check...');
    try {
      await this.relationshipSync.ensureConsistency();
      const stats = this.relationshipSync.getGraphStats();
      loggingService.info(`Consistency check complete: ${stats.nodes} contacts, ${stats.edges} relationships`);
    } catch (error) {
      loggingService.error('Failed to run consistency check: ' + error);
    }
  }

  /**
   * Get relationship statistics
   */
  getStats(): { nodes: number; edges: number } {
    return this.relationshipSync.getGraphStats();
  }

  /**
   * Cleanup and remove event handlers
   */
  cleanup(): void {
    loggingService.info('Cleaning up relationship event handler...');
    
    this.eventRefs.forEach(ref => {
      this.app.workspace.offref(ref);
    });
    this.eventRefs = [];
    
    this.relationshipSync.clear();
    this.lastRelatedContent.clear();
    this.activeFile = null;
  }
}