/**
 * ContactResolver Service
 * 
 * Centralized service for resolving contacts by name, UID, or other identifiers.
 * Handles all contact lookup operations across the vault.
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { Gender } from '../types';

/**
 * Resolved contact information
 */
export interface ResolvedContact {
  name: string;
  uid: string;
  file: TFile;
  gender: Gender;
}

/**
 * Contact resolver service for finding and resolving contacts
 */
export class ContactResolver {
  /**
   * Find a contact file by name in the contacts folder
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param contactName - Name of the contact to find
   * @returns Contact file or null if not found
   */
  static async findByName(
    app: App, 
    settings: ContactsPluginSettings, 
    contactName: string
  ): Promise<TFile | null> {
    try {
      const contactsFolder = settings.contactsFolder || 'Contacts';
      
      // Normalize the contact name
      const normalizedContactName = contactName.toLowerCase().replace(/\s+/g, '-');
      const contactFile = app.vault.getAbstractFileByPath(`${contactsFolder}/${normalizedContactName}.md`);
      
      if (contactFile && 'path' in contactFile && 'basename' in contactFile) {
        return contactFile as TFile;
      }

      // Search for file in contacts folder
      const allFiles = app.vault.getMarkdownFiles();
      const matchingFiles = allFiles.filter(file => {
        const normalizedBasename = file.basename.toLowerCase().replace(/\s+/g, '-');
        return normalizedBasename === normalizedContactName &&
          file.path.startsWith(contactsFolder);
      });

      return matchingFiles.length > 0 ? matchingFiles[0] : null;
    } catch (error: any) {
      console.error('Error finding contact by name:', error);
      return null;
    }
  }

  /**
   * Find a contact by UID across all markdown files
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param uid - UID to search for
   * @returns Contact file and frontmatter, or null if not found
   */
  static async findByUID(
    app: App,
    settings: ContactsPluginSettings,
    uid: string
  ): Promise<{ file: TFile; frontmatter: any } | null> {
    const allFiles = app.vault.getMarkdownFiles();
    const contactsFolder = settings.contactsFolder || 'Contacts';
    
    for (const file of allFiles) {
      if (!file.path.startsWith(contactsFolder)) continue;
      
      const cache = app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID === uid) {
        return { file, frontmatter: cache.frontmatter };
      }
    }
    
    return null;
  }

  /**
   * Resolve contact file by UID - returns just the TFile
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param uid - UID to resolve
   * @returns Contact file or null if not found
   */
  static async resolveFileByUID(
    app: App,
    settings: ContactsPluginSettings,
    uid: string
  ): Promise<TFile | null> {
    const result = await ContactResolver.findByUID(app, settings, uid);
    return result?.file || null;
  }

  /**
   * Resolve contact name by UID
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param uid - UID to resolve
   * @returns Contact name or null if not found
   */
  static async resolveNameByUID(
    app: App,
    settings: ContactsPluginSettings,
    uid: string
  ): Promise<string | null> {
    const result = await ContactResolver.findByUID(app, settings, uid);
    if (!result) return null;
    
    return result.frontmatter?.FN || result.file.basename;
  }

  /**
   * Resolve full contact information by name
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param contactName - Name of contact to resolve
   * @param getContactData - Function to extract UID and gender from file
   * @returns Resolved contact information or null if not found
   */
  static async resolveByName(
    app: App,
    settings: ContactsPluginSettings,
    contactName: string,
    getContactData: (file: TFile) => Promise<{ uid: string | null; gender: Gender }>
  ): Promise<ResolvedContact | null> {
    const file = await ContactResolver.findByName(app, settings, contactName);
    if (!file) return null;
    
    try {
      const data = await getContactData(file);
      
      return {
        name: contactName,
        uid: data.uid || '',
        file: file,
        gender: data.gender
      };
    } catch (error: any) {
      console.debug(`[ContactResolver] Error resolving contact ${contactName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper method to search for contact by UID (legacy compatibility)
   * Returns name and file
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param uid - UID to search for
   * @param getContactName - Function to extract contact name from file
   * @returns Contact name and file, or null if not found
   */
  static async searchByUID(
    app: App,
    settings: ContactsPluginSettings,
    uid: string,
    getContactName: (file: TFile, frontmatter: any) => Promise<string>
  ): Promise<{ name: string; file: TFile } | null> {
    const allFiles = app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      try {
        const cache = app.metadataCache.getFileCache(file);
        const fileUid = cache?.frontmatter?.UID;
        
        if (fileUid === uid) {
          const frontmatter = cache.frontmatter;
          const contactName = await getContactName(file, frontmatter);
          
          return {
            name: contactName,
            file: file
          };
        }
      } catch (error: any) {
        continue;
      }
    }

    return null;
  }
}
