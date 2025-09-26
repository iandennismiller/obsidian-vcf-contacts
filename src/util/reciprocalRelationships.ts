/**
 * Utilities for detecting and fixing missing reciprocal relationships
 */

import { TFile, App } from 'obsidian';
import { 
  parseRelatedSection, 
  findContactByName, 
  resolveContact,
  parseFrontmatterRelationships,
  syncRelatedListToFrontmatter,
  updateRelatedSectionInContent,
  type ParsedRelationship,
  type FrontmatterRelationship 
} from './relatedListSync';
import { convertToGenderlessType, type Gender } from './genderUtils';
import { extractRelationshipType, parseRelatedValue } from './relatedFieldUtils';
import { loggingService } from '../services/loggingService';

/**
 * Represents a missing reciprocal relationship
 */
export interface MissingReciprocal {
  /** Contact file that is missing the reciprocal */
  targetFile: TFile;
  /** Name of the target contact */
  targetName: string;
  /** The reciprocal relationship type that should be added */
  reciprocalType: string;
  /** Name of the source contact (the one with the original relationship) */
  sourceContactName: string;
}

/**
 * Result of checking reciprocal relationships
 */
export interface ReciprocalCheckResult {
  /** Whether all relationships have proper reciprocals */
  allReciprocalExists: boolean;
  /** List of missing reciprocal relationships */
  missingReciprocals: MissingReciprocal[];
  /** Any errors encountered during the check */
  errors: string[];
}

/**
 * Get the reciprocal relationship type for a given type
 * @param relationshipType - The original relationship type
 * @returns The reciprocal type, or null if no reciprocal exists
 */
export function getReciprocalRelationshipType(relationshipType: string): string | null {
  // Convert to genderless form for consistent mapping
  const genderlessType = convertToGenderlessType(relationshipType.toLowerCase());
  
  const reciprocalMap: Record<string, string> = {
    'parent': 'child',
    'child': 'parent',
    'sibling': 'sibling',
    'spouse': 'spouse',
    'partner': 'partner',
    'friend': 'friend',
    'colleague': 'colleague',
    'relative': 'relative',
    'auncle': 'nibling',  // aunt/uncle -> nibling (niece/nephew)
    'nibling': 'auncle',  // nibling (niece/nephew) -> aunt/uncle
    'grandparent': 'grandchild',
    'grandchild': 'grandparent',
    'cousin': 'cousin'
  };
  
  return reciprocalMap[genderlessType] || null;
}

/**
 * Check if a relationship type is symmetric (has the same reciprocal)
 * @param relationshipType - The relationship type to check
 * @returns True if the relationship is symmetric
 */
export function isSymmetricRelationship(relationshipType: string): boolean {
  const genderlessType = convertToGenderlessType(relationshipType.toLowerCase());
  const symmetricTypes = ['sibling', 'spouse', 'partner', 'friend', 'colleague', 'relative', 'cousin'];
  return symmetricTypes.includes(genderlessType);
}

/**
 * Check if two relationship types are equivalent (considering gender variations)
 * @param type1 - First relationship type
 * @param type2 - Second relationship type  
 * @returns True if the types are equivalent
 */
function areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
  if (type1 === type2) {
    return true;
  }
  
  const genderless1 = convertToGenderlessType(type1.toLowerCase());
  const genderless2 = convertToGenderlessType(type2.toLowerCase());
  
  return genderless1 === genderless2;
}

/**
 * Check if a contact has a reciprocal relationship in their frontmatter
 * @param app - Obsidian app instance
 * @param targetFile - The contact file to check for reciprocal
 * @param sourceContactName - Name of the source contact
 * @param expectedReciprocalType - The expected reciprocal relationship type
 * @returns True if the reciprocal relationship exists
 */
export async function hasReciprocalRelationshipInFrontmatter(
  app: App,
  targetFile: TFile,
  sourceContactName: string,
  expectedReciprocalType: string
): Promise<boolean> {
  try {
    const cache = app.metadataCache.getFileCache(targetFile);
    const frontmatter = cache?.frontmatter || {};
    
    // Parse all RELATED fields from frontmatter
    const frontmatterRelationships = parseFrontmatterRelationships(frontmatter);
    
    // Check if any relationship matches the expected reciprocal
    for (const relationship of frontmatterRelationships) {
      // Check if the relationship type matches (considering gender variations)
      if (areRelationshipTypesEquivalent(relationship.type, expectedReciprocalType)) {
        // Check if the relationship points to the source contact
        if (relationship.parsedValue.type === 'name') {
          if (relationship.parsedValue.value === sourceContactName) {
            return true;
          }
        } else {
          // For UID-based relationships, we need to resolve the UID to a name
          // This is more complex and might require additional lookup
          // For now, we'll assume name-based relationships are the primary concern
        }
      }
    }
    
    return false;
    
  } catch (error) {
    loggingService.error(`Error checking reciprocal relationship in ${targetFile.path}: ${error.message}`);
    return false;
  }
}

