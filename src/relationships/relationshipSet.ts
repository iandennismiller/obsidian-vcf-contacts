import { RelationshipType } from './relationshipGraph';

/**
 * Utility class for managing RELATED fields in front matter
 */
export class RelationshipSet {
  private relationships = new Map<string, Set<string>>(); // type -> set of values

  /**
   * Create from front matter object
   */
  static fromFrontMatter(frontmatter: Record<string, any>): RelationshipSet {
    const set = new RelationshipSet();
    
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED')) {
        // Parse RELATED field key: RELATED or RELATED;TYPE=friend or RELATED;TYPE=friend2
        const typeMatch = key.match(/RELATED(?:;TYPE=([^;]+))?/);
        if (typeMatch) {
          let type = typeMatch[1] || 'relative'; // Default to 'relative' if no type specified
          // Remove any trailing numbers (friend2 -> friend)
          type = type.replace(/\d+$/, '');
          set.add(type as RelationshipType, value as string);
        }
      }
    }

    return set;
  }

  /**
   * Add a relationship
   */
  add(type: RelationshipType, value: string): void {
    if (!this.relationships.has(type)) {
      this.relationships.set(type, new Set());
    }
    this.relationships.get(type)!.add(value);
  }

  /**
   * Remove a relationship
   */
  remove(type: RelationshipType, value: string): void {
    const typeSet = this.relationships.get(type);
    if (typeSet) {
      typeSet.delete(value);
      if (typeSet.size === 0) {
        this.relationships.delete(type);
      }
    }
  }

  /**
   * Check if a relationship exists
   */
  has(type: RelationshipType, value: string): boolean {
    const typeSet = this.relationships.get(type);
    return typeSet ? typeSet.has(value) : false;
  }

  /**
   * Get all relationships of a specific type
   */
  getByType(type: RelationshipType): string[] {
    const typeSet = this.relationships.get(type);
    return typeSet ? Array.from(typeSet).sort() : [];
  }

  /**
   * Get all relationship types
   */
  getAllTypes(): RelationshipType[] {
    return Array.from(this.relationships.keys()) as RelationshipType[];
  }

  /**
   * Get all relationships as array
   */
  getAll(): { type: RelationshipType; value: string }[] {
    const result: { type: RelationshipType; value: string }[] = [];
    
    for (const [type, values] of this.relationships.entries()) {
      for (const value of values) {
        result.push({ type: type as RelationshipType, value });
      }
    }

    return result.sort((a, b) => {
      const typeCmp = a.type.localeCompare(b.type);
      if (typeCmp !== 0) return typeCmp;
      return a.value.localeCompare(b.value);
    });
  }

  /**
   * Get count of all relationships
   */
  size(): number {
    let total = 0;
    for (const values of this.relationships.values()) {
      total += values.size;
    }
    return total;
  }

  /**
   * Clear all relationships
   */
  clear(): void {
    this.relationships.clear();
  }

  /**
   * Merge with another RelationshipSet
   */
  merge(other: RelationshipSet): void {
    for (const { type, value } of other.getAll()) {
      this.add(type, value);
    }
  }

  /**
   * Convert to front matter fields
   */
  toFrontMatterFields(): Record<string, string> {
    const fields: Record<string, string> = {};
    
    for (const [type, values] of this.relationships.entries()) {
      const sortedValues = Array.from(values).sort();
      
      if (sortedValues.length === 1) {
        // Single value: RELATED;TYPE=friend
        fields[`RELATED;TYPE=${type}`] = sortedValues[0];
      } else if (sortedValues.length > 1) {
        // Multiple values: RELATED;TYPE=friend, RELATED;TYPE=friend1, etc.
        sortedValues.forEach((value, index) => {
          const suffix = index === 0 ? '' : (index + 1).toString();
          fields[`RELATED;TYPE=${type}${suffix}`] = value;
        });
      }
    }

    return fields;
  }

  /**
   * Check if this set is equivalent to another
   */
  equals(other: RelationshipSet): boolean {
    if (this.size() !== other.size()) {
      return false;
    }

    for (const { type, value } of this.getAll()) {
      if (!other.has(type, value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a copy of this set
   */
  clone(): RelationshipSet {
    const copy = new RelationshipSet();
    copy.merge(this);
    return copy;
  }
}