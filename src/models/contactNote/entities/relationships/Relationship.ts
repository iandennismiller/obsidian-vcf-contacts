/**
 * Relationship represents a connection between two contacts.
 * 
 * This entity encapsulates all relationship logic including:
 * - Type management with gender-aware terminology
 * - Contact references (UID or name-based)
 * - Reciprocal relationship logic
 * - Serialization to/from markdown and frontmatter
 */

import { RelationshipType } from './RelationshipType';
import { RelationshipReference } from './RelationshipReference';
import { Gender } from '../valueObjects/Gender';

/**
 * Validation result for relationships
 */
export interface RelationshipValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Relationship entity representing a connection between contacts
 */
export class Relationship {
  private readonly type: RelationshipType;
  private readonly target: RelationshipReference;

  private constructor(type: RelationshipType, target: RelationshipReference) {
    this.type = type;
    this.target = target;
  }

  /**
   * Create a Relationship from type and target
   */
  static create(type: RelationshipType, target: RelationshipReference): Relationship {
    return new Relationship(type, target);
  }

  /**
   * Parse a relationship from markdown format
   * Examples:
   *   "- spouse [[John Doe]]"
   *   "- father [[uid:123-456|Dad]]"
   *   "- friend [[Jane Smith]]"
   */
  static fromMarkdown(markdown: string): Relationship {
    if (!markdown || typeof markdown !== 'string') {
      throw new Error('Markdown must be a non-empty string');
    }

    const trimmed = markdown.trim();
    
    // Remove leading "- " if present
    const withoutDash = trimmed.startsWith('- ') ? trimmed.substring(2) : trimmed;
    
    // Find the first wikilink
    const wikilinkMatch = withoutDash.match(/\[\[.+?\]\]/);
    if (!wikilinkMatch) {
      throw new Error('Markdown must contain a wikilink reference');
    }

    // Extract type (everything before the wikilink)
    const typeStr = withoutDash.substring(0, wikilinkMatch.index).trim();
    if (!typeStr) {
      throw new Error('Relationship type is required');
    }

    const type = RelationshipType.fromString(typeStr);
    const target = RelationshipReference.fromString(wikilinkMatch[0]);

    return new Relationship(type, target);
  }

  /**
   * Parse a relationship from frontmatter format
   * Format: { key: "spouse", value: "uid:123-456" } or { key: "spouse", value: "John Doe" }
   */
  static fromFrontmatter(entry: { key: string; value: string }): Relationship {
    if (!entry || !entry.key || !entry.value) {
      throw new Error('Frontmatter entry must have key and value');
    }

    const type = RelationshipType.fromString(entry.key);
    const target = RelationshipReference.fromString(entry.value);

    return new Relationship(type, target);
  }

  /**
   * Get the relationship type
   */
  getType(): RelationshipType {
    return this.type;
  }

  /**
   * Get the target reference
   */
  getTarget(): RelationshipReference {
    return this.target;
  }

  /**
   * Get gender-aware relationship term
   */
  getGenderedTerm(targetGender: Gender): string {
    return this.type.getGenderedTerm(targetGender);
  }

  /**
   * Get the reciprocal relationship
   * For example: if this is "parent" -> child, reciprocal is "child" -> parent
   */
  getReciprocalType(): RelationshipType {
    return this.type.getReciprocal();
  }

  /**
   * Create the reciprocal relationship for the target contact
   * This is used for bidirectional relationship sync
   */
  createReciprocal(sourceReference: RelationshipReference): Relationship {
    const reciprocalType = this.getReciprocalType();
    return new Relationship(reciprocalType, sourceReference);
  }

  /**
   * Validate this relationship
   */
  validate(): RelationshipValidation {
    const errors: string[] = [];

    // Type must be present
    if (!this.type) {
      errors.push('Relationship type is required');
    }

    // Target must be present
    if (!this.target) {
      errors.push('Relationship target is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert to markdown format
   */
  toMarkdown(targetGender?: Gender, displayName?: string): string {
    const term = targetGender ? this.getGenderedTerm(targetGender) : this.type.toString();
    const wikilink = this.target.toWikilink(displayName);
    return `- ${term} ${wikilink}`;
  }

  /**
   * Convert to frontmatter format
   */
  toFrontmatter(targetGender?: Gender): { key: string; value: string } {
    const term = targetGender ? this.getGenderedTerm(targetGender) : this.type.toString();
    return {
      key: term,
      value: this.target.toFrontmatter(),
    };
  }

  /**
   * Check if this is a family relationship
   */
  isFamilyRelationship(): boolean {
    return this.type.isFamilyRelationship();
  }

  /**
   * Check if this is a professional relationship
   */
  isProfessionalRelationship(): boolean {
    return this.type.isProfessionalRelationship();
  }

  /**
   * Check equality with another relationship
   */
  equals(other: Relationship): boolean {
    if (!other) return false;
    return this.type.equals(other.type) && this.target.equals(other.target);
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `${this.type.toString()} -> ${this.target.toString()}`;
  }
}
