import { RelationshipType, RelatedField } from './relationshipGraph';
import { normalizeRelationshipTerm } from './genderUtils';

/**
 * Represents a single relationship entry in a RelationshipSet
 */
export interface RelationshipEntry {
  type: RelationshipType;
  value: string; // urn:uuid:..., uid:..., or name:...
}

/**
 * A formalized class for managing RELATED front matter fields with consistent,
 * deterministic behavior for serialization and deserialization.
 * 
 * This class ensures:
 * - Relationship types are normalized to genderless forms
 * - Arrays are properly reindexed when items are removed
 * - Orphaned indices are cleaned up
 * - Blank values are filtered out
 * - Invalid relationship types are rejected
 */
export class RelationshipSet {
  private entries: RelationshipEntry[] = [];
  
  // Valid relationship types for validation
  private static readonly VALID_RELATIONSHIP_TYPES: RelationshipType[] = [
    'parent', 'child', 'sibling', 'spouse', 'friend',
    'colleague', 'relative', 'auncle', 'nibling',
    'grandparent', 'grandchild', 'cousin', 'partner'
  ];

  constructor(entries: RelationshipEntry[] = []) {
    this.entries = this.normalizeEntries(entries);
  }

  /**
   * Create a RelationshipSet from front matter fields
   */
  static fromFrontMatter(frontmatter: Record<string, any>): RelationshipSet {
    const entries: RelationshipEntry[] = [];
    
    for (const [key, value] of Object.entries(frontmatter)) {
      // Match RELATED field pattern: RELATED.TYPE[N] or RELATED.TYPE
      const match = key.match(/^RELATED\.([A-Z]+)(?:\[(\d+)\])?$/i);
      if (!match) continue;
      
      const typeString = match[1].toLowerCase();
      const normalizedType = normalizeRelationshipTerm(typeString);
      
      if (!normalizedType || this.isBlankValue(value)) continue;
      
      entries.push({
        type: normalizedType,
        value: String(value).trim()
      });
    }
    
    return new RelationshipSet(entries);
  }

  /**
   * Create a RelationshipSet from RelatedField array
   */
  static fromRelatedFields(relatedFields: RelatedField[]): RelationshipSet {
    const entries: RelationshipEntry[] = relatedFields
      .filter(field => !this.isBlankValue(field.value))
      .map(field => ({
        type: field.type,
        value: field.value.trim()
      }));
    
    return new RelationshipSet(entries);
  }

  /**
   * Add a relationship entry
   */
  add(type: RelationshipType, value: string): void {
    if (RelationshipSet.isBlankValue(value) || !RelationshipSet.VALID_RELATIONSHIP_TYPES.includes(type)) {
      return;
    }
    
    const trimmedValue = value.trim();
    
    // Check for duplicates
    const exists = this.entries.some(entry => 
      entry.type === type && entry.value === trimmedValue
    );
    
    if (!exists) {
      this.entries.push({ type, value: trimmedValue });
      this.normalizeInPlace();
    }
  }

  /**
   * Remove a relationship entry
   */
  remove(type: RelationshipType, value: string): void {
    this.entries = this.entries.filter(entry => 
      !(entry.type === type && entry.value === value)
    );
    this.normalizeInPlace();
  }

  /**
   * Get all entries
   */
  getEntries(): RelationshipEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by type
   */
  getEntriesByType(type: RelationshipType): RelationshipEntry[] {
    return this.entries.filter(entry => entry.type === type);
  }

  /**
   * Check if the set contains a specific relationship
   */
  has(type: RelationshipType, value: string): boolean {
    return this.entries.some(entry => 
      entry.type === type && entry.value === value
    );
  }

  /**
   * Get the number of entries
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Check if the set is empty
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Convert to front matter fields
   */
  toFrontMatterFields(): Record<string, string> {
    const fields: Record<string, string> = {};
    const typeCounts: Record<RelationshipType, number> = {} as Record<RelationshipType, number>;
    
    // Initialize counts
    for (const type of RelationshipSet.VALID_RELATIONSHIP_TYPES) {
      typeCounts[type] = 0;
    }
    
    // Process entries in their current order (not sorted)
    for (const entry of this.entries) {
      typeCounts[entry.type]++;
      const key = `RELATED.${entry.type.toUpperCase()}[${typeCounts[entry.type]}]`;
      fields[key] = entry.value;
    }
    
    return fields;
  }

  /**
   * Convert to RelatedField array
   */
  toRelatedFields(): RelatedField[] {
    return this.entries.map(entry => ({
      type: entry.type,
      value: entry.value
    }));
  }

  /**
   * Merge with another RelationshipSet
   */
  merge(other: RelationshipSet): RelationshipSet {
    const allEntries = [...this.entries, ...other.entries];
    return new RelationshipSet(allEntries);
  }

  /**
   * Check if two RelationshipSets are equal (same entries in any order)
   */
  equals(other: RelationshipSet): boolean {
    if (this.entries.length !== other.entries.length) {
      return false;
    }

    // Sort both sets and compare
    const thisEntries = [...this.entries].sort((a, b) => 
      a.type.localeCompare(b.type) || a.value.localeCompare(b.value)
    );
    const otherEntries = [...other.entries].sort((a, b) => 
      a.type.localeCompare(b.type) || a.value.localeCompare(b.value)
    );

    return thisEntries.every((entry, i) => 
      entry.type === otherEntries[i].type && entry.value === otherEntries[i].value
    );
  }

  /**
   * Create a copy of this RelationshipSet
   */
  clone(): RelationshipSet {
    return new RelationshipSet([...this.entries]);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Check if a value is blank/empty
   */
  private static isBlankValue(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }

  /**
   * Normalize entries by filtering and deduplicating
   */
  private normalizeEntries(entries: RelationshipEntry[]): RelationshipEntry[] {
    const seen = new Set<string>();
    const normalized: RelationshipEntry[] = [];
    
    for (const entry of entries) {
      // Skip invalid relationship types
      if (!RelationshipSet.VALID_RELATIONSHIP_TYPES.includes(entry.type)) {
        continue;
      }
      
      // Skip blank values
      if (RelationshipSet.isBlankValue(entry.value)) {
        continue;
      }
      
      const trimmedValue = entry.value.trim();
      const key = `${entry.type}:${trimmedValue}`;
      
      // Skip duplicates
      if (seen.has(key)) {
        continue;
      }
      
      seen.add(key);
      normalized.push({
        type: entry.type,
        value: trimmedValue
      });
    }
    
    return normalized; // Don't sort here to preserve insertion order
  }

  /**
   * Normalize entries in place
   */
  private normalizeInPlace(): void {
    this.entries = this.normalizeEntries(this.entries);
  }
}