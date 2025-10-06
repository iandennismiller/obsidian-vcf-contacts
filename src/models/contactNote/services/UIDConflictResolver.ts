/**
 * UIDConflictResolver Service
 * 
 * Centralized service for detecting and resolving UID conflicts across contacts.
 * Handles UID conflict detection, relationship UID updates, and bulk UID operations.
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * UID conflict information
 */
export interface UIDConflict {
  uid: string;
  files: string[];
}

/**
 * Result of UID conflict detection
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: UIDConflict[];
}

/**
 * Result of UID update operation
 */
export interface UIDUpdateResult {
  success: boolean;
  updatedRelationships: Array<{
    oldUID: string;
    newUID: string;
    key: string;
  }>;
}

/**
 * Result of bulk UID update operation
 */
export interface BulkUIDUpdateResult {
  success: boolean;
  filesUpdated: number;
  relationshipsUpdated: number;
}

/**
 * UID conflict resolver service
 */
export class UIDConflictResolver {
  /**
   * Detect UID conflicts across all contact files
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @returns Conflict detection result with list of conflicts
   */
  static async detectConflicts(
    app: App,
    settings: ContactsPluginSettings
  ): Promise<ConflictDetectionResult> {
    const uidMap = new Map<string, string[]>();
    
    // Collect UIDs from all contact files
    for (const file of app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(settings.contactsFolder)) continue;
      
      const uid = app.metadataCache.getFileCache(file)?.frontmatter?.UID;
      if (uid) {
        if (!uidMap.has(uid)) uidMap.set(uid, []);
        uidMap.get(uid)!.push(file.path);
      }
    }
    
    // Find conflicts (UIDs with multiple files)
    const conflicts = Array.from(uidMap.entries())
      .filter(([_, files]) => files.length > 1)
      .map(([uid, files]) => ({ uid, files }));
    
    return { hasConflicts: conflicts.length > 0, conflicts };
  }

  /**
   * Update a specific relationship's UID in a contact's frontmatter
   * 
   * @param oldUID - Old UID to replace
   * @param newUID - New UID to use
   * @param frontmatter - Contact frontmatter to update
   * @param parseRelatedValue - Function to parse RELATED field values
   * @returns Update result with list of updated relationships
   */
  static updateRelationshipUID(
    oldUID: string,
    newUID: string,
    frontmatter: Record<string, any>,
    parseRelatedValue: (value: string) => { type: 'uuid' | 'uid' | 'name'; value: string } | null
  ): UIDUpdateResult {
    const result: UIDUpdateResult = {
      success: true,
      updatedRelationships: []
    };
    
    if (!frontmatter) {
      result.success = false;
      return result;
    }

    const updates: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED[') && typeof value === 'string') {
        const parsedValue = parseRelatedValue(value);
        if (parsedValue && (parsedValue.type === 'uuid' || parsedValue.type === 'uid')) {
          // Extract UID from parsed value
          let uid = parsedValue.value;
          if (uid.startsWith('urn:uuid:')) {
            uid = uid.substring(9);
          }
          
          if (uid === oldUID) {
            // Create new value with updated UID
            const newValue = `urn:uuid:${newUID}`;
            updates[key] = newValue;
            result.updatedRelationships.push({
              oldUID,
              newUID,
              key
            });
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Bulk update relationship UIDs across multiple contacts
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param uidMappings - Map of old UIDs to new UIDs
   * @param updateFrontmatter - Function to update a contact's frontmatter
   * @returns Bulk update result with statistics
   */
  static async bulkUpdateUIDs(
    app: App,
    settings: ContactsPluginSettings,
    uidMappings: Map<string, string>,
    updateFrontmatter: (file: TFile, updates: Record<string, string>) => Promise<void>
  ): Promise<BulkUIDUpdateResult> {
    const result: BulkUIDUpdateResult = {
      success: true,
      filesUpdated: 0,
      relationshipsUpdated: 0
    };
    
    try {
      for (const file of app.vault.getMarkdownFiles()) {
        if (!file.path.startsWith(settings.contactsFolder)) continue;
        
        const cache = app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) continue;
        
        const updates: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(cache.frontmatter)) {
          if (key.startsWith('RELATED[') && typeof value === 'string') {
            // Check if value contains a UID that needs updating
            for (const [oldUID, newUID] of uidMappings) {
              if (value.includes(oldUID)) {
                // Replace old UID with new UID
                const newValue = value.replace(oldUID, newUID);
                updates[key] = newValue;
                result.relationshipsUpdated++;
              }
            }
          }
        }
        
        if (Object.keys(updates).length > 0) {
          await updateFrontmatter(file, updates);
          result.filesUpdated++;
        }
      }
    } catch (error: any) {
      result.success = false;
      console.error('Error in bulk UID update:', error);
    }
    
    return result;
  }

  /**
   * Find all contacts that reference a specific UID
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param uid - UID to search for
   * @returns Array of files that reference the UID
   */
  static async findReferencingContacts(
    app: App,
    settings: ContactsPluginSettings,
    uid: string
  ): Promise<TFile[]> {
    const referencingFiles: TFile[] = [];
    
    for (const file of app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(settings.contactsFolder)) continue;
      
      const cache = app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      
      for (const [key, value] of Object.entries(cache.frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          if (value.includes(uid)) {
            referencingFiles.push(file);
            break; // Found a reference in this file, move to next file
          }
        }
      }
    }
    
    return referencingFiles;
  }
}
