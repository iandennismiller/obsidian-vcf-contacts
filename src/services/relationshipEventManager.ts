import { App, TFile, WorkspaceLeaf, EventRef, MarkdownView } from 'obsidian';
import { loggingService } from './loggingService';
import { relationshipGraphService } from './relationshipGraph';
import { 
  parseRelatedFromFrontMatter, 
  updateContactRelatedFrontMatter,
  loadContactIntoGraph,
  getContactUidFromFrontMatter,
  getContactFullNameFromFrontMatter
} from 'src/util/relationshipFrontMatter';
import { 
  findRelatedHeading, 
  parseRelationshipList, 
  relationshipListToFrontMatter,
  frontMatterToRelationshipList,
  updateRelatedSection,
  cleanupRelatedHeading
} from 'src/util/relationshipMarkdown';
import { revDebouncer } from 'src/util/revDebouncer';

/**
 * Manages relationship synchronization between markdown lists and front matter
 * Handles Obsidian events for file open/close to keep relationships in sync
 */
export class RelationshipEventManager {
  private app: App;
  private eventRefs: EventRef[] = [];
  private isEnabled: boolean = true;
  private processingFiles: Set<string> = new Set();
  private currentContactFile: TFile | null = null;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Start listening to Obsidian events
   */
  start(): void {
    this.eventRefs.push(
      // Handle file open - sync front matter to Related list
      this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
    );

    this.eventRefs.push(
      // Handle active leaf change - sync Related list to front matter for previous file
      this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange.bind(this))
    );

    this.eventRefs.push(
      // Handle file close - sync Related list to front matter
      this.app.workspace.on('file-open', this.handleFileClose.bind(this))
    );

    this.eventRefs.push(
      // Handle file deletion - remove from graph
      this.app.vault.on('delete', this.handleFileDelete.bind(this))
    );

