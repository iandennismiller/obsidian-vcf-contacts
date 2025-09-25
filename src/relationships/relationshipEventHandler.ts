/**
 * Handles automatic synchronization of relationships when contact files are modified
 */

import { App, TFile, EventRef, debounce } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { RelationshipManager } from './relationshipManager';
import { ContactUtils } from './contactUtils';

export class RelationshipEventHandler {
  private app: App;
  private settings: ContactsPluginSettings;
  private relationshipManager: RelationshipManager;
  private contactUtils: ContactUtils;
  private eventRefs: EventRef[] = [];
  private syncingFiles = new Set<string>(); // Prevent infinite sync loops
  private debouncedSync = new Map<string, () => void>();

  constructor(
    app: App, 
    settings: ContactsPluginSettings, 
    relationshipManager: RelationshipManager
  ) {
    this.app = app;
    this.settings = settings;
    this.relationshipManager = relationshipManager;
    this.contactUtils = new ContactUtils(app, settings);
  }

  /**
   * Start listening to file events for automatic relationship sync
   */
  start(): void {
    this.stop(); // Clean up any existing listeners

    // Listen for file modifications
    const modifyRef = this.app.vault.on('modify', (file) => {
      if (file instanceof TFile) {
        this.handleFileModify(file);
      }
    });

    // Listen for file renames (in case contact names change)
    const renameRef = this.app.vault.on('rename', (file, oldPath) => {
      if (file instanceof TFile) {
        this.handleFileRename(file, oldPath);
      }
    });

    // Listen for file deletions (to clean up relationships)
    const deleteRef = this.app.vault.on('delete', (file) => {
      if (file instanceof TFile) {
        this.handleFileDelete(file);
      }
    });

    this.eventRefs.push(modifyRef, renameRef, deleteRef);
  }

  /**
   * Stop listening to file events
   */
  stop(): void {
    for (const ref of this.eventRefs) {
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
    
    // Clear any pending syncs
    this.debouncedSync.clear();
  }

  /**
   * Handle file modification events
   */
  private handleFileModify(file: TFile): void {
    // Only process contact files
    if (!this.contactUtils.isContactFile(file)) {
      return;
    }

    // Skip if we're currently syncing this file (prevent infinite loops)
    if (this.syncingFiles.has(file.path)) {
      return;
    }

    // Debounce sync operations to avoid excessive processing
    this.debounceSyncFile(file);
  }

  /**
   * Handle file rename events
   */
  private async handleFileRename(file: TFile, oldPath: string): Promise<void> {
    // Only process contact files
    if (!this.contactUtils.isContactFile(file)) {
      return;
    }

    const contactNote = await this.contactUtils.loadContactNote(file);
    if (!contactNote) return;

    // Extract old name from path (rough approximation)
    const oldName = oldPath.split('/').pop()?.replace('.md', '') || '';
    const newName = contactNote.fullName;

    if (oldName !== newName) {
      // Update any relationships that reference this contact by name
      await this.updateContactNameReferences(oldName, newName);
    }
  }

  /**
   * Handle file deletion events
   */
  private async handleFileDelete(file: TFile): Promise<void> {
    // Only process contact files
    if (!file.path.startsWith(this.settings.contactsFolder)) {
      return;
    }

    // Extract UID from cache if available
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;

    if (uid) {
      // Remove this contact from the relationship graph
      await this.removeContactFromGraph(uid);
    }
  }

  /**
   * Debounced sync operation for a specific file
   */
  private debounceSyncFile(file: TFile): void {
    // Cancel any existing sync for this file
    const existingSync = this.debouncedSync.get(file.path);
    if (existingSync) {
      // TypeScript doesn't know this is a debounced function, but it is
      (existingSync as any).cancel?.();
    }

    // Create new debounced sync
    const debouncedFn = debounce(async () => {
      await this.performFileSync(file);
      this.debouncedSync.delete(file.path);
    }, 1000, true); // 1 second debounce, leading edge

    this.debouncedSync.set(file.path, debouncedFn);
    debouncedFn();
  }

  /**
   * Perform the actual sync operation for a file
   */
  private async performFileSync(file: TFile): Promise<void> {
    try {
      // Mark that we're syncing this file
      this.syncingFiles.add(file.path);

      // Check if file still exists and is valid
      if (!this.app.vault.getAbstractFileByPath(file.path)) {
        return;
      }

      const contactNote = await this.contactUtils.loadContactNote(file);
      if (!contactNote) {
        return;
      }

      // Sync relationships from the Related section
      await this.relationshipManager.syncContactFromRelatedList(file);

    } catch (error) {
      console.error(`Error syncing relationships for ${file.path}:`, error);
    } finally {
      // Always remove the sync flag
      this.syncingFiles.delete(file.path);
    }
  }

  /**
   * Update references to a contact when its name changes
   */
  private async updateContactNameReferences(oldName: string, newName: string): Promise<void> {
    const contactFiles = this.contactUtils.getContactFiles();

    for (const file of contactFiles) {
      try {
        const content = await this.app.vault.read(file);
        
        // Check if this file contains references to the old name
        const namePattern = new RegExp(`\\[\\[${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'g');
        
        if (namePattern.test(content)) {
          // Replace old name with new name
          const updatedContent = content.replace(namePattern, `[[${newName}]]`);
          
          // Mark as syncing to prevent infinite loops
          this.syncingFiles.add(file.path);
          
          try {
            await this.app.vault.modify(file, updatedContent);
            
            // Sync this file to update the graph
            await this.relationshipManager.syncContactFromRelatedList(file);
          } finally {
            this.syncingFiles.delete(file.path);
          }
        }
      } catch (error) {
        console.error(`Error updating name references in ${file.path}:`, error);
      }
    }
  }

  /**
   * Remove a contact from the relationship graph and clean up references
   */
  private async removeContactFromGraph(uid: string): Promise<void> {
    try {
      // Get all contacts that have relationships with this contact
      const allRelationships = this.relationshipManager.getContactRelationships(uid);
      const affectedContacts = new Set<string>();

      for (const rel of allRelationships) {
        affectedContacts.add(rel.targetUid);
      }

      // Remove the contact from the graph (this also removes all its relationships)
      // Note: We would need to expose this method in RelationshipManager
      // For now, we'll trigger a graph rebuild
      await this.relationshipManager.rebuildGraph();

      // Sync all affected contacts to update their front matter
      for (const affectedUid of affectedContacts) {
        const affectedFile = this.contactUtils.findContactByUID(affectedUid);
        if (affectedFile) {
          await this.relationshipManager.syncContactFromRelatedList(affectedFile);
        }
      }

    } catch (error) {
      console.error(`Error removing contact ${uid} from graph:`, error);
    }
  }

  /**
   * Check if a file is currently being synced
   */
  isSyncing(filePath: string): boolean {
    return this.syncingFiles.has(filePath);
  }

  /**
   * Force sync all contact files (useful after major changes)
   */
  async syncAllContacts(): Promise<void> {
    const contactFiles = this.contactUtils.getContactFiles();
    
    for (const file of contactFiles) {
      try {
        await this.performFileSync(file);
      } catch (error) {
        console.error(`Error syncing ${file.path}:`, error);
      }
    }
  }

  /**
   * Update settings and restart event handling if needed
   */
  updateSettings(newSettings: ContactsPluginSettings): void {
    const oldContactsFolder = this.settings.contactsFolder;
    this.settings = newSettings;
    
    // If contacts folder changed, we need to reinitialize
    if (oldContactsFolder !== newSettings.contactsFolder) {
      this.stop();
      this.start();
    }
  }
}