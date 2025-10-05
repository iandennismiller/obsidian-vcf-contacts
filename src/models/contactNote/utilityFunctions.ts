/**
 * Standalone utility functions for contact operations
 */

import { TFile } from 'obsidian';
import { VCardForObsidianRecord, VCardKind, VCardKinds } from '../vcardFile';
import { Contact, Gender } from './types';
import { stringify as stringifyYaml } from 'yaml';
import { 
  SECTION_NAMES, 
  HEADING_LEVELS, 
  FIELD_GROUPS 
} from './markdownConstants';

/**
 * Render markdown from vCard record data (standalone function for compatibility)
 */
export function mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
  const { NOTE, ...recordWithoutNote } = record;
  const groups = groupVCardFields(recordWithoutNote);
  const myNote = NOTE ? NOTE.replace(/\\n/g, '\n') : '';
  let additionalTags = '';
  
  if (recordWithoutNote.CATEGORIES) {
    const tempTags = recordWithoutNote.CATEGORIES.split(',');
    additionalTags = `#${tempTags.join(' #')}`;
  }

  const frontmatter = {
    ...sortNameItems(groups.name),
    ...sortedPriorityItems(groups.priority),
    ...groups.address,
    ...groups.other
  };

  const relatedSection = generateRelatedList(recordWithoutNote, genderLookup);

  return `---\n${stringifyYaml(frontmatter)}---\n${HEADING_LEVELS.SUBSECTION} ${SECTION_NAMES.NOTES}\n${myNote}\n${relatedSection}\n\n${hashtags} ${additionalTags}\n`;
}

function groupVCardFields(record: Record<string, any>) {
  const nameKeys = FIELD_GROUPS.NAME as readonly string[];
  const priorityKeys = FIELD_GROUPS.PRIORITY as readonly string[];
  const addressKeys = FIELD_GROUPS.ADDRESS as readonly string[];

  const groups = {
    name: {} as Record<string, any>,
    priority: {} as Record<string, any>,
    address: {} as Record<string, any>,
    other: {} as Record<string, any>
  };

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

function sortNameItems(nameItems: Record<string, any>): Record<string, any> {
  const nameOrder = ["N.PREFIX", "N.GN", "N.MN", "N.FN", "N.SUFFIX", "FN"];
  const sortedNameItems: Record<string, any> = {};

  nameOrder.forEach(key => {
    if (nameItems[key] !== undefined) {
      sortedNameItems[key] = nameItems[key];
    }
  });

  Object.keys(nameItems).forEach(key => {
    if (!nameOrder.includes(key)) {
      sortedNameItems[key] = nameItems[key];
    }
  });

  return sortedNameItems;
}

function sortedPriorityItems(priorityItems: Record<string, any>): Record<string, any> {
  const priorityOrder = [
    "EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", 
    "PHOTO", "RELATED", "GENDER"
  ];
  const sortedPriorityItems: Record<string, any> = {};

  priorityOrder.forEach(baseKey => {
    Object.keys(priorityItems).forEach(key => {
      if (key.startsWith(baseKey)) {
        sortedPriorityItems[key] = priorityItems[key];
      }
    });
  });

  return sortedPriorityItems;
}

function generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
  const relatedEntries: string[] = [];

  Object.entries(record).forEach(([key, value]) => {
    if (key.startsWith('RELATED')) {
      const relationshipType = extractRelationshipTypeFromKey(key);
      const parsedValue = parseRelatedValue(value as string);
      
      if (parsedValue) {
        let contactName = parsedValue.value;
        let displayType = relationshipType;
        
        if (genderLookup && parsedValue.type === 'name') {
          const contactGender = genderLookup(contactName);
          if (contactGender) {
            displayType = getGenderedRelationshipTerm(relationshipType, contactGender);
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

function extractRelationshipTypeFromKey(key: string): string {
  const dotMatch = key.match(/^RELATED\.([^.]+)(?:\.\d+)?$/);
  if (dotMatch) {
    return dotMatch[1];
  }
  
  const bracketMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
  return bracketMatch ? bracketMatch[1] || 'related' : 'related';
}

function parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
  if (value.startsWith('urn:uuid:')) {
    return { type: 'uuid', value: value.substring(9) };
  } else if (value.startsWith('uid:')) {
    return { type: 'uid', value: value.substring(4) };
  } else if (value.startsWith('name:')) {
    return { type: 'name', value: value.substring(5) };
  }
  return null;
}

function getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
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

/**
 * Create a filename slug from a vCard record
 */
export function createNameSlug(record: VCardForObsidianRecord): string {
  let fileName: string | undefined = undefined;
  
  if (isKind(record, VCardKinds.Individual)) {
    fileName = [
      record["N.PREFIX"],
      record["N.GN"],
      record["N.MN"],
      record["N.FN"],
      record["N.SUFFIX"],
    ]
      .map((part) => part?.trim())
      .filter((part) => part)
      .join(" ") || undefined;
  }

  if (!fileName && record["FN"]) {
    fileName = record["FN"];
  }

  if (!fileName) {
    throw new Error("No name found for record");
  }

  return sanitizeFileName(fileName);
}

/**
 * Create a contact slug (alias for createNameSlug)
 */
export function createContactSlug(record: VCardForObsidianRecord): string {
  return createNameSlug(record);
}

/**
 * Check if a record is of a specific kind
 */
export function isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
  return record.KIND === kind || (!record.KIND && kind === VCardKinds.Individual);
}

/**
 * Sanitize a filename for use in the filesystem
 */
function sanitizeFileName(input: string): string {
  const illegalRe = /[\/\?<>\\:\*\|"]/g;
  const controlRe = /[\x00-\x1f\x80-\x9f]/g;
  const reservedRe = /^\.+$/;
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  const windowsTrailingRe = /[\. ]+$/;
  const multipleSpacesRe = /\s+/g;
  
  return input
    .replace(illegalRe, ' ')
    .replace(controlRe, ' ')
    .replace(reservedRe, ' ')
    .replace(windowsReservedRe, ' ')
    .replace(windowsTrailingRe, ' ')
    .replace(multipleSpacesRe, " ")
    .trim();
}

/**
 * Get a unique file ID
 */
export function fileId(file: TFile): string {
  return file.path.replace(/[^\w]/g, '_');
}

/**
 * Get UI-friendly contact name
 */
export function getUiName(contact: Contact): string {
  const frontmatter = contact.data;
  return frontmatter?.["N.GN"] + " " + frontmatter?.["N.FN"] || frontmatter?.["FN"] || contact.file.basename;
}

/**
 * Make a string safe for UI display
 */
export function uiSafeString(input: string): string {
  return input.replace(/[<>&"]/g, (match) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;'
    };
    return escapeMap[match];
  });
}

/**
 * Get a name suitable for sorting
 */
export function getSortName(contact: Contact): string {
  const frontmatter = contact.data;
  return frontmatter?.["N.FN"] + ", " + frontmatter?.["N.GN"] || frontmatter?.["FN"] || contact.file.basename;
}

/**
 * Create a filename with .md extension
 */
export function createFileName(record: VCardForObsidianRecord): string {
  try {
    return createNameSlug(record) + '.md';
  } catch {
    return 'contact.md';
  }
}