    loggingService.info('Relationship event manager started');
  }

  /**
   * Stop listening to events
   */
  stop(): void {
    // Cancel all pending REV updates when stopping
    revDebouncer.cancelAllUpdates();
    
    this.eventRefs.forEach(ref => this.app.workspace.offref(ref));
    this.eventRefs = [];
    this.currentContactFile = null;
    loggingService.info('Relationship event manager stopped');
  }

  /**
   * Enable/disable event processing
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    loggingService.info(`Relationship event manager ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Handle file open event - sync front matter to Related list
   */
  private async handleFileOpen(file: TFile | null): Promise<void> {
    if (!this.isEnabled || !file || !this.isContactFile(file)) {
      return;
    }

    // Sync previous contact file if switching between contacts
    if (this.currentContactFile && this.currentContactFile !== file) {
      await this.syncRelatedListToFrontMatter(this.currentContactFile);
    }

    // Update current contact file
    this.currentContactFile = file;

    const fileId = file.path;
    if (this.processingFiles.has(fileId)) {
      return;
    }

    try {
      this.processingFiles.add(fileId);
      
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontMatter) {
        return;
      }

      // Load contact into graph
      const contactId = loadContactIntoGraph(file, frontMatter);

      // Parse relationships from front matter
      const relationships = parseRelatedFromFrontMatter(frontMatter);
      
      // Convert to list entries for display
      const listEntries = frontMatterToRelationshipList(relationships);

      // Read current content and check Related section
      const content = await this.app.vault.read(file);
      const relatedInfo = findRelatedHeading(content);

      if (relatedInfo.found) {
        // Update existing Related section to match front matter
        await updateRelatedSection(file, listEntries);
      } else if (listEntries.length > 0) {
        // Add Related section if there are relationships but no section
        await updateRelatedSection(file, listEntries);
      }

      // Clean up heading formatting
      const updatedContent = await this.app.vault.read(file);
      const cleanedContent = cleanupRelatedHeading(updatedContent);
      if (cleanedContent !== updatedContent) {
        await this.app.vault.modify(file, cleanedContent);
      }

      loggingService.info(`Synced front matter to Related list for ${file.name}`);
    } catch (error) {
      loggingService.error(`Error handling file open for ${file.name}: ${error}`);
    } finally {
      this.processingFiles.delete(fileId);
    }
  }

  /**
   * Handle file close event - sync Related list to front matter when leaving contact
   */
  private async handleFileClose(file: TFile | null): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // If we're leaving a contact file, sync it
    if (this.currentContactFile && this.currentContactFile !== file) {
      await this.syncRelatedListToFrontMatter(this.currentContactFile);
      this.currentContactFile = null;
    }
  }

  /**
   * Handle active leaf change - sync Related list to front matter for previous file
   */
  private async handleActiveLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Get the currently active file
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeFile = activeView?.file;

    // If we're switching away from a contact file, sync it
    if (this.currentContactFile && this.currentContactFile !== activeFile) {
      await this.syncRelatedListToFrontMatter(this.currentContactFile);
    }

    // Update current contact file
    if (activeFile && this.isContactFile(activeFile)) {
      this.currentContactFile = activeFile;
    } else {
      this.currentContactFile = null;
    }
  }

  /**
   * Handle file deletion - remove from graph
   */
  private handleFileDelete(file: TFile): void {
    if (!this.isEnabled || !this.isContactFile(file)) {
      return;
    }

    try {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontMatter) {
        const uid = getContactUidFromFrontMatter(frontMatter);
        const fullName = getContactFullNameFromFrontMatter(frontMatter);
        
        const contactId = relationshipGraphService.generateContactId({ uid, fullName });
        relationshipGraphService.removeContactNode(contactId);
        
        loggingService.info(`Removed contact ${file.name} from relationship graph`);
      }
    } catch (error) {
      loggingService.error(`Error handling file deletion for ${file.name}: ${error}`);
    }
  }

  /**
   * Sync Related list to front matter for a specific file
   */
  private async syncRelatedListToFrontMatter(file: TFile): Promise<void> {
    const fileId = file.path;
    if (this.processingFiles.has(fileId)) {
      return;
    }

    try {
      this.processingFiles.add(fileId);

      const content = await this.app.vault.read(file);
      const relatedInfo = findRelatedHeading(content);

      if (!relatedInfo.found) {
        return; // No Related section to sync
      }

      // Extract Related section content
      const relatedContent = content.substring(relatedInfo.start, relatedInfo.end);
      const listEntries = parseRelationshipList(relatedContent);

      // Convert to front matter entries
      const frontMatterEntries = relationshipListToFrontMatter(listEntries);

      // Update front matter
      await updateContactRelatedFrontMatter(file, frontMatterEntries);

      // Update graph with new relationships
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontMatter) {
        loadContactIntoGraph(file, frontMatter);
      }

      // Propagate changes to related contacts
      await this.propagateRelationshipChanges(file, frontMatterEntries);

      loggingService.info(`Synced Related list to front matter for ${file.name}`);
    } catch (error) {
      loggingService.error(`Error syncing Related list for ${file.name}: ${error}`);
    } finally {
      this.processingFiles.delete(fileId);
    }
  }

  /**
   * Propagate relationship changes to related contacts
   */
  private async propagateRelationshipChanges(
    sourceFile: TFile,
    relationships: Array<{ kind: string; target: string }>
  ): Promise<void> {
    const affectedContacts = new Set<string>();

    // Find all contacts that need to be updated
    relationships.forEach(rel => {
      const targetRef = relationshipGraphService.parseContactReference(rel.target);
      if (targetRef) {
        const targetId = relationshipGraphService.buildContactIdFromReference(targetRef.namespace, targetRef.value);
        affectedContacts.add(targetId);
      }
    });

    // Update each affected contact's Related section
    for (const contactId of affectedContacts) {
      const contactNode = relationshipGraphService.getContactNode(contactId);
      if (contactNode?.file && contactNode.file !== sourceFile) {
        try {
          // Get current relationships for this contact
          const contactRelationships = relationshipGraphService.getContactRelationships(contactId);
          const listEntries = frontMatterToRelationshipList(
            contactRelationships.map(rel => ({
              kind: rel.kind,
              target: rel.targetContactId,
              key: ''
            }))
          );

          // Update Related section
          await updateRelatedSection(contactNode.file, listEntries);
        } catch (error) {
          loggingService.error(`Error propagating changes to ${contactNode.file.name}: ${error}`);
        }
      }
    }
  }

  /**
   * Check if a file is a contact file (has contact front matter)
   */
  private isContactFile(file: TFile): boolean {
    if (file.extension !== 'md') {
      return false;
    }

    const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return !!(frontMatter && (
      (frontMatter['N.GN'] && frontMatter['N.FN']) || 
      frontMatter['FN']
    ));
  }

  /**
   * Manually trigger sync for all contact files
   */
  async syncAllContacts(): Promise<void> {
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => this.isContactFile(file));
    
    loggingService.info(`Syncing ${contactFiles.length} contact files`);
    
    for (const file of contactFiles) {
      try {
        const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontMatter) {
          loadContactIntoGraph(file, frontMatter);
        }
      } catch (error) {
        loggingService.error(`Error syncing contact ${file.name}: ${error}`);
      }
    }

    loggingService.info('Completed contact sync');
  }

  /**
   * Get current processing status
   */
  getStatus(): { enabled: boolean; processingCount: number } {
    return {
      enabled: this.isEnabled,
      processingCount: this.processingFiles.size
    };
  }
}