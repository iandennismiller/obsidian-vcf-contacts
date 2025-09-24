import { Gender, RelationshipType } from './relationshipGraph';

/**
 * Gender-specific relationship terms
 */
export interface GenderedTerms {
  male: string;
  female: string;
  neutral: string;
}

/**
 * Mapping of relationship types to gendered terms
 */
const GENDERED_RELATIONSHIP_TERMS: Record<RelationshipType, GenderedTerms> = {
  'parent': {
    male: 'father',
    female: 'mother',
    neutral: 'parent'
  },
  'child': {
    male: 'son',
    female: 'daughter',
    neutral: 'child'
  },
  'sibling': {
    male: 'brother',
    female: 'sister',
    neutral: 'sibling'
  },
  'spouse': {
    male: 'husband',
    female: 'wife',
    neutral: 'spouse'
  },
  'auncle': {
    male: 'uncle',
    female: 'aunt',
    neutral: 'auncle'
  },
  'nibling': {
    male: 'nephew',
    female: 'niece',
    neutral: 'nibling'
  },
  'grandparent': {
    male: 'grandfather',
    female: 'grandmother',
    neutral: 'grandparent'
  },
  'grandchild': {
    male: 'grandson',
    female: 'granddaughter',
    neutral: 'grandchild'
  },
  // These relationships typically don't have gendered variants
  'friend': {
    male: 'friend',
    female: 'friend',
    neutral: 'friend'
  },
  'colleague': {
    male: 'colleague',
    female: 'colleague',
    neutral: 'colleague'
  },
  'relative': {
    male: 'relative',
    female: 'relative',
    neutral: 'relative'
  },
  'cousin': {
    male: 'cousin',
    female: 'cousin',
    neutral: 'cousin'
  },
  'partner': {
    male: 'partner',
    female: 'partner',
    neutral: 'partner'
  }
};

/**
 * Terms that imply gender when used in relationships
 */
const GENDER_IMPLYING_TERMS: Record<string, { gender: Gender; type: RelationshipType }> = {
  // Parent terms
  'father': { gender: 'M', type: 'parent' },
  'dad': { gender: 'M', type: 'parent' },
  'daddy': { gender: 'M', type: 'parent' },
  'papa': { gender: 'M', type: 'parent' },
  'mother': { gender: 'F', type: 'parent' },
  'mom': { gender: 'F', type: 'parent' },
  'mama': { gender: 'F', type: 'parent' },
  'mommy': { gender: 'F', type: 'parent' },

  // Child terms
  'son': { gender: 'M', type: 'child' },
  'daughter': { gender: 'F', type: 'child' },

  // Sibling terms
  'brother': { gender: 'M', type: 'sibling' },
  'sister': { gender: 'F', type: 'sibling' },

  // Spouse terms
  'husband': { gender: 'M', type: 'spouse' },
  'wife': { gender: 'F', type: 'spouse' },

  // Auncle terms
  'uncle': { gender: 'M', type: 'auncle' },
  'aunt': { gender: 'F', type: 'auncle' },

  // Nibling terms
  'nephew': { gender: 'M', type: 'nibling' },
  'niece': { gender: 'F', type: 'nibling' },

  // Grandparent terms
  'grandfather': { gender: 'M', type: 'grandparent' },
  'grandpa': { gender: 'M', type: 'grandparent' },
  'grandmother': { gender: 'F', type: 'grandparent' },
  'grandma': { gender: 'F', type: 'grandparent' },

  // Grandchild terms
  'grandson': { gender: 'M', type: 'grandchild' },
  'granddaughter': { gender: 'F', type: 'grandchild' }
};

/**
 * Infer gender and relationship type from a gendered relationship term
 */
export function inferGenderFromTerm(term: string): { gender: Gender; type: RelationshipType } | null {
  const normalized = term.toLowerCase().trim();
  return GENDER_IMPLYING_TERMS[normalized] || null;
}

/**
 * Get the appropriate display term for a relationship based on the target's gender
 */
export function getGenderedRelationshipTerm(
  relationshipType: RelationshipType, 
  targetGender?: Gender
): string {
  const terms = GENDERED_RELATIONSHIP_TERMS[relationshipType];
  if (!terms) return relationshipType;

  // If no gender specified or gender is non-binary/unspecified, use neutral
  if (!targetGender || targetGender === 'NB' || targetGender === 'U' || targetGender.length === 0) {
    return terms.neutral;
  }

  return targetGender === 'M' ? terms.male : 
         targetGender === 'F' ? terms.female : 
         terms.neutral;
}

/**
 * Parse a relationship list item from markdown
 * Format: "- relationship_term [[Contact Name]]"
 */
export function parseRelationshipListItem(line: string): { 
  type: RelationshipType; 
  contactName: string; 
  impliedGender?: Gender 
} | null {
  // Match pattern: "- relationship_term [[Contact Name]]"
  const match = line.trim().match(/^-\s*([^\[]+?)\s*\[\[([^\]]+)\]\]/);
  if (!match) return null;

  const relationshipTerm = match[1].trim();
  const contactName = match[2].trim();

  // Try to infer gender and type from the term
  const inferred = inferGenderFromTerm(relationshipTerm);
  if (inferred) {
    return {
      type: inferred.type,
      contactName,
      impliedGender: inferred.gender
    };
  }

  // If no gender inference, treat as neutral relationship type
  // Check if the term matches any neutral term
  for (const [type, terms] of Object.entries(GENDERED_RELATIONSHIP_TERMS)) {
    if (terms.neutral.toLowerCase() === relationshipTerm.toLowerCase() ||
        terms.male.toLowerCase() === relationshipTerm.toLowerCase() ||
        terms.female.toLowerCase() === relationshipTerm.toLowerCase()) {
      return {
        type: type as RelationshipType,
        contactName
      };
    }
  }

  return null;
}

/**
 * Format a relationship as a markdown list item
 */
export function formatRelationshipListItem(
  relationshipType: RelationshipType, 
  contactName: string, 
  targetGender?: Gender
): string {
  const term = getGenderedRelationshipTerm(relationshipType, targetGender);
  return `- ${term} [[${contactName}]]`;
}

/**
 * Check if a gender value is valid
 */
export function isValidGender(value: string): value is Gender {
  return ['M', 'F', 'NB', 'U', ''].includes(value);
}

/**
 * Normalize gender value from various formats
 */
export function normalizeGender(value: string): Gender {
  const normalized = value.toUpperCase().trim();
  
  switch (normalized) {
    case 'M':
    case 'MALE':
    case 'MAN':
      return 'M';
    case 'F':
    case 'FEMALE':
    case 'WOMAN':
      return 'F';
    case 'NB':
    case 'NON-BINARY':
    case 'NONBINARY':
    case 'ENBY':
      return 'NB';
    case 'U':
    case 'UNKNOWN':
    case 'UNSPECIFIED':
      return 'U';
    default:
      return '';
  }
}