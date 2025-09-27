import { App, TFile, EventRef, WorkspaceLeaf, TFolder, Vault, normalizePath, Notice, Workspace } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { loggingService } from '../services/loggingService';
import { ContactNote, getFrontmatterFromFiles } from './contactNote';
import { VCardForObsidianRecord } from './vcardFile';
import { getSettings } from '../context/sharedSettingsContext';
import { RunType } from '../insights/insight.d';
import { insightService } from '../insights/insightService';
import { FileExistsModal } from '../ui/modals/fileExistsModal';

/**
 * Interface for managing contact notes in the Obsidian vault.
 * Provides methods for contact file detection, UID management, and caching.
 */
export interface IContactManager {
  /**
   * Extract UID from a contact file
   */
  extractUIDFromFile(file: TFile): Promise<string | null>;

  /**
   * Find a contact file by its UID
   */
  findContactFileByUID(uid: string): Promise<TFile | null>;

  /**
   * Initialize the cache of existing contact UIDs
   */
  initializeCache(): Promise<void>;

  /**
   * Clear the internal cache
   */
  clearCache(): void;

  /**
   * Get all contact files from the vault
   */
  getAllContactFiles(): TFile[];

  /**
   * Check if a file is a contact file
   */
  isContactFile(file: TFile): boolean;

  /**
   * Get the contacts folder path
   */
  getContactsFolder(): string;

  /**
   * Add a contact file to the cache
   */
  addToCache(uid: string, file: TFile): void;

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void;

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void;

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files
   */
  setupEventListeners(): void;

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void;
}

/**
 * Manages the collection of contact notes in the Obsidian vault.
 * Provides an interface for contact file detection, UID management, and caching.
 */