/**
 * Check if a contact has a reciprocal relationship in their Related list
 * @param app - Obsidian app instance
 * @param targetFile - The contact file to check for reciprocal
 * @param sourceContactName - Name of the source contact
 * @param expectedReciprocalType - The expected reciprocal relationship type
 * @returns True if the reciprocal relationship exists
 */
export async function hasReciprocalRelationshipInRelatedList(
  app: App,
  targetFile: TFile,
  sourceContactName: string,
  expectedReciprocalType: string
): Promise<boolean> {
  try {
    const content = await app.vault.read(targetFile);
    const relationships = parseRelatedSection(content);
    
    // Check if any relationship matches the expected reciprocal
    return relationships.some(rel => 
      rel.contactName === sourceContactName && 
      areRelationshipTypesEquivalent(rel.type, expectedReciprocalType)
    );
    
  } catch (error) {
    loggingService.error(`Error checking reciprocal relationship in Related list for ${targetFile.path}: ${error.message}`);
    return false;
  }
}

/**
 * Result of fixing missing reciprocal relationships
 */
export interface FixReciprocalResult {
  /** Whether all reciprocals were successfully fixed */
  success: boolean;
  /** Number of reciprocal relationships that were added */
  addedCount: number;
  /** Any errors encountered during the fix operation */
  errors: string[];
}

/**
 * Add a reciprocal relationship to a target contact's Related list
 * @param app - Obsidian app instance
 * @param targetFile - The target contact file
 * @param reciprocalType - The reciprocal relationship type
 * @param sourceContactName - Name of the source contact
 * @returns True if successfully added
 */
