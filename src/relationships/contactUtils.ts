import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { loggingService } from '../services/loggingService';

/**
 * Centralized utilities for contact file detection and management
 */
export class ContactUtils {
  private app: App;
  private settings: ContactsPluginSettings;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Get the effective contacts folder path (same logic as VcfFolderWatcher)
   */
  private getContactsFolder(): string {
    return this.settings.contactsFolder || '/';
  }

  /**
   * Extract UID from a file using metadata cache (reuses VcfFolderWatcher pattern)
   */
  extractUIDFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;
    return uid || null;
  }

  /**
   * Check if a file is a contact file based on plugin settings and UID presence
   */
  isContactFile(file: TFile | null): boolean {
    if (!file) return false;
    
    // Use same folder logic as VcfFolderWatcher for consistency
    const contactsFolder = this.getContactsFolder();
    
    // Check if file is in the configured contacts folder
    if (contactsFolder !== '/' && file.path.startsWith(contactsFolder)) {
      return true;
    }
    
    // For vault root or legacy setups, check common folder patterns
    if (contactsFolder === '/' && (file.path.includes('Contacts/') || file.path.includes('contacts/'))) {
      return true;
    }
    
    // Check if it has a UID in front matter (regardless of location)
    return !!this.extractUIDFromFile(file);
  }

  /**
   * Get all contact files from the vault using Obsidian API (with logging like VcfFolderWatcher)
   */
  getAllContactFiles(): TFile[] {
    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
    loggingService.debug(`[ContactUtils] Total markdown files in vault: ${allMarkdownFiles.length}`);
    
    const contactFiles = allMarkdownFiles.filter(file => this.isContactFile(file));
    loggingService.debug(`[ContactUtils] Contact files found: ${contactFiles.length}`);
    
    if (contactFiles.length === 0) {
      const contactsFolder = this.getContactsFolder();
      loggingService.warning(`[ContactUtils] No contact files found. Contacts folder: "${contactsFolder}". Check folder setting or ensure files have UIDs in front matter.`);
    }
    
    return contactFiles;
  }

  /**
   * Get all contact files from a specific folder using Obsidian API (reuses VcfFolderWatcher pattern)
   */
  getContactFilesFromFolder(folderPath?: string): TFile[] {
    const targetFolder = folderPath || this.getContactsFolder();
    
    if (!targetFolder || targetFolder === '/') {
      // If no specific folder, return all contact files
      return this.getAllContactFiles();
    }

    // Use same filtering approach as VcfFolderWatcher
    const files = this.app.vault.getMarkdownFiles().filter(file => {
      return file.path.startsWith(targetFolder) && this.isContactFile(file);
    });

    loggingService.debug(`[ContactUtils] Found ${files.length} contact files in folder "${targetFolder}"`);
    return files;
  }
}