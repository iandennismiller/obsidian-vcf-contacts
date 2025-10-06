/**
 * FieldType utility for extracting and working with contact field types
 * 
 * Provides utilities for parsing frontmatter keys to determine field types
 * like EMAIL, TEL, URL, ADR, etc.
 */

/**
 * Supported contact field types
 */
export type FieldTypeValue = 'EMAIL' | 'TEL' | 'URL' | 'ADR' | 'N' | 'FN' | 'ORG' | 'TITLE' | 'ROLE' | 'BDAY' | 'PHOTO' | 'NOTE' | 'RELATED' | 'GENDER' | 'UID' | 'REV' | 'CATEGORIES';

/**
 * FieldType utility class for working with field types
 */
export class FieldType {
  /**
   * Extract field type from a frontmatter key
   * 
   * Examples:
   *   "EMAIL.WORK" -> "EMAIL"
   *   "TEL.CELL.PRIMARY" -> "TEL"
   *   "URL[0:WEBSITE]" -> "URL"
   *   "ADR.HOME" -> "ADR"
   *   "FN" -> "FN"
   * 
   * @param key - Frontmatter key
   * @returns Field type or null if not recognized
   */
  static extract(key: string): string | null {
    if (!key || typeof key !== 'string') {
      return null;
    }
    
    // Match field types at the start of the key
    // Supports dot notation (EMAIL.WORK) and bracket notation (EMAIL[0:WORK])
    const match = key.match(/^(EMAIL|TEL|URL|ADR|N|FN|ORG|TITLE|ROLE|BDAY|PHOTO|NOTE|RELATED|GENDER|UID|REV|CATEGORIES)(\[|\.)?/);
    return match ? match[1] : null;
  }
  
  /**
   * Check if a key represents a contact field (EMAIL, TEL, URL, ADR)
   * 
   * @param key - Frontmatter key
   * @returns True if key is a contact field type
   */
  static isContactField(key: string): boolean {
    const type = FieldType.extract(key);
    return type === 'EMAIL' || type === 'TEL' || type === 'URL' || type === 'ADR';
  }
  
  /**
   * Check if a key represents a name field (N, FN)
   * 
   * @param key - Frontmatter key
   * @returns True if key is a name field type
   */
  static isNameField(key: string): boolean {
    const type = FieldType.extract(key);
    return type === 'N' || type === 'FN';
  }
  
  /**
   * Check if a key represents a relationship field
   * 
   * @param key - Frontmatter key
   * @returns True if key is RELATED type
   */
  static isRelationshipField(key: string): boolean {
    const type = FieldType.extract(key);
    return type === 'RELATED';
  }
  
  /**
   * Check if a key represents metadata (UID, REV, GENDER, etc.)
   * 
   * @param key - Frontmatter key
   * @returns True if key is metadata type
   */
  static isMetadataField(key: string): boolean {
    const type = FieldType.extract(key);
    return type === 'UID' || type === 'REV' || type === 'GENDER' || type === 'CATEGORIES';
  }
  
  /**
   * Get the label from a field key (part after the field type)
   * 
   * Examples:
   *   "EMAIL.WORK" -> "WORK"
   *   "TEL.CELL.PRIMARY" -> "CELL.PRIMARY"
   *   "FN" -> null
   * 
   * @param key - Frontmatter key
   * @returns Label or null if no label
   */
  static extractLabel(key: string): string | null {
    const type = FieldType.extract(key);
    if (!type) {
      return null;
    }
    
    // For dot notation
    if (key.includes('.')) {
      const parts = key.split('.');
      if (parts.length > 1) {
        return parts.slice(1).join('.');
      }
    }
    
    // For bracket notation
    const bracketMatch = key.match(/\[(?:\d+:)?([^\]]+)\]/);
    if (bracketMatch) {
      return bracketMatch[1];
    }
    
    return null;
  }
}
