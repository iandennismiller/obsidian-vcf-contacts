/**
 * Markdown operations optimized for data locality with ContactData
 */

import { stringifyYaml } from 'obsidian';
import { ContactData } from './contactData';
import { Gender } from './types';
import { BaseMarkdownSectionOperations } from './baseMarkdownSectionOperations';
import { 
  SECTION_NAMES, 
  HEADING_LEVELS, 
  VCARD_FIELD_TYPES,
  FIELD_GROUPS 
} from './markdownConstants';

/**
 * Markdown operations that work directly with ContactData
 * for optimal cache locality and performance.
 * 
 * Extends BaseMarkdownSectionOperations to use marked library for
 * standard markdown parsing while maintaining domain-specific logic.
 */
export class MarkdownOperations extends BaseMarkdownSectionOperations {

  constructor(contactData: ContactData) {
    super(contactData);
  }

  // === Markdown Rendering (co-located with data access) ===

  /**
   * Render the contact as markdown from vCard record data
   * Groups rendering logic with data access for better cache locality
   */
  mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
    const { NOTE, ...recordWithoutNote } = record;
    const groups = this.groupVCardFields(recordWithoutNote);
    const myNote = NOTE ? NOTE.replace(/\\n/g, '\n') : '';
    let additionalTags = '';
    
    if (recordWithoutNote.CATEGORIES) {
      const tempTags = recordWithoutNote.CATEGORIES.split(',');
      additionalTags = `#${tempTags.join(' #')}`;
    }

    const frontmatter = {
      ...this.sortNameItems(groups.name),
      ...this.sortedPriorityItems(groups.priority),
      ...groups.address,
      ...groups.other
    };

    const relatedSection = this.generateRelatedList(recordWithoutNote, genderLookup);

    return `---\n${stringifyYaml(frontmatter)}---\n${HEADING_LEVELS.SUBSECTION} ${SECTION_NAMES.NOTES}\n${myNote}\n${relatedSection}\n\n${hashtags} ${additionalTags}\n`;
  }

  // === Field Grouping Operations (grouped with rendering) ===

  private groupVCardFields(record: Record<string, any>) {
    const nameKeys = FIELD_GROUPS.NAME as readonly string[];
    const priorityKeys = FIELD_GROUPS.PRIORITY as readonly string[];
    const addressKeys = FIELD_GROUPS.ADDRESS as readonly string[];

    const groups = {
      name: {} as Record<string, any>,
      priority: {} as Record<string, any>,
      address: {} as Record<string, any>,
      other: {} as Record<string, any>
    };

    // Group fields by category for better organization
    for (const [key, value] of Object.entries(record)) {
      const baseKey = key.split('[')[0];
      
      if (nameKeys.includes(baseKey)) {
        groups.name[key] = value;
      } else if (priorityKeys.includes(baseKey)) {
        groups.priority[key] = value;
      } else if (addressKeys.includes(baseKey)) {
        groups.address[key] = value;
      } else {
        groups.other[key] = value;
      }
    }

    return groups;
  }

  private sortNameItems(nameItems: Record<string, any>): Record<string, any> {
    const nameOrder = ["N.PREFIX", "N.GN", "N.MN", "N.FN", "N.SUFFIX", "FN"];
    const sortedNameItems: Record<string, any> = {};

    // Sort name fields in logical order
    nameOrder.forEach(key => {
      if (nameItems[key] !== undefined) {
        sortedNameItems[key] = nameItems[key];
      }
    });

    // Add any remaining name fields
    Object.keys(nameItems).forEach(key => {
      if (!nameOrder.includes(key)) {
        sortedNameItems[key] = nameItems[key];
      }
    });

    return sortedNameItems;
  }

  private sortedPriorityItems(priorityItems: Record<string, any>): Record<string, any> {
    const priorityOrder = [
      "EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", 
      "PHOTO", "RELATED", "GENDER"
    ];
    const sortedPriorityItems: Record<string, any> = {};

    // Sort priority fields in logical order
    priorityOrder.forEach(baseKey => {
      Object.keys(priorityItems).forEach(key => {
        if (key.startsWith(baseKey)) {
          sortedPriorityItems[key] = priorityItems[key];
        }
      });
    });

    return sortedPriorityItems;
  }

  // === Related List Generation (co-located with markdown operations) ===

  private generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
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

  // === Helper Methods (grouped with related functionality) ===

  private extractRelationshipTypeFromKey(key: string): string {
    const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return typeMatch ? typeMatch[1] || 'related' : 'related';
  }

  private parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    if (value.startsWith('urn:uuid:')) {
      return { type: 'uuid', value: value.substring(9) };
    } else if (value.startsWith('uid:')) {
      return { type: 'uid', value: value.substring(4) };
    } else if (value.startsWith('name:')) {
      return { type: 'name', value: value.substring(5) };
    }
    return null;
  }

  private getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const mapping: Record<string, { M: string; F: string; default: string }> = {
      parent: { M: 'father', F: 'mother', default: 'parent' },
      auncle: { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
      child: { M: 'son', F: 'daughter', default: 'child' },
      sibling: { M: 'brother', F: 'sister', default: 'sibling' },
      grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
      grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
      spouse: { M: 'husband', F: 'wife', default: 'spouse' },
      friend: { M: 'friend', F: 'friend', default: 'friend' },
      colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
      acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' }
    };

    const typeMapping = mapping[relationshipType.toLowerCase()];
    if (!typeMapping) return relationshipType;

    if (contactGender === 'M') return typeMapping.M;
    if (contactGender === 'F') return typeMapping.F;
    return typeMapping.default;
  }

  // === Content Analysis Operations (grouped with markdown processing) ===

  /**
   * Extract specific sections from markdown content
   * Groups content parsing with markdown operations for data locality
   * 
   * @deprecated Use extractMarkdownSections() from BaseMarkdownSectionOperations
   * This method is maintained for backward compatibility
   */
  async extractMarkdownSections(): Promise<Map<string, string>> {
    // Delegate to base class implementation using marked
    return super.extractMarkdownSections();
  }

  /**
   * Update a specific section in the markdown content
   * 
   * @deprecated Use updateSection() from BaseMarkdownSectionOperations
   * This method is maintained for backward compatibility
   */
  async updateMarkdownSection(sectionName: string, newContent: string): Promise<void> {
    // Delegate to base class implementation using marked
    await super.updateSection(sectionName, newContent);
  }
}