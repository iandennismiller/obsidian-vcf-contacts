/**
 * Optimized ContactManager class with improved data locality.
 * Groups methods close to the data they operate on for better cache performance.
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';
import { Contact } from '../contactNote';

// Import the optimized components
import { ContactManagerData } from './contactManagerData';
import { ConsistencyOperations } from './consistencyOperations';

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
 * Optimized ContactManager class that groups operations by data locality.
 * Uses centralized ContactManagerData for better cache performance.
 */
export class ContactManager implements IContactManager {
  private managerData: ContactManagerData;
  private consistencyOps: ConsistencyOperations;

  constructor(app: App, settings: ContactsPluginSettings) {
    // Initialize centralized data store
    this.managerData = new ContactManagerData(app, settings);
    
    // Initialize operation groups that work with the centralized data
    this.consistencyOps = new ConsistencyOperations(this.managerData);
  }

  // === Settings Management (directly from ContactManagerData) ===

  /**
   * Update settings reference
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.managerData.updateSettings(settings);
  }

  /**
   * Get the effective contacts folder path
   */
  getContactsFolder(): string {
    return this.managerData.getContactsFolder();
  }

  // === File Operations (directly from ContactManagerData) ===

  /**
   * Extract UID from a contact file
   */
  async extractUIDFromFile(file: TFile): Promise<string | null> {
    return this.managerData.extractUIDFromFile(file);
  }

  /**
   * Find a contact file by its UID
   */
  async findContactFileByUID(uid: string): Promise<TFile | null> {
    return this.managerData.findContactFileByUID(uid, this.extractUIDFromFile.bind(this));
  }

  /**
   * Get all contact files from the vault
   */
  getAllContactFiles(): TFile[] {
    return this.managerData.getAllContactFiles(this.isContactFile.bind(this));
  }

  /**
   * Check if a file is a contact file
   */
  isContactFile(file: TFile): boolean {
    return this.managerData.isContactFile(file);
  }

  // === Cache Management (directly from ContactManagerData) ===

  /**
   * Initialize the cache of existing contact UIDs
   */
  async initializeCache(): Promise<void> {
    return this.managerData.initializeCache(this.extractUIDFromFile.bind(this));
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.managerData.clearCache();
  }

  /**
   * Check if a UID exists in the cache
   */
  hasUID(uid: string): boolean {
    return this.managerData.hasUID(uid);
  }

