import { App, TFile, EventRef } from 'obsidian';
import { RelationshipManager } from './relationshipManager';
import { RelationshipListManager } from './relationshipListManager';
import { getApp } from '../context/sharedAppContext';
import { loggingService } from './loggingService';

/**
 * Manages Obsidian events for relationship synchronization
 * Handles file open/close, focus changes, and content modifications
 */
export class RelationshipEventManager {
  private app: App;
  private relationshipManager: RelationshipManager;
  private listManager: RelationshipListManager;
  private eventRefs: EventRef[] = [];
  private openFiles: Set<string> = new Set();
  private debounceTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private lastRelatedSectionContent: Map<string, string> = new Map(); // Track last known Related section content
  private readonly DEBOUNCE_DELAY = 1000; // 1 second

  constructor(relationshipManager: RelationshipManager, app?: App) {
    this.app = app || getApp();
    this.relationshipManager = relationshipManager;
    this.listManager = new RelationshipListManager(relationshipManager, app);
  }

  /**
   * Register all event listeners
   */
  registerEvents(): void {
    // File opened - sync front matter to Related list
    const fileOpenRef = this.app.workspace.on('file-open', async (file) => {
      if (file && this.isContactFile(file)) {
        this.openFiles.add(file.path);
        await this.onFileOpen(file);
      }
    });

    // File closed - sync Related list to front matter
    const activeLeafChangeRef = this.app.workspace.on('active-leaf-change', async (leaf) => {
      // Check if we switched away from a contact file
      const previousFiles = Array.from(this.openFiles);
      const currentFile = this.app.workspace.getActiveFile();
      
      for (const filePath of previousFiles) {
        if (!currentFile || currentFile.path !== filePath) {
          this.openFiles.delete(filePath);
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile && this.isContactFile(file)) {
            await this.onFileClose(file);
          }
        }
      }
      
      // Handle new file opening
      if (currentFile && this.isContactFile(currentFile)) {
        this.openFiles.add(currentFile.path);
        await this.onFileOpen(currentFile);
      }
    });

    // File content modified - debounced sync
    const fileModifyRef = this.app.vault.on('modify', async (file) => {
      if (file instanceof TFile && this.isContactFile(file)) {
        this.debounceSync(file, async () => {
          await this.onFileModify(file);
        });
      }
    });

    // File created - check if it's a VCF file dropped in vault
    const fileCreateRef = this.app.vault.on('create', async (file) => {
      if (file instanceof TFile && file.extension === 'vcf') {
        await this.handleVcfFileDrop(file);
      }
    });

