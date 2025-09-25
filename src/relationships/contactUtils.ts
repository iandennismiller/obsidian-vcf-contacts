/**
 * Utilities for working with contact files and Obsidian integration
 */

import { App, TFile, TFolder, Vault } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { ContactNote, Gender } from './types';

export class ContactUtils {
  private app: App;
  private settings: ContactsPluginSettings;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Check if a file is in the contacts folder
   */
  isContactFile(file: TFile): boolean {
    return file.path.startsWith(this.settings.contactsFolder);
  }

  /**
   * Get all contact files from the contacts folder
   */
  getContactFiles(): TFile[] {
    const contactsFolder = this.app.vault.getAbstractFileByPath(this.settings.contactsFolder);
    if (!(contactsFolder instanceof TFolder)) {
      return [];
    }

    const contactFiles: TFile[] = [];
    Vault.recurseChildren(contactsFolder, (file) => {
      if (file instanceof TFile && file.extension === 'md') {
        contactFiles.push(file);
      }
    });

    return contactFiles;
  }

  /**
   * Extract UID from a contact file's front matter
   */
  extractUIDFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.UID || null;
  }

  /**
   * Extract full name from a contact file
   */
  extractFullNameFromFile(file: TFile): string {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontMatter = cache?.frontmatter;
    
    // Try to build full name from front matter
    if (frontMatter) {
      if (frontMatter.FN) return frontMatter.FN;
      
      const parts: string[] = [];
      if (frontMatter['N.PREFIX']) parts.push(frontMatter['N.PREFIX']);
      if (frontMatter['N.GN']) parts.push(frontMatter['N.GN']);
      if (frontMatter['N.MN']) parts.push(frontMatter['N.MN']);
      if (frontMatter['N.FN']) parts.push(frontMatter['N.FN']);
      if (frontMatter['N.SUFFIX']) parts.push(frontMatter['N.SUFFIX']);
      
      if (parts.length > 0) return parts.join(' ').trim();
    }
    
    // Fallback to file name (without extension)
    return file.basename;
  }

  /**
   * Extract gender from a contact file's front matter
   */
  extractGenderFromFile(file: TFile): Gender | undefined {
    const cache = this.app.metadataCache.getFileCache(file);
    const gender = cache?.frontmatter?.GENDER;
    
    if (gender && ['M', 'F', 'NB', 'U'].includes(gender)) {
      return gender as Gender;
    }
    
    return undefined;
  }

  /**
   * Find a contact file by UID
   */
  findContactByUID(uid: string): TFile | null {
    const contactFiles = this.getContactFiles();
    
    for (const file of contactFiles) {
      if (this.extractUIDFromFile(file) === uid) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Find a contact file by name (fuzzy match)
   */
  findContactByName(name: string): TFile | null {
    const contactFiles = this.getContactFiles();
    const normalizedSearchName = name.toLowerCase().trim();
    
    // First try exact match
    for (const file of contactFiles) {
      const fullName = this.extractFullNameFromFile(file);
      if (fullName.toLowerCase() === normalizedSearchName) {
        return file;
      }
    }
    
    // Then try basename match
    for (const file of contactFiles) {
      if (file.basename.toLowerCase() === normalizedSearchName) {
        return file;
      }
    }
    
    // Finally try partial match
    for (const file of contactFiles) {
      const fullName = this.extractFullNameFromFile(file);
      if (fullName.toLowerCase().includes(normalizedSearchName) ||
          file.basename.toLowerCase().includes(normalizedSearchName)) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Load a contact note with all its data
   */
  async loadContactNote(file: TFile): Promise<ContactNote | null> {
    if (!this.isContactFile(file)) {
      return null;
    }

    const uid = this.extractUIDFromFile(file);
    if (!uid) {
      return null;
    }

    const content = await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    const frontMatter = cache?.frontmatter || {};
    
    return {
      file,
      frontMatter,
      content,
      uid,
      fullName: this.extractFullNameFromFile(file),
      gender: this.extractGenderFromFile(file)
    };
  }

  /**
   * Update front matter of a contact file
   */
  async updateFrontMatter(file: TFile, updates: Record<string, any>): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
      Object.assign(frontMatter, updates);
    });
  }

  /**
   * Update content of a contact file
   */
  async updateContent(file: TFile, newContent: string): Promise<void> {
    await this.app.vault.modify(file, newContent);
  }

  /**
   * Generate a unique UID for a new contact
   */
  generateUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new contact file
   */
  async createContactFile(name: string, initialData?: Partial<ContactNote>): Promise<TFile | null> {
    const uid = this.generateUID();
    const fileName = this.sanitizeFileName(name);
    const filePath = `${this.settings.contactsFolder}/${fileName}.md`;
    
    // Check if file already exists
    if (await this.app.vault.adapter.exists(filePath)) {
      return null;
    }

    const frontMatter = {
      UID: uid,
      FN: name,
      VERSION: '4.0',
      ...initialData?.frontMatter
    };

    const content = this.generateContactContent(frontMatter, initialData?.content);
    
    try {
      const file = await this.app.vault.create(filePath, content);
      return file;
    } catch (error) {
      console.error('Failed to create contact file:', error);
      return null;
    }
  }

  /**
   * Generate contact file content with front matter
   */
  private generateContactContent(frontMatter: Record<string, any>, bodyContent?: string): string {
    const frontMatterLines = ['---'];
    
    for (const [key, value] of Object.entries(frontMatter)) {
      if (value !== undefined && value !== null && value !== '') {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    
    frontMatterLines.push('---');
    
    const body = bodyContent || '\n## Related\n\n';
    
    return frontMatterLines.join('\n') + '\n' + body;
  }

  /**
   * Sanitize a filename for Obsidian
   */
  private sanitizeFileName(name: string): string {
    // Replace invalid filename characters
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  /**
   * Check if a contact has any relationships in front matter
   */
  hasRelationshipsInFrontMatter(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return false;
    
    for (const key of Object.keys(cache.frontmatter)) {
      if (key.startsWith('RELATED[') || key === 'RELATED') {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get the currently active contact file (if any)
   */
  getCurrentContactFile(): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && this.isContactFile(activeFile)) {
      return activeFile;
    }
    return null;
  }
}