import { RelationshipType } from './relationshipTypes';

/**
 * A utility class for managing sets of relationships with consistent ordering
 */
export class RelationshipSet {
  private relationships: Map<string, { type: RelationshipType; value: string }>;

  constructor(entries: { type: RelationshipType; value: string }[] = []) {
    this.relationships = new Map();
    
    // Add entries and maintain sorted order
    for (const entry of entries) {
      this.add(entry.type, entry.value);
    }
  }

  /**
   * Create a RelationshipSet from front matter
   */
  static fromFrontMatter(frontMatter: Record<string, any>): RelationshipSet {
    const entries: { type: RelationshipType; value: string }[] = [];
    
    // Parse RELATED fields from front matter
    for (const [key, value] of Object.entries(frontMatter)) {
      if (key.startsWith('RELATED[') && value) {
        // Extract type from key like "RELATED[friend]" or "RELATED[1:parent]"
        const match = key.match(/^RELATED\[(?:\d+:)?(.+)\]$/);
        if (match) {
          const type = match[1] as RelationshipType;
          entries.push({ type, value: String(value) });
        }
      }
    }
    
    return new RelationshipSet(entries);
  }

  /**
   * Add a relationship to the set
   */
  add(type: RelationshipType, value: string): void {
    const key = `${type}:${value}`;
    this.relationships.set(key, { type, value });
  }

  /**
   * Remove a relationship from the set
   */
  remove(type: RelationshipType, value: string): void {
    const key = `${type}:${value}`;
    this.relationships.delete(key);
  }

  /**
   * Check if a relationship exists in the set
   */
  has(type: RelationshipType, value: string): boolean {
    const key = `${type}:${value}`;
    return this.relationships.has(key);
  }

  /**
   * Get all relationships as sorted entries
   */
  getEntries(): { type: RelationshipType; value: string }[] {
    const entries = Array.from(this.relationships.values());
    
    // Sort by type first, then by value
    return entries.sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return a.value.localeCompare(b.value);
    });
  }

  /**
   * Get the size of the set
   */
  size(): number {
    return this.relationships.size;
  }

  /**
   * Clear all relationships
   */
  clear(): void {
    this.relationships.clear();
  }

  /**
   * Clone the relationship set
   */
  clone(): RelationshipSet {
    return new RelationshipSet(this.getEntries());
  }

  /**
   * Merge another RelationshipSet into this one
   */
  merge(other: RelationshipSet): void {
    for (const entry of other.getEntries()) {
      this.add(entry.type, entry.value);
    }
  }

  /**
   * Check if this set is equivalent to another set
   */
  equals(other: RelationshipSet): boolean {
    if (this.size() !== other.size()) {
      return false;
    }

    const thisEntries = this.getEntries();
    const otherEntries = other.getEntries();

    for (let i = 0; i < thisEntries.length; i++) {
      if (thisEntries[i].type !== otherEntries[i].type || 
          thisEntries[i].value !== otherEntries[i].value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get relationships of a specific type
   */
  getByType(type: RelationshipType): string[] {
    return this.getEntries()
      .filter(entry => entry.type === type)
      .map(entry => entry.value);
  }

  /**
   * Convert to front matter format with indexed keys
   */
  toFrontMatter(): Record<string, string> {
    const frontMatter: Record<string, string> = {};
    const entriesByType: Record<RelationshipType, string[]> = {} as Record<RelationshipType, string[]>;
    
    // Group entries by type
    for (const entry of this.getEntries()) {
      if (!entriesByType[entry.type]) {
        entriesByType[entry.type] = [];
      }
      entriesByType[entry.type].push(entry.value);
    }
    
    // Generate front matter keys
    for (const [type, values] of Object.entries(entriesByType)) {
      for (let i = 0; i < values.length; i++) {
        let key: string;
        if (i === 0) {
          key = `RELATED[${type}]`;
        } else {
          key = `RELATED[${i}:${type}]`;
        }
        frontMatter[key] = values[i];
      }
    }
    
    return frontMatter;
  }

  /**
   * Get a set of differences between this set and another
   */
  diff(other: RelationshipSet): {
    added: { type: RelationshipType; value: string }[];
    removed: { type: RelationshipType; value: string }[];
  } {
    const added: { type: RelationshipType; value: string }[] = [];
    const removed: { type: RelationshipType; value: string }[] = [];
    
    // Find entries in this set but not in other (added)
    for (const entry of this.getEntries()) {
      if (!other.has(entry.type, entry.value)) {
        added.push(entry);
      }
    }
    
    // Find entries in other set but not in this (removed)
    for (const entry of other.getEntries()) {
      if (!this.has(entry.type, entry.value)) {
        removed.push(entry);
      }
    }
    
    return { added, removed };
  }
}