import { App, TFile, EventRef, WorkspaceLeaf, TFolder, Vault, normalizePath, Notice, Workspace } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { ContactNote, Contact } from './contactNote';
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

  /**
   * Ensure consistency of contact data by processing through insight processors
   */
  ensureContactDataConsistency(maxIterations?: number): Promise<void>;
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

            return extractedUID;
          }
        }
      } catch (readError) {

      }

      return null;
    } catch (error) {

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

    
    // First check the cached contactFiles map
    const cachedFile = this.contactFiles.get(uid);
    if (cachedFile) {

      // Verify the file still exists and has the correct UID
      const fileUID = await this.extractUIDFromFile(cachedFile);
      if (fileUID === uid) {

        return cachedFile;
      } else {

        // Remove stale cache entry
        this.contactFiles.delete(uid);
        this.existingUIDs.delete(uid);

      }
    } else {

    }

    // Fall back to searching all files if not in cache or cache is stale
    try {
      const contactsFolder = this.getContactsFolder();
      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );



      for (const file of files) {
        const fileUID = await this.extractUIDFromFile(file);
        
        if (fileUID === uid) {
          // Update the cache
          this.contactFiles.set(uid, file);
          this.existingUIDs.add(uid);

          return file;
        }
      }
      

    } catch (error) {
      console.log(`[ContactManager] Error finding contact file by UID: ${error.message}`);
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
    

    
    try {
      const contactsFolder = this.getContactsFolder();

      
      const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
      
      if (!folder) {
        console.log(`[ContactManager] Contacts folder not found: ${contactsFolder}`);
        return;
      }

      const allMarkdownFiles = this.app.vault.getMarkdownFiles();

      
      const files = allMarkdownFiles.filter(file => 
        file.path.startsWith(contactsFolder)
      );


      let filesWithUID = 0;
      let filesWithoutUID = 0;

      for (const file of files) {
        const uid = await this.extractUIDFromFile(file);
        
        if (uid) {
          this.existingUIDs.add(uid);
          this.contactFiles.set(uid, file);
          filesWithUID++;

        } else {
          filesWithoutUID++;

        }
      }



    } catch (error) {
      console.log(`[ContactManager] Failed to build UID cache: ${error.message}`);
    }
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.existingUIDs.clear();
    this.contactFiles.clear();

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

  }

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void {
    this.existingUIDs.delete(uid);
    this.contactFiles.delete(uid);

  }

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void {
    if (this.existingUIDs.has(uid)) {
      this.contactFiles.set(uid, newFile);

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


  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void {
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;

    }
  }

  /**
   * Handle active leaf change - track current active file
   */
  private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    // Check if the view has a file property (duck typing for MarkdownView)
    const newActiveFile = (leaf?.view && 'file' in leaf.view) ? (leaf.view as any).file : null;
    
    this.currentActiveFile = newActiveFile;
  }



  // File management methods migrated from src/file/file.ts

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
      // Open file directly in workspace
      const workspace = this.app.workspace;
      const leaf = workspace.getLeaf();
      leaf.openFile(file, { active: true });
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
      const contact = await this.getFrontmatterFromFiles([createdFile]);
      await insightService.process(contact, RunType.IMMEDIATELY);
      // Open the created file directly in workspace
      const workspace = this.app.workspace;
      const leaf = workspace.getLeaf();
      leaf.openFile(createdFile, { active: true });
    }
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
      const contact = await ContactManager.getFrontmatterFromFilesStatic(app, [createdFile]);
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
   * Ensure consistency of contact data by processing all contacts through insight processors.
   * This method iteratively processes contacts until no more changes are made or max iterations reached.
   * 
   * @param maxIterations - Maximum number of iterations before stopping (default: 10)
   * @returns Promise that resolves when consistency check is complete
   */
  async ensureContactDataConsistency(maxIterations: number = 10): Promise<void> {
    console.log('[ContactManager] Starting contact data consistency check...');
    
    try {
      // Get all contact files
      const allContactFiles = this.getAllContactFiles();
      if (allContactFiles.length === 0) {
        console.log('[ContactManager] No contacts found for consistency check');
        return;
      }

      console.log(`[ContactManager] Processing ${allContactFiles.length} contacts for consistency`);

      // Create initial task list with contacts and their REV timestamps
      let taskList = await this.createContactTaskList(allContactFiles);
      let iteration = 0;
      let hasChanges = true;

      // Temporarily disable vcardSyncPostProcessor by storing its original state
      const originalVcardSyncPostProcessorState = getSettings().vcardSyncPostProcessor;
      
      try {
        // Disable vcardSyncPostProcessor during consistency checks
        const currentSettings = getSettings();
        currentSettings.vcardSyncPostProcessor = false;

        // Iteratively process contacts until no changes or max iterations
        while (hasChanges && iteration < maxIterations) {
          iteration++;
          console.log(`[ContactManager] Consistency check iteration ${iteration}/${maxIterations}`);

          const changedContacts = await this.processTaskListForConsistency(taskList);
          
          if (changedContacts.length === 0) {
            hasChanges = false;
            console.log(`[ContactManager] No changes detected in iteration ${iteration}, consistency achieved`);
          } else {
            console.log(`[ContactManager] ${changedContacts.length} contacts changed in iteration ${iteration}`);
            // Create new task list with only changed contacts
            taskList = await this.createContactTaskList(changedContacts);
          }
        }

        // Check if we hit max iterations
        if (iteration >= maxIterations && hasChanges) {
          console.log(`[ContactManager] WARNING: Consistency check stopped after ${maxIterations} iterations. Some contacts may still need processing.`);
        }

      } finally {
        // Restore original vcardSyncPostProcessor state
        const currentSettings = getSettings();
        currentSettings.vcardSyncPostProcessor = originalVcardSyncPostProcessorState;
      }

      // Finally, process all contacts one more time with just vcardSyncPostProcessor
      if (originalVcardSyncPostProcessorState) {
        console.log('[ContactManager] Running final vcardSyncPostProcessor pass...');
        const allContacts = await this.getFrontmatterFromFiles(allContactFiles);
        await insightService.process(allContacts, RunType.INPROVEMENT);
        console.log('[ContactManager] Final vcardSyncPostProcessor pass completed');
      }

      console.log(`[ContactManager] Contact data consistency check completed after ${iteration} iterations`);

    } catch (error) {
      console.log(`[ContactManager] Error during consistency check: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a task list of contacts with their current REV timestamps
   */
  private async createContactTaskList(contactFiles: TFile[]): Promise<Map<string, { file: TFile; originalRev: string | null }>> {
    const taskList = new Map<string, { file: TFile; originalRev: string | null }>();
    
    for (const file of contactFiles) {
      try {
        const contactNote = new ContactNote(this.app, this.settings, file);
        const frontmatter = await contactNote.getFrontmatter();
        const originalRev = frontmatter?.REV || null;
        
        const uid = await this.extractUIDFromFile(file);
        if (uid) {
          taskList.set(uid, { file, originalRev });
        }
      } catch (error) {
        console.log(`[ContactManager] Error reading contact ${file.basename}: ${error.message}`);
      }
    }
    
    return taskList;
  }

  /**
   * Process a task list of contacts and return those that were changed (REV updated)
   */
  private async processTaskListForConsistency(taskList: Map<string, { file: TFile; originalRev: string | null }>): Promise<TFile[]> {
    const changedContacts: TFile[] = [];
    const contactFiles = Array.from(taskList.values()).map(item => item.file);
    
    try {
      // Get contact data for processing
      const contacts = await this.getFrontmatterFromFiles(contactFiles);
      
      // Process with all insight processors except vcardSyncPostProcessor
      // Note: vcardSyncPostProcessor is already disabled by the caller
      await insightService.process(contacts, RunType.IMMEDIATELY);
      await insightService.process(contacts, RunType.INPROVEMENT);
      await insightService.process(contacts, RunType.UPCOMMING);
      
      // Check which contacts had their REV timestamp updated
      for (const [uid, taskItem] of taskList) {
        try {
          const contactNote = new ContactNote(this.app, this.settings, taskItem.file);
          const currentFrontmatter = await contactNote.getFrontmatter();
          const currentRev = currentFrontmatter?.REV || null;
          
          // Compare REV timestamps to detect changes
          if (currentRev !== taskItem.originalRev) {
            changedContacts.push(taskItem.file);
            console.log(`[ContactManager] Contact ${taskItem.file.basename} REV changed: ${taskItem.originalRev} -> ${currentRev}`);
          }
        } catch (error) {
          console.log(`[ContactManager] Error checking REV for ${taskItem.file.basename}: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`[ContactManager] Error processing task list: ${error.message}`);
      throw error;
    }
    
    return changedContacts;
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

  /**
   * Get frontmatter data from multiple files and create Contact objects
   * This method operates on multiple files, which is appropriate for ContactManager
   */
  async getFrontmatterFromFiles(files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    for (const file of files) {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({
          file,
          data: frontMatter,
        });
      }
    }
    return contactsData;
  }

  /**
   * Static version of getFrontmatterFromFiles for use in static contexts
   */
  static async getFrontmatterFromFilesStatic(app: App, files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    for (const file of files) {
      const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({
          file,
          data: frontMatter,
        });
      }
    }
    return contactsData;
  }

}