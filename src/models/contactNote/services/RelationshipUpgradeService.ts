/**
 * RelationshipUpgradeService - Service for upgrading name-based relationships to UID-based
 * 
 * This service handles the migration of contact relationships from name-based references
 * to UID-based references for more reliable relationship tracking.
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { RelationshipReference } from '../entities/relationships/RelationshipReference';

/**
 * Result of upgrading relationships
 */
export interface RelationshipUpgradeResult {
  /** Whether the upgrade was successful */
  success: boolean;
  /** List of relationships that were upgraded */
  upgradedRelationships: Array<{
    targetUID: string;
    type: string;
    key: string;
  }>;
  /** Any errors encountered during upgrade */
  errors: string[];
}

/**
 * RelationshipUpgradeService - Upgrades name-based relationships to UID-based
 * 
 * This service provides functionality to migrate relationships from name-based
 * references (e.g., "John Doe") to UID-based references (e.g., "urn:uuid:123")
 * for more reliable contact tracking.
 */
export class RelationshipUpgradeService {
  /**
   * Upgrade name-based relationships to UID-based in a contact file
   * 
   * This method:
   * 1. Scans frontmatter for name-based RELATED fields
   * 2. Looks up the target contact by name to get their UID
   * 3. Updates the relationship to use the UID instead of the name
   * 4. Preserves the display name for reference
   * 
   * @param app - Obsidian App instance
   * @param settings - Plugin settings
   * @param file - Contact file to upgrade
   * @param getFrontmatter - Function to get frontmatter from file
   * @param findContactByName - Function to find contact file by name
   * @param parseRelatedSection - Function to parse Related section from markdown
   * @param extractRelationshipTypeFromKey - Function to extract relationship type from key
   * @param formatRelatedValue - Function to format a RELATED field value
   * @param updateMultipleFrontmatterValues - Function to update multiple frontmatter values
   * @returns Result containing upgraded relationships and any errors
   * 
   * @example
   * ```typescript
   * const result = await RelationshipUpgradeService.upgradeRelationships(
   *   app, settings, file,
   *   () => contactNote.getFrontmatter(),
   *   (name) => contactNote.findContactByName(name),
   *   () => contactNote.parseRelatedSection(),
   *   (key) => contactNote.extractRelationshipTypeFromKey(key),
   *   (uid, name) => contactNote.formatRelatedValue(uid, name),
   *   (updates) => contactNote.updateMultipleFrontmatterValues(updates)
   * );
   * ```
   */
  static async upgradeRelationships(
    app: App,
    settings: ContactsPluginSettings,
    file: TFile,
    getFrontmatter: () => Promise<Record<string, any> | null>,
    findContactByName: (name: string) => Promise<TFile | null>,
    parseRelatedSection: () => Promise<any[]>,
    extractRelationshipTypeFromKey: (key: string) => string,
    formatRelatedValue: (uid: string, displayName?: string) => string,
    updateMultipleFrontmatterValues: (updates: Record<string, string>) => Promise<void>
  ): Promise<RelationshipUpgradeResult> {
    const result: RelationshipUpgradeResult = { 
      success: true, 
      upgradedRelationships: [], 
      errors: [] 
    };

    try {
      const frontmatter = await getFrontmatter();
      const updates: Record<string, string> = {};
      
      // Upgrade existing frontmatter name-based relationships
      if (frontmatter) {
        for (const [key, value] of Object.entries(frontmatter)) {
          if (key.startsWith('RELATED[') && typeof value === 'string') {
            const ref = RelationshipReference.fromString(value);
            if (ref.isNameReference()) {
              const targetFile = await findContactByName(ref.getValue());
              const targetUID = targetFile ? app.metadataCache.getFileCache(targetFile)?.frontmatter?.UID : null;
                
              if (targetUID) {
                updates[key] = formatRelatedValue(targetUID, ref.getValue());
                const relType = extractRelationshipTypeFromKey(key);
                result.upgradedRelationships.push({ targetUID, type: relType, key });
              }
            }
          }
        }
      }

      // Add missing markdown relationships to frontmatter with UIDs
      const markdownRelationships = await parseRelatedSection();
      let relationshipIndex = 0;
      
      for (const relationship of markdownRelationships) {
        const relType = relationship.getType().toString();
        const contactName = relationship.getTarget().getValue();
        
        // Skip if already in frontmatter
        const hasEntry = frontmatter && Object.keys(frontmatter).some(key => 
          key.startsWith('RELATED[') && 
          extractRelationshipTypeFromKey(key).toLowerCase() === relType.toLowerCase()
        );
        
        if (!hasEntry) {
          const targetFile = await findContactByName(contactName);
          const targetUID = targetFile ? app.metadataCache.getFileCache(targetFile)?.frontmatter?.UID : null;
            
          if (targetUID) {
            const key = relationshipIndex === 0 ? `RELATED.${relType}` : `RELATED.${relType}.${relationshipIndex}`;
            updates[key] = formatRelatedValue(targetUID, contactName);
            result.upgradedRelationships.push({ targetUID, type: relType, key });
            relationshipIndex++;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Error upgrading relationships: ${error.message}`);
    }

    return result;
  }
}
