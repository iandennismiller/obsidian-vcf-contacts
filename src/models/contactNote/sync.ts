/**
 * Handles relationship synchronization operations between markdown and frontmatter
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { GenderOperations } from './gender';
import { FrontmatterOperations } from './frontmatter';
import { VaultOperations, ResolvedContact } from './vault';
import { RelatedFieldOperations } from './relatedField';
import { RelatedListOperations, ParsedRelationship, FrontmatterRelationship } from './relatedList';

export class SyncOperations {
  private app: App;
  private settings: ContactsPluginSettings;
  private file: TFile;
  private genderOps: GenderOperations;
  private frontmatterOps: FrontmatterOperations;
  private vaultOps: VaultOperations;
  private relatedFieldOps: RelatedFieldOperations;
  private relatedListOps: RelatedListOperations;

  constructor(
    app: App,
    settings: ContactsPluginSettings,
    file: TFile,
    genderOps: GenderOperations,
    frontmatterOps: FrontmatterOperations,
    vaultOps: VaultOperations,
    relatedFieldOps: RelatedFieldOperations,
    relatedListOps: RelatedListOperations
  ) {
    this.app = app;
    this.settings = settings;
    this.file = file;
    this.genderOps = genderOps;
    this.frontmatterOps = frontmatterOps;
    this.vaultOps = vaultOps;
    this.relatedFieldOps = relatedFieldOps;
    this.relatedListOps = relatedListOps;
  }

  /**
   * Sync Related list from markdown to frontmatter
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const relationships = await this.relatedListOps.parseRelatedSection();
      
      if (relationships.length === 0) {
        // No relationships found in Related section
        return { success: true, errors: [] };
      }
      
      const currentFrontmatter = await this.frontmatterOps.getFrontmatter();
      const frontmatterUpdates: Record<string, string> = {};
      const processedContacts = new Set<string>();
      const typeIndexes: Record<string, number> = {};
      
      for (const relationship of relationships) {
        try {
          const genderlessType = this.genderOps.convertToGenderlessType(relationship.type);
          const resolvedContact = await this.vaultOps.resolveContact(relationship.contactName, this.genderOps);
          
          if (!resolvedContact) {
            const contactKey = `${genderlessType}:${relationship.contactName}`;
            
            if (processedContacts.has(contactKey)) {
              continue;
            }
            processedContacts.add(contactKey);
            
            const relatedValue = this.relatedFieldOps.formatRelatedValue('', relationship.contactName);
            
            const existingMatchingKey = Object.keys(currentFrontmatter || {}).find(key => {
              const keyType = this.relatedFieldOps.extractRelationshipType(key);
              return keyType === genderlessType && (currentFrontmatter as any)[key] === relatedValue;
            });
            
            if (existingMatchingKey) {
              continue;
            }
            
            let key = this.relatedListOps.generateRelatedKey(genderlessType, typeIndexes, currentFrontmatter || {}, frontmatterUpdates);
            frontmatterUpdates[key] = relatedValue;
            
          } else {
            const relatedValue = this.relatedFieldOps.formatRelatedValue(resolvedContact.uid, resolvedContact.name);
            const contactKey = `${genderlessType}:${resolvedContact.uid}`;
            
            if (processedContacts.has(contactKey)) {
              continue;
            }
            processedContacts.add(contactKey);
            
            const existingMatchingKey = Object.keys(currentFrontmatter || {}).find(key => {
              const keyType = this.relatedFieldOps.extractRelationshipType(key);
              return keyType === genderlessType && (currentFrontmatter as any)[key] === relatedValue;
            });
            
            if (existingMatchingKey) {
              continue;
            }
            
            let key = this.relatedListOps.generateRelatedKey(genderlessType, typeIndexes, currentFrontmatter || {}, frontmatterUpdates);
            frontmatterUpdates[key] = relatedValue;
            
            // Infer and update gender if needed
            const inferredGender = this.genderOps.inferGenderFromRelationship(relationship.type);
            if (inferredGender && !resolvedContact.gender) {
              try {
                // Import ContactNote dynamically to avoid circular dependency
                const { ContactNote } = await import('../contactNote');
                const targetContact = new ContactNote(this.app, this.settings, resolvedContact.file);
                await targetContact.updateGender(inferredGender);
                // Inferred and updated gender
              } catch (error) {
                errors.push(`Failed to update gender for ${resolvedContact.name}: ${(error as Error).message}`);
              }
            }
          }
        } catch (error) {
          errors.push(`Error processing relationship ${relationship.type} -> ${relationship.contactName}: ${(error as Error).message}`);
        }
      }
      
      if (Object.keys(frontmatterUpdates).length > 0) {
        await this.frontmatterOps.updateMultipleFrontmatterValues(frontmatterUpdates);
        // Updated relationships
      } else {
        // No new relationships to add
      }
      
      return { success: true, errors };
      
    } catch (error) {
      const errorMsg = `Failed to sync Related list for ${this.file.basename}: ${(error as Error).message}`;
      console.log(errorMsg);
      errors.push(errorMsg);
      return { success: false, errors };
    }
  }

  /**
   * Sync frontmatter RELATED fields to Related list in markdown
   */
  async syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const frontmatterRelationships = await this.relatedListOps.parseFrontmatterRelationships();
      
      if (frontmatterRelationships.length === 0) {
        // No relationships found in frontmatter
        return { success: true, errors: [] };
      }
      
      const existingRelationships = await this.relatedListOps.parseRelatedSection();
      const missingRelationships: { type: string; contactName: string }[] = [];
      
      for (const fmRel of frontmatterRelationships) {
        let contactName = '';
        
        if (fmRel.parsedValue.type === 'name') {
          contactName = fmRel.parsedValue.value;
        } else {
          const resolvedContact = await this.vaultOps.resolveContact(fmRel.parsedValue.value, this.genderOps);
          if (resolvedContact) {
            contactName = resolvedContact.name;
          } else {
            const allFiles = this.app.vault.getMarkdownFiles();
            for (const otherFile of allFiles) {
              const otherCache = this.app.metadataCache.getFileCache(otherFile);
              if (otherCache?.frontmatter?.UID === fmRel.parsedValue.value) {
                contactName = otherFile.basename;
                break;
              }
            }
            
            if (!contactName) {
              contactName = fmRel.parsedValue.value;
              errors.push(`Could not resolve contact name for UID: ${fmRel.parsedValue.value}`);
            }
          }
        }
        
        const relationshipExists = existingRelationships.some(existing => 
          existing.contactName === contactName && 
          this.relatedListOps.areRelationshipTypesEquivalent(existing.type, fmRel.type)
        );
        
        if (!relationshipExists) {
          missingRelationships.push({
            type: fmRel.type,
            contactName
          });
        }
      }
      
      if (missingRelationships.length === 0) {
        // No missing relationships to sync
        return { success: true, errors };
      }
      
      const allRelationships = [
        ...existingRelationships.map(rel => ({ type: rel.type, contactName: rel.contactName })),
        ...missingRelationships
      ];
      
      await this.relatedListOps.updateRelatedSectionInContent(allRelationships);
      // Synced missing relationships to Related section
      
      return { success: true, errors };
      
    } catch (error) {
      const errorMsg = `Failed to sync frontmatter to Related list for ${this.file.basename}: ${(error as Error).message}`;
      console.log(errorMsg);
      errors.push(errorMsg);
      return { success: false, errors };
    }
  }
}