/**
 * Frontmatter entity representing YAML metadata in contact notes
 * 
 * Frontmatter is immutable - all mutation operations return new instances.
 * Supports both nested and flat access patterns for compatibility.
 */

import * as yaml from 'yaml';
import { UID } from '../valueObjects/UID';
import { Gender } from '../valueObjects/Gender';
import { Revision } from '../valueObjects/Revision';

/**
 * Validation result for frontmatter data
 */
export interface FrontmatterValidationResult {
  isValid: boolean;
  issues: string[];
}

/**
 * Frontmatter entity - immutable YAML metadata container
 */
export class Frontmatter {
  private readonly data: Record<string, any>;

  /**
   * Create frontmatter from data object
   * @param data - Key-value pairs for frontmatter
   */
  constructor(data?: Record<string, any>) {
    // Deep clone to ensure immutability
    this.data = data ? JSON.parse(JSON.stringify(data)) : {};
  }

  // === Factory Methods ===

  /**
   * Create empty frontmatter
   */
  static empty(): Frontmatter {
    return new Frontmatter();
  }

  /**
   * Create frontmatter from object
   */
  static fromObject(obj: Record<string, any>): Frontmatter {
    return new Frontmatter(obj);
  }

  /**
   * Create frontmatter from YAML string
   * @param yamlString - YAML formatted string
   * @throws Error if YAML is invalid
   */
  static fromYAML(yamlString: string): Frontmatter {
    try {
      const parsed = yaml.parse(yamlString);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('YAML must parse to an object');
      }
      return new Frontmatter(parsed as Record<string, any>);
    } catch (error: any) {
      throw new Error(`Invalid YAML: ${error.message}`);
    }
  }

  // === Access Methods ===

  /**
   * Get value by key
   */
  get(key: string): any {
    return this.data[key];
  }

  /**
   * Get value using dot notation (e.g., "EMAIL.WORK")
   */
  getFlat(key: string): any {
    const parts = key.split('.');
    let current: any = this.data;
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Check if flat key exists (using dot notation)
   */
  hasFlat(key: string): boolean {
    return this.getFlat(key) !== undefined;
  }
  
  /**
   * Find an existing key that matches the given key, ignoring case
   * Useful for case-insensitive key lookups
   * 
   * @param searchKey - Key to search for (case-insensitive)
   * @returns Actual key if found, null otherwise
   */
  findKey(searchKey: string): string | null {
    // Exact match first
    if (searchKey in this.data) {
      return searchKey;
    }
    
    // Case-insensitive match
    const searchKeyLower = searchKey.toLowerCase();
    for (const key of Object.keys(this.data)) {
      if (key.toLowerCase() === searchKeyLower) {
        return key;
      }
    }
    
    return null;
  }

  // === Mutation Methods (return new Frontmatter - immutable) ===

  /**
   * Set value for key (returns new Frontmatter)
   */
  set(key: string, value: any): Frontmatter {
    const newData = { ...this.data, [key]: value };
    return new Frontmatter(newData);
  }

  /**
   * Set value using dot notation (returns new Frontmatter)
   */
  setFlat(key: string, value: any): Frontmatter {
    const parts = key.split('.');
    const newData = JSON.parse(JSON.stringify(this.data));
    
    let current = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
    return new Frontmatter(newData);
  }

  /**
   * Delete key (returns new Frontmatter)
   */
  delete(key: string): Frontmatter {
    const newData = { ...this.data };
    delete newData[key];
    return new Frontmatter(newData);
  }

  /**
   * Delete using dot notation (returns new Frontmatter)
   */
  deleteFlat(key: string): Frontmatter {
    const parts = key.split('.');
    const newData = JSON.parse(JSON.stringify(this.data));
    
    let current = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        return this; // Path doesn't exist, return unchanged
      }
      current = current[part];
    }
    
    delete current[parts[parts.length - 1]];
    return new Frontmatter(newData);
  }

  /**
   * Merge with another frontmatter (returns new Frontmatter)
   * Other's values take precedence
   */
  merge(other: Frontmatter): Frontmatter {
    const merged = { ...this.data, ...other.data };
    return new Frontmatter(merged);
  }

  // === Serialization ===

  /**
   * Convert to YAML string
   */
  toYAML(): string {
    return yaml.stringify(this.data);
  }

  /**
   * Get underlying data object (cloned)
   */
  toObject(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * Convert to flat object with dot notation keys
   */
  toFlatObject(): Record<string, any> {
    const flat: Record<string, any> = {};
    
    const flatten = (obj: any, prefix: string = '') => {
      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value, newKey);
        } else {
          flat[newKey] = value;
        }
      }
    };
    
    flatten(this.data);
    return flat;
  }

  // === Querying ===

  /**
   * Get all top-level keys
   */
  getKeys(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Get all keys in flat notation
   */
  getFlatKeys(): string[] {
    return Object.keys(this.toFlatObject());
  }

  /**
   * Check if frontmatter is empty
   */
  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  // === Validation ===

  /**
   * Validate frontmatter structure
   */
  validate(): FrontmatterValidationResult {
    const issues: string[] = [];
    
    // Basic structure validation
    if (this.data === null || this.data === undefined) {
      issues.push('Frontmatter data is null or undefined');
      return { isValid: false, issues };
    }
    
    if (typeof this.data !== 'object' || Array.isArray(this.data)) {
      issues.push('Frontmatter must be an object');
      return { isValid: false, issues };
    }
    
    return { isValid: true, issues: [] };
  }

  // === Convenience Methods for Common Fields ===

  /**
   * Get UID from frontmatter
   */
  getUID(): UID | null {
    const uid = this.get('UID');
    if (!uid || typeof uid !== 'string') {
      return null;
    }
    try {
      return UID.fromString(uid);
    } catch {
      return null;
    }
  }

  /**
   * Get contact name from frontmatter
   */
  getName(): string | null {
    const name = this.get('FN');
    return typeof name === 'string' ? name : null;
  }

  /**
   * Get gender from frontmatter
   */
  getGender(): Gender | null {
    const gender = this.get('GENDER');
    if (!gender || typeof gender !== 'string') {
      return null;
    }
    try {
      return Gender.fromString(gender);
    } catch {
      return null;
    }
  }

  /**
   * Get revision timestamp from frontmatter
   */
  getRevision(): Revision | null {
    const rev = this.get('REV');
    if (!rev) {
      return null;
    }
    try {
      if (typeof rev === 'string') {
        return Revision.fromString(rev);
      } else if (typeof rev === 'number') {
        return Revision.fromTimestamp(rev);
      }
      return null;
    } catch {
      return null;
    }
  }

  // === Utility ===

  /**
   * String representation for debugging
   */
  toString(): string {
    return `Frontmatter(${Object.keys(this.data).length} keys)`;
  }

  /**
   * Check equality with another frontmatter
   */
  equals(other: Frontmatter): boolean {
    return JSON.stringify(this.data) === JSON.stringify(other.data);
  }
}
