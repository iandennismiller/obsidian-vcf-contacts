/**
 * @fileoverview Types and interfaces for relationship management
 */

export interface RelationshipTriple {
  subject: string;  // Contact UID
  relationshipKind: string;  // Genderless relationship type
  object: string;  // Related contact UID
}

export interface ContactReference {
  uid: string;
  name: string;
  exists: boolean;  // Whether the contact note exists in Obsidian
}

export interface RelationshipEdge {
  kind: string;  // Genderless relationship type (friend, parent, child, etc.)
  displayKind?: string;  // Gendered display version if applicable
}

export interface ContactGraphNode {
  uid: string;
  name: string;
  gender?: string;
  exists: boolean;
}

export interface GenderMapping {
  [key: string]: {
    male: string;
    female: string;
    neutral: string;
    inferredGender?: 'M' | 'F';
  };
}

export const RELATIONSHIP_GENDER_MAPPING: GenderMapping = {
  parent: {
    male: 'father',
    female: 'mother', 
    neutral: 'parent'
  },
  child: {
    male: 'son',
    female: 'daughter',
    neutral: 'child'
  },
  sibling: {
    male: 'brother',
    female: 'sister',
    neutral: 'sibling'
  },
  auncle: {  // Internal representation for aunt/uncle
    male: 'uncle',
    female: 'aunt',
    neutral: 'auncle'
  },
  // Add more as needed
  friend: {
    male: 'friend',
    female: 'friend',
    neutral: 'friend'
  },
  spouse: {
    male: 'husband',
    female: 'wife',
    neutral: 'spouse'
  }
};

// Mapping from gendered terms back to neutral internal terms
export const GENDERED_TO_NEUTRAL: { [key: string]: string } = {
  'father': 'parent',
  'mother': 'parent',
  'dad': 'parent',
  'mom': 'parent',
  'papa': 'parent',
  'mama': 'parent',
  'son': 'child',
  'daughter': 'child',
  'brother': 'sibling',
  'sister': 'sibling',
  'uncle': 'auncle',
  'aunt': 'auncle',
  'husband': 'spouse',
  'wife': 'spouse',
  'friend': 'friend'
};

// Terms that imply gender of the related contact
export const GENDER_INFERRING_TERMS: { [key: string]: 'M' | 'F' } = {
  'father': 'M',
  'dad': 'M',
  'papa': 'M',
  'son': 'M',
  'brother': 'M',
  'uncle': 'M',
  'husband': 'M',
  'mother': 'F',
  'mom': 'F',
  'mama': 'F',
  'daughter': 'F',
  'sister': 'F',
  'aunt': 'F',
  'wife': 'F'
};

export interface RelationshipSyncOptions {
  debounceMs: number;
  preventCascade: boolean;
}