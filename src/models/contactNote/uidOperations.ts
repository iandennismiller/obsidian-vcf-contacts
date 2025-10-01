/**
 * UID-based operations for contact resolution and conflict detection
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { ContactData } from './contactData';

/**
 * Operations for UID-based contact resolution and management
 */
export class UIDOperations {
  private app: App;
  private settings: ContactsPluginSettings;
  private contactData: ContactData;

  constructor(app: App, settings: ContactsPluginSettings, contactData: ContactData) {
    this.app = app;
    this.settings = settings;
    this.contactData = contactData;
  }

  /**
   * Validate UID format
   */
  static isValidUID(uid: string): boolean {
    if (!uid || typeof uid !== 'string') return false;
    
    // Check for urn:uuid: format
    if (uid.startsWith('urn:uuid:')) {
      const uuidPart = uid.slice(9);
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidPart);
    }
    
    // Check for direct UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
      return true;
    }
    
    // Allow other valid UID formats (alphanumeric with dashes, at least 3 chars)
    return /^[a-zA-Z0-9\-_.]{3,}$/.test(uid);
  }

  /**
   * Resolve a contact by UID - returns object with frontmatter
   */
  async resolveContactByUID(uid: string): Promise<{ file: TFile; frontmatter: any } | null> {
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      if (!file.path.startsWith(this.settings.contactsFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID === uid) {
        return { file, frontmatter: cache.frontmatter };
      }
    }
    
    return null;
  }

  /**
   * Resolve contact file by UID - returns just the TFile
   */
  async resolveContactFileByUID(uid: string): Promise<TFile | null> {
    const result = await this.resolveContactByUID(uid);
    return result?.file || null;
  }

  /**
   * Resolve contact name by UID
   */
  async resolveContactNameByUID(uid: string): Promise<string | null> {
    const result = await this.resolveContactByUID(uid);
    if (!result) return null;
    
    return result.frontmatter?.FN || result.file.basename;
  }

  /**
   * Detect UID conflicts within the contact system
   */
  async detectUIDConflicts(): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{
      uid: string;
      files: string[];
    }>;
  }> {
    const result: {
      hasConflicts: boolean;
      conflicts: Array<{
        uid: string;
        files: string[];
      }>;
    } = { hasConflicts: false, conflicts: [] };
    const uidMap = new Map<string, string[]>();
    
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      if (!file.path.startsWith(this.settings.contactsFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (uid) {
        if (!uidMap.has(uid)) {
          uidMap.set(uid, []);
        }
        uidMap.get(uid)!.push(file.path);
      }
    }
    
    for (const [uid, files] of uidMap.entries()) {
      if (files.length > 1) {
        result.hasConflicts = true;
        result.conflicts.push({ uid, files });
      }
    }
    
    return result;
  }

  /**
   * Update a specific relationship's UID
   */
  async updateRelationshipUID(oldUID: string, newUID: string, parseRelatedValue: (value: string) => { type: 'uuid' | 'uid' | 'name'; value: string } | null, formatRelatedValue: (targetUid: string, targetName: string) => string): Promise<{
    success: boolean;
    updatedRelationships: Array<{
      oldUID: string;
      newUID: string;
      key: string;
    }>;
  }> {
    const result: {
      success: boolean;
      updatedRelationships: Array<{
        oldUID: string;
        newUID: string;
        key: string;
      }>;
    } = {
      success: true,
      updatedRelationships: []
    };
    
    try {
      const frontmatter = await this.contactData.getFrontmatter();
      if (!frontmatter) {
        result.success = false;
        return result;
      }

      const updates: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          const parsedValue = parseRelatedValue(value);
          if (parsedValue && (parsedValue.type === 'uuid' || parsedValue.type === 'uid')) {
            if (parsedValue.value === oldUID) {
              // Format with the same prefix style (urn:uuid: or uid:)
              updates[key] = formatRelatedValue(newUID, '');
              result.updatedRelationships.push({
                oldUID,
                newUID,
                key
              });
            }
          } else if (value === oldUID) {
            // Direct match without prefix
            updates[key] = formatRelatedValue(newUID, '');
            result.updatedRelationships.push({
              oldUID,
              newUID,
              key
            });
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.contactData.updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      console.error(`Error updating relationship UID: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Bulk update relationship UIDs
   */
  async bulkUpdateRelationshipUIDs(
    uidMappings: Record<string, string> | Array<{ name: string; uid: string }>,
    parseRelatedValue: (value: string) => { type: 'uuid' | 'uid' | 'name'; value: string } | null,
    formatRelatedValue: (targetUid: string, targetName: string) => string
  ): Promise<{
    success: boolean;
    updatedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const result: {
      success: boolean;
      updatedCount: number;
      failedCount: number;
      errors: string[];
    } = { success: true, updatedCount: 0, failedCount: 0, errors: [] };
    
    try {
      const frontmatter = await this.contactData.getFrontmatter();
      if (!frontmatter) return result;

      const updates: Record<string, string> = {};
      
      // Convert array format to map if needed
      const mappingMap = Array.isArray(uidMappings)
        ? uidMappings.reduce((acc, { name, uid }) => {
            acc[`name:${name}`] = uid;
            return acc;
          }, {} as Record<string, string>)
        : uidMappings;

      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          // Try to match the value directly or parse it
          let matchedUID = mappingMap[value];
          
          if (!matchedUID) {
            // Try parsing the value
            const parsedValue = parseRelatedValue(value);
            if (parsedValue) {
              if (parsedValue.type === 'name') {
                matchedUID = mappingMap[`name:${parsedValue.value}`] || mappingMap[parsedValue.value];
              } else {
                matchedUID = mappingMap[parsedValue.value];
              }
            }
          }
          
          if (matchedUID && matchedUID !== value) {
            updates[key] = formatRelatedValue(matchedUID, '');
            result.updatedCount++;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.contactData.updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      result.failedCount = result.updatedCount;
      result.updatedCount = 0;
      result.errors.push(`Error in bulk update: ${error.message}`);
    }

    return result;
  }
}
