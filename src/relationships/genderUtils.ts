import { Gender, RelationshipType } from './relationshipGraph';

/**
 * Map relationship terms to genderless forms
 */
export const GENDERED_TO_GENDERLESS: Record<string, RelationshipType> = {
  // Parent relationships
  'father': 'parent',
  'mother': 'parent',
  'parent': 'parent',
  
  // Child relationships
  'son': 'child',
  'daughter': 'child',
  'child': 'child',
  
  // Sibling relationships
  'brother': 'sibling',
  'sister': 'sibling',
  'sibling': 'sibling',
  
  // Grandparent relationships
  'grandfather': 'grandparent',
  'grandmother': 'grandparent',
  'grandparent': 'grandparent',
  
  // Grandchild relationships
  'grandson': 'grandchild',
  'granddaughter': 'grandchild',
  'grandchild': 'grandchild',
  
  // Auncle relationships (aunt/uncle)
  'uncle': 'auncle',
  'aunt': 'auncle',
  'auncle': 'auncle',
  
  // Nibling relationships (nephew/niece)
  'nephew': 'nibling',
  'niece': 'nibling',
  'nibling': 'nibling',
  
  // Other relationships (already genderless)
  'spouse': 'spouse',
  'partner': 'partner',
  'cousin': 'cousin',
  'friend': 'friend',
  'colleague': 'colleague',
  'relative': 'relative'
};

/**
 * Gendered relationship terms mapping
 */
export const RELATIONSHIP_TERMS: Record<RelationshipType, { M: string; F: string; neutral: string }> = {
  'parent': { M: 'father', F: 'mother', neutral: 'parent' },
  'child': { M: 'son', F: 'daughter', neutral: 'child' },
  'sibling': { M: 'brother', F: 'sister', neutral: 'sibling' },
  'grandparent': { M: 'grandfather', F: 'grandmother', neutral: 'grandparent' },
  'grandchild': { M: 'grandson', F: 'granddaughter', neutral: 'grandchild' },
  'auncle': { M: 'uncle', F: 'aunt', neutral: 'auncle' },
  'nibling': { M: 'nephew', F: 'niece', neutral: 'nibling' },
  'spouse': { M: 'spouse', F: 'spouse', neutral: 'spouse' },
  'partner': { M: 'partner', F: 'partner', neutral: 'partner' },
  'cousin': { M: 'cousin', F: 'cousin', neutral: 'cousin' },
  'friend': { M: 'friend', F: 'friend', neutral: 'friend' },
  'colleague': { M: 'colleague', F: 'colleague', neutral: 'colleague' },
  'relative': { M: 'relative', F: 'relative', neutral: 'relative' }
};

/**
 * Normalize a relationship term to its genderless form
 */
export function normalizeRelationshipTerm(term: string): RelationshipType | null {
  const normalized = term.toLowerCase().trim();
  return GENDERED_TO_GENDERLESS[normalized] || null;
}

/**
 * Get the appropriate relationship term based on target gender
 */
export function getRelationshipTerm(type: RelationshipType, targetGender?: Gender): string {
  const terms = RELATIONSHIP_TERMS[type];
  if (!terms) return type;
  
  switch (targetGender) {
    case 'M':
      return terms.M;
    case 'F':
      return terms.F;
    default:
      return terms.neutral;
  }
}

/**
 * Format a relationship list item with appropriate gender term
 */
export function formatRelationshipListItem(
  relationshipType: RelationshipType,
  contactName: string,
  targetGender?: Gender
): string {
  const term = getRelationshipTerm(relationshipType, targetGender);
  return `- ${term} [[${contactName}]]`;
}

/**
 * Infer gender from a relationship term (for parsing existing Related lists)
 */
export function inferGenderFromTerm(term: string): Gender | undefined {
  const normalized = term.toLowerCase().trim();
  
  // Male terms
  const maleTerms = ['father', 'son', 'brother', 'grandfather', 'grandson', 'uncle', 'nephew'];
  if (maleTerms.includes(normalized)) {
    return 'M';
  }
  
  // Female terms
  const femaleTerms = ['mother', 'daughter', 'sister', 'grandmother', 'granddaughter', 'aunt', 'niece'];
  if (femaleTerms.includes(normalized)) {
    return 'F';
  }
  
  // Neutral/unknown terms
  return undefined;
}

/**
 * Check if a term is a valid relationship type
 */
export function isValidRelationshipTerm(term: string): boolean {
  return normalizeRelationshipTerm(term) !== null;
}

/**
 * Get all valid relationship terms (including gendered variants)
 */
export function getAllValidRelationshipTerms(): string[] {
  return Object.keys(GENDERED_TO_GENDERLESS);
}

/**
 * Get the reciprocal relationship type
 */
export function getReciprocalRelationshipType(type: RelationshipType): RelationshipType | null {
  const reciprocals: Record<RelationshipType, RelationshipType | null> = {
    'parent': 'child',
    'child': 'parent',
    'sibling': 'sibling',
    'spouse': 'spouse',
    'friend': 'friend',
    'colleague': 'colleague',
    'relative': 'relative',
    'auncle': 'nibling',
    'nibling': 'auncle',
    'grandparent': 'grandchild',
    'grandchild': 'grandparent',
    'cousin': 'cousin',
    'partner': 'partner'
  };

  return reciprocals[type] || null;
}