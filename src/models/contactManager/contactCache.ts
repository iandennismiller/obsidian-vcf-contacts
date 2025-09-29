import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';

/**
 * Manages the cache of contact UIDs and file mappings for fast lookups.
 * Handles initialization, updates, and cleanup of the contact cache.
 */
export class ContactCache {
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
  private getContactsFolder(): string {
    return this.settings.contactsFolder || '/';
  }

  /**
   * Initialize the cache of existing contact UIDs from the Obsidian contacts folder.
   * 
   * Scans all markdown files in the contacts folder and builds:
   * - A set of existing UIDs for duplicate detection
   * - A map of UIDs to TFile objects for quick lookups
   * 
   * @param extractUIDFromFile - Function to extract UID from a file
   * @returns Promise that resolves when the UID cache is built
   */
  async initializeCache(extractUIDFromFile: (file: TFile) => Promise<string | null>): Promise<void> {
    this.existingUIDs.clear();
    this.contactFiles.clear();

    try {
      console.log('[ContactCache] Building UID cache...');

      const contactsFolder = this.getContactsFolder();

      // Check if the contacts folder exists
      const folder = this.app.vault.getAbstractFileByPath(contactsFolder);

      if (!folder) {
        console.log(`[ContactCache] Contacts folder not found: ${contactsFolder}`);
        return;
      }

      const allMarkdownFiles = this.app.vault.getMarkdownFiles();

      // Filter files in the contacts folder
      const files = allMarkdownFiles.filter(file => 
        file.path.startsWith(contactsFolder)
      );

      console.log(`[ContactCache] Found ${files.length} files in contacts folder`);
      
      // Extract UIDs from each file and build cache
      for (const file of files) {
        const uid = await extractUIDFromFile(file);

        if (uid) {
          this.existingUIDs.add(uid);
          this.contactFiles.set(uid, file);
          console.log(`[ContactCache] Cached UID "${uid}" -> ${file.path}`);
        }
      }

      console.log(`[ContactCache] Cache built with ${this.existingUIDs.size} UIDs`);
    } catch (error: any) {
      console.log(`[ContactCache] Failed to build UID cache: ${error.message}`);
    }
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.existingUIDs.clear();
    this.contactFiles.clear();
    console.log('[ContactCache] Cache cleared');
  }

  /**
   * Check if a UID exists in the cache
   */
  hasUID(uid: string): boolean {
    return this.existingUIDs.has(uid);
  }

  /**
   * Add a contact file to the cache
   */
  addToCache(uid: string, file: TFile): void {
    this.existingUIDs.add(uid);
    this.contactFiles.set(uid, file);
    console.log(`[ContactCache] Added to cache: UID "${uid}" -> ${file.path}`);
  }

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void {
    this.existingUIDs.delete(uid);
    this.contactFiles.delete(uid);
    console.log(`[ContactCache] Removed from cache: UID "${uid}"`);
  }

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void {
    if (this.existingUIDs.has(uid)) {
      this.contactFiles.set(uid, newFile);
      console.log(`[ContactCache] Updated cache for rename: UID "${uid}" -> ${newFile.path}`);
    }
  }

  /**
   * Get a cached file by UID
   */
  getCachedFile(uid: string): TFile | undefined {
    return this.contactFiles.get(uid);
  }

  /**
   * Get all cached contact files
   */
  getAllCachedFiles(): TFile[] {
    return Array.from(this.contactFiles.values());
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