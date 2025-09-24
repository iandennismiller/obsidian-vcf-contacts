import { TFile, App, MarkdownView } from 'obsidian';
import { RelationshipGraph, RelationshipType, Gender } from './relationshipGraph';
import { parseRelationshipListItem, formatRelationshipListItem, inferGenderFromTerm, normalizeGender } from './genderUtils';
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

  constructor(app: App) {
    this.app = app;
    this.graph = new RelationshipGraph();
    this.setupEventListeners();
  }

  /**
   * Initialize the relationship graph with existing contacts
   */
  async initializeFromVault(): Promise<void> {
    return this.withGlobalLock(async () => {
      const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.includes('Contacts/') || file.path.includes('contacts/')
      );

      for (const file of contactFiles) {
        await this.loadContactIntoGraph(file);
      }

      // Schedule consistency check with debouncing
      this.scheduleConsistencyCheck();
    });
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
   * Parse RELATED fields from frontmatter
   */
  private parseRelatedFromFrontmatter(frontmatter: Record<string, any>): { type: RelationshipType; value: string }[] {
    const related: { type: RelationshipType; value: string }[] = [];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED')) {
        // Extract type from key format: RELATED[type] or RELATED[index:type]
        const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
        if (typeMatch && typeMatch[1]) {
          let type = typeMatch[1];
          
          // Normalize gendered relationship terms to genderless ones
          const inferred = inferGenderFromTerm(type);
          if (inferred) {
            type = inferred.type;
          }
          
          related.push({ type: type as RelationshipType, value: String(value) });
        }
      }
    }

    return related;
  }

  /**
   * Setup event listeners for file events
   */
  private setupEventListeners(): void {
    // Listen for when files lose focus to sync Related list to frontmatter
    this.app.workspace.on('active-leaf-change', () => {
      this.handleFileChange();
    });

    // Note: Removed 'modify' event listener to prevent cascading updates
    // Only user-initiated events (like switching files) should trigger sync
  }

  /**
   * Handle when active file changes - sync the previous file if needed
   */
  private handleFileChange(): void {
    const previousFile = this.getCurrentContactFile();
    if (previousFile && !this.globalLock) {
      this.debounceSync(previousFile, () => this.syncRelatedListToFrontmatter(previousFile), 1500); // Longer delay for file change
    }
  }

  /**
   * Get the current contact file if it's a contact
   */
  private getCurrentContactFile(): TFile | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.file) return null;

    const file = activeView.file;
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Check if it's a contact file (has UID or name fields)
    if (cache?.frontmatter?.UID || cache?.frontmatter?.FN || cache?.frontmatter?.['N.GN']) {
      return file;
    }

    return null;
  }

  /**
   * Sync the Related list in markdown to frontmatter
   */
  private async syncRelatedListToFrontmatter(file: TFile): Promise<void> {
    if (this.syncingFiles.has(file.path) || this.globalLock) return;

    await this.withGlobalLock(async () => {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter?.UID) return;

      const uid = cache.frontmatter.UID;
      const content = await this.app.vault.read(file);
      
      // Find and parse the Related section
      const relatedSection = this.extractRelatedSection(content);
      if (!relatedSection) return;

      const relationships = this.parseRelatedSection(relatedSection);
      
      this.syncingFiles.add(file.path);
      try {
        // Update graph with new relationships
        await this.updateGraphFromRelatedList(uid, relationships);
        
        // Update frontmatter to match graph
        await this.updateFrontmatterFromGraph(file, uid);
        
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
   * Update frontmatter from graph relationships
   */
  private async updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void> {
    const relatedFields = this.graph.contactToRelatedFields(uid);
    
    // Clear existing RELATED fields
    const cache = this.app.metadataCache.getFileCache(file);
    if (cache?.frontmatter) {
      for (const key of Object.keys(cache.frontmatter)) {
        if (key.startsWith('RELATED')) {
          await updateFrontMatterValue(file, key, '', this.app);
        }
      }
    }

    // Add new RELATED fields
    for (let i = 0; i < relatedFields.length; i++) {
      const field = relatedFields[i];
      const key = i === 0 ? `RELATED[${field.type}]` : `RELATED[${i}:${field.type}]`;
      await updateFrontMatterValue(file, key, field.value, this.app);
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
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear consistency check timer
    if (this.consistencyCheckTimer) {
      clearTimeout(this.consistencyCheckTimer);
      this.consistencyCheckTimer = null;
    }
    
    // Wait for any pending operations to complete
    this.globalLock = false;
  }
}