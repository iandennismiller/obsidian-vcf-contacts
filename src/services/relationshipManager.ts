import { App, TFile, Editor, MarkdownView, debounce } from "obsidian";
import { getApp } from "src/context/sharedAppContext";
import { RelationshipGraph } from "./relationshipGraph";
import { RelationshipSync } from "./relationshipSync";
import { updateFrontMatterValue } from "src/contacts/contactFrontmatter";
import { loggingService } from "./loggingService";
import { FileUpdateCoordinator } from "./fileUpdateCoordinator";

export interface RelationshipListItem {
  kind: string;
  contactName: string;
  valid: boolean;
}

/**
 * Manages relationship events and markdown list synchronization.
 */
export class RelationshipManager {
  private app: App;
  private graph: RelationshipGraph;
  private relationshipSync: RelationshipSync;
  private fileCoordinator: FileUpdateCoordinator;
  private isUpdatingNote = new Set<string>(); // Track files being updated to prevent loops
  private debouncedSyncFromList: Map<string, () => void> = new Map();

  constructor(app?: App) {
    this.app = app || getApp();
    this.graph = new RelationshipGraph();
    this.relationshipSync = new RelationshipSync(this.graph);
    this.fileCoordinator = FileUpdateCoordinator.getInstance();
  }

  /**
   * Initialize the relationship manager with event listeners
   */
  initialize(): void {
    // Hook file open events to render relationships
    this.app.workspace.on('file-open', this.onFileOpen.bind(this));
    
    // Hook editor change events for live sync (debounced)
    this.app.workspace.on('editor-change', this.onEditorChange.bind(this));
    
    // Hook when files lose focus to sync relationships
    this.app.workspace.on('active-leaf-change', this.onActiveLeafChange.bind(this));
  }

  /**
   * Load all relationships from contact files into the graph
   */
  async loadAllRelationships(contactFiles: TFile[]): Promise<void> {
    loggingService.info("Loading relationships from contact files into graph...");
    this.graph.clear();
    
    for (const file of contactFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontMatter = cache?.frontmatter;
      
      if (frontMatter && frontMatter.UID) {
        const uid = frontMatter.UID;
        const name = frontMatter.FN || file.basename;
        const gender = frontMatter.GENDER;
        
        // Add contact to graph
        this.graph.addContact(uid, name, gender);
        
        // Load relationships from front matter
        this.relationshipSync.loadRelationshipsFromFrontMatter(uid, name, frontMatter);
      }
    }
    
    loggingService.info(`Loaded relationships for ${contactFiles.length} contacts`);
  }

  /**
   * Check and repair graph consistency
   */
  async checkAndRepairConsistency(contactFiles: TFile[]): Promise<void> {
    const missingRelationships = this.graph.checkConsistency();
    
    if (missingRelationships.length > 0) {
      loggingService.info(`Found ${missingRelationships.length} missing reciprocal relationships, repairing...`);
      
      // Add missing reciprocal relationships
      for (const missing of missingRelationships) {
        this.graph.addRelationship(
          missing.fromUid,
          missing.fromName,
          missing.toUid,
          missing.toName,
          missing.missingRelationshipKind
        );
      }
      
      // Sync updated graph back to front matter
      await this.relationshipSync.syncGraphToFrontMatter(contactFiles, this.app);
      loggingService.info("Graph consistency repair completed");
    }
  }

  /**
   * Handle file open event - render relationships as markdown list
   */
  private async onFileOpen(file: TFile | null): Promise<void> {
    if (!file || this.isUpdatingNote.has(file.path)) {
      return;
    }
    
    const cache = this.app.metadataCache.getFileCache(file);
    const frontMatter = cache?.frontmatter;
    
    if (frontMatter && frontMatter.UID) {
      await this.renderRelationshipsList(file);
    }
  }