  /**
   * Add a contact file to the cache
   */
  addToCache(uid: string, file: TFile): void {
    this.managerData.addToCache(uid, file);
  }

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void {
    this.managerData.removeFromCache(uid);
  }

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void {
    this.managerData.updateCacheForRename(uid, newFile);
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { uidCount: number; fileCount: number } {
    return this.managerData.getCacheStats();
  }

  // === Event Management (directly from ContactManagerData) ===

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files
   */
  setupEventListeners(): void {
    this.managerData.setupEventListeners();
  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void {
    this.managerData.cleanupEventListeners();
  }

  /**
   * Get the currently active file
   */
  getCurrentActiveFile(): TFile | null {
    return this.managerData.getCurrentActiveFile();
  }

  // === Data Consistency Operations (delegated to ConsistencyOperations) ===

  /**
   * Ensure consistency of contact data by processing through insight processors
   */
  async ensureContactDataConsistency(maxIterations?: number): Promise<void> {
    return this.consistencyOps.ensureContactDataConsistency(maxIterations);
  }

  /**
   * Validate contact data integrity
   */
  async validateContactIntegrity(): Promise<{ 
    isValid: boolean; 
    issues: string[]; 
    recommendations: string[] 
  }> {
    return this.consistencyOps.validateContactIntegrity();
  }

  // === Utility Operations (for backward compatibility) ===

  /**
   * Find all contact files in a folder
   */
  findContactFiles(contactsFolder: any): TFile[] {
    // Legacy method - use getAllContactFiles for better performance
    return this.getAllContactFiles().filter(file => 
      file.path.startsWith(contactsFolder.path || contactsFolder)
    );
  }

  /**
   * Get frontmatter data from multiple files and create Contact objects
   */
  async getFrontmatterFromFiles(files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    const app = this.managerData.getApp();
    
    for (const file of files) {
      const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({
          file: file,
          data: frontMatter
        });
      }
    }
    return contactsData;
  }

  // === Debug and Utility Operations ===

  /**
   * Get comprehensive status for debugging
   */
  getManagerStatus(): { 
    cacheStats: { uidCount: number; fileCount: number };
    contactFileCount: number;
    contactsFolder: string;
    hasActiveFile: boolean;
  } {
    return {
      cacheStats: this.managerData.getCacheStats(),
      contactFileCount: this.managerData.getAllContactFiles().length,
      contactsFolder: this.managerData.getContactsFolder(),
      hasActiveFile: this.managerData.getCurrentActiveFile() !== null
    };
  }

  /**
   * Force cache refresh
   */
  async refreshCache(): Promise<void> {
    this.clearCache();
    await this.initializeCache();
  }

  /**
   * Invalidate all internal caches
   */
  invalidateAllCaches(): void {
    this.managerData.invalidateAllCaches();
  }

  // ============================================================================
  // VCF Processing and Contact Creation Methods
  // ============================================================================

  /**
   * Processes VCF contact records and creates/updates contacts as needed.
   * 
   * This method handles the contact creation and processing logic that was
   * previously duplicated in syncWatcher. It takes parsed VCF records and
   * either finds existing contacts or creates new ones.
   * 
   * @param vcfEntries - Array of [slug, record] tuples from VCF parsing
   * @param app - Obsidian App instance for file operations
   * @param settings - Plugin settings for contact creation
   * @returns Promise resolving to array of TFile objects that need processing
   */
  async processVCFContacts(
    vcfEntries: Array<[string, any]>, 
    app: import('obsidian').App, 
    settings: ContactsPluginSettings
  ): Promise<import('obsidian').TFile[]> {
    const contactsToProcess: import('obsidian').TFile[] = [];

    for (const [slug, record] of vcfEntries) {
      if (slug && record.UID) {
        const existingFile = await this.findContactFileByUID(record.UID);
        
        if (existingFile) {
          // Contact exists - add to processing list
          contactsToProcess.push(existingFile);
        } else {
          // New contact - create it and add to processing list
          const newFile = await this.createContactFromVCF(slug, record, app, settings);
          if (newFile) {
            contactsToProcess.push(newFile);
          }
        }
      }
    }

    return contactsToProcess;
  }

  /**
   * Creates a new contact file from VCF record data.
   * 
   * This method encapsulates the contact creation logic that was previously
   * duplicated in syncWatcher. It handles markdown generation and file creation.
   * 
   * @param slug - URL-friendly identifier for the contact
   * @param record - VCF record data
   * @param app - Obsidian App instance for file operations  
   * @param settings - Plugin settings for contact creation
   * @returns Promise resolving to created TFile or null if creation failed
   */
  async createContactFromVCF(
    slug: string, 
    record: any, 
    app: import('obsidian').App, 
    settings: ContactsPluginSettings
  ): Promise<import('obsidian').TFile | null> {
    try {
      // Import ContactNote here to avoid circular dependencies
      const { ContactNote } = await import('../contactNote');
      const { ContactManagerUtils } = await import('./contactManagerUtils');
      
      const contactNote = new ContactNote(app, settings, null as any);
      const mdContent = contactNote.mdRender(record, settings.defaultHashtag);
      const filename = slug + '.md';
      
      await ContactManagerUtils.createContactFile(app, settings.contactsFolder, mdContent, filename);
      
      // Find the newly created file
      const newFile = await this.findContactFileByUID(record.UID);
      if (newFile) {
        console.log(`[ContactManager] Created new contact: ${newFile.basename}`);
        return newFile;
      }
      
      return null;
    } catch (error) {
      console.log(`[ContactManager] Failed to create contact ${slug}: ${error.message}`);
      return null;
    }
  }
}