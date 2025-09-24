import { App, TFile } from 'obsidian';
import { loggingService } from '../services/loggingService';
import { ContactsPluginSettings } from '../settings/settings.d';

/**
 * Utilities for contact resolution and management
 */
export class ContactUtils {
  private app: App;
  private settings: ContactsPluginSettings;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
  }

  /**
   * Extract UID from a contact file
   */
  extractUIDFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.UID) {
      return null;
    }
    return cache.frontmatter.UID;
  }

  /**
   * Get contact name from file (either from front matter FN or filename)
   */
  getContactName(file: TFile): string {
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Try to get name from front matter first
    if (cache?.frontmatter?.FN) {
      return cache.frontmatter.FN;
    }
    
    // Fall back to filename without extension
    return file.basename;
  }

  /**
   * Find all contact files in the contacts folder
   */
  getContactFiles(): TFile[] {
    if (!this.settings.contactsFolder || this.settings.contactsFolder.trim() === '') {
      loggingService.warn('[ContactUtils] No contacts folder specified in settings');
      return [];
    }

    const contactsFolder = this.app.vault.getAbstractFileByPath(this.settings.contactsFolder);
    if (!contactsFolder) {
      loggingService.warn(`[ContactUtils] Contacts folder not found: ${this.settings.contactsFolder}`);
      return [];
    }

    const contactFiles: TFile[] = [];
    
    // Recursively find all markdown files in the contacts folder
    const processFolder = (folder: any) => {
      if (!folder.children) return;
      
      for (const child of folder.children) {
        if (child.children) {
          // It's a subfolder
          processFolder(child);
        } else if (child instanceof TFile && child.extension === 'md') {
          // It's a markdown file
          const cache = this.app.metadataCache.getFileCache(child);
          if (cache?.frontmatter?.UID) {
            // Has UID, so it's a contact file
            contactFiles.push(child);
          }
        }
      }
    };

    processFolder(contactsFolder);
    loggingService.info(`[ContactUtils] Found ${contactFiles.length} contact files`);
    return contactFiles;
  }

  /**
   * Find a contact by name
   */
  findContactByName(name: string): TFile | null {
    const contactFiles = this.getContactFiles();
    
    for (const file of contactFiles) {
      const contactName = this.getContactName(file);
      if (contactName === name) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Find a contact by UID
   */
  findContactByUID(uid: string): TFile | null {
    const contactFiles = this.getContactFiles();
    
    for (const file of contactFiles) {
      const fileUID = this.extractUIDFromFile(file);
      if (fileUID === uid) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Check if a file is in the contacts folder
   */
  isContactFile(file: TFile): boolean {
    if (!this.settings.contactsFolder) {
      return false;
    }
    
    // Check if file path starts with contacts folder path
    const contactsFolderPath = this.settings.contactsFolder.endsWith('/') 
      ? this.settings.contactsFolder 
      : this.settings.contactsFolder + '/';
    
    return file.path.startsWith(contactsFolderPath) && 
           file.extension === 'md' && 
           this.extractUIDFromFile(file) !== null;
  }

  /**
   * Generate a unique UID for a new contact
   */
  generateUID(): string {
    // Generate a simple UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Create a new contact file stub
   */
  async createContactStub(name: string): Promise<TFile | null> {
    if (!this.settings.contactsFolder) {
      loggingService.error('[ContactUtils] Cannot create contact stub: no contacts folder configured');
      return null;
    }

    // Generate UID and file path
    const uid = this.generateUID();
    const fileName = `${name}.md`;
    const filePath = `${this.settings.contactsFolder}/${fileName}`;

    // Check if file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      loggingService.warn(`[ContactUtils] Contact file already exists: ${filePath}`);
      return existingFile as TFile;
    }

    // Create the file with basic front matter
    const frontMatter = [
      '---',
      `UID: ${uid}`,
      `FN: ${name}`,
      `REV: ${new Date().toISOString()}`,
      '---',
      '',
      `# ${name}`,
      ''
    ].join('\n');

    try {
      const file = await this.app.vault.create(filePath, frontMatter);
      loggingService.info(`[ContactUtils] Created contact stub: ${filePath}`);
      return file;
    } catch (error) {
      loggingService.error(`[ContactUtils] Failed to create contact stub: ${error}`);
      return null;
    }
  }

  /**
   * Get contact's gender from front matter
   */
  getContactGender(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.GENDER || null;
  }

  /**
   * Check if two contact names might refer to the same person
   */
  isNameMatch(name1: string, name2: string): boolean {
    // Simple exact match for now
    // Could be enhanced with fuzzy matching in the future
    return name1.trim().toLowerCase() === name2.trim().toLowerCase();
  }
}