export class ContactManager implements IContactManager {
  private app: App;
  private settings: ContactsPluginSettings;
  private existingUIDs = new Set<string>();
  private contactFiles = new Map<string, TFile>(); // UID -> TFile mapping

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
  }

  /**
   * Get the effective contacts folder path
   */
  getContactsFolder(): string {
    return this.settings.contactsFolder || '/';
  }

  /**
   * Extract UID from a contact file's frontmatter.
   * 
   * Tries multiple approaches:
   * 1. Uses Obsidian's metadata cache (primary method)
   * 2. Falls back to direct file reading and frontmatter parsing
   * 
   * @param file - The contact file to read UID from
   * @returns Promise resolving to the UID string or null if not found
   */
  async extractUIDFromFile(file: TFile): Promise<string | null> {
    try {
      // Try metadata cache first (most efficient)
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (uid) {
        loggingService.debug(`[ContactManager] Found UID "${uid}" via metadata cache from ${file.path}`);
        return uid;
      }

      // Fallback: read file directly and parse frontmatter
      try {
        const content = await this.app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatterText = frontmatterMatch[1];
          const uidMatch = frontmatterText.match(/^UID:\s*(.+)$/m);
          if (uidMatch) {
            const extractedUID = uidMatch[1].trim();
            loggingService.debug(`[ContactManager] Found UID "${extractedUID}" via direct read from ${file.path}`);
            return extractedUID;
          }
        }
      } catch (readError) {
        loggingService.debug(`[ContactManager] Failed to read file ${file.path} directly: ${readError.message}`);
      }

      return null;
    } catch (error) {
      loggingService.debug(`[ContactManager] Error extracting UID from ${file.path}: ${error.message}`);
      return null;
    }
  }

  /**
   * Find a contact file by its UID.
   * 
   * Uses a two-tier approach:
   * 1. First checks the cached contactFiles map for fast lookup
   * 2. Falls back to scanning all files if cache miss or stale cache
   * 
   * @param uid - The UID to search for
   * @returns Promise resolving to the TFile or null if not found
   */
  async findContactFileByUID(uid: string): Promise<TFile | null> {
    loggingService.debug(`[ContactManager] Looking for contact with UID: "${uid}"`);
    
    // First check the cached contactFiles map
    const cachedFile = this.contactFiles.get(uid);
    if (cachedFile) {
      loggingService.debug(`[ContactManager] Found cached file for UID "${uid}": ${cachedFile.path}`);
      // Verify the file still exists and has the correct UID
      const fileUID = await this.extractUIDFromFile(cachedFile);
      if (fileUID === uid) {
        loggingService.debug(`[ContactManager] Cache verification successful for UID "${uid}"`);
        return cachedFile;
      } else {
        loggingService.debug(`[ContactManager] Cache verification failed for UID "${uid}": file UID is "${fileUID}"`);
        // Remove stale cache entry
        this.contactFiles.delete(uid);
        this.existingUIDs.delete(uid);
        loggingService.debug(`[ContactManager] Removed stale cache entry for UID "${uid}"`);
      }
    } else {
      loggingService.debug(`[ContactManager] No cached file found for UID "${uid}"`);
    }

    // Fall back to searching all files if not in cache or cache is stale
    try {
      const contactsFolder = this.getContactsFolder();
      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );

      loggingService.debug(`[ContactManager] Searching ${files.length} files in "${contactsFolder}" for UID "${uid}"`);

      for (const file of files) {
        const fileUID = await this.extractUIDFromFile(file);
        
        if (fileUID === uid) {
          // Update the cache
          this.contactFiles.set(uid, file);
          this.existingUIDs.add(uid);
          loggingService.debug(`[ContactManager] Found matching file for UID "${uid}": ${file.path}`);
          return file;
        }
      }
      
      loggingService.debug(`[ContactManager] No file found for UID "${uid}" after searching ${files.length} files`);
    } catch (error) {
      loggingService.error(`[ContactManager] Error finding contact file by UID: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Initialize the cache of existing contact UIDs from the Obsidian contacts folder.
   * 
   * Scans all markdown files in the contacts folder and builds:
   * - A set of existing UIDs for duplicate detection
   * - A map of UIDs to TFile objects for quick lookups
   * 
   * @returns Promise that resolves when the UID cache is built
   */
  async initializeCache(): Promise<void> {
    this.existingUIDs.clear();
    this.contactFiles.clear();
    
    loggingService.info("[ContactManager] Building UID cache from existing contacts...");
    
    try {
      const contactsFolder = this.getContactsFolder();
      loggingService.debug(`[ContactManager] Contacts folder path: "${contactsFolder}"`);
      
      const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
      
      if (!folder) {
        loggingService.warning(`[ContactManager] Contacts folder not found: ${contactsFolder}`);
        return;
      }

      const allMarkdownFiles = this.app.vault.getMarkdownFiles();
      loggingService.debug(`[ContactManager] Total markdown files in vault: ${allMarkdownFiles.length}`);
      
      const files = allMarkdownFiles.filter(file => 
        file.path.startsWith(contactsFolder)
      );
      loggingService.debug(`[ContactManager] Markdown files in contacts folder: ${files.length}`);

      let filesWithUID = 0;
      let filesWithoutUID = 0;

      for (const file of files) {
        const uid = await this.extractUIDFromFile(file);
        
        if (uid) {
          this.existingUIDs.add(uid);
          this.contactFiles.set(uid, file);
          filesWithUID++;
          loggingService.debug(`[ContactManager] Found UID "${uid}" in file: ${file.path}`);
        } else {
          filesWithoutUID++;
          loggingService.debug(`[ContactManager] No UID found in file: ${file.path}`);
        }
      }

      loggingService.info(`[ContactManager] UID cache built successfully: ${this.existingUIDs.size} existing contacts indexed`);
      loggingService.debug(`[ContactManager] Files with UID: ${filesWithUID}, without UID: ${filesWithoutUID}`);
    } catch (error) {
      loggingService.error(`[ContactManager] Failed to build UID cache: ${error.message}`);
    }
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.existingUIDs.clear();
    this.contactFiles.clear();
    loggingService.debug("[ContactManager] Cache cleared");
  }

  /**
   * Check if a UID exists in the cache
   */
  hasUID(uid: string): boolean {
    return this.existingUIDs.has(uid);
  }

  /**
   * Get all contact files from the vault using Obsidian API
   * Reuses pattern from ContactUtils but with ContactManager context
   */
  getAllContactFiles(): TFile[] {
    const contactsFolder = this.getContactsFolder();
    
    if (!contactsFolder || contactsFolder === '/') {
      // If no specific folder, check all markdown files for UIDs
      const allFiles = this.app.vault.getMarkdownFiles();
      return allFiles.filter(file => this.isContactFile(file));
    }

    // Use same filtering approach as existing ContactUtils
    const files = this.app.vault.getMarkdownFiles().filter(file => {
      return file.path.startsWith(contactsFolder) && this.isContactFile(file);
    });

    loggingService.debug(`[ContactManager] Found ${files.length} contact files in folder "${contactsFolder}"`);
    return files;
  }

  /**
   * Check if a file is a contact file based on plugin settings and UID presence
   */
  isContactFile(file: TFile): boolean {
    if (!file) return false;
    
    // Check if file is in contacts folder
    const contactsFolder = this.getContactsFolder();
    if (contactsFolder !== '/' && !file.path.startsWith(contactsFolder)) {
      return false;
    }

    // Check if file has UID in frontmatter (using cache for efficiency)
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;
    return uid != null;
  }

  /**
   * Add a contact file to the cache
   */
  addToCache(uid: string, file: TFile): void {
    this.existingUIDs.add(uid);
    this.contactFiles.set(uid, file);
    loggingService.debug(`[ContactManager] Added to cache: UID "${uid}" -> ${file.path}`);
  }

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void {
    this.existingUIDs.delete(uid);
    this.contactFiles.delete(uid);
    loggingService.debug(`[ContactManager] Removed from cache: UID "${uid}"`);
  }

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void {
    if (this.existingUIDs.has(uid)) {
      this.contactFiles.set(uid, newFile);
      loggingService.debug(`[ContactManager] Updated cache for rename: UID "${uid}" -> ${newFile.path}`);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { uidCount: number; fileCount: number } {
    return {
      uidCount: this.existingUIDs.size,
      fileCount: this.contactFiles.size
    };
  }

  // Event handling for active leaf changes
  private eventRef: EventRef | null = null;
  private currentActiveFile: TFile | null = null;

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files
   */
  setupEventListeners(): void {
    if (this.eventRef) {
      // Already set up
      return;
    }

    this.eventRef = this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
      this.handleActiveLeafChange(leaf);
    });

    loggingService.info('[ContactManager] Event listeners set up for active-leaf-change');
  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void {
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;
      loggingService.info('[ContactManager] Event listeners cleaned up');
    }
  }

  /**
   * Handle active leaf change - sync the previous contact file if we're leaving one
   */
  private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    // Check if the view has a file property (duck typing for MarkdownView)
    const newActiveFile = (leaf?.view && 'file' in leaf.view) ? (leaf.view as any).file : null;
    
    // If we had a previous active contact file and we're switching away from it, sync it
    if (this.currentActiveFile && 
        this.currentActiveFile !== newActiveFile && 
        this.isContactFile(this.currentActiveFile)) {
      
      const fileToSync = this.currentActiveFile;
      loggingService.info(`[ContactManager] Navigating away from contact file: ${fileToSync.path} - starting sync`);
      
      // Sync the related list to frontmatter for the file we're leaving
      this.syncContactFile(fileToSync);
    }
    
    this.currentActiveFile = newActiveFile;
  }

  /**
   * Sync a contact file bidirectionally:
   * 1. First sync frontmatter to Related list (add missing relationships to Related section)
   * 2. Then sync Related list to frontmatter (ensure frontmatter is complete)
   */
  private async syncContactFile(file: TFile): Promise<void> {
    try {
      const contactNote = new ContactNote(this.app, this.settings, file);

      // Step 1: Sync from frontmatter to Related list
      loggingService.info(`[ContactManager] Syncing frontmatter to Related list for: ${file.basename}`);
      const frontmatterToRelatedResult = await contactNote.syncFrontmatterToRelatedList();

      if (frontmatterToRelatedResult.success) {
        loggingService.info(`[ContactManager] Successfully synced frontmatter to Related list for: ${file.basename}`);
        if (frontmatterToRelatedResult.errors.length > 0) {
          loggingService.warning(`[ContactManager] Frontmatter sync completed with warnings for ${file.basename}`);
          frontmatterToRelatedResult.errors.forEach(error => loggingService.warning(error));
        }
      } else {
        loggingService.error(`[ContactManager] Failed to sync frontmatter to Related list for: ${file.basename}`);
        frontmatterToRelatedResult.errors.forEach(error => loggingService.error(error));
      }

      // Step 2: Sync from Related list to frontmatter
      loggingService.info(`[ContactManager] Syncing Related list to frontmatter for: ${file.basename}`);
      const relatedToFrontmatterResult = await contactNote.syncRelatedListToFrontmatter();

      if (relatedToFrontmatterResult.success) {
        loggingService.info(`[ContactManager] Successfully synced Related list to frontmatter for: ${file.basename}`);
        if (relatedToFrontmatterResult.errors.length > 0) {
          loggingService.warning(`[ContactManager] Related list sync completed with warnings for ${file.basename}`);
          relatedToFrontmatterResult.errors.forEach(error => loggingService.warning(error));
        }
      } else {
        loggingService.error(`[ContactManager] Failed to sync Related list to frontmatter for: ${file.basename}`);
        relatedToFrontmatterResult.errors.forEach(error => loggingService.error(error));
      }

    } catch (error) {
      loggingService.error(`[ContactManager] Error syncing contact file ${file.basename}: ${error.message}`);
    }
  }

  /**
   * Ensure vCard object has a name before processing
   * Migrated from src/contacts/ensureHasName.ts
   */
  async ensureHasName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
    return ContactManager.ensureHasNameStatic(vCardObject);
  }

  /**
   * Static version of ensureHasName for use in static contexts
   */
  static async ensureHasNameStatic(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
    const { createNameSlug } = await import('./contactNote');
    const { VCardKinds } = await import('./vcardFile');
    const { ContactNameModal } = await import('../ui/modals/contactNameModal');
    const { getApp } = await import('../context/sharedAppContext');
    
    // Import the type separately
    type NamingPayload = import('../ui/modals/contactNameModal').NamingPayload;
    
    try {
      // if we can create a file name then we meet the minimum requirements
      createNameSlug(vCardObject);
      return Promise.resolve(vCardObject);
    } catch (error) {
      // Need to prompt for some form of name information.
      const app = getApp();
      return new Promise((resolve) => {
        console.warn("No name found for record", vCardObject);
        new ContactNameModal(app, (nameData: NamingPayload) => {
          if (nameData.kind === VCardKinds.Individual) {
            vCardObject["N.PREFIX"] ??= "";
            vCardObject["N.GN"] = nameData.given;
            vCardObject["N.MN"] ??= "";
            vCardObject["N.FN"] = nameData.family;
            vCardObject["N.SUFFIX"] ??= "";
          } else {
            vCardObject["FN"] ??= nameData.fn;
          }
          vCardObject["KIND"] ??= nameData.kind;
          resolve(vCardObject);
        }).open();
      });
    }
  }

  // File management methods migrated from src/file/file.ts

  /**
   * Open a file in the workspace
   * Migrated from src/file/file.ts
   */
  async openFile(file: TFile, workspace?: Workspace): Promise<void> {
    const ws = workspace || this.app.workspace;
    const leaf = ws.getLeaf();
    await leaf.openFile(file, { active: true });
  }

  /**
   * Find all contact files in a folder
   * Migrated from src/file/file.ts
   */
  findContactFiles(contactsFolder: TFolder): TFile[] {
    const contactFiles: TFile[] = [];
    Vault.recurseChildren(contactsFolder, async (contactNote) => {
      if (contactNote instanceof TFile) {
        contactFiles.push(contactNote);
      }
    });
    return contactFiles;
  }

  /**
   * Open a created file by its path
   * Migrated from src/file/file.ts
   */
  private openCreatedFile(filePath: string): void {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      this.openFile(file);
    }
  }

  /**
   * Handle file creation with existence checking
   * Migrated from src/file/file.ts
   */
  private async handleFileCreation(filePath: string, content: string): Promise<void> {
    const fileExists = await this.app.vault.adapter.exists(filePath);

    if (fileExists) {
      new FileExistsModal(this.app, filePath, async (action: "replace" | "skip") => {
        if (action === "skip") {
          new Notice("File creation skipped.");
          return;
        }

        if (action === "replace") {
          await this.app.vault.adapter.write(filePath, content);
          this.openCreatedFile(filePath);
          new Notice(`File overwritten.`);
        }
      }).open();
    } else {
      const createdFile = await this.app.vault.create(filePath, content);
      await new Promise(r => setTimeout(r, 50));
      const contact = await getFrontmatterFromFiles([createdFile]);
      await insightService.process(contact, RunType.IMMEDIATELY);
      this.openFile(createdFile);
    }
  }

  /**
   * Create a contact file in the appropriate folder
   * Migrated from src/file/file.ts
   */
  async createContactFile(folderPath: string, content: string, filename: string): Promise<void> {
    return ContactManager.createContactFileStatic(this.app, folderPath, content, filename);
  }

  /**
   * Static version of createContactFile for use in static contexts
   */
  static async createContactFileStatic(app: App, folderPath: string, content: string, filename: string): Promise<void> {
    const folder = app.vault.getAbstractFileByPath(folderPath !== '' ? folderPath : '/');
    if (!folder) {
      new Notice(`Can not find path: '${folderPath}'. Please update "Contacts" plugin settings`);
      return;
    }
    const activeFile = app.workspace.getActiveFile();
    const parentFolder = activeFile?.parent; // Get the parent folder if it's a file

    const fileJoin = (...parts: string[]): string => {
      return parts
        .filter(Boolean)
        .join("/")
        .replace(/\/{2,}/g, "/")
        .replace(/\/+$/, "");
    };

    if (parentFolder?.path?.contains(folderPath)) {
      const filePath = normalizePath(fileJoin(parentFolder.path, filename));
      await ContactManager.handleFileCreationStatic(app, filePath, content);
    } else {
      const filePath = normalizePath(fileJoin(folderPath, filename));
      await ContactManager.handleFileCreationStatic(app, filePath, content);
    }
  }

  /**
   * Static version of handleFileCreation
   */
  static async handleFileCreationStatic(app: App, filePath: string, content: string): Promise<void> {
    const fileExists = await app.vault.adapter.exists(filePath);

    if (fileExists) {
      new FileExistsModal(app, filePath, async (action: "replace" | "skip") => {
        if (action === "skip") {
          new Notice("File creation skipped.");
          return;
        }

        if (action === "replace") {
          await app.vault.adapter.write(filePath, content);
          ContactManager.openCreatedFileStatic(app, filePath);
          new Notice(`File overwritten.`);
        }
      }).open();
    } else {
      const createdFile = await app.vault.create(filePath, content);
      await new Promise(r => setTimeout(r, 50));
      const contact = await getFrontmatterFromFiles([createdFile]);
      await insightService.process(contact, RunType.IMMEDIATELY);
      ContactManager.openFileStatic(app, createdFile);
    }
  }

  /**
   * Static version of openFile
   */
  static async openFileStatic(app: App, file: TFile, workspace?: Workspace): Promise<void> {
    const ws = workspace || app.workspace;
    const leaf = ws.getLeaf();
    await leaf.openFile(file, { active: true });
  }

  /**
   * Static version of openCreatedFile
   */
  static openCreatedFileStatic(app: App, filePath: string): void {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      ContactManager.openFileStatic(app, file);
    }
  }

  /**
   * Check if a file is in the contacts folder
   * Migrated from src/file/file.ts
   */
  isFileInContactsFolder(file: TFile): boolean {
    const settings = getSettings();
    return file.path.startsWith(settings.contactsFolder);
  }

  /**
   * Join file path parts
   * Migrated from src/file/file.ts
   */
  private fileJoin(...parts: string[]): string {
    return parts
      .filter(Boolean)
      .join("/")
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/, "");
  }
}