    this.eventRefs.push(fileOpenRef, activeLeafChangeRef, fileModifyRef, fileCreateRef);
    loggingService.info('Relationship event handlers registered');
  }

  /**
   * Unregister all event listeners
   */
  unregisterEvents(): void {
    this.eventRefs.forEach(ref => this.app.workspace.offref(ref));
    this.eventRefs = [];
    
    // Clear any pending debounce timeouts
    this.debounceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.debounceTimeouts.clear();
    
    loggingService.info('Relationship event handlers unregistered');
  }

  /**
   * Handle file open - sync front matter to Related list
   */
  private async onFileOpen(file: TFile): Promise<void> {
    try {
      await this.listManager.updateRelatedSection(file);
      
      // Initialize the Related section content cache
      const content = await this.app.vault.read(file);
      if (this.hasRelatedSection(content)) {
        const relatedContent = this.extractRelatedSectionContent(content);
        this.lastRelatedSectionContent.set(file.path, relatedContent);
      }
      
      loggingService.debug(`Updated Related section for ${file.name} on open`);
    } catch (error) {
      loggingService.error(`Error updating Related section on file open: ${error.message}`);
    }
  }

  /**
   * Handle file close - sync Related list to front matter
   */
  private async onFileClose(file: TFile): Promise<void> {
    try {
      await this.listManager.syncListToFrontmatter(file);
      
      // Clear the Related section content cache for closed files
      this.lastRelatedSectionContent.delete(file.path);
      
      loggingService.debug(`Synced Related list to front matter for ${file.name} on close`);
    } catch (error) {
      loggingService.error(`Error syncing Related list on file close: ${error.message}`);
    }
  }

  /**
   * Extract the Related section content from markdown
   */
  private extractRelatedSectionContent(content: string): string {
    const relatedSection = this.listManager.parseRelationshipList(content);
    // Create a normalized string representation for comparison
    return relatedSection
      .map(rel => `${rel.relationshipType}:${rel.contactName}`)
      .sort()
      .join('|');
  }

  /**
   * Handle file modification - check if Related list changed
   */
  private async onFileModify(file: TFile): Promise<void> {
    try {
      // Check if the Related section was modified
      const content = await this.app.vault.read(file);
      if (this.hasRelatedSection(content)) {
        const currentRelatedContent = this.extractRelatedSectionContent(content);
        const lastKnownContent = this.lastRelatedSectionContent.get(file.path) || '';
        
        // Only sync if the Related section content actually changed
        if (currentRelatedContent !== lastKnownContent) {
          this.lastRelatedSectionContent.set(file.path, currentRelatedContent);
          await this.listManager.syncListToFrontmatter(file);
          loggingService.debug(`Synced Related list changes for ${file.name} - content changed`);
        }
      }
    } catch (error) {
      loggingService.error(`Error handling file modification: ${error.message}`);
    }
  }

  /**
   * Handle VCF file dropped into vault
   */
  private async handleVcfFileDrop(file: TFile): Promise<void> {
    try {
      // Read VCF content
      const vcfContent = await this.app.vault.read(file);
      
      // TODO: Move VCF to proper folder and process
      // This would integrate with the existing VCF folder watcher
      loggingService.info(`VCF file detected: ${file.name}. Move to VCF folder for processing.`);
      
      // For now, just log the detection
      // The actual VCF processing should be handled by VCFolderWatcher
      
    } catch (error) {
      loggingService.error(`Error handling VCF file drop: ${error.message}`);
    }
  }

  /**
   * Debounce sync operations to avoid excessive updates
   */
  private debounceSync(file: TFile, syncFunction: () => Promise<void>): void {
    const key = file.path;
    
    // Clear existing timeout
    if (this.debounceTimeouts.has(key)) {
      clearTimeout(this.debounceTimeouts.get(key)!);
    }
    
    // Set new timeout
    const timeout = setTimeout(async () => {
      this.debounceTimeouts.delete(key);
      await syncFunction();
    }, this.DEBOUNCE_DELAY);
    
    this.debounceTimeouts.set(key, timeout);
  }

  /**
   * Check if file has a Related section
   */
  private hasRelatedSection(content: string): boolean {
    const relatedHeaderRegex = /^#{1,6}\s+related\s*$/im;
    return relatedHeaderRegex.test(content);
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    return !!(frontmatter?.UID || frontmatter?.FN || (frontmatter?.['N.GN'] && frontmatter?.['N.FN']));
  }

  /**
   * Initialize relationship system
   */
  async initialize(): Promise<void> {
    try {
      await this.relationshipManager.initializeGraph();
      await this.relationshipManager.ensureGraphConsistency();
      this.registerEvents();
      loggingService.info('Relationship system initialized successfully');
    } catch (error) {
      loggingService.error(`Error initializing relationship system: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.unregisterEvents();
    this.openFiles.clear();
    this.lastRelatedSectionContent.clear();
  }

  /**
   * Force sync all contact files (useful for maintenance)
   */
  async syncAllContacts(): Promise<void> {
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
      this.isContactFile(file)
    );

    loggingService.info(`Starting sync for ${contactFiles.length} contact files`);

    for (const file of contactFiles) {
      try {
        await this.listManager.updateRelatedSection(file);
      } catch (error) {
        loggingService.error(`Error syncing ${file.name}: ${error.message}`);
      }
    }

    loggingService.info('Completed sync for all contact files');
  }
}