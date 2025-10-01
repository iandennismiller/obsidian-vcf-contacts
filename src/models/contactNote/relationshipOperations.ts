/**
 * Relationship operations that work closely with ContactData
 * for optimal data locality and cache efficiency.
 */

import { TFile } from 'obsidian';
import { ContactData } from './contactData';
import { Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

// Re-export types for external consumption
export type { ParsedRelationship, FrontmatterRelationship, ResolvedContact };

/**
 * Relationship operations that work directly with ContactData
 * to minimize data access overhead and improve cache locality.
 */
export class RelationshipOperations {
  private contactData: ContactData;

  constructor(contactData: ContactData) {
    this.contactData = contactData;
  }

  // === Relationship Parsing (co-located with relationship data access) ===

  /**
   * Parse Related section from markdown content
   * Groups parsing logic with data access for better cache locality
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const content = await this.contactData.getContent();
    const relationships: ParsedRelationship[] = [];

    // Find the Related section - case-insensitive and depth-agnostic
    // Matches any heading level (##, ###, ####, etc.) with "Related" in any case
    const relatedSectionMatch = content.match(/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
    if (!relatedSectionMatch) {
      return relationships;
    }

    const relatedContent = relatedSectionMatch[3];
    const lines = relatedContent.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse different formats: "- Type: [[Contact Name]]" or "- [[Contact Name]] (Type)"
      const match1 = line.match(/^-\s*([^:]+):\s*\[\[([^\]]+)\]\]/);
      const match2 = line.match(/^-\s*\[\[([^\]]+)\]\]\s*\(([^)]+)\)/);

      if (match1) {
        const [, type, contactName] = match1;
        relationships.push({
          type: type.trim(),
          contactName: contactName.trim(),
          linkType: 'name' // Markdown links are always name-based
        });
      } else if (match2) {
        const [, contactName, type] = match2;
        relationships.push({
          type: type.trim(),
          contactName: contactName.trim(),
          linkType: 'name' // Markdown links are always name-based
        });
      }
    }

    return relationships;
  }

  /**
   * Parse RELATED fields from frontmatter
   * Co-locates frontmatter access with parsing logic
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    const frontmatter = await this.contactData.getFrontmatter();
    const relationships: FrontmatterRelationship[] = [];

    if (!frontmatter) return relationships;

    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED')) {
        // Handle RELATED as an object (from RELATED.type YAML dot notation)
        if (key === 'RELATED' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // This is a nested object from YAML dot notation
          // Process each property as a separate relationship
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (typeof nestedValue === 'string') {
              const correctedKey = `RELATED[${nestedKey}]`;
              const type = nestedKey;
              const parsedValue = this.parseRelatedValue(nestedValue);
              
              relationships.push({
                key: correctedKey,
                type,
                value: nestedValue,
                parsedValue: parsedValue || undefined
              });
              
              console.info(`[RelationshipOperations] Auto-corrected malformed RELATED.${nestedKey} to RELATED[${nestedKey}]`);
            }
          }
          continue;
        }
        
        // Handle RELATED.type format (dot notation as a key) - convert to RELATED[type]
        if (key.includes('.') && key !== 'RELATED') {
          // Extract the type from RELATED.type or RELATED.x.y format
          const parts = key.split('.');
          if (parts[0] === 'RELATED' && parts.length >= 2) {
            const typePart = parts.slice(1).join('.');
            
            if (typeof value === 'string') {
              const correctedKey = `RELATED[${typePart}]`;
              const parsedValue = this.parseRelatedValue(value);
              
              relationships.push({
                key: correctedKey,
                type: typePart,
                value: value,
                parsedValue: parsedValue || undefined
              });
              
              console.info(`[RelationshipOperations] Auto-corrected malformed ${key} to RELATED[${typePart}]`);
              continue;
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Handle nested object under RELATED.type key
              // e.g., RELATED.friend: { name: "Jane Smith" }
              for (const [nestedKey, nestedValue] of Object.entries(value)) {
                if (typeof nestedValue === 'string') {
                  // Create a combined type from the path
                  const combinedType = `${typePart}.${nestedKey}`;
                  const correctedKey = `RELATED[${combinedType}]`;
                  const parsedValue = this.parseRelatedValue(nestedValue);
                  
                  relationships.push({
                    key: correctedKey,
                    type: combinedType,
                    value: nestedValue,
                    parsedValue: parsedValue || undefined
                  });
                  
                  console.info(`[RelationshipOperations] Auto-corrected malformed ${key}.${nestedKey} to RELATED[${combinedType}]`);
                }
              }
              continue;
            } else {
              // Provide more specific error message based on value type
              let valueType: string = typeof value;
              if (value === null) {
                valueType = 'null';
              } else if (Array.isArray(value)) {
                valueType = 'array';
              }
              console.warn(`[RelationshipOperations] Skipping malformed RELATED key "${key}": Use RELATED[type] format instead. Value type: ${valueType}`);
              continue;
            }
          }
        }
        
        // Skip non-string values to prevent .startsWith() errors
        if (typeof value !== 'string') {
          console.warn(`[RelationshipOperations] Skipping non-string RELATED value for key ${key}: ${typeof value}. Expected string value like "name:ContactName", "uid:...", or "urn:uuid:..."`);
          continue;
        }
        
        const type = this.extractRelationshipType(key);
        const parsedValue = this.parseRelatedValue(value);
        
        relationships.push({
          key,
          type,
          value: value,
          parsedValue: parsedValue || undefined
        });
      }
    }

    return relationships;
  }

  // === Relationship Value Operations (grouped with parsing) ===

  /**
   * Format a related value for vCard RELATED field
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(targetUid)) {
      return `urn:uuid:${targetUid}`;
    } else if (targetUid) {
      return `uid:${targetUid}`;
    } else {
      return `name:${targetName}`;
    }
  }

  /**
   * Parse a vCard RELATED value to extract UID or name
   */
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    if (value.startsWith('urn:uuid:')) {
      return { type: 'uuid', value: value.substring(9) };
    } else if (value.startsWith('uid:')) {
      return { type: 'uid', value: value.substring(4) };
    } else if (value.startsWith('name:')) {
      return { type: 'name', value: value.substring(5) };
    }
    return null;
  }

  /**
   * Extract relationship type from RELATED key format
   */
  extractRelationshipType(key: string): string {
    const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return typeMatch ? typeMatch[1] || 'related' : 'related';
  }

  // === Contact Resolution (co-located with relationship operations) ===

  /**
   * Find contact by name in the contacts folder
   * Groups contact lookup with relationship operations for better data locality
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
    try {
      const app = this.contactData.getApp();
      const contactsFolder = 'Contacts'; // TODO: Get from settings
      
      // Normalize the contact name for comparison (replace spaces with dashes, lowercase)
      const normalizedContactName = contactName.toLowerCase().replace(/\s+/g, '-');
      const contactFile = app.vault.getAbstractFileByPath(`${contactsFolder}/${normalizedContactName}.md`);
      
      // Check if file exists and has the right properties (avoid instanceof in test env)
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
   * Resolve contact information from contact name
   * Groups contact resolution with relationship data
   */
  async resolveContact(contactName: string): Promise<ResolvedContact | null> {
    const file = await this.findContactByName(contactName);
    if (!file) return null;

    const app = this.contactData.getApp();
    
    // Create a temporary ContactData for the target contact
    const targetContactData = new ContactData(app, file);
    
    try {
      const uid = await targetContactData.getUID();
      const gender = await targetContactData.getGender();
      
      return {
        name: contactName,
        uid: uid || '',
        file: file,
        gender: gender
      };
    } catch (error: any) {
      console.log(`[RelationshipOperations] Error resolving contact ${contactName}: ${error.message}`);
      return null;
    }
  }

  // === Content Update Operations (grouped with content access) ===

  /**
   * Update Related section in markdown content
   * Groups content modification with relationship operations
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    const content = await this.contactData.getContent();
    
    // Generate new Related section
    let newRelatedSection = '#### Related\n';
    if (relationships.length > 0) {
      for (const rel of relationships) {
        newRelatedSection += `- ${rel.type}: [[${rel.contactName}]]\n`;
      }
    } else {
      newRelatedSection += '\n';
    }

    // Replace existing Related section or add new one - case-insensitive and depth-agnostic
    const relatedSectionMatch = content.match(/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
    let newContent: string;
    
    if (relatedSectionMatch) {
      // Replace existing section, preserving the heading structure
      newContent = content.replace(relatedSectionMatch[0], '\n' + newRelatedSection.trim());
    } else {
      // Add new section before tags
      const tagMatch = content.match(/\n(#\w.*?)\s*$/);
      if (tagMatch) {
        const insertIndex = content.lastIndexOf(tagMatch[1]);
        newContent = content.substring(0, insertIndex) + newRelatedSection + '\n' + tagMatch[1] + '\n';
      } else {
        newContent = content + '\n' + newRelatedSection;
      }
    }

    await this.contactData.updateContent(newContent);
  }

  // === Gender-based Relationship Terms (grouped with relationship logic) ===

  /**
   * Get the display term for a relationship based on the contact's gender
   * Co-locates gender logic with relationship operations
   */
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const mapping: Record<string, { M: string; F: string; default: string }> = {
      parent: { M: 'father', F: 'mother', default: 'parent' },
      auncle: { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
      child: { M: 'son', F: 'daughter', default: 'child' },
      sibling: { M: 'brother', F: 'sister', default: 'sibling' },
      grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
      grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
      spouse: { M: 'husband', F: 'wife', default: 'spouse' },
      friend: { M: 'friend', F: 'friend', default: 'friend' },
      colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
      acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' }
    };

    const typeMapping = mapping[relationshipType.toLowerCase()];
    if (!typeMapping) return relationshipType;

    if (contactGender === 'M') return typeMapping.M;
    if (contactGender === 'F') return typeMapping.F;
    return typeMapping.default;
  }

  /**
   * Infer gender from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    const maleTerms = ['father', 'uncle', 'son', 'brother', 'grandfather', 'grandson', 'husband'];
    const femaleTerms = ['mother', 'aunt', 'daughter', 'sister', 'grandmother', 'granddaughter', 'wife'];

    const term = relationshipType.toLowerCase();
    if (maleTerms.includes(term)) return 'M';
    if (femaleTerms.includes(term)) return 'F';
    return null;
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   */
  convertToGenderlessType(relationshipType: string): string {
    const genderlessMap: Record<string, string> = {
      father: 'parent', mother: 'parent',
      uncle: 'auncle', aunt: 'auncle',
      son: 'child', daughter: 'child',
      brother: 'sibling', sister: 'sibling',
      grandfather: 'grandparent', grandmother: 'grandparent',
      grandson: 'grandchild', granddaughter: 'grandchild',
      husband: 'spouse', wife: 'spouse'
    };

    return genderlessMap[relationshipType.toLowerCase()] || relationshipType;
  }

  /**
   * Get the reverse relationship type (genderless form)
   * For example: parent -> child, child -> parent, sibling -> sibling
   */
  getReverseRelationshipType(relationshipType: string): string {
    const reverseMap: Record<string, string> = {
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      spouse: 'spouse',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
      auncle: 'niece-nephew',
      'niece-nephew': 'auncle',
      'aunt-uncle': 'niece-nephew',
      friend: 'friend',
      colleague: 'colleague',
      'in-law-parent': 'in-law-child',
      'in-law-child': 'in-law-parent'
    };

    // Normalize the input by converting to genderless first
    const genderless = this.convertToGenderlessType(relationshipType);
    return reverseMap[genderless.toLowerCase()] || relationshipType;
  }
}