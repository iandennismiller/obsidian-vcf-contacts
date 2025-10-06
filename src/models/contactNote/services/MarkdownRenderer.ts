/**
 * MarkdownRenderer - Service for rendering contact notes as markdown
 * 
 * This service handles the conversion of vCard record data into
 * properly formatted Obsidian markdown with frontmatter.
 */

import { stringify as stringifyYaml } from 'yaml';
import { Gender } from '../types';
import { FieldGrouper } from '../entities/fields';
import { RelationshipType } from '../entities/relationships';
import { HEADING_LEVELS, SECTION_NAMES } from '../markdownConstants';

/**
 * Parsed relationship value from frontmatter
 */
interface ParsedRelatedValue {
  /** Type of reference: 'uid' or 'name' */
  type: 'uid' | 'name';
  /** The UID or name value */
  value: string;
}

/**
 * MarkdownRenderer - Renders contact vCard data as markdown
 * 
 * Provides a clean interface for converting vCard record data into
 * Obsidian-compatible markdown with YAML frontmatter and structured sections.
 */
export class MarkdownRenderer {
  /**
   * Render a vCard record as complete markdown
   * 
   * Converts vCard field data into a formatted markdown document with:
   * - YAML frontmatter (sorted by field importance)
   * - Notes section
   * - Related section (with gender-aware relationship terms)
   * - Hashtags
   * 
   * @param record - vCard record data
   * @param hashtags - Hashtags to append to the document
   * @param genderLookup - Optional function to lookup contact gender for relationship terms
   * @returns Formatted markdown string
   * 
   * @example
   * ```typescript
   * const record = {
   *   'N.FN': 'Doe',
   *   'N.GN': 'John',
   *   'EMAIL.WORK': 'john@example.com',
   *   'NOTE': 'Some notes'
   * };
   * 
   * const markdown = MarkdownRenderer.render(record, '#contact');
   * ```
   */
  static render(
    record: Record<string, any>,
    hashtags: string,
    genderLookup?: (contactRef: string) => Gender
  ): string {
    // Extract NOTE field separately as it goes in the body
    const { NOTE, ...recordWithoutNote } = record;
    
    // Group fields into semantic categories
    const groups = FieldGrouper.groupVCardFields(recordWithoutNote);
    
    // Process notes
    const myNote = NOTE ? NOTE.replace(/\\n/g, '\n') : '';
    
    // Extract additional tags from CATEGORIES
    let additionalTags = '';
    if (recordWithoutNote.CATEGORIES) {
      const tempTags = recordWithoutNote.CATEGORIES.split(',');
      additionalTags = `#${tempTags.join(' #')}`;
    }

    // Build frontmatter in priority order
    const frontmatter = {
      ...FieldGrouper.sortNameItems(groups.name),
      ...FieldGrouper.sortedPriorityItems(groups.priority),
      ...groups.address,
      ...groups.other
    };

    // Generate Related section
    const relatedSection = this.generateRelatedList(recordWithoutNote, genderLookup);

    // Assemble complete markdown document
    return `---\n${stringifyYaml(frontmatter)}---\n${HEADING_LEVELS.SUBSECTION} ${SECTION_NAMES.NOTES}\n${myNote}\n${relatedSection}\n\n${hashtags} ${additionalTags}\n`;
  }

  /**
   * Generate the Related section from frontmatter RELATED fields
   * 
   * Processes RELATED fields from the record and formats them as
   * a markdown list with optional gender-aware relationship terms.
   * 
   * @param record - vCard record data (without NOTE field)
   * @param genderLookup - Optional function to lookup contact gender
   * @returns Formatted Related section markdown
   * 
   * @private
   */
  private static generateRelatedList(
    record: Record<string, any>,
    genderLookup?: (contactRef: string) => Gender
  ): string {
    const relatedEntries: string[] = [];

    // Process RELATED fields from frontmatter
    Object.entries(record).forEach(([key, value]) => {
      if (key.startsWith('RELATED')) {
        const relationshipType = this.extractRelationshipTypeFromKey(key);
        const parsedValue = this.parseRelatedValue(value as string);
        
        if (parsedValue) {
          let contactName = parsedValue.value;
          let displayType = relationshipType;
          
          // Apply gender-based relationship terms if gender lookup is available
          if (genderLookup && parsedValue.type === 'name') {
            const contactGender = genderLookup(contactName);
            if (contactGender) {
              displayType = this.getGenderedRelationshipTerm(relationshipType, contactGender);
            }
          }
          
          relatedEntries.push(`- ${displayType} [[${contactName}]]`);
        }
      }
    });

    if (relatedEntries.length === 0) {
      return `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.RELATED}\n`;
    }

    return `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.RELATED}\n${relatedEntries.join('\n')}\n`;
  }

  /**
   * Extract relationship type from frontmatter key
   * 
   * @param key - Frontmatter key (e.g., "RELATED[Spouse]")
   * @returns Relationship type string
   * 
   * @private
   */
  private static extractRelationshipTypeFromKey(key: string): string {
    return RelationshipType.fromFrontmatterKey(key).toString();
  }

  /**
   * Parse a RELATED field value
   * 
   * Determines if the value is a UID reference or a name reference.
   * 
   * @param value - RELATED field value
   * @returns Parsed value with type and content, or null if invalid
   * 
   * @private
   */
  private static parseRelatedValue(value: string): ParsedRelatedValue | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    
    // UID format: urn:uuid:xxx-xxx-xxx
    if (trimmed.startsWith('urn:uuid:')) {
      return { type: 'uid', value: trimmed };
    }
    
    // Name format: anything else
    return { type: 'name', value: trimmed };
  }

  /**
   * Get gendered relationship term based on contact gender
   * 
   * @param type - Relationship type
   * @param gender - Contact gender
   * @returns Gender-appropriate relationship term
   * 
   * @private
   */
  private static getGenderedRelationshipTerm(type: string, gender: Gender): string {
    return RelationshipType.getGenderedTerm(type, gender);
  }
}
