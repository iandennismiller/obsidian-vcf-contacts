import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';

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
   * Check if a file is a contact file based on plugin settings and UID presence
   */
  isContactFile(file: TFile | null): boolean {
    if (!file) return false;
    
    // First check if it's in the configured contacts folder
    const contactsFolder = this.settings.contactsFolder;
    if (contactsFolder) {
      // Normalize folder path - ensure it ends with /
      const normalizedFolder = contactsFolder.endsWith('/') ? contactsFolder : contactsFolder + '/';
      if (file.path.startsWith(normalizedFolder)) {
        return true;
      }
    } else {
      // If no contacts folder is configured, check common folder names for backward compatibility
      if (file.path.includes('Contacts/') || file.path.includes('contacts/')) {
        return true;
      }
    }
    
    // Check if it has a UID in front matter (regardless of location)
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID);
  }

  /**
   * Get all contact files from the vault using Obsidian API
   */
  getAllContactFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles().filter(file => this.isContactFile(file));
  }

  /**
   * Get all contact files from a specific folder using Obsidian API
   */
  getContactFilesFromFolder(folderPath?: string): TFile[] {
    const targetFolder = folderPath || this.settings.contactsFolder;
    
    if (!targetFolder) {
      // If no folder specified, return all contact files
      return this.getAllContactFiles();
    }

    // Use Obsidian API to get files from folder recursively
    const files = this.app.vault.getMarkdownFiles().filter(file => {
      // Normalize folder path for comparison
      const normalizedFolder = targetFolder.endsWith('/') ? targetFolder : targetFolder + '/';
      return file.path.startsWith(normalizedFolder) && this.isContactFile(file);
    });

    return files;
  }
}