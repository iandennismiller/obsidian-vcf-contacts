/**
 * Advanced relationship operations including resolution, reverse linking, and upgrades
 */

import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { ContactData } from './contactData';
import { RelationshipOperations } from './relationshipOperations';
import { Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

/**
 * Advanced relationship operations that build on top of basic relationship functionality
 */
export class AdvancedRelationshipOperations {
  private app: App;
  private settings: ContactsPluginSettings;
  private contactData: ContactData;
  private relationshipOps: RelationshipOperations;

  constructor(app: App, settings: ContactsPluginSettings, contactData: ContactData, relationshipOps: RelationshipOperations) {
    this.app = app;
    this.settings = settings;
    this.contactData = contactData;
    this.relationshipOps = relationshipOps;
  }

  /**
   * Get relationships with enhanced UID/name linking information
   */
  async getRelationships(
    resolveContact: (contactName: string) => Promise<ResolvedContact | null>,
    resolveContactNameByUID: (uid: string) => Promise<string | null>
  ): Promise<Array<{
    type: string;
    contactName: string;
    targetUID?: string;
    linkType: 'uid' | 'name';
    originalType: string;
  }>> {
    const relationships = await this.relationshipOps.parseRelatedSection();
    const frontmatterRelationships = await this.relationshipOps.parseFrontmatterRelationships();
    
    const result: Array<{
      type: string;
      contactName: string;
      targetUID?: string;
      linkType: 'uid' | 'name';
      originalType: string;
    }> = [];
    const processedTargets = new Set<string>(); // Track processed targets to avoid duplicates
    
    // Process frontmatter relationships first (higher priority)
    for (const fmRel of frontmatterRelationships) {
      if (fmRel.parsedValue && (fmRel.parsedValue.type === 'uuid' || fmRel.parsedValue.type === 'uid')) {
        const contactName = await resolveContactNameByUID(fmRel.parsedValue.value);
        if (contactName) {
          result.push({
            type: fmRel.type,
            contactName,
            targetUID: fmRel.parsedValue.value,
            linkType: 'uid',
            originalType: fmRel.type
          });
          processedTargets.add(contactName.toLowerCase());
        }
      } else if (fmRel.parsedValue && fmRel.parsedValue.type === 'name') {
        // Handle name-based frontmatter relationships
        const resolved = await resolveContact(fmRel.parsedValue.value);
        const obj: {
          type: string;
          contactName: string;
          targetUID?: string;
          linkType: 'uid' | 'name';
          originalType: string;
        } = {
          type: fmRel.type,
          contactName: fmRel.parsedValue.value,
          linkType: resolved?.uid ? 'uid' : 'name',
          originalType: fmRel.type
        };
        if (resolved?.uid) {
          obj.targetUID = resolved.uid;
        }
        result.push(obj);
        processedTargets.add(fmRel.parsedValue.value.toLowerCase());
      }
    }
    
    // Process markdown relationships (only if not already processed)
    for (const rel of relationships) {
      if (!processedTargets.has(rel.contactName.toLowerCase())) {
        const resolved = await resolveContact(rel.contactName);
        const obj: {
          type: string;
          contactName: string;
          targetUID?: string;
          linkType: 'uid' | 'name';
          originalType: string;
        } = {
          type: rel.type,
          contactName: rel.contactName,
          linkType: resolved?.uid ? 'uid' : 'name',
          originalType: rel.type
        };
        if (resolved?.uid) {
          obj.targetUID = resolved.uid;
        }
        result.push(obj);
      }
    }
    
    return result;
  }

  /**
   * Resolve relationship target by relationship type or identifier
   */
  async resolveRelationshipTarget(
    identifierOrType: string,
    isValidUID: (uid: string) => boolean,
    resolveContactByUID: (uid: string) => Promise<{ file: TFile; frontmatter: any } | null>,
    findContactByName: (contactName: string) => Promise<TFile | null>
  ): Promise<{
    file: TFile | null;
    frontmatter?: any;
    type: 'uid' | 'name';
    contactName: string;
  } | null> {
    // First, check if identifier is a relationship type in frontmatter
    const frontmatter = await this.contactData.getFrontmatter();
    if (frontmatter) {
      // Look for RELATED[identifierOrType] or RELATED[N:identifierOrType] fields
      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
          const relType = typeMatch ? typeMatch[1] : '';
          
          if (relType.toLowerCase() === identifierOrType.toLowerCase()) {
            // Found matching relationship in frontmatter, resolve by its value
            const parsedValue = this.relationshipOps.parseRelatedValue(value);
            if (parsedValue && (parsedValue.type === 'uuid' || parsedValue.type === 'uid')) {
              const result = await resolveContactByUID(parsedValue.value);
              if (result) {
                const contactName = result.frontmatter?.FN || result.file.basename;
                return { 
                  file: result.file, 
                  frontmatter: result.frontmatter,
                  type: 'uid', 
                  contactName 
                };
              }
            }
          }
        }
      }
    }
    
    // Check if it's a UID format
    if (identifierOrType.startsWith('urn:uuid:') || isValidUID(identifierOrType)) {
      const result = await resolveContactByUID(identifierOrType);
      if (result) {
        const contactName = result.frontmatter?.FN || result.file.basename;
        return { 
          file: result.file, 
          frontmatter: result.frontmatter,
          type: 'uid', 
          contactName 
        };
      }
    }
    
    // Fall back to name resolution
    const file = await findContactByName(identifierOrType);
    if (file) {
      const cache = this.app.metadataCache.getFileCache(file);
      return { 
        file, 
        frontmatter: cache?.frontmatter,
        type: 'name', 
        contactName: identifierOrType 
      };
    }
    
    return null;
  }

  /**
   * Process reverse relationships for automatic bidirectional linking
   */
  async processReverseRelationships(
    getDisplayName: () => string,
    getReciprocalRelationshipType: (relationshipType: string, targetGender?: Gender) => string | null,
    areRelationshipTypesEquivalent: (type1: string, type2: string) => boolean,
    createContactNote: (file: TFile) => any
  ): Promise<{
    success: boolean;
    processedRelationships: Array<{
      targetContact: string;
      reverseType: string;
      added: boolean;
      reason?: string;
      error?: string;
    }>;
    errors: string[];
  }> {
    const result: {
      success: boolean;
      processedRelationships: Array<{
        targetContact: string;
        reverseType: string;
        added: boolean;
        reason?: string;
        error?: string;
      }>;
      errors: string[];
    } = {
      success: true,
      processedRelationships: [],
      errors: []
    };

    try {
      const relationships = await this.relationshipOps.parseRelatedSection();
      const sourceContactName = getDisplayName();
      const sourceFrontmatter = await this.contactData.getFrontmatter();
      const sourceGender = sourceFrontmatter?.GENDER as Gender;
      
      for (const relationship of relationships) {
        const targetFile = await this.relationshipOps.findContactByName(relationship.contactName);
        if (!targetFile) {
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType: '',
            added: false,
            reason: 'target contact not found',
            error: 'Target contact not found'
          });
          continue;
        }

        // Get target gender for gender-aware reciprocal relationship
        // We use sourceGender because the reciprocal will point back to the source
        const targetContact = createContactNote(targetFile);
        const reverseType = getReciprocalRelationshipType(relationship.type, sourceGender);
        
        if (!reverseType) {
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType: '',
            added: false,
            reason: 'no reciprocal relationship type available',
            error: 'No reciprocal relationship type available'
          });
          continue;
        }

        // Check if reverse relationship already exists
        const targetRelationships = await targetContact.parseRelatedSection();
        
        const reverseExists = targetRelationships.some((rel: any) => {
          // Normalize contact names for comparison (case-insensitive, space/dash equivalence)
          const normalizedRelName = rel.contactName.toLowerCase().replace(/[\s\-]/g, '');
          const normalizedSourceName = sourceContactName.toLowerCase().replace(/[\s\-]/g, '');
          return normalizedRelName === normalizedSourceName && 
            areRelationshipTypesEquivalent(rel.type, reverseType);
        });

        if (!reverseExists) {
          // Add reverse relationship
          const newRelationships = [...targetRelationships, {
            type: reverseType,
            contactName: sourceContactName
          }];
          
          await targetContact.updateRelatedSectionInContent(newRelationships);
          
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType,
            added: true
          });
        } else {
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType,
            added: false,
            reason: 'relationship already exists'
          });
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Error processing reverse relationships: ${error.message}`);
    }

    return result;
  }

  /**
   * Upgrade name-based relationships to UID-based when possible
   */
  async upgradeNameBasedRelationshipsToUID(
    findContactByName: (contactName: string) => Promise<TFile | null>
  ): Promise<{
    success: boolean;
    upgradedRelationships: Array<{
      targetUID: string;
      type: string;
      key: string;
    }>;
    errors: string[];
  }> {
    const result: {
      success: boolean;
      upgradedRelationships: Array<{
        targetUID: string;
        type: string;
        key: string;
      }>;
      errors: string[];
    } = { success: true, upgradedRelationships: [], errors: [] };

    try {
      // First check frontmatter relationships
      const frontmatter = await this.contactData.getFrontmatter();
      const updates: Record<string, string> = {};
      
      if (frontmatter) {
        for (const [key, value] of Object.entries(frontmatter)) {
          if (key.startsWith('RELATED[') && typeof value === 'string') {
            const parsedValue = this.relationshipOps.parseRelatedValue(value);
            // Check if it's currently name-based
            if (parsedValue && parsedValue.type === 'name') {
              const targetFile = await findContactByName(parsedValue.value);
              if (targetFile) {
                const targetCache = this.app.metadataCache.getFileCache(targetFile);
                const targetUID = targetCache?.frontmatter?.UID;
                
                if (targetUID) {
                  updates[key] = this.relationshipOps.formatRelatedValue(targetUID, parsedValue.value);
                  const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
                  const relType = typeMatch ? typeMatch[1] : 'related';
                  result.upgradedRelationships.push({
                    targetUID,
                    type: relType,
                    key
                  });
                }
              }
            }
          }
        }
      }

      // Also check markdown relationships without frontmatter entries
      const markdownRelationships = await this.relationshipOps.parseRelatedSection();
      let relationshipIndex = 0;
      
      for (const relationship of markdownRelationships) {
        // Check if this relationship already has a frontmatter entry
        const hasFrontmatterEntry = frontmatter && Object.keys(frontmatter).some(key => {
          if (!key.startsWith('RELATED[')) return false;
          const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
          const relType = typeMatch ? typeMatch[1] : '';
          return relType.toLowerCase() === relationship.type.toLowerCase();
        });
        
        if (!hasFrontmatterEntry) {
          // Try to resolve and upgrade this relationship
          const targetFile = await findContactByName(relationship.contactName);
          if (targetFile) {
            const targetCache = this.app.metadataCache.getFileCache(targetFile);
            const targetUID = targetCache?.frontmatter?.UID;
            
            if (targetUID) {
              const key = relationshipIndex === 0 && !hasFrontmatterEntry
                ? `RELATED[${relationship.type}]`
                : `RELATED[${relationshipIndex}:${relationship.type}]`;
              
              updates[key] = this.relationshipOps.formatRelatedValue(targetUID, relationship.contactName);
              result.upgradedRelationships.push({
                targetUID,
                type: relationship.type,
                key
              });
              relationshipIndex++;
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.contactData.updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Error upgrading relationships: ${error.message}`);
    }

    return result;
  }
}
