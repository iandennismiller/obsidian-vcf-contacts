/**
 * Core types and interfaces for relationship management
 */

/**
 * Gender types as specified in vCard 4.0 GENDER field
 */
export type Gender = 'M' | 'F' | 'NB' | 'U' | '';

/**
 * Relationship types (genderless internally)
 */
export type RelationshipType = 
  | 'parent' | 'child' | 'sibling' | 'spouse' | 'friend' 
  | 'colleague' | 'relative' | 'auncle' | 'nibling' 
  | 'grandparent' | 'grandchild' | 'cousin' | 'partner';

/**
 * Node attributes for contacts in the relationship graph
 */
export interface ContactNode {
  uid: string;
  fullName: string;
  gender?: Gender;
  file?: any; // TFile from Obsidian
}

/**
 * Edge attributes for relationships
 */
export interface RelationshipEdge {
  type: RelationshipType;
  created: Date;
}

/**
 * RELATED field value format for vCard
 */
export interface RelatedField {
  type: RelationshipType;
  value: string; // Format: urn:uuid:xxx, uid:xxx, or name:xxx
}

/**
 * Relationship tuple for internal processing
 */
export interface RelationshipTuple {
  type: RelationshipType;
  targetUid: string;
  targetName: string;
}

/**
 * Parsed relationship from markdown list
 */
export interface ParsedRelationship {
  type: RelationshipType;
  contactName: string;
  impliedGender?: Gender;
}

/**
 * Relationship mapping for gendered terms
 */
export interface GenderedRelationship {
  male: string;
  female: string;
  nonbinary: string;
  unspecified: string;
}

/**
 * Map of relationship types to their gendered variants
 */
export const GENDERED_RELATIONSHIPS: Record<RelationshipType, GenderedRelationship> = {
  parent: {
    male: 'father',
    female: 'mother',
    nonbinary: 'parent',
    unspecified: 'parent'
  },
  child: {
    male: 'son',
    female: 'daughter',
    nonbinary: 'child',
    unspecified: 'child'
  },
  sibling: {
    male: 'brother',
    female: 'sister',
    nonbinary: 'sibling',
    unspecified: 'sibling'
  },
  auncle: {
    male: 'uncle',
    female: 'aunt',
    nonbinary: 'auncle',
    unspecified: 'auncle'
  },
  nibling: {
    male: 'nephew',
    female: 'niece',
    nonbinary: 'nibling',
    unspecified: 'nibling'
  },
  grandparent: {
    male: 'grandfather',
    female: 'grandmother',
    nonbinary: 'grandparent',
    unspecified: 'grandparent'
  },
  grandchild: {
    male: 'grandson',
    female: 'granddaughter',
    nonbinary: 'grandchild',
    unspecified: 'grandchild'
  },
  spouse: {
    male: 'husband',
    female: 'wife',
    nonbinary: 'spouse',
    unspecified: 'spouse'
  },
  // These don't have typical gendered variants
  cousin: {
    male: 'cousin',
    female: 'cousin',
    nonbinary: 'cousin',
    unspecified: 'cousin'
  },
  friend: {
    male: 'friend',
    female: 'friend',
    nonbinary: 'friend',
    unspecified: 'friend'
  },
  colleague: {
    male: 'colleague',
    female: 'colleague',
    nonbinary: 'colleague',
    unspecified: 'colleague'
  },
  relative: {
    male: 'relative',
    female: 'relative',
    nonbinary: 'relative',
    unspecified: 'relative'
  },
  partner: {
    male: 'partner',
    female: 'partner',
    nonbinary: 'partner',
    unspecified: 'partner'
  }
};

/**
 * Map of gendered terms to their base relationship type and implied gender
 */
export const GENDERED_TERM_TO_TYPE: Record<string, { type: RelationshipType; gender?: Gender }> = {
  // Parent variations
  'father': { type: 'parent', gender: 'M' },
  'mother': { type: 'parent', gender: 'F' },
  'parent': { type: 'parent' },
  'dad': { type: 'parent', gender: 'M' },
  'mom': { type: 'parent', gender: 'F' },
  'daddy': { type: 'parent', gender: 'M' },
  'mommy': { type: 'parent', gender: 'F' },

  // Child variations
  'son': { type: 'child', gender: 'M' },
  'daughter': { type: 'child', gender: 'F' },
  'child': { type: 'child' },

  // Sibling variations
  'brother': { type: 'sibling', gender: 'M' },
  'sister': { type: 'sibling', gender: 'F' },
  'sibling': { type: 'sibling' },

  // Auncle variations
  'uncle': { type: 'auncle', gender: 'M' },
  'aunt': { type: 'auncle', gender: 'F' },
  'auncle': { type: 'auncle' },

  // Nibling variations
  'nephew': { type: 'nibling', gender: 'M' },
  'niece': { type: 'nibling', gender: 'F' },
  'nibling': { type: 'nibling' },

  // Grandparent variations
  'grandfather': { type: 'grandparent', gender: 'M' },
  'grandmother': { type: 'grandparent', gender: 'F' },
  'grandparent': { type: 'grandparent' },
  'grandpa': { type: 'grandparent', gender: 'M' },
  'grandma': { type: 'grandparent', gender: 'F' },

  // Grandchild variations
  'grandson': { type: 'grandchild', gender: 'M' },
  'granddaughter': { type: 'grandchild', gender: 'F' },
  'grandchild': { type: 'grandchild' },

  // Spouse variations
  'husband': { type: 'spouse', gender: 'M' },
  'wife': { type: 'spouse', gender: 'F' },
  'spouse': { type: 'spouse' },

  // Others (no gender implications)
  'cousin': { type: 'cousin' },
  'friend': { type: 'friend' },
  'colleague': { type: 'colleague' },
  'relative': { type: 'relative' },
  'partner': { type: 'partner' }
};