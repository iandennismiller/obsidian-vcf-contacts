import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { loggingService } from '../services/loggingService';

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
}