import { RelationshipType, RelatedField } from './relationshipGraph';
import { inferGenderFromTerm } from './genderUtils';

/**
 * Represents a single relationship entry in a RelationshipSet
 */
export interface RelationshipEntry {
  type: RelationshipType;
  value: string;
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
      if (key.startsWith('RELATED')) {
        // Extract type from key format: RELATED[type] or RELATED[index:type]
        const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
        if (typeMatch && typeMatch[1]) {
          let type = typeMatch[1];
          
          // Normalize gendered relationship terms to genderless ones
          const inferred = inferGenderFromTerm(type);
          if (inferred) {
            type = inferred.type;
          }
          
          // Validate that the type is a valid RelationshipType
          if (!RelationshipSet.VALID_RELATIONSHIP_TYPES.includes(type as RelationshipType)) {
            continue; // Skip invalid relationship types
          }
          
          // Check if value is blank/empty
          if (RelationshipSet.isBlankValue(value)) {
            continue; // Skip blank values
          }
          
          const stringValue = String(value || '').trim();
          
          entries.push({ type: type as RelationshipType, value: stringValue });
        }
      }
    }

    return new RelationshipSet(entries);
  }

  /**
   * Create a RelationshipSet from RelatedField array (from graph)
   */
  static fromRelatedFields(fields: RelatedField[]): RelationshipSet {
    const entries = fields
      .filter(field => {
        // Filter out blank values
        const value = String(field.value || '').trim();
        return value && value !== 'null' && value !== 'undefined';
      })
      .map(field => ({
        type: field.type,
        value: String(field.value).trim()
      }));

    return new RelationshipSet(entries);
  }

  /**
   * Add a relationship entry to the set
   */
  add(type: RelationshipType, value: string): void {
    // Validate relationship type
    if (!RelationshipSet.VALID_RELATIONSHIP_TYPES.includes(type)) {
      throw new Error(`Invalid relationship type: ${type}`);
    }

    // Validate value is not blank
    if (RelationshipSet.isBlankValue(value)) {
      return; // Silently skip blank values
    }

    const trimmedValue = value.trim();

    this.entries.push({ type, value: trimmedValue });
    this.normalizeInPlace();
  }

  /**
   * Remove entries matching the given criteria
   */
  remove(predicate: (entry: RelationshipEntry) => boolean): void {
    this.entries = this.entries.filter(entry => !predicate(entry));
  }

  /**
   * Remove all entries of a specific type and value
   */
  removeByTypeAndValue(type: RelationshipType, value: string): void {
    this.remove(entry => entry.type === type && entry.value === value);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get all entries as a readonly array
   */
  getEntries(): readonly RelationshipEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries grouped by relationship type
   */
  getEntriesByType(): Map<RelationshipType, RelationshipEntry[]> {
    const grouped = new Map<RelationshipType, RelationshipEntry[]>();
    
    for (const entry of this.entries) {
      if (!grouped.has(entry.type)) {
        grouped.set(entry.type, []);
      }
      grouped.get(entry.type)!.push(entry);
    }
    
    return grouped;
  }

  /**
   * Convert to front matter field representation with proper indexing
   */
  toFrontMatterFields(): Record<string, string> {
    const fields: Record<string, string> = {};
    const typeCounts = new Map<RelationshipType, number>();

    // Sort entries for deterministic output
    const sortedEntries = [...this.entries].sort((a, b) => {
      // Sort by type first, then by value
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.value.localeCompare(b.value);
    });

    for (const entry of sortedEntries) {
      const currentCount = typeCounts.get(entry.type) || 0;
      typeCounts.set(entry.type, currentCount + 1);

      // First entry of each type uses RELATED[type], subsequent ones use RELATED[index:type]
      const key = currentCount === 0 
        ? `RELATED[${entry.type}]` 
        : `RELATED[${currentCount}:${entry.type}]`;
        
      fields[key] = entry.value;
    }

    return fields;
  }

  /**
   * Convert to RelatedField array for graph operations
   */
  toRelatedFields(): RelatedField[] {
    return this.entries.map(entry => ({
      type: entry.type,
      value: entry.value
    }));
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
   * Create a copy of this RelationshipSet
   */
  clone(): RelationshipSet {
    return new RelationshipSet([...this.entries]);
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
   * Check if a value is blank or should be filtered out
   */
  private static isBlankValue(value: any): boolean {
    const stringValue = String(value || '').trim();
    return !stringValue || stringValue === 'null' || stringValue === 'undefined';
  }

  /**
   * Normalize entries by filtering and deduplicating
   */
  private normalizeEntries(entries: RelationshipEntry[]): RelationshipEntry[] {
    const normalized: RelationshipEntry[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      // Skip invalid types
      if (!RelationshipSet.VALID_RELATIONSHIP_TYPES.includes(entry.type)) {
        continue;
      }

      // Skip blank values
      if (RelationshipSet.isBlankValue(entry.value)) {
        continue;
      }

      const value = entry.value.trim();

      // Skip duplicates
      const key = `${entry.type}:${value}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push({ type: entry.type, value });
    }

    return normalized;
  }

  /**
   * Normalize entries in place
   */
  private normalizeInPlace(): void {
    this.entries = this.normalizeEntries(this.entries);
  }
}