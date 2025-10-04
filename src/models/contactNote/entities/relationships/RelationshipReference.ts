/**
 * RelationshipReference represents a reference to another contact.
 * It can be either a UID (preferred) or a name-based reference.
 */

import { UID } from '../valueObjects/UID';

/**
 * Type of reference - UID or name
 */
export enum ReferenceType {
  UID = 'uid',
  NAME = 'name',
}

/**
 * RelationshipReference encapsulates how we refer to another contact
 * in a relationship. Prefer UID-based references for stability.
 */
export class RelationshipReference {
  private readonly type: ReferenceType;
  private readonly value: string;
  private readonly uid: UID | null;

  private constructor(type: ReferenceType, value: string, uid: UID | null = null) {
    this.type = type;
    this.value = value;
    this.uid = uid;
  }

  /**
   * Create a UID-based reference (preferred)
   */
  static fromUID(uid: UID): RelationshipReference {
    return new RelationshipReference(ReferenceType.UID, uid.toString(), uid);
  }

  /**
   * Create a name-based reference (fallback)
   */
  static fromName(name: string): RelationshipReference {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Reference name must be a non-empty string');
    }
    return new RelationshipReference(ReferenceType.NAME, name.trim(), null);
  }

  /**
   * Parse a reference from a string that might be a UID, wikilink, or name
   */
  static fromString(value: string): RelationshipReference {
    if (!value || typeof value !== 'string') {
      throw new Error('Reference value must be a non-empty string');
    }

    const trimmed = value.trim();
    
    // Try to extract from wikilink format: [[Name]] or [[uid:xxx|Name]]
    const wikilinkMatch = trimmed.match(/^\[\[(.+?)\]\]$/);
    if (wikilinkMatch) {
      const inner = wikilinkMatch[1];
      
      // Check for UID format: [[uid:xxx|Name]] or [[urn:uuid:xxx|Name]]
      const uidMatch = inner.match(/^(uid:|urn:uuid:)([a-zA-Z0-9\-]+)(?:\|.+)?$/);
      if (uidMatch) {
        const uid = UID.fromString(uidMatch[2]);
        return RelationshipReference.fromUID(uid);
      }
      
      // Plain wikilink: [[Name]]
      return RelationshipReference.fromName(inner);
    }
    
    // Check if it's a raw UID format
    if (trimmed.startsWith('uid:') || trimmed.startsWith('urn:uuid:')) {
      try {
        // Remove the prefix and parse
        const uidValue = trimmed.startsWith('uid:') ? trimmed.substring(4) : trimmed.substring(9);
        const uid = UID.fromString(uidValue);
        return RelationshipReference.fromUID(uid);
      } catch {
        // Not a valid UID, treat as name
        return RelationshipReference.fromName(trimmed);
      }
    }
    
    // Try to parse as a plain UID (UUID or custom format)
    if (UID.validate(trimmed)) {
      try {
        const uid = UID.fromString(trimmed);
        return RelationshipReference.fromUID(uid);
      } catch {
        // Not a valid UID, treat as name
      }
    }
    
    // Default: treat as name
    return RelationshipReference.fromName(trimmed);
  }

  /**
   * Get the reference type
   */
  getType(): ReferenceType {
    return this.type;
  }

  /**
   * Get the reference value (UID string or name)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get the UID if this is a UID-based reference
   */
  getUID(): UID | null {
    return this.uid;
  }

  /**
   * Check if this is a UID-based reference
   */
  isUIDReference(): boolean {
    return this.type === ReferenceType.UID;
  }

  /**
   * Check if this is a name-based reference
   */
  isNameReference(): boolean {
    return this.type === ReferenceType.NAME;
  }

  /**
   * Convert to wikilink format for markdown
   */
  toWikilink(displayName?: string): string {
    if (this.isUIDReference() && this.uid) {
      if (displayName) {
        return `[[uid:${this.uid.toString()}|${displayName}]]`;
      }
      return `[[uid:${this.uid.toString()}]]`;
    }
    
    // Name-based reference
    return `[[${this.value}]]`;
  }

  /**
   * Convert to frontmatter format
   */
  toFrontmatter(): string {
    if (this.isUIDReference() && this.uid) {
      return `uid:${this.uid.toString()}`;
    }
    return this.value;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another reference
   */
  equals(other: RelationshipReference): boolean {
    if (!other) return false;
    
    // If both are UID references, compare UIDs
    if (this.isUIDReference() && other.isUIDReference()) {
      return this.uid?.equals(other.uid!) || false;
    }
    
    // If both are name references, compare names (case-insensitive)
    if (this.isNameReference() && other.isNameReference()) {
      return this.value.toLowerCase() === other.value.toLowerCase();
    }
    
    // Different types
    return false;
  }
}
