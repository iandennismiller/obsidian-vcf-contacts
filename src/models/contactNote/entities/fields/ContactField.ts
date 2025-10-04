/**
 * Abstract base class for contact data fields
 * 
 * Provides common interface for all contact field types (EMAIL, TEL, ADR, URL).
 * Each field type must implement validation, serialization to frontmatter and markdown.
 */

/**
 * Validation result for field validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Frontmatter entry for a field
 */
export interface FrontmatterEntry {
  key: string;
  value: any;
}

/**
 * Abstract base class for all contact fields
 * 
 * Subclasses must implement:
 * - getType(): Return the field type (EMAIL, TEL, ADR, URL)
 * - validate(): Validate the field value
 * - toFrontmatter(): Convert to frontmatter format
 * - toMarkdown(): Convert to markdown format
 */
export abstract class ContactField {
  protected readonly label: string;
  protected readonly value: string;
  
  /**
   * Constructor
   * 
   * @param label - Field label (e.g., "WORK", "HOME", "CELL")
   * @param value - Field value
   */
  constructor(label: string, value: string) {
    this.label = label;
    this.value = value;
  }
  
  /**
   * Get the field type
   * Must be implemented by subclasses
   * 
   * @returns Field type (EMAIL, TEL, ADR, URL)
   */
  abstract getType(): string;
  
  /**
   * Validate the field value
   * Must be implemented by subclasses
   * 
   * @returns Validation result
   */
  abstract validate(): ValidationResult;
  
  /**
   * Convert to frontmatter format
   * Must be implemented by subclasses
   * 
   * @returns Frontmatter entry or array of entries
   */
  abstract toFrontmatter(): FrontmatterEntry | FrontmatterEntry[];
  
  /**
   * Convert to markdown format
   * Must be implemented by subclasses
   * 
   * @returns Markdown string
   */
  abstract toMarkdown(): string;
  
  /**
   * Get the field label
   * 
   * @returns Field label
   */
  getLabel(): string {
    return this.label;
  }
  
  /**
   * Get the field value
   * 
   * @returns Field value
   */
  getValue(): string {
    return this.value;
  }
  
  /**
   * Check equality with another field
   * 
   * @param other - Another ContactField instance
   * @returns True if fields are equal
   */
  equals(other: ContactField | null | undefined): boolean {
    if (!other) {
      return false;
    }
    
    return this.getType() === other.getType() &&
           this.label === other.label &&
           this.value === other.value;
  }
  
  /**
   * String representation
   * 
   * @returns String representation of field
   */
  toString(): string {
    return `${this.getType()}.${this.label}: ${this.value}`;
  }
}
