/**
 * Central data holder for ContactManager with optimized data locality.
 * Groups all contact management data in one place to minimize cache misses.
 */

import { App, TFile, EventRef, WorkspaceLeaf } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';

/**
 * Centralized contact manager data storage that keeps related data together
 * for optimal cache locality and performance.
 */
export class ContactManagerData {
  // Core data - kept together for cache locality
  private app: App;
  private settings: ContactsPluginSettings;
  
  // Cache data - co-located for better memory access patterns
  private existingUIDs = new Set<string>();
  private contactFiles = new Map<string, TFile>(); // UID -> TFile mapping
  private _contactFilesCache: TFile[] | null = null;
  
  // Event handling data - grouped with event operations
  private eventRef: EventRef | null = null;
  private currentActiveFile: TFile | null = null;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  // === Core Access Methods (grouped with core data) ===

  getApp(): App {
    return this.app;
  }

  getSettings(): ContactsPluginSettings {
    return this.settings;
  }

  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
    // Invalidate caches that depend on settings
    this._contactFilesCache = null;
  }

  getContactsFolder(): string {
    return this.settings.contactsFolder || '/';
  }

  // === Cache Operations (co-located with cache data) ===

  /**
   * Initialize the cache - groups cache operations with cache data
   */
  async initializeCache(extractUIDFromFile: (file: TFile) => Promise<string | null>): Promise<void> {
    this.existingUIDs.clear();
    this.contactFiles.clear();

    try {
      console.log('[ContactManagerData] Building UID cache...');

      const contactsFolder = this.getContactsFolder();

      // Check if the contacts folder exists
      const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
      if (!folder) {
        console.log(`[ContactManagerData] Contacts folder not found: ${contactsFolder}`);
        return;
      }

      const allMarkdownFiles = this.app.vault.getMarkdownFiles();
      
      // Filter files in the contacts folder
      const files = allMarkdownFiles.filter(file => 
        file.path.startsWith(contactsFolder)
      );

      console.log(`[ContactManagerData] Found ${files.length} files in contacts folder`);
      
      // Extract UIDs from each file and build cache
      for (const file of files) {
        const uid = await extractUIDFromFile(file);

        if (uid) {
          this.existingUIDs.add(uid);
          this.contactFiles.set(uid, file);
          console.log(`[ContactManagerData] Cached UID "${uid}" -> ${file.path}`);
        }
      }

      console.log(`[ContactManagerData] Cache built with ${this.existingUIDs.size} UIDs`);
    } catch (error: any) {
      console.log(`[ContactManagerData] Failed to build UID cache: ${error.message}`);
    }
  }

  /**
   * Clear cache - co-located with cache data
   */
  clearCache(): void {
    this.existingUIDs.clear();
    this.contactFiles.clear();
    this._contactFilesCache = null;
    console.log('[ContactManagerData] Cache cleared');
  }

  /**
   * Check if UID exists - cache operation grouped with cache data
   */
  hasUID(uid: string): boolean {
    return this.existingUIDs.has(uid);
  }

  /**
   * Add to cache - cache operation grouped with cache data
   */
  addToCache(uid: string, file: TFile): void {
    this.existingUIDs.add(uid);
    this.contactFiles.set(uid, file);
    this._contactFilesCache = null; // Invalidate cache
    console.log(`[ContactManagerData] Added to cache: UID "${uid}" -> ${file.path}`);
  }

  /**
   * Remove from cache - cache operation grouped with cache data
   */
  removeFromCache(uid: string): void {
    this.existingUIDs.delete(uid);
    this.contactFiles.delete(uid);
    this._contactFilesCache = null; // Invalidate cache
    console.log(`[ContactManagerData] Removed from cache: UID "${uid}"`);
  }

  /**
   * Update cache for rename - cache operation grouped with cache data
   */
  updateCacheForRename(uid: string, newFile: TFile): void {
    if (this.existingUIDs.has(uid)) {
      this.contactFiles.set(uid, newFile);
      this._contactFilesCache = null; // Invalidate cache
      console.log(`[ContactManagerData] Updated cache for rename: UID "${uid}" -> ${newFile.path}`);
    }
  }

  /**
   * Get cached file by UID - cache access grouped with cache data
   */
  getCachedFile(uid: string): TFile | undefined {
    return this.contactFiles.get(uid);
  }

  /**
   * Get all cached files - cache access grouped with cache data
   */
  getAllCachedFiles(): TFile[] {
    return Array.from(this.contactFiles.values());
  }

  /**
   * Get cache statistics - cache introspection grouped with cache data
   */
  getCacheStats(): { uidCount: number; fileCount: number } {
    return {
      uidCount: this.existingUIDs.size,
      fileCount: this.contactFiles.size
    };
  }

  // === File Operations (co-located with file access patterns) ===

  /**
   * Extract UID from file - file operation grouped with data access
   */
  async extractUIDFromFile(file: TFile): Promise<string | null> {
    try {
      // Try metadata cache first (most efficient)
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (uid) {
        console.log(`[ContactManagerData] Extracted UID "${uid}" from ${file.path} via metadata cache`);
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
            console.log(`[ContactManagerData] Extracted UID "${extractedUID}" from ${file.path} via file parsing`);
            return extractedUID;
          }
        }
      } catch (readError) {
        console.log(`[ContactManagerData] Error reading file for UID extraction: ${readError}`);
      }

      return null;
    } catch (error: any) {
      console.log(`[ContactManagerData] Error extracting UID from ${file.path}: ${error.message}`);
      return null;
    }
  }

  /**
   * Find contact file by UID - search operation grouped with cache access
   */
  async findContactFileByUID(uid: string, extractUIDCallback?: (file: TFile) => Promise<string | null>): Promise<TFile | null> {
    console.log(`[ContactManagerData] Looking for contact with UID: "${uid}"`);
    
    // Use the callback if provided, otherwise use internal method
    const extractUID = extractUIDCallback || this.extractUIDFromFile.bind(this);
    
    // First check the cached contactFiles map
    const cachedFile = this.getCachedFile(uid);
    if (cachedFile) {
      console.log(`[ContactManagerData] Found cached file for UID "${uid}": ${cachedFile.path}`);
      // Verify the file still exists and has the correct UID
      const fileUID = await extractUID(cachedFile);
      
      if (fileUID === uid) {
        console.log(`[ContactManagerData] Cache hit confirmed for UID "${uid}"`);
        return cachedFile;
      } else {
        console.log(`[ContactManagerData] Cache stale for UID "${uid}", removing from cache`);
        // Cache is stale, remove this entry
        this.removeFromCache(uid);
      }
    }
    
    // Fallback: scan all files in the contacts folder
    try {
      console.log(`[ContactManagerData] Cache miss for UID "${uid}", scanning all files...`);
      
      const contactsFolder = this.getContactsFolder();
      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );
      
      console.log(`[ContactManagerData] Scanning ${files.length} files for UID "${uid}"`);
      
      for (const file of files) {
        const fileUID = await extractUID(file);
        
        if (fileUID === uid) {
          console.log(`[ContactManagerData] Found match for UID "${uid}": ${file.path}`);
          // Add to cache for future lookups
          this.addToCache(uid, file);
          return file;
        }
      }
      
      console.log(`[ContactManagerData] No contact found with UID "${uid}"`);
      return null;
    } catch (error: any) {
      console.log(`[ContactManagerData] Error finding contact file by UID: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all contact files - file enumeration grouped with file operations
   */
  getAllContactFiles(isContactFileCallback?: (file: TFile) => boolean): TFile[] {
    if (this._contactFilesCache !== null) {
      return this._contactFilesCache;
    }

    const contactsFolder = this.getContactsFolder();
    const isContactFile = isContactFileCallback || this.isContactFile.bind(this);

    if (!contactsFolder || contactsFolder === '/') {
      // Search entire vault if no specific contacts folder
      const allFiles = this.app.vault.getMarkdownFiles();
      this._contactFilesCache = allFiles.filter(file => isContactFile(file));
    } else {
      // Filter files in the specific contacts folder
      const files = this.app.vault.getMarkdownFiles().filter(file => {
        return file.path.startsWith(contactsFolder) && isContactFile(file);
      });
      this._contactFilesCache = files;
    }

    return this._contactFilesCache;
  }

  /**
   * Check if file is contact file - file detection grouped with file operations
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

  // === Event Operations (co-located with event data) ===

  /**
   * Setup event listeners - event operation grouped with event data
   */
  setupEventListeners(): void {
    if (this.eventRef) {
      // Already set up
      return;
    }

    this.eventRef = this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
      this.handleActiveLeafChange(leaf);
    });

    console.log('[ContactManagerData] Event listeners set up');
  }

  /**
   * Cleanup event listeners - event operation grouped with event data
   */
  cleanupEventListeners(): void {
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;
      console.log('[ContactManagerData] Event listeners cleaned up');
    }
  }

  /**
   * Handle active leaf change - event handler grouped with event data
   */
  private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    // Check if the view has a file property (duck typing for MarkdownView)
    const newActiveFile = (leaf?.view && 'file' in leaf.view) ? (leaf.view as any).file : null;
    this.currentActiveFile = newActiveFile;
  }

  /**
   * Get current active file - event state access grouped with event data
   */
  getCurrentActiveFile(): TFile | null {
    return this.currentActiveFile;
  }

  // === Cache Invalidation Operations ===

  /**
   * Invalidate all caches when external changes occur
   */
  invalidateAllCaches(): void {
    this._contactFilesCache = null;
  }
}