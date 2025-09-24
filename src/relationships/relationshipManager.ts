import { TFile, App, MarkdownView } from 'obsidian';
import { RelationshipGraph, RelationshipType, Gender } from './relationshipGraph';
import { parseRelationshipListItem, formatRelationshipListItem, inferGenderFromTerm, normalizeGender } from './genderUtils';
import { RelationshipSet } from './relationshipSet';
import { updateFrontMatterValue } from '../contacts/contactFrontmatter';
import { loggingService } from '../services/loggingService';

/**
 * Manages relationships between contacts, handling sync between markdown lists and front matter
 */
export class RelationshipManager {
  private graph: RelationshipGraph;
  private app: App;
  private syncingFiles = new Set<string>(); // Prevent infinite loops
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private globalLock = false; // Global lock for graph operations
  private consistencyCheckTimer: NodeJS.Timeout | null = null; // Debounced consistency check
  private operationQueue: Promise<void> = Promise.resolve(); // Serial operation queue
  private currentContactFile: TFile | null = null; // Track the currently active contact file

  constructor(app: App) {
    this.app = app;
    this.graph = new RelationshipGraph();
    
    // Try to get the current contact file, but handle cases where workspace is not available (e.g., tests)
    try {
      this.currentContactFile = this.getActiveContactFile();
    } catch (e) {
      this.currentContactFile = null; // Gracefully handle unavailable workspace
    }
    
    this.setupEventListeners();
  }