export async function addReciprocalRelationshipToRelatedList(
  app: App,
  targetFile: TFile,
  reciprocalType: string,
  sourceContactName: string
): Promise<boolean> {
  try {
    // Read current content
    const content = await app.vault.read(targetFile);
    
    // Parse existing relationships
    const existingRelationships = parseRelatedSection(content);
    
    // Check if the reciprocal relationship already exists in the Related list
    const reciprocalExists = existingRelationships.some(rel => 
      rel.contactName === sourceContactName && 
      areRelationshipTypesEquivalent(rel.type, reciprocalType)
    );
    
    if (reciprocalExists) {
      loggingService.debug(`Reciprocal relationship already exists in Related list: ${targetFile.basename} -> ${reciprocalType} -> ${sourceContactName}`);
      return true;
    }
    
    // Add the reciprocal relationship to the Related section
    const updatedRelationships = [
      ...existingRelationships,
      { type: reciprocalType, contactName: sourceContactName }
    ];
    
    // Update content with new relationships
    const updatedContent = updateRelatedSectionInContent(content, updatedRelationships);
    
    if (updatedContent !== content) {
      await app.vault.modify(targetFile, updatedContent);
      loggingService.info(`Added reciprocal relationship to Related list: ${targetFile.basename} -> ${reciprocalType} -> ${sourceContactName}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    loggingService.error(`Failed to add reciprocal relationship to Related list in ${targetFile.path}: ${error.message}`);
    return false;
  }
}

/**
 * Fix missing reciprocal relationships for a contact
 * This will add missing reciprocal relationships to the target contacts' Related lists
 * and then sync them to their frontmatter
 * @param app - Obsidian app instance
 * @param contactFile - The contact file to fix reciprocals for
 * @param contactsFolder - Path to contacts folder
 * @returns Result of the fix operation
 */
export async function fixMissingReciprocalRelationships(
  app: App,
  contactFile: TFile,
  contactsFolder: string
): Promise<FixReciprocalResult> {
  const errors: string[] = [];
  let addedCount = 0;
  
  try {
    // First, find all missing reciprocals
    const checkResult = await findMissingReciprocalRelationships(app, contactFile, contactsFolder);
    
    if (checkResult.errors.length > 0) {
      errors.push(...checkResult.errors);
    }
    
    if (checkResult.missingReciprocals.length === 0) {
      loggingService.info(`No missing reciprocal relationships found for ${contactFile.basename}`);
      return {
        success: true,
        addedCount: 0,
        errors
      };
    }
    
    // Fix each missing reciprocal
    for (const missing of checkResult.missingReciprocals) {
      try {
        // Add to Related list
        const addedToRelatedList = await addReciprocalRelationshipToRelatedList(
          app,
          missing.targetFile,
          missing.reciprocalType,
          missing.sourceContactName
        );
        
        if (addedToRelatedList) {
          // Sync the Related list to frontmatter for the target contact
          const syncResult = await syncRelatedListToFrontmatter(
            app,
            missing.targetFile,
            contactsFolder
          );
          
          if (syncResult.success) {
            addedCount++;
            loggingService.info(`Successfully added reciprocal relationship: ${missing.targetName} -> ${missing.reciprocalType} -> ${missing.sourceContactName}`);
            
            if (syncResult.errors.length > 0) {
              errors.push(...syncResult.errors);
            }
          } else {
            errors.push(`Failed to sync reciprocal relationship to frontmatter for ${missing.targetName}`);
            if (syncResult.errors.length > 0) {
              errors.push(...syncResult.errors);
            }
          }
        } else {
          errors.push(`Failed to add reciprocal relationship to Related list for ${missing.targetName}`);
        }
        
      } catch (error) {
        errors.push(`Error fixing reciprocal relationship for ${missing.targetName}: ${error.message}`);
      }
    }
    
    return {
      success: addedCount > 0 || checkResult.missingReciprocals.length === 0,
      addedCount,
      errors
    };
    
  } catch (error) {
    const errorMsg = `Error fixing missing reciprocal relationships for ${contactFile.path}: ${error.message}`;
    loggingService.error(errorMsg);
    errors.push(errorMsg);
    
    return {
      success: false,
      addedCount: 0,
      errors
    };
  }
}

/**
 * Find all missing reciprocal relationships for a given contact
 * @param app - Obsidian app instance
 * @param contactFile - The contact file to check
 * @param contactsFolder - Path to contacts folder
 * @returns List of missing reciprocal relationships
 */
export async function findMissingReciprocalRelationships(
  app: App,
  contactFile: TFile,
  contactsFolder: string
): Promise<ReciprocalCheckResult> {
  const errors: string[] = [];
  const missingReciprocals: MissingReciprocal[] = [];
  
  try {
    // Get the source contact name
    const sourceContactName = contactFile.basename;
    
    // Read the file content and parse relationships
    const content = await app.vault.read(contactFile);
    const relationships = parseRelatedSection(content);
    
    // Check each relationship for reciprocal existence
    for (const relationship of relationships) {
      const reciprocalType = getReciprocalRelationshipType(relationship.type);
      
      if (!reciprocalType) {
        // Skip relationships that don't have reciprocals
        continue;
      }
      
      try {
        // Find the target contact file
        const targetFile = await findContactByName(app, relationship.contactName, contactsFolder);
        
        if (!targetFile) {
          errors.push(`Target contact not found: ${relationship.contactName}`);
          continue;
        }
        
        // Check if the target contact has the reciprocal relationship
        // Check both frontmatter and Related list
        const hasReciprocalInFrontmatter = await hasReciprocalRelationshipInFrontmatter(
          app, 
          targetFile, 
          sourceContactName, 
          reciprocalType
        );
        
        const hasReciprocalInRelatedList = await hasReciprocalRelationshipInRelatedList(
          app, 
          targetFile, 
          sourceContactName, 
          reciprocalType
        );
        
        // If the reciprocal doesn't exist in either location, it's missing
        if (!hasReciprocalInFrontmatter && !hasReciprocalInRelatedList) {
          missingReciprocals.push({
            targetFile,
            targetName: relationship.contactName,
            reciprocalType,
            sourceContactName
          });
        }
        
      } catch (error) {
        errors.push(`Error processing relationship ${relationship.type} -> ${relationship.contactName}: ${error.message}`);
      }
    }
    
    return {
      allReciprocalExists: missingReciprocals.length === 0,
      missingReciprocals,
      errors
    };
    
  } catch (error) {
    const errorMsg = `Error finding missing reciprocal relationships for ${contactFile.path}: ${error.message}`;
    loggingService.error(errorMsg);
    errors.push(errorMsg);
    
    return {
      allReciprocalExists: false,
      missingReciprocals: [],
      errors
    };
  }
}