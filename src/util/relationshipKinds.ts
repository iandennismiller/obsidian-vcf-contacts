/**
 * Utility for handling relationship kinds and gender mappings
 */

export interface RelationshipMapping {
  base: string;
  male?: string;
  female?: string;
  neutral: string;
}

// Relationship mappings for gendered types
const RELATIONSHIP_MAPPINGS: Record<string, RelationshipMapping> = {
  // Family relationships
  auncle: {
    base: 'auncle',
    male: 'uncle',
    female: 'aunt', 
    neutral: 'auncle'
  },
  parent: {
    base: 'parent',
    male: 'father',
    female: 'mother',
    neutral: 'parent'
  },
  child: {
    base: 'child',
    male: 'son',
    female: 'daughter',
    neutral: 'child'
  },
  sibling: {
    base: 'sibling',
    male: 'brother',
    female: 'sister',
    neutral: 'sibling'
  },
  spouse: {
    base: 'spouse',
    male: 'husband',
    female: 'wife',
    neutral: 'spouse'
  },
  grandparent: {
    base: 'grandparent',
    male: 'grandfather',
    female: 'grandmother',
    neutral: 'grandparent'
  },
  grandchild: {
    base: 'grandchild',
    male: 'grandson',
    female: 'granddaughter',
    neutral: 'grandchild'
  },
  // Non-gendered relationships
  friend: {
    base: 'friend',
    neutral: 'friend'
  },
  colleague: {
    base: 'colleague', 
    neutral: 'colleague'
  },
  acquaintance: {
    base: 'acquaintance',
    neutral: 'acquaintance'
  },
  neighbor: {
    base: 'neighbor',
    neutral: 'neighbor'
  },
  contact: {
    base: 'contact',
    neutral: 'contact'
  }
};

// Define reciprocal relationship mappings
const RECIPROCAL_RELATIONSHIPS: Record<string, string> = {
  // Family relationships that are reciprocal
  'parent': 'child',
  'child': 'parent',
  'sibling': 'sibling',
  'spouse': 'spouse',
  'grandparent': 'grandchild',
  'grandchild': 'grandparent',
  'auncle': 'auncle', // Aunt/uncle relationship is reciprocal with itself
  
  // Social relationships that are typically reciprocal
  'friend': 'friend',
  'colleague': 'colleague',
  'acquaintance': 'acquaintance',
  'neighbor': 'neighbor'
  
  // Note: 'contact' is not reciprocal - it's more of a one-way acknowledgment
};

// Reverse mapping from gendered terms to base terms
const GENDERED_TO_BASE: Record<string, string> = {};
Object.values(RELATIONSHIP_MAPPINGS).forEach(mapping => {
  if (mapping.male) GENDERED_TO_BASE[mapping.male] = mapping.base;
  if (mapping.female) GENDERED_TO_BASE[mapping.female] = mapping.base;
  GENDERED_TO_BASE[mapping.neutral] = mapping.base;
});

/**
 * Get the base (genderless) relationship kind
 */
export function getBaseRelationshipKind(kind: string): string {
  const lowerKind = kind.toLowerCase();
  return GENDERED_TO_BASE[lowerKind] || lowerKind;
}

/**
 * Get the gendered relationship kind based on target contact's gender
 */
export function getGenderedRelationshipKind(baseKind: string, targetGender?: string): string {
  const mapping = RELATIONSHIP_MAPPINGS[baseKind.toLowerCase()];
  if (!mapping) {
    return baseKind;
  }

  if (!targetGender) {
    return mapping.neutral;
  }

  const gender = targetGender.toLowerCase();
  if (gender === 'male' || gender === 'm') {
    return mapping.male || mapping.neutral;
  } else if (gender === 'female' || gender === 'f') {
    return mapping.female || mapping.neutral;
  }

  return mapping.neutral;
}

/**
 * Check if a relationship kind is gendered
 */
export function isGenderedRelationshipKind(kind: string): boolean {
  const lowerKind = kind.toLowerCase();
  return lowerKind in GENDERED_TO_BASE;
}

/**
 * Infer gender from a gendered relationship kind
 */
export function inferGenderFromRelationshipKind(kind: string): string | null {
  const lowerKind = kind.toLowerCase();
  
  for (const mapping of Object.values(RELATIONSHIP_MAPPINGS)) {
    if (mapping.male === lowerKind) {
      return 'male';
    }
    if (mapping.female === lowerKind) {
      return 'female';
    }
  }
  
  return null;
}

/**
 * Get all supported relationship kinds
 */
export function getSupportedRelationshipKinds(): string[] {
  const kinds = new Set<string>();
  
  Object.values(RELATIONSHIP_MAPPINGS).forEach(mapping => {
    kinds.add(mapping.neutral);
    if (mapping.male) kinds.add(mapping.male);
    if (mapping.female) kinds.add(mapping.female);
  });
  
  return Array.from(kinds).sort();
}

/**
 * Validate if a relationship kind is supported
 */
export function isValidRelationshipKind(kind: string): boolean {
  const lowerKind = kind.toLowerCase();
  return getSupportedRelationshipKinds().some(k => k.toLowerCase() === lowerKind);
}

/**
 * Get the reciprocal relationship kind for a given relationship
 */
export function getReciprocalRelationshipKind(kind: string): string | null {
  const baseKind = getBaseRelationshipKind(kind);
  return RECIPROCAL_RELATIONSHIPS[baseKind] || null;
}

/**
 * Check if a relationship kind should have a reciprocal relationship
 */
export function shouldHaveReciprocalRelationship(kind: string): boolean {
  const baseKind = getBaseRelationshipKind(kind);
  return baseKind in RECIPROCAL_RELATIONSHIPS;
}