  /**
   * Handle editor change events - sync relationship list changes
   */
  private onEditorChange(editor: Editor, view: MarkdownView): void {
    const file = view.file;
    if (!file || this.isUpdatingNote.has(file.path)) {
      return;
    }
    
    // Debounce the sync to avoid excessive processing
    const fileKey = file.path;
    if (!this.debouncedSyncFromList.has(fileKey)) {
      this.debouncedSyncFromList.set(fileKey, debounce(() => {
        this.syncRelationshipsFromList(file);
      }, 1000)); // 1 second debounce
    }
    
    const debouncedSync = this.debouncedSyncFromList.get(fileKey);
    if (debouncedSync) {
      debouncedSync();
    }
  }

  /**
   * Handle active leaf change - ensure sync when switching files
   */
  private async onActiveLeafChange(): Promise<void> {
    // This provides a final sync opportunity when user switches away from a file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      await this.syncRelationshipsFromList(activeFile);
    }
  }

  /**
   * Render relationships from front matter as markdown list under ## Related heading
   */
  private async renderRelationshipsList(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontMatter = cache?.frontmatter;
    
    if (!frontMatter || !frontMatter.UID) {
      return;
    }
    
    const uid = frontMatter.UID;
    const name = frontMatter.FN || file.basename;
    const relationships = this.graph.getContactRelationships(uid, name);
    
    if (relationships.length === 0) {
      return; // No relationships to render
    }
    
    this.isUpdatingNote.add(file.path);
    
    try {
      const content = await this.app.vault.read(file);
      const updatedContent = this.updateRelatedSection(content, relationships);
      
      if (content !== updatedContent) {
        await this.app.vault.modify(file, updatedContent);
      }
    } finally {
      this.isUpdatingNote.delete(file.path);
    }
  }

  /**
   * Sync relationships from markdown list to front matter and graph
   */
  private async syncRelationshipsFromList(file: TFile): Promise<void> {
    // Skip if already being updated by our own tracking
    if (this.isUpdatingNote.has(file.path)) {
      return;
    }

    // Skip if file is being updated by another service (VCFolderWatcher)
    if (this.fileCoordinator.isFileBeingUpdated(file.path)) {
      loggingService.debug(`Skipping relationship sync for ${file.path} - file is being updated by another service`);
      return;
    }
    
    const cache = this.app.metadataCache.getFileCache(file);
    const frontMatter = cache?.frontmatter;
    
    if (!frontMatter || !frontMatter.UID) {
      return;
    }
    
    const uid = frontMatter.UID;
    const name = frontMatter.FN || file.basename;
    
    await this.fileCoordinator.withExclusiveAccess(file.path, async () => {
      try {
        const content = await this.app.vault.read(file);
        const relationships = this.parseRelationshipsList(content);
        
        // Clear existing relationships for this contact in the graph
        const existingRelationships = this.graph.getContactRelationships(uid, name);
        existingRelationships.forEach(rel => {
          this.graph.removeRelationship(uid, name, rel.targetUid, rel.targetName, rel.relationshipKind);
        });
        
        // Add new relationships from the list
        let hasChanges = false;
        for (const rel of relationships) {
          if (rel.valid) {
            // Find the contact by name to get their UID
            const targetContact = await this.findContactByName(rel.contactName);
            if (targetContact) {
              this.graph.addRelationship(uid, name, targetContact.uid, targetContact.name, rel.kind);
              hasChanges = true;
            }
          }
        }
        
        if (hasChanges) {
          // Update this contact's front matter
          await this.relationshipSync.updateContactRelatedFields(file, uid, name, this.app);
          
          // Update REV field
          const revTimestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          await updateFrontMatterValue(file, 'REV', revTimestamp, this.app);
          
          loggingService.debug(`Updated relationships for ${name}`);
        }
      } catch (error) {
        loggingService.error(`Error syncing relationships for ${file.path}: ${error.message}`);
      }
    });
  }

  /**
   * Update the Related section in markdown content
   */
  private updateRelatedSection(content: string, relationships: Array<{
    targetName: string;
    relationshipKind: string;
  }>): string {
    // Find or create the Related heading
    const relatedRegex = /^(#{1,6})\s*related\s*$/im;
    const match = content.match(relatedRegex);
    
    if (match) {
      // Found existing Related heading
      const headingLevel = match[1];
      const headingIndex = content.indexOf(match[0]);
      
      // Find the end of this section (next heading of same or higher level, or end of file)
      const nextHeadingRegex = new RegExp(`^#{1,${headingLevel.length}}\\s+.+$`, 'im');
      const afterHeading = content.slice(headingIndex + match[0].length);
      const nextHeadingMatch = afterHeading.match(nextHeadingRegex);
      
      const sectionEnd = nextHeadingMatch 
        ? headingIndex + match[0].length + afterHeading.indexOf(nextHeadingMatch[0])
        : content.length;
      
      // Build relationship list
      const relationshipList = relationships
        .map(rel => `- ${rel.relationshipKind} [[${rel.targetName}]]`)
        .join('\n');
      
      // Replace the section
      const beforeSection = content.slice(0, headingIndex);
      const afterSection = content.slice(sectionEnd);
      const newSection = `## Related\n\n${relationshipList}\n\n`;
      
      return beforeSection + newSection + afterSection;
    } else {
      // No Related heading exists, add one at the end
      const relationshipList = relationships
        .map(rel => `- ${rel.relationshipKind} [[${rel.targetName}]]`)
        .join('\n');
      
      return content + `\n## Related\n\n${relationshipList}\n`;
    }
  }

  /**
   * Parse relationship list items from markdown content
   */
  private parseRelationshipsList(content: string): RelationshipListItem[] {
    const relationships: RelationshipListItem[] = [];
    
    // Find the Related heading
    const relatedRegex = /^(#{1,6})\s*related\s*$/im;
    const match = content.match(relatedRegex);
    
    if (!match) {
      return relationships;
    }
    
    const headingLevel = match[1];
    const headingIndex = content.indexOf(match[0]);
    
    // Find the end of this section
    const nextHeadingRegex = new RegExp(`^#{1,${headingLevel.length}}\\s+.+$`, 'im');
    const afterHeading = content.slice(headingIndex + match[0].length);
    const nextHeadingMatch = afterHeading.match(nextHeadingRegex);
    
    const sectionEnd = nextHeadingMatch 
      ? headingIndex + match[0].length + afterHeading.indexOf(nextHeadingMatch[0])
      : content.length;
    
    const sectionContent = content.slice(headingIndex + match[0].length, sectionEnd);
    
    // Parse list items: "- relationship_kind [[Contact Name]]"
    const listItemRegex = /^-\s+(\w+)\s+\[\[([^\]]+)\]\]/gm;
    let listMatch;
    
    while ((listMatch = listItemRegex.exec(sectionContent)) !== null) {
      const kind = listMatch[1].trim();
      const contactName = listMatch[2].trim();
      
      relationships.push({
        kind,
        contactName,
        valid: kind.length > 0 && contactName.length > 0
      });
    }
    
    return relationships;
  }

  /**
   * Find contact by name in the vault
   */
  private async findContactByName(contactName: string): Promise<{ uid: string; name: string } | null> {
    const contactFile = this.app.metadataCache.getFirstLinkpathDest(contactName, '');
    
    if (contactFile) {
      const cache = this.app.metadataCache.getFileCache(contactFile);
      const frontMatter = cache?.frontmatter;
      
      if (frontMatter && frontMatter.UID) {
        return {
          uid: frontMatter.UID,
          name: frontMatter.FN || contactFile.basename
        };
      }
    }
    
    return null;
  }

  /**
   * Clean up event listeners
   */
  cleanup(): void {
    this.app.workspace.off('file-open', this.onFileOpen.bind(this));
    this.app.workspace.off('editor-change', this.onEditorChange.bind(this));
    this.app.workspace.off('active-leaf-change', this.onActiveLeafChange.bind(this));
  }
}