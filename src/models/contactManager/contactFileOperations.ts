import { App, TFile, TFolder, Vault } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { ContactCache } from './contactCache';

/**
 * Handles contact file operations including UID extraction, file detection, and file retrieval.
 */
export class ContactFileOperations {
  private app: App;
  private settings: ContactsPluginSettings;
  private cache: ContactCache;

  constructor(app: App, settings: ContactsPluginSettings, cache: ContactCache) {
    this.app = app;
    this.settings = settings;
    this.cache = cache;
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
        console.log(`[ContactFileOperations] Extracted UID "${uid}" from ${file.path} via metadata cache`);
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
            console.log(`[ContactFileOperations] Extracted UID "${extractedUID}" from ${file.path} via file parsing`);
            return extractedUID;
          }
        }
      } catch (readError) {
        console.log(`[ContactFileOperations] Error reading file for UID extraction: ${readError}`);
      }

      return null;
    } catch (error: any) {
      console.log(`[ContactFileOperations] Error extracting UID from ${file.path}: ${error.message}`);
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
    console.log(`[ContactFileOperations] Looking for contact with UID: "${uid}"`);
    
    // First check the cached contactFiles map
    const cachedFile = this.cache.getCachedFile(uid);
    if (cachedFile) {
      console.log(`[ContactFileOperations] Found cached file for UID "${uid}": ${cachedFile.path}`);
      // Verify the file still exists and has the correct UID
      const fileUID = await this.extractUIDFromFile(cachedFile);
      
      if (fileUID === uid) {
        console.log(`[ContactFileOperations] Cache hit confirmed for UID "${uid}"`);
        return cachedFile;
      } else {
        console.log(`[ContactFileOperations] Cache stale for UID "${uid}", removing from cache`);
        // Cache is stale, remove this entry
        this.cache.removeFromCache(uid);
      }
    }
    
    // Fallback: scan all files in the contacts folder
    try {
      console.log(`[ContactFileOperations] Cache miss for UID "${uid}", scanning all files...`);
      
      const contactsFolder = this.getContactsFolder();
      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );
      
      console.log(`[ContactFileOperations] Scanning ${files.length} files for UID "${uid}"`);
      
      for (const file of files) {
        const fileUID = await this.extractUIDFromFile(file);
        
        if (fileUID === uid) {
          console.log(`[ContactFileOperations] Found match for UID "${uid}": ${file.path}`);
          // Add to cache for future lookups
          this.cache.addToCache(uid, file);
          return file;
        }
      }
      
      console.log(`[ContactFileOperations] No contact found with UID "${uid}"`);
      return null;
    } catch (error: any) {
      console.log(`[ContactFileOperations] Error finding contact file by UID: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all contact files from the vault using Obsidian API
   * Reuses pattern from ContactUtils but with ContactManager context
   */
  getAllContactFiles(): TFile[] {
    const contactsFolder = this.getContactsFolder();

    if (!contactsFolder || contactsFolder === '/') {
      // Search entire vault if no specific contacts folder
      const allFiles = this.app.vault.getMarkdownFiles();
      return allFiles.filter(file => this.isContactFile(file));
    }

    // Filter files in the specific contacts folder
    const files = this.app.vault.getMarkdownFiles().filter(file => {
      return file.path.startsWith(contactsFolder) && this.isContactFile(file);
    });

    return files;
  }

  /**
   * Check if a file is a contact file based on having UID in frontmatter and folder location
   */
  isContactFile(file: TFile): boolean {
    if (!file) return false;

    // Check if file is in the contacts folder (if specified)
    const contactsFolder = this.getContactsFolder();
    if (contactsFolder !== '/' && !file.path.startsWith(contactsFolder)) {
      return false;
    }

    // Check if the file has UID in frontmatter (indicates it's a contact)
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID);
  }

  /**
   * Find all contact files in a folder
   * Migrated from src/file/file.ts
   */
  findContactFiles(contactsFolder: TFolder): TFile[] {
    const contactFiles: TFile[] = [];
    Vault.recurseChildren(contactsFolder, async (contactNote) => {
      if (contactNote instanceof TFile) {
        if (this.isContactFile(contactNote)) {
          contactFiles.push(contactNote);
        }
      }
    });
    return contactFiles;
  }
}