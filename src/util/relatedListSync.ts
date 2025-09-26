/**
 * Utilities for parsing and syncing Related lists from markdown to frontmatter
 */

import { TFile, App, TAbstractFile } from 'obsidian';
import { updateMultipleFrontMatterValues, updateFrontMatterValue } from 'src/contacts/contactFrontmatter';
import { formatRelatedValue } from 'src/util/relatedFieldUtils';
import { 
  parseGender, 
  getGenderedRelationshipTerm, 
  inferGenderFromRelationship,
  convertToGenderlessType,
  type Gender 
} from 'src/util/genderUtils';
import { loggingService } from 'src/services/loggingService';

/**
 * Represents a relationship parsed from a Related list item
 */
export interface ParsedRelationship {
  type: string;           // The relationship type (e.g., "friend", "parent")
  contactName: string;    // The contact name from [[ContactName]]
  originalType: string;   // The original type before any gender inference
}

/**
 * Represents a resolved contact with its UID and gender
 */
export interface ResolvedContact {
  name: string;
  uid: string;
  file: TFile;
  gender: Gender;
}

/**
 * Parse Related section from markdown content
 * @param content - Full markdown content of the contact file
 * @returns Array of parsed relationships
 */
export function parseRelatedSection(content: string): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];
  
  // Find the Related section - handle different line ending formats
  const relatedMatch = content.match(/##\s*Related\s*(?:\r?\n)((?:^\s*-\s*.*(?:\r?\n)?)*)/m);
  if (!relatedMatch) {
    return relationships;
  }
  
  const relatedSection = relatedMatch[1];
  const lines = relatedSection.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Match pattern: - relationshipType [[ContactName]]
    const match = line.match(/^\s*-\s*([^\[\]]+)\s*\[\[([^\[\]]+)\]\]/);
    if (match) {
      const type = match[1].trim();
      const contactName = match[2].trim();
      
      // Skip empty relationship types
      if (type.length === 0) {
        continue;
      }
      
      relationships.push({
        type,
        contactName,
        originalType: type
      });
    }
  }
  
  return relationships;
}

/**
 * Find contact file by name in the contacts folder
 * @param app - Obsidian app instance
 * @param contactName - Name of the contact to find
 * @param contactsFolder - Path to contacts folder
 * @returns Contact file if found, null otherwise
 */
export async function findContactByName(
  app: App, 
  contactName: string, 
  contactsFolder: string
): Promise<TFile | null> {
  const contactFile = app.vault.getAbstractFileByPath(`${contactsFolder}/${contactName}.md`);
  
  // Check if it's a TFile (or looks like one for testing)
  if (contactFile && (contactFile instanceof TFile || contactFile.basename !== undefined)) {
    return contactFile as TFile;
  }
  
  // Try alternative search in the contacts folder
  const folder = app.vault.getAbstractFileByPath(contactsFolder);
  if (!folder || !('children' in folder)) {
    return null;
  }
  
  for (const child of folder.children) {
    // Check if it's a TFile (or looks like one for testing)
    if (child && (child instanceof TFile || child.basename !== undefined) && child.basename === contactName) {
      return child as TFile;
    }
  }
  
  return null;
}

/**
 * Resolve contact information from contact name
 * @param app - Obsidian app instance
 * @param contactName - Name of the contact
 * @param contactsFolder - Path to contacts folder
 * @returns Resolved contact information or null
 */
export async function resolveContact(
  app: App,
  contactName: string,
  contactsFolder: string
): Promise<ResolvedContact | null> {
  const file = await findContactByName(app, contactName, contactsFolder);
  if (!file) {
    return null;
  }
  
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter;
  
  if (!frontmatter) {
    return null;
  }
  
  const uid = frontmatter.UID;
  if (!uid) {
    return null;
  }
  
  const genderValue = frontmatter.GENDER;
  const gender = genderValue ? parseGender(genderValue) : null;
  
  return {
    name: contactName,
    uid,
    file,
    gender
  };
}

/**
 * Sync Related list from markdown to frontmatter
 * @param app - Obsidian app instance
 * @param file - The contact file to sync
 * @param contactsFolder - Path to contacts folder
 * @returns Success status and any errors
 */
export async function syncRelatedListToFrontmatter(
  app: App,
  file: TFile,
  contactsFolder: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Read the file content
    const content = await app.vault.read(file);
    
    // Parse relationships from the Related section
    const relationships = parseRelatedSection(content);
    
    if (relationships.length === 0) {
      loggingService.info(`No relationships found in Related section for ${file.basename}`);
      return { success: true, errors: [] };
    }
    
    // Get current frontmatter to check for duplicates
    const cache = app.metadataCache.getFileCache(file);
    const currentFrontmatter = cache?.frontmatter || {};
    
    // Track updates needed
    const frontmatterUpdates: Record<string, string> = {};
    const processedContacts = new Set<string>(); // Track to avoid duplicates
    
    for (const relationship of relationships) {
      try {
        // Convert gendered terms to genderless for storage
        const genderlessType = convertToGenderlessType(relationship.type);
        
        // Resolve the contact
        const resolvedContact = await resolveContact(app, relationship.contactName, contactsFolder);
        
        if (!resolvedContact) {
          // Contact not found - use name namespace
          const key = `RELATED[${genderlessType}]`;
          const contactKey = `${genderlessType}:${relationship.contactName}`;
          
          // Skip if already processed this contact for this relationship type
          if (processedContacts.has(contactKey)) {
            continue;
          }
          processedContacts.add(contactKey);
          
          // Check if this relationship already exists in frontmatter
          if (!currentFrontmatter[key]) {
            frontmatterUpdates[key] = formatRelatedValue('', relationship.contactName);
            loggingService.debug(`Adding relationship: ${key} = name:${relationship.contactName}`);
          }
        } else {
          // Contact found - use UID
          const relatedValue = formatRelatedValue(resolvedContact.uid, resolvedContact.name);
          const key = `RELATED[${genderlessType}]`;
          const contactKey = `${genderlessType}:${resolvedContact.uid}`;
          
          // Skip if already processed this contact for this relationship type  
          if (processedContacts.has(contactKey)) {
            continue;
          }
          processedContacts.add(contactKey);
          
          // Check if this relationship already exists in frontmatter
          if (!currentFrontmatter[key]) {
            frontmatterUpdates[key] = relatedValue;
            loggingService.debug(`Adding relationship: ${key} = ${relatedValue}`);
          }
          
          // Infer and update gender if needed
          const inferredGender = inferGenderFromRelationship(relationship.type);
          if (inferredGender && !resolvedContact.gender) {
            try {
              await updateFrontMatterValue(resolvedContact.file, 'GENDER', inferredGender, app);
              loggingService.info(`Inferred and updated gender for ${resolvedContact.name}: ${inferredGender}`);
            } catch (error) {
              errors.push(`Failed to update gender for ${resolvedContact.name}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        errors.push(`Error processing relationship ${relationship.type} -> ${relationship.contactName}: ${error.message}`);
      }
    }
    
    // Update frontmatter if there are changes
    if (Object.keys(frontmatterUpdates).length > 0) {
      await updateMultipleFrontMatterValues(file, frontmatterUpdates, app);
      loggingService.info(`Updated ${Object.keys(frontmatterUpdates).length} relationships in ${file.basename}`);
    } else {
      loggingService.info(`No new relationships to add for ${file.basename}`);
    }
    
    return { success: true, errors };
    
  } catch (error) {
    const errorMsg = `Failed to sync Related list for ${file.basename}: ${error.message}`;
    loggingService.error(errorMsg);
    errors.push(errorMsg);
    return { success: false, errors };
  }
}