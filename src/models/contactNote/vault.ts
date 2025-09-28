/**
 * Handles all vault/file-related operations for contacts
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { GenderOperations, Gender } from './genderOperations';

export interface ResolvedContact {
  name: string;
  uid: string;
  file: TFile;
  gender: Gender;
}

export class VaultOperations {
  private app: App;
  private settings: ContactsPluginSettings;
  private file: TFile;
  private _content: string | null = null;

  constructor(app: App, settings: ContactsPluginSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    this.file = file;
  }

  /**
   * Get the file content, with caching
   */
  async getContent(): Promise<string> {
    if (this._content === null) {
      this._content = await this.app.vault.read(this.file);
    }
    return this._content;
  }

  /**
   * Invalidate content cache when file is modified externally
   */
  invalidateContentCache(): void {
    this._content = null;
  }

  /**
   * Find contact by name in the contacts folder
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
    const contactsFolder = this.settings.contactsFolder || '/';
    const contactFile = this.app.vault.getAbstractFileByPath(`${contactsFolder}/${contactName}.md`);
    
    if (contactFile && contactFile instanceof TFile) {
      return contactFile;
    }
    
    const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
    if (!folder || !('children' in folder)) {
      return null;
    }
    
    for (const child of (folder as any).children) {
      if (child && child instanceof TFile && child.basename === contactName) {
        return child;
      }
    }
    
    return null;
  }

  /**
   * Resolve contact information from contact name
   */
  async resolveContact(contactName: string, genderOps: GenderOperations): Promise<ResolvedContact | null> {
    const file = await this.findContactByName(contactName);
    if (!file) {
      return null;
    }
    
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    
    if (!frontmatter) {
      return null;
    }
    
    const uid = frontmatter.UID;
    if (!uid) {
      return null;
    }
    
    const genderValue = frontmatter.GENDER;
    const gender = genderValue ? genderOps.parseGender(genderValue) : null;
    
    return {
      name: contactName,
      uid,
      file,
      gender
    };
  }
}