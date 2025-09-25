import { App, TFile, TFolder } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';

/**
 * Utility class for working with contact files
 */
export class ContactUtils {
  private app: App;
  private settings: ContactsPluginSettings;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Get all contact files from the contacts folder
   */
  getAllContactFiles(): TFile[] {
    const contactsFolder = this.settings.contactsFolder || 'contacts';
    const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
    
    if (!folder || !(folder instanceof TFolder)) {
      return [];
    }

    const contactFiles: TFile[] = [];
    
    // Recursively find all markdown files in the contacts folder
    const findMarkdownFiles = (currentFolder: TFolder) => {
      for (const child of currentFolder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          const cache = this.app.metadataCache.getFileCache(child);
          // Only include files that have a UID in frontmatter (indicating they are contacts)
          if (cache?.frontmatter?.UID) {
            contactFiles.push(child);
          }
        } else if (child instanceof TFolder) {
          findMarkdownFiles(child);
        }
      }
    };

    findMarkdownFiles(folder);
    return contactFiles;
  }

  /**
   * Find a contact file by UID
   */
  findContactFileByUID(uid: string): TFile | null {
    const contactFiles = this.getAllContactFiles();
    
    for (const file of contactFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID === uid) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Find contact files by name (fuzzy matching)
   */
  findContactFilesByName(name: string): TFile[] {
    const contactFiles = this.getAllContactFiles();
    const normalizedSearchName = name.toLowerCase().trim();
    const matches: TFile[] = [];
    
    for (const file of contactFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fullName = cache?.frontmatter?.FN;
      
      if (fullName && fullName.toLowerCase().includes(normalizedSearchName)) {
        matches.push(file);
      }
    }
    
    return matches.sort((a, b) => {
      const aName = this.app.metadataCache.getFileCache(a)?.frontmatter?.FN || '';
      const bName = this.app.metadataCache.getFileCache(b)?.frontmatter?.FN || '';
      return aName.localeCompare(bName);
    });
  }

  /**
   * Check if a file is a contact file
   */
  isContactFile(file: TFile): boolean {
    if (file.extension !== 'md') return false;
    
    const cache = this.app.metadataCache.getFileCache(file);
    return !!(cache?.frontmatter?.UID);
  }

  /**
   * Get contact name from file
   */
  getContactName(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.FN || null;
  }

  /**
   * Get contact UID from file
   */
  getContactUID(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.UID || null;
  }

  /**
   * Get contact gender from file
   */
  getContactGender(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.GENDER || null;
  }
}