  /**
   * Initialize the relationship graph with existing contacts and ensure consistency
   */
  async initializeFromVault(): Promise<void> {
    return this.withGlobalLock(async () => {
      loggingService.info('[RelationshipManager] Initializing from vault...');
      
      const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.includes('Contacts/') || file.path.includes('contacts/')
      );

      loggingService.info(`[RelationshipManager] Found ${contactFiles.length} potential contact files`);

      for (const file of contactFiles) {
        await this.loadContactIntoGraph(file);
      }

      // Perform startup consistency check to ensure all notes are consistent
      await this.performStartupConsistencyCheck(contactFiles);

      // Schedule regular consistency check with debouncing  
      this.scheduleConsistencyCheck();
    });
  }

  /**
   * Perform a comprehensive consistency check during plugin startup
   * Ensures all contact files have consistent Related lists and front matter
   */
  private async performStartupConsistencyCheck(contactFiles: TFile[]): Promise<void> {
    loggingService.info('[RelationshipManager] Performing startup consistency check...');
    
    let inconsistentFiles = 0;
    
    for (const file of contactFiles) {
      if (!this.isContactFile(file)) continue;
      
      try {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter?.UID) continue;
        
        const uid = cache.frontmatter.UID;
        const content = await this.app.vault.read(file);
        
        // Parse relationships from Related list in content
        const relatedSection = this.extractRelatedSection(content);
        const relatedListRelationships = relatedSection ? this.parseRelatedSection(relatedSection) : [];
        
        // Parse relationships from front matter  
        const frontMatterRelationships = this.parseRelatedFromFrontmatter(cache.frontmatter);
        
        // Check for inconsistencies
        const relatedListSet = new Set(relatedListRelationships.map(r => `${r.type}:${r.contactName}`));
        const frontMatterSet = new Set(frontMatterRelationships.map(r => `${r.type}:${r.value}`));
        
        // Count items in Related list not in front matter
        const missingInFrontMatter = [...relatedListSet].filter(item => !frontMatterSet.has(item));
        
        if (missingInFrontMatter.length > 0) {
          loggingService.info(`[RelationshipManager] Inconsistency in ${file.path}: ${missingInFrontMatter.length} relationships in Related list missing from front matter`);
          
          // Update graph with Related list relationships
          await this.updateGraphFromRelatedList(uid, relatedListRelationships);
          
          // Merge with existing front matter (never remove, only add)
          await this.updateFrontmatterFromGraph(file, uid);
          
          inconsistentFiles++;
        }
        
      } catch (error) {
        loggingService.error(`[RelationshipManager] Error checking consistency for ${file.path}: ${error.message}`);
      }
    }
    
    loggingService.info(`[RelationshipManager] Startup consistency check complete. Fixed ${inconsistentFiles} inconsistent files.`);
  }

  /**
   * Execute operation with global lock to prevent race conditions
   */
  private async withGlobalLock<T>(operation: () => Promise<T>): Promise<T> {
    // Queue the operation to run serially
    return new Promise<T>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(async () => {
        // Wait for global lock to be released
        while (this.globalLock) {
          await new Promise(r => setTimeout(r, 100));
        }

        this.globalLock = true;
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.globalLock = false;
        }
      }).catch(reject);
    });
  }

  /**
   * Schedule a debounced consistency check
   */
  private scheduleConsistencyCheck(): void {
    if (this.consistencyCheckTimer) {
      clearTimeout(this.consistencyCheckTimer);
    }

    this.consistencyCheckTimer = setTimeout(() => {
      this.consistencyCheckTimer = null;
      this.withGlobalLock(() => this.ensureGraphConsistency());
    }, 2000); // 2 second debounce for consistency checks
  }

  /**
   * Load a contact file into the relationship graph
   */
  private async loadContactIntoGraph(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return;

    const frontmatter = cache.frontmatter;
    const uid = frontmatter.UID;
    const fullName = frontmatter.FN || frontmatter['N.GN'] + ' ' + frontmatter['N.FN'];
    const gender = normalizeGender(frontmatter.GENDER || '');

    if (!uid || !fullName) return;

    // Add contact to graph
    this.graph.addContact(uid, fullName, gender, file);

    // Parse RELATED fields from frontmatter
    const relatedFields = this.parseRelatedFromFrontmatter(frontmatter);
    if (relatedFields.length > 0) {
      this.graph.updateContactFromRelatedFields(uid, relatedFields);
    }
  }

  /**
   * Parse RELATED fields from frontmatter using RelationshipSet
   */
  private parseRelatedFromFrontmatter(frontmatter: Record<string, any>): { type: RelationshipType; value: string }[] {
    const relationshipSet = RelationshipSet.fromFrontMatter(frontmatter);
    return [...relationshipSet.getEntries()]; // Convert readonly to mutable array
  }

  /**
   * Setup event listeners for file events
   */
  private setupEventListeners(): void {
    // Guard against missing workspace (e.g., in tests)
    if (!this.app.workspace?.on) {
      return;
    }

    // Listen for when a file is opened to sync the previous file
    this.app.workspace.on('file-open', (file: TFile | null) => {
      loggingService.info(`[RelationshipManager] file-open event: ${file?.path || 'null'}`);
      this.handleFileOpen(file);
    });

    // Listen for when the active leaf changes as a fallback
    this.app.workspace.on('active-leaf-change', (leaf) => {
      const file = leaf?.view && 'file' in leaf.view ? (leaf.view as any).file : null;
      loggingService.info(`[RelationshipManager] active-leaf-change event: ${file?.path || 'null'}`);
      this.handleActiveLeafChange();
    });

    // Listen for editor changes with heavy debouncing for when users edit content
    this.app.workspace.on('editor-change', (editor, info) => {
      if (info.file && this.isContactFile(info.file)) {
        loggingService.info(`[RelationshipManager] editor-change event: ${info.file.path}`);
        this.handleEditorChange(info.file);
      }
    });

    // Listen for layout changes that might indicate tab closing/reorganization
    this.app.workspace.on('layout-change', () => {
      loggingService.info(`[RelationshipManager] layout-change event`);
      this.handleLayoutChange();
    });

    // Listen for window/app close events to sync current file
    if (typeof window !== 'undefined') {
      // Bind the method so we can remove it later
      this.handleAppClose = this.handleAppClose.bind(this);
      window.addEventListener('beforeunload', this.handleAppClose);
    }
  }

  /**
   * Handle when a file is opened - sync the previous file if needed
   */
  private handleFileOpen(file: TFile | null): void {
    const previousFile = this.currentContactFile;
    
    loggingService.info(`[RelationshipManager] handleFileOpen: previous=${previousFile?.path || 'null'}, new=${file?.path || 'null'}`);
    
    // Update current file tracking
    this.currentContactFile = this.isContactFile(file) ? file : null;
    
    // Sync the previous file if it was a contact file
    if (previousFile && !this.globalLock) {
      loggingService.info(`[RelationshipManager] Syncing previous file: ${previousFile.path}`);
      this.debounceSync(previousFile, () => this.syncRelatedListToFrontmatter(previousFile), 800);
    }
  }

  /**
   * Handle when active leaf changes - sync the previous file if needed (fallback)
   */
  private handleActiveLeafChange(): void {
    const previousFile = this.currentContactFile;
    const newFile = this.getActiveContactFile();
    
    loggingService.info(`[RelationshipManager] handleActiveLeafChange: previous=${previousFile?.path || 'null'}, new=${newFile?.path || 'null'}`);
    
    // Only update if we don't already have the right file tracked
    if (this.currentContactFile !== newFile) {
      this.currentContactFile = newFile;
      
      // Sync the previous file if it was a contact file
      if (previousFile && !this.globalLock) {
        loggingService.info(`[RelationshipManager] Syncing previous file: ${previousFile.path}`);
        this.debounceSync(previousFile, () => this.syncRelatedListToFrontmatter(previousFile), 1000);
      }
    }
  }

  /**
   * Handle when editor content changes - sync current file with heavy debouncing
   */
  private handleEditorChange(file: TFile): void {
    if (this.globalLock) return;
    
    loggingService.info(`[RelationshipManager] handleEditorChange: ${file.path}`);
    
    // Heavy debouncing for editor changes (5 seconds to avoid spam)
    this.debounceSync(file, () => this.syncRelatedListToFrontmatter(file), 5000);
  }

  /**
   * Handle layout changes that might indicate tab closing or reorganization
   */
  private handleLayoutChange(): void {
    const currentFile = this.getActiveContactFile();
    
    // If we had a tracked contact file but now there's a different active file (or none),
    // sync the previous file
    if (this.currentContactFile && this.currentContactFile !== currentFile && !this.globalLock) {
      loggingService.info(`[RelationshipManager] Layout change - syncing previous file: ${this.currentContactFile.path}`);
      this.debounceSync(this.currentContactFile, () => this.syncRelatedListToFrontmatter(this.currentContactFile!), 500);
    }
    
    // Update current file tracking
    this.currentContactFile = currentFile;
  }

  /**
   * Manually trigger sync for the currently active contact file
   * This can be called as a fallback when automatic event listening fails
   */
  public async syncCurrentFile(): Promise<void> {
    const currentFile = this.getActiveContactFile();
    if (currentFile && !this.globalLock) {
      loggingService.info(`[RelationshipManager] Manual sync triggered for: ${currentFile.path}`);
      await this.syncRelatedListToFrontmatter(currentFile);
    }
  }

  /**
   * Manually trigger sync for a specific file
   */
  public async syncFile(file: TFile): Promise<void> {
    if (this.isContactFile(file) && !this.globalLock) {
      loggingService.info(`[RelationshipManager] Manual sync triggered for file: ${file.path}`);
      await this.syncRelatedListToFrontmatter(file);
    }
  }

  /**
   * Handle when a file is closed - sync it if needed
   */
  private handleFileClose(file: TFile): void {
    if (!file || this.globalLock) return;
    
    // Check if it's a contact file that needs syncing
    if (this.isContactFile(file)) {
      this.debounceSync(file, () => this.syncRelatedListToFrontmatter(file), 500);
    }
    
    // Clear current file if it's the one being closed
    if (this.currentContactFile === file) {
      this.currentContactFile = null;
    }
  }

  /**
   * Handle when the app is closing - sync current file if needed
   */
  private handleAppClose(): void {
    if (this.currentContactFile && !this.globalLock) {
      // Synchronous sync for app close to ensure it completes
      this.syncRelatedListToFrontmatter(this.currentContactFile);
    }
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile | null): boolean {
    if (!file) return false;
    
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID || cache?.frontmatter?.FN || cache?.frontmatter?.['N.GN']);
  }

  /**
   * Get the currently active contact file (if any)
   */
  private getActiveContactFile(): TFile | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.file) return null;

    const file = activeView.file;
    return this.isContactFile(file) ? file : null;
  }

  /**
   * Sync the Related list in markdown to frontmatter
   */
  private async syncRelatedListToFrontmatter(file: TFile): Promise<void> {
    loggingService.info(`[RelationshipManager] syncRelatedListToFrontmatter called for: ${file.path}`);
    
    if (this.syncingFiles.has(file.path) || this.globalLock) {
      loggingService.info(`[RelationshipManager] Skipping sync - already syncing or locked: ${file.path}`);
      return;
    }

    await this.withGlobalLock(async () => {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter?.UID) {
        loggingService.info(`[RelationshipManager] No UID in frontmatter: ${file.path}`);
        return;
      }

      const uid = cache.frontmatter.UID;
      const content = await this.app.vault.read(file);
      
      loggingService.info(`[RelationshipManager] Processing relationships for UID: ${uid}`);
      
      // Find and parse the Related section
      const relatedSection = this.extractRelatedSection(content);
      if (!relatedSection) {
        loggingService.info(`[RelationshipManager] No Related section found: ${file.path}`);
        return;
      }

      const relationships = this.parseRelatedSection(relatedSection);
      loggingService.info(`[RelationshipManager] Found ${relationships.length} relationships in: ${file.path}`);
      
      this.syncingFiles.add(file.path);
      try {
        // Update graph with new relationships
        await this.updateGraphFromRelatedList(uid, relationships);
        
        // Update frontmatter to match graph
        await this.updateFrontmatterFromGraph(file, uid);
        
        loggingService.info(`[RelationshipManager] Successfully synced: ${file.path}`);
        
        // Schedule consistency check and propagation (debounced)
        this.scheduleConsistencyCheck();
        await this.propagateRelationshipChanges(uid);

      } finally {
        this.syncingFiles.delete(file.path);
      }
    });
  }

  /**
   * Sync frontmatter to the Related list in markdown
   */
  private async syncFrontmatterToRelatedList(file: TFile): Promise<void> {
    if (this.syncingFiles.has(file.path)) return;

    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.UID) return;

    const uid = cache.frontmatter.UID;
    const content = await this.app.vault.read(file);
    
    // Get relationships from graph
    const relationships = this.graph.getContactRelationships(uid);
    
    this.syncingFiles.add(file.path);
    try {
      // Update the Related section in the content
      const newContent = this.updateRelatedSectionInContent(content, relationships);
      if (newContent !== content) {
        await this.app.vault.modify(file, newContent);
      }
    } finally {
      this.syncingFiles.delete(file.path);
    }
  }

  /**
   * Extract the Related section from markdown content
   */
  private extractRelatedSection(content: string): string | null {
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\s\S]*?)(?=^#{1,6}|$)/im);
    return relatedMatch ? relatedMatch[2].trim() : null;
  }

  /**
   * Parse relationships from the Related section markdown
   */
  private parseRelatedSection(sectionContent: string): { type: RelationshipType; contactName: string; impliedGender?: Gender }[] {
    const lines = sectionContent.split('\n');
    const relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[] = [];

    for (const line of lines) {
      const parsed = parseRelationshipListItem(line.trim());
      if (parsed) {
        relationships.push(parsed);
      }
    }

    return relationships;
  }

  /**
   * Update the graph from parsed related list
   */
  private async updateGraphFromRelatedList(uid: string, relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[]): Promise<void> {
    const contact = this.graph.getContact(uid);
    if (!contact) return;

    // Clear existing relationships for this contact
    const existingRelationships = this.graph.getContactRelationships(uid);
    for (const rel of existingRelationships) {
      this.graph.removeRelationship(uid, rel.targetUid, rel.type);
    }

    // Add new relationships
    for (const rel of relationships) {
      // Find or create the target contact
      const targetUid = await this.findOrCreateContactByName(rel.contactName);
      if (!targetUid) continue;

      // Update target contact's gender if implied
      if (rel.impliedGender) {
        const targetContact = this.graph.getContact(targetUid);
        if (targetContact && targetContact.file) {
          await this.updateContactGender(targetContact.file, rel.impliedGender);
        }
      }

      // Add the relationship
      this.graph.addRelationship(uid, targetUid, rel.type);
    }
  }

  /**
   * Find contact by name or create a stub entry
   */
  private async findOrCreateContactByName(name: string): Promise<string | null> {
    // First, try to find existing contact by name
    const allContacts = this.graph.getAllContacts();
    const existing = allContacts.find(c => c.fullName === name);
    if (existing) return existing.uid;

    // Look for a contact file with this name
    const contactFile = this.app.vault.getAbstractFileByPath(`Contacts/${name}.md`);
    if (contactFile instanceof TFile) {
      await this.loadContactIntoGraph(contactFile);
      const contact = this.graph.getAllContacts().find(c => c.fullName === name);
      return contact?.uid || null;
    }

    // For now, return null if contact doesn't exist
    // In a full implementation, we might want to create placeholder contacts
    return null;
  }

  /**
   * Update contact's gender in frontmatter
   */
  private async updateContactGender(file: TFile, gender: Gender): Promise<void> {
    if (this.syncingFiles.has(file.path)) return;

    // Don't add to syncingFiles here since this is called within a locked context
    try {
      await updateFrontMatterValue(file, 'GENDER', gender, this.app);
      await this.updateRevTimestamp(file);
    } catch (error) {
      loggingService.error(`Error updating gender for ${file.path}: ${error.message}`);
    }
  }

  /**
   * Update frontmatter from graph relationships - MERGE with existing front matter, never remove
   */
  private async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    const graphRelatedFields = this.graph.contactToRelatedFields(uid);
    
    // Get existing front matter relationships
    const cache = this.app.metadataCache.getFileCache(file);
    const existingFrontMatterSet = RelationshipSet.fromFrontMatter(cache?.frontmatter || {});
    
    // Create a combined set from graph relationships
    const graphSet = RelationshipSet.fromRelatedFields(graphRelatedFields);
    
    // Merge: start with existing front matter, add any missing relationships from graph
    const mergedSet = existingFrontMatterSet.clone();
    for (const entry of graphSet.getEntries()) {
      // Only add if this exact relationship doesn't already exist
      const existingEntries = mergedSet.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      if (!alreadyExists) {
        mergedSet.add(entry.type, entry.value);
      }
    }
    
    loggingService.info(`[RelationshipManager] Merging relationships - existing: ${existingFrontMatterSet.size()}, graph: ${graphSet.size()}, merged: ${mergedSet.size()}`);
    
    // Clear existing RELATED fields only if we have changes to make
    if (!existingFrontMatterSet.equals(mergedSet)) {
      if (cache?.frontmatter) {
        for (const key of Object.keys(cache.frontmatter)) {
          if (key.startsWith('RELATED')) {
            await updateFrontMatterValue(file, key, '', this.app);
          }
        }
      }

      // Add merged and sanitized RELATED fields using RelationshipSet for consistent indexing
      const frontMatterFields = mergedSet.toFrontMatterFields();
      for (const [key, value] of Object.entries(frontMatterFields)) {
        await updateFrontMatterValue(file, key, value, this.app);
      }
      
      loggingService.info(`[RelationshipManager] Updated front matter for: ${file.path}`);
    } else {
      loggingService.info(`[RelationshipManager] No front matter changes needed for: ${file.path}`);
    }

    // Update REV timestamp
    await this.updateRevTimestamp(file);
  }

  /**
   * Update the Related section in content
   */
  private updateRelatedSectionInContent(content: string, relationships: { type: RelationshipType; targetUid: string; targetName: string }[]): string {
    const relatedListItems = relationships.map(rel => {
      const targetContact = this.graph.getContact(rel.targetUid);
      return formatRelationshipListItem(rel.type, rel.targetName, targetContact?.gender);
    });

    const relatedSection = relatedListItems.length > 0 
      ? `\n## Related\n${relatedListItems.join('\n')}\n`
      : '\n## Related\n\n';

    // Replace or add the Related section
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\s\S]*?)(?=^#{1,6}|$)/im);
    if (relatedMatch) {
      return content.replace(relatedMatch[0], relatedSection.trim());
    } else {
      // Add the section before the last hashtags line
      const lines = content.split('\n');
      const lastHashtagIndex = lines.findIndex(line => line.trim().startsWith('#'));
      if (lastHashtagIndex >= 0) {
        lines.splice(lastHashtagIndex, 0, relatedSection.trim());
        return lines.join('\n');
      } else {
        return content + relatedSection;
      }
    }
  }

  /**
   * Propagate relationship changes to related contacts
   */
  private async propagateRelationshipChanges(uid: string): Promise<void> {
    const relationships = this.graph.getContactRelationships(uid);
    
    // Use a debounced approach to avoid cascading updates
    for (const rel of relationships) {
      const targetContact = this.graph.getContact(rel.targetUid);
      if (targetContact?.file && !this.syncingFiles.has(targetContact.file.path)) {
        // Debounce the update to the related contact to prevent cascades
        this.debounceSync(targetContact.file, async () => {
          // Check again if we should update (may have been updated by another operation)
          if (!this.syncingFiles.has(targetContact.file!.path)) {
            await this.syncFrontmatterToRelatedList(targetContact.file!);
          }
        }, 500); // Shorter delay for propagation
      }
    }
  }

  /**
   * Update REV timestamp in frontmatter
   */
  private async updateRevTimestamp(file: TFile): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    await updateFrontMatterValue(file, 'REV', timestamp, this.app);
  }

  /**
   * Ensure graph consistency by adding missing reciprocal relationships
   * This method should only be called within a global lock context
   */
  private async ensureGraphConsistency(): Promise<void> {
    const inconsistencies = this.graph.checkConsistency();
    
    if (inconsistencies.length === 0) {
      return; // No inconsistencies found
    }

    loggingService.info(`Found ${inconsistencies.length} relationship inconsistencies, fixing...`);
    
    // Add missing relationships to graph first (batch operation)
    for (const inconsistency of inconsistencies) {
      loggingService.debug(`Adding missing reciprocal relationship: ${inconsistency.fromUid} -> ${inconsistency.toUid} (${inconsistency.type})`);
      this.graph.addRelationship(inconsistency.fromUid, inconsistency.toUid, inconsistency.type);
    }
    
    // Then update front matter for all affected contacts (without triggering more cascades)
    const affectedContacts = new Set<string>();
    for (const inconsistency of inconsistencies) {
      affectedContacts.add(inconsistency.fromUid);
    }
    
    for (const uid of affectedContacts) {
      const contact = this.graph.getContact(uid);
      if (contact?.file && !this.syncingFiles.has(contact.file.path)) {
        this.syncingFiles.add(contact.file.path);
        try {
          await this.updateFrontmatterFromGraph(contact.file, uid);
        } finally {
          this.syncingFiles.delete(contact.file.path);
        }
      }
    }
  }

  /**
   * Debounce sync operations to prevent excessive updates
   */
  private debounceSync(file: TFile, operation: () => Promise<void> | void, delay = 1000): void {
    const key = file.path;
    
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        await operation();
      } catch (error) {
        loggingService.error(`Error in debounced sync for ${file.path}: ${error.message}`);
      }
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Sync current file before cleanup if needed
    if (this.currentContactFile && !this.globalLock) {
      this.syncRelatedListToFrontmatter(this.currentContactFile);
    }

    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear consistency check timer
    if (this.consistencyCheckTimer) {
      clearTimeout(this.consistencyCheckTimer);
      this.consistencyCheckTimer = null;
    }
    
    // Clean up event listeners
    if (typeof window !== 'undefined' && this.handleAppClose) {
      window.removeEventListener('beforeunload', this.handleAppClose);
    }
    
    // Wait for any pending operations to complete
    this.globalLock = false;
  }
}