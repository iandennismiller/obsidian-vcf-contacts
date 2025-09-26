/**
 * Utilities for parsing and syncing Related lists from markdown to frontmatter
 */

import { TFile, App, TAbstractFile } from 'obsidian';
import { updateMultipleFrontMatterValues, updateFrontMatterValue } from 'src/contacts/contactFrontmatter';
import { formatRelatedValue, extractRelationshipType, parseRelatedValue } from 'src/util/relatedFieldUtils';
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
 * Represents a relationship parsed from frontmatter RELATED fields
 */
export interface FrontmatterRelationship {
  type: string;           // The relationship type (e.g., "friend", "parent")
  value: string;          // The full value (urn:uuid:..., uid:..., or name:...)
  parsedValue: {          // Parsed components
    type: 'uuid' | 'uid' | 'name';
    value: string;
  };
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
 * Parse RELATED fields from frontmatter
 * @param frontmatter - Frontmatter object from file cache
 * @returns Array of frontmatter relationships
 */
export function parseFrontmatterRelationships(frontmatter: Record<string, any>): FrontmatterRelationship[] {
  const relationships: FrontmatterRelationship[] = [];
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key.startsWith('RELATED') && value) {
      const type = extractRelationshipType(key);
      const parsedValue = parseRelatedValue(value);
      
      if (parsedValue) {
        relationships.push({
          type,
          value,
          parsedValue
        });
      }
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
  if (contactFile && (contactFile instanceof TFile || ('basename' in contactFile && contactFile.basename !== undefined))) {
    return contactFile as TFile;
  }
  
  // Try alternative search in the contacts folder
  const folder = app.vault.getAbstractFileByPath(contactsFolder);
  if (!folder || !('children' in folder)) {
    return null;
  }
  
  for (const child of (folder as any).children) {
    // Check if it's a TFile (or looks like one for testing)
    if (child && (child instanceof TFile || ('basename' in child && child.basename !== undefined)) && child.basename === contactName) {
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
 * Update Related section in markdown content
 * @param content - Original markdown content
 * @param relationships - Relationships to add to the Related section
 * @returns Updated markdown content
 */
export function updateRelatedSectionInContent(
  content: string, 
  relationships: { type: string; contactName: string }[]
): string {
  // Find the Related section - handle different line ending formats
  const relatedMatch = content.match(/^(#{1,6})\s*Related\s*(?:\r?\n)((?:^\s*-\s*.*(?:\r?\n)?)*)/m);
  
  // Create the relationship list items
  const relatedListItems = relationships.map(rel => 
    `- ${rel.type} [[${rel.contactName}]]`
  );
  
  const relatedSection = relatedListItems.length > 0 
    ? `## Related\n${relatedListItems.join('\n')}\n`
    : `## Related\n\n`;
  
  if (relatedMatch) {
    // Replace the existing Related section
    return content.replace(relatedMatch[0], relatedSection);
  } else {
    // Add Related section before any existing sections or at the end
    const firstSectionMatch = content.match(/^#{1,6}\s+/m);
    if (firstSectionMatch) {
      const insertPos = content.indexOf(firstSectionMatch[0]);
      return content.slice(0, insertPos) + relatedSection + '\n' + content.slice(insertPos);
    } else {
      // Add at the end
      return content.trimEnd() + '\n\n' + relatedSection;
    }
  }
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
    const typeIndexes: Record<string, number> = {}; // Track indexes for multiple same-type relationships
    
    for (const relationship of relationships) {
      try {
        // Convert gendered terms to genderless for storage
        const genderlessType = convertToGenderlessType(relationship.type);
        
        // Resolve the contact
        const resolvedContact = await resolveContact(app, relationship.contactName, contactsFolder);
        
        if (!resolvedContact) {
          // Contact not found - use name namespace
          const contactKey = `${genderlessType}:${relationship.contactName}`;
          
          // Skip if already processed this contact for this relationship type
          if (processedContacts.has(contactKey)) {
            continue;
          }
          processedContacts.add(contactKey);
          
          const relatedValue = formatRelatedValue('', relationship.contactName);
          
          // Check if this exact relationship already exists in frontmatter
          const existingMatchingKey = Object.keys(currentFrontmatter).find(key => {
            const keyType = extractRelationshipType(key);
            return keyType === genderlessType && currentFrontmatter[key] === relatedValue;
          });
          
          if (existingMatchingKey) {
            // This relationship already exists, skip it
            loggingService.debug(`Relationship already exists: ${existingMatchingKey} = ${relatedValue}`);
            continue;
          }
          
          // Generate indexed key for multiple relationships of the same type
          const baseKey = `RELATED[${genderlessType}]`;
          let key = baseKey;
          
          // Check if base key already exists in current frontmatter or updates
          if (currentFrontmatter[baseKey] || frontmatterUpdates[baseKey]) {
            // Need to use indexed key
            if (!typeIndexes[genderlessType]) {
              typeIndexes[genderlessType] = 1;
            }
            key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
            typeIndexes[genderlessType]++;
          }
          
          // Ensure the key doesn't already exist
          while (currentFrontmatter[key] || frontmatterUpdates[key]) {
            if (!typeIndexes[genderlessType]) {
              typeIndexes[genderlessType] = 1;
            }
            key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
            typeIndexes[genderlessType]++;
          }
          
          frontmatterUpdates[key] = relatedValue;
          loggingService.debug(`Adding relationship: ${key} = name:${relationship.contactName}`);
        } else {
          // Contact found - use UID
          const relatedValue = formatRelatedValue(resolvedContact.uid, resolvedContact.name);
          const contactKey = `${genderlessType}:${resolvedContact.uid}`;
          
          // Skip if already processed this contact for this relationship type  
          if (processedContacts.has(contactKey)) {
            continue;
          }
          processedContacts.add(contactKey);
          
          // Check if this exact relationship already exists in frontmatter
          const existingMatchingKey = Object.keys(currentFrontmatter).find(key => {
            const keyType = extractRelationshipType(key);
            return keyType === genderlessType && currentFrontmatter[key] === relatedValue;
          });
          
          if (existingMatchingKey) {
            // This relationship already exists, skip it
            loggingService.debug(`Relationship already exists: ${existingMatchingKey} = ${relatedValue}`);
            continue;
          }
          
          // Generate indexed key for multiple relationships of the same type
          const baseKey = `RELATED[${genderlessType}]`;
          let key = baseKey;
          
          // Check if base key already exists in current frontmatter or updates
          if (currentFrontmatter[baseKey] || frontmatterUpdates[baseKey]) {
            // Need to use indexed key
            if (!typeIndexes[genderlessType]) {
              typeIndexes[genderlessType] = 1;
            }
            key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
            typeIndexes[genderlessType]++;
          }
          
          // Ensure the key doesn't already exist
          while (currentFrontmatter[key] || frontmatterUpdates[key]) {
            if (!typeIndexes[genderlessType]) {
              typeIndexes[genderlessType] = 1;
            }
            key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
            typeIndexes[genderlessType]++;
          }
          
          frontmatterUpdates[key] = relatedValue;
          loggingService.debug(`Adding relationship: ${key} = ${relatedValue}`);
          
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

/**
 * Sync frontmatter RELATED fields to Related list in markdown
 * @param app - Obsidian app instance
 * @param file - The contact file to sync
 * @param contactsFolder - Path to contacts folder
 * @returns Success status and any errors
 */
export async function syncFrontmatterToRelatedList(
  app: App,
  file: TFile,
  contactsFolder: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Read the file content
    const content = await app.vault.read(file);
    
    // Get frontmatter
    const cache = app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter || {};
    
    // Parse relationships from frontmatter
    const frontmatterRelationships = parseFrontmatterRelationships(frontmatter);
    
    if (frontmatterRelationships.length === 0) {
      loggingService.info(`No relationships found in frontmatter for ${file.basename}`);
      return { success: true, errors: [] };
    }
    
    // Parse existing relationships from Related section
    const existingRelationships = parseRelatedSection(content);
    const existingRelationshipsSet = new Set(
      existingRelationships.map(rel => `${rel.type}:${rel.contactName}`)
    );
    
    // Find missing relationships that exist in frontmatter but not in Related section
    const missingRelationships: { type: string; contactName: string }[] = [];
    
    for (const fmRel of frontmatterRelationships) {
      let contactName = '';
      
      if (fmRel.parsedValue.type === 'name') {
        // Direct name reference
        contactName = fmRel.parsedValue.value;
      } else {
        // UID reference - try to resolve to contact name
        const resolvedContact = await resolveContact(app, fmRel.parsedValue.value, contactsFolder);
        if (resolvedContact) {
          contactName = resolvedContact.name;
        } else {
          // Try to find contact by UID in all files
          const allFiles = app.vault.getMarkdownFiles();
          for (const otherFile of allFiles) {
            const otherCache = app.metadataCache.getFileCache(otherFile);
            if (otherCache?.frontmatter?.UID === fmRel.parsedValue.value) {
              contactName = otherFile.basename;
              break;
            }
          }
          
          if (!contactName) {
            // Use the UID/name as fallback
            contactName = fmRel.parsedValue.value;
            errors.push(`Could not resolve contact name for UID: ${fmRel.parsedValue.value}`);
          }
        }
      }
      
      // Check if this relationship already exists in the Related section
      const relationshipKey = `${fmRel.type}:${contactName}`;
      if (!existingRelationshipsSet.has(relationshipKey)) {
        missingRelationships.push({
          type: fmRel.type,
          contactName
        });
      }
    }
    
    if (missingRelationships.length === 0) {
      loggingService.info(`No missing relationships to sync for ${file.basename}`);
      return { success: true, errors };
    }
    
    // Combine existing and missing relationships
    const allRelationships = [
      ...existingRelationships.map(rel => ({ type: rel.type, contactName: rel.contactName })),
      ...missingRelationships
    ];
    
    // Update the Related section
    const newContent = updateRelatedSectionInContent(content, allRelationships);
    
    if (newContent !== content) {
      await app.vault.modify(file, newContent);
      loggingService.info(`Synced ${missingRelationships.length} missing relationships to Related section in: ${file.basename}`);
    }
    
    return { success: true, errors };
    
  } catch (error) {
    const errorMsg = `Failed to sync frontmatter to Related list for ${file.basename}: ${error.message}`;
    loggingService.error(errorMsg);
    errors.push(errorMsg);
    return { success: false, errors };
  }
}