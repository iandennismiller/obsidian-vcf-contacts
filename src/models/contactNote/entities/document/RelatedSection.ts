/**
 * RelatedSection - Markdown section for relationship listings
 * 
 * Extends MarkdownSection to provide relationship-specific functionality
 * including parsing relationship lists and converting to markdown format.
 */

import { MarkdownSection } from './MarkdownSection';
import { Relationship } from '../relationships/Relationship';
import { RelationshipType } from '../relationships/RelationshipType';
import { RelationshipReference } from '../relationships/RelationshipReference';

/**
 * Parsed relationship from Related section
 */
export interface ParsedRelationship {
  type: string;
  contactName: string;
  uid?: string;
}

/**
 * Validation result for Related section
 */
export interface RelatedValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * RelatedSection represents the ## Related section in contact notes
 * containing lists of relationships to other contacts.
 */
export class RelatedSection extends MarkdownSection {
  private relationships: Relationship[];

  private constructor(name: string, level: number, content: string, relationships: Relationship[]) {
    super(name, level, content);
    this.relationships = relationships;
  }

  /**
   * Create RelatedSection from markdown content
   */
  static fromMarkdown(content: string, sectionName: string = 'Related', level: number = 2): RelatedSection {
    const section = new RelatedSection(sectionName, level, content, []);
    section.relationships = section.parse();
    return section;
  }

  /**
   * Create RelatedSection from relationships
   */
  static fromRelationships(relationships: Relationship[], sectionName: string = 'Related', level: number = 2): RelatedSection {
    // Generate content first
    const content = RelatedSection.generateContentFromRelationships(relationships);
    return new RelatedSection(sectionName, level, content, relationships);
  }

  /**
   * Create empty RelatedSection
   */
  static empty(sectionName: string = 'Related', level: number = 2): RelatedSection {
    return new RelatedSection(sectionName, level, '', []);
  }

  /**
   * Parse section content into Relationship entities
   */
  parse(): Relationship[] {
    const relationships: Relationship[] = [];
    const lines = this.content.trim().split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('-')) {
        continue;
      }

      try {
        const relationship = Relationship.fromMarkdown(trimmed);
        relationships.push(relationship);
      } catch (error) {
        // Skip invalid relationship lines
        continue;
      }
    }

    return relationships;
  }

  /**
   * Validate section structure
   */
  validate(): RelatedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if section has content
    if (this.isEmpty() && this.relationships.length > 0) {
      errors.push('Section has relationships but no content');
    }

    // Validate each relationship
    for (const rel of this.relationships) {
      const validation = rel.validate();
      if (!validation.isValid) {
        errors.push(...validation.errors.map(e => `Relationship validation: ${e}`));
      }
    }

    // Check for duplicate relationships
    const seen = new Set<string>();
    for (const rel of this.relationships) {
      const key = `${rel.getType().toString()}:${rel.getTarget().toString()}`;
      if (seen.has(key)) {
        warnings.push(`Duplicate relationship: ${key}`);
      }
      seen.add(key);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get all relationships in the section
   */
  getRelationships(): Relationship[] {
    return [...this.relationships];
  }

  /**
   * Get relationships of a specific type
   */
  getRelationshipsByType(type: string): Relationship[] {
    const searchType = RelationshipType.fromString(type);
    return this.relationships.filter(rel => rel.getType().equals(searchType));
  }

  /**
   * Check if section has a specific relationship
   */
  hasRelationship(relationship: Relationship): boolean {
    return this.relationships.some(rel => rel.equals(relationship));
  }

  /**
   * Add a relationship (returns new section)
   */
  addRelationship(relationship: Relationship): RelatedSection {
    const newRelationships = [...this.relationships, relationship];
    return RelatedSection.fromRelationships(newRelationships, this.name, this.level);
  }

  /**
   * Remove a relationship (returns new section)
   */
  removeRelationship(relationship: Relationship): RelatedSection {
    const newRelationships = this.relationships.filter(rel => !rel.equals(relationship));
    return RelatedSection.fromRelationships(newRelationships, this.name, this.level);
  }

  /**
   * Generate content from relationships (static helper)
   */
  private static generateContentFromRelationships(relationships: Relationship[]): string {
    if (relationships.length === 0) {
      return '';
    }

    const lines = relationships.map(rel => rel.toMarkdown());
    return lines.join('\n');
  }

  /**
   * Generate content from relationships
   */
  private generateContent(): string {
    return RelatedSection.generateContentFromRelationships(this.relationships);
  }

  /**
   * Convert to markdown format
   */
  toMarkdown(): string {
    const heading = '#'.repeat(this.level) + ` ${this.name}`;
    if (this.relationships.length === 0) {
      return `${heading}\n`;
    }
    const content = this.generateContent();
    return `${heading}\n${content}`;
  }

  /**
   * Get parsed relationships (compatible with old format)
   */
  getParsedRelationships(): ParsedRelationship[] {
    return this.relationships.map(rel => ({
      type: rel.getType().toString(),
      contactName: rel.getTarget().isNameReference() 
        ? rel.getTarget().getValue() 
        : `uid:${rel.getTarget().getUID()!.toString()}`,
      uid: rel.getTarget().isUIDReference() 
        ? rel.getTarget().getUID()!.toString() 
        : undefined
    }));
  }
}
