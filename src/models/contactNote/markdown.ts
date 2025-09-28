/**
 * Handles markdown rendering and related operations for contacts
 */

import { stringifyYaml } from 'obsidian';
import { GenderOperations, Gender } from './gender';

export class MarkdownOperations {
  private genderOps: GenderOperations;

  constructor(genderOps: GenderOperations) {
    this.genderOps = genderOps;
  }

  /**
   * Render the contact as markdown from vCard record data
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

    return `---\n${stringifyYaml(frontmatter)}---\n#### Notes\n${myNote}\n${relatedSection}\n\n${hashtags} ${additionalTags}\n`;
  }

  private groupVCardFields(record: Record<string, any>) {
    const nameKeys = ["N", "FN"];
    const priorityKeys = [
      "EMAIL", "TEL", "BDAY", "URL",
      "ORG", "TITLE", "ROLE", "PHOTO", "RELATED", "GENDER"
    ];
    const addressKeys = ["ADR"];

    const groups = {
      name: {} as Record<string, any>,
      priority: {} as Record<string, any>,
      address: {} as Record<string, any>,
      other: {} as Record<string, any>
    };

    for (const [key, value] of Object.entries(record)) {
      const baseKey = this.extractBaseKey(key);
      
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

  private extractBaseKey(key: string): string {
    if (key.includes("[")) {
      return key.split("[")[0];
    } else if (key.includes(".")) {
      return key.split(".")[0];
    }
    return key;
  }

  private sortNameItems(nameItems: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(nameItems).sort(([keyA], [keyB]) => {
        const order = ["N", "FN"];
        const indexA = order.indexOf(keyA.split('.')[0]);
        const indexB = order.indexOf(keyB.split('.')[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
    );
  }

  private sortedPriorityItems(priorityItems: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(priorityItems).sort(([keyA], [keyB]) => {
        const order = ["EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", "PHOTO", "RELATED", "GENDER"];
        const indexA = order.indexOf(keyA.split('.')[0]);
        const indexB = order.indexOf(keyB.split('.')[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
    );
  }

  private generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
    const relatedFields = Object.entries(record).filter(([key]) => 
      this.extractBaseKey(key) === 'RELATED'
    );
    
    if (relatedFields.length === 0) {
      return '';
    }

    const relationships: { type: string; contact: string }[] = [];
    
    relatedFields.forEach(([key, value]) => {
      const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
      const type = typeMatch ? typeMatch[1] || 'related' : 'related';
      
      let contact = '';
      if (typeof value === 'string') {
        if (value.startsWith('urn:uuid:')) {
          contact = value.substring(9);
        } else if (value.startsWith('uid:')) {
          contact = value.substring(4);
        } else if (value.startsWith('name:')) {
          contact = value.substring(5);
        } else {
          contact = value;
        }
        
        // Apply gender lookup if provided
        let displayType = type;
        if (genderLookup) {
          const gender = genderLookup(contact);
          displayType = this.genderOps.getGenderedRelationshipTerm(type, gender);
        }
        
        relationships.push({ type: displayType, contact });
      }
    });

    if (relationships.length === 0) {
      return '';
    }

    const relationshipList = relationships
      .map(rel => `- ${rel.type} [[${rel.contact}]]`)
      .join('\n');

    return `\n## Related\n${relationshipList}\n`;
  }
}