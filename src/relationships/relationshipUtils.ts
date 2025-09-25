import { Gender, RelationshipType } from './relationshipGraph';

/**
 * Mapping of genderless relationship types to gendered equivalents
 */
const GENDERED_RELATIONSHIPS: Record<RelationshipType, { M: string; F: string; default: string }> = {
  parent: { M: 'father', F: 'mother', default: 'parent' },
  child: { M: 'son', F: 'daughter', default: 'child' },
  sibling: { M: 'brother', F: 'sister', default: 'sibling' },
  auncle: { M: 'uncle', F: 'aunt', default: 'auncle' },
  nibling: { M: 'nephew', F: 'niece', default: 'nibling' },
  grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
  grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
  spouse: { M: 'husband', F: 'wife', default: 'spouse' },
  partner: { M: 'partner', F: 'partner', default: 'partner' },
  friend: { M: 'friend', F: 'friend', default: 'friend' },
  colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
  relative: { M: 'relative', F: 'relative', default: 'relative' },
  cousin: { M: 'cousin', F: 'cousin', default: 'cousin' }
};

/**
 * Mapping of relationship types to their reciprocal relationships
 */
const RECIPROCAL_RELATIONSHIPS: Record<RelationshipType, RelationshipType> = {
  parent: 'child',
  child: 'parent',
  sibling: 'sibling',
  spouse: 'spouse',
  friend: 'friend',
  colleague: 'colleague',
  relative: 'relative',
  auncle: 'nibling',
  nibling: 'auncle',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  cousin: 'cousin',
  partner: 'partner'
};

/**
 * Get the reciprocal relationship type
 */
export function getReciprocalType(type: RelationshipType): RelationshipType {
  return RECIPROCAL_RELATIONSHIPS[type];
}

/**
 * Render a relationship type with gender consideration
 */
export function renderRelationshipType(type: RelationshipType, gender?: Gender): string {
  const mapping = GENDERED_RELATIONSHIPS[type];
  if (!mapping) {
    return type;
  }

  if (gender === 'M') {
    return mapping.M;
  } else if (gender === 'F') {
    return mapping.F;
  } else {
    return mapping.default;
  }
}

/**
 * Format a relationship list item for markdown
 */
export function formatRelationshipListItem(type: RelationshipType, contactName: string, gender?: Gender): string {
  const renderedType = renderRelationshipType(type, gender);
  return `- ${renderedType} [[${contactName}]]`;
}

/**
 * Parse a relationship list item from markdown
 */
export function parseRelationshipListItem(line: string): { type: RelationshipType; contactName: string; impliedGender?: Gender } | null {
  // Match pattern: "- relationship_type [[Contact Name]]"
  const match = line.trim().match(/^-\s*(\w+)\s*\[\[([^\]]+)\]\]/);
  if (!match) {
    return null;
  }

  const [, typeString, contactName] = match;
  
  // Try to map gendered terms back to genderless types
  const type = mapToGenderlessType(typeString.toLowerCase());
  if (!type) {
    return null;
  }

  // Infer gender from gendered term
  const impliedGender = inferGenderFromTerm(typeString.toLowerCase());

  return { type, contactName: contactName.trim(), impliedGender };
}

/**
 * Map a potentially gendered term back to its genderless type
 */
function mapToGenderlessType(term: string): RelationshipType | null {
  // Direct match first
  if (Object.keys(GENDERED_RELATIONSHIPS).includes(term as RelationshipType)) {
    return term as RelationshipType;
  }

  // Check gendered variants
  for (const [genderlessType, variants] of Object.entries(GENDERED_RELATIONSHIPS)) {
    if (variants.M === term || variants.F === term || variants.default === term) {
      return genderlessType as RelationshipType;
    }
  }

  return null;
}

/**
 * Infer gender from a relationship term
 */
function inferGenderFromTerm(term: string): Gender | undefined {
  for (const variants of Object.values(GENDERED_RELATIONSHIPS)) {
    // Only infer gender if the term is different from the default
    if (variants.M === term && variants.M !== variants.default) {
      return 'M';
    }
    if (variants.F === term && variants.F !== variants.default) {
      return 'F';
    }
  }
  return undefined;
}

/**
 * Check if a relationship type is symmetric (friend, spouse, etc.)
 */
export function isSymmetricRelationship(type: RelationshipType): boolean {
  return RECIPROCAL_RELATIONSHIPS[type] === type;
}

/**
 * Validate a relationship type
 */
export function isValidRelationshipType(type: string): type is RelationshipType {
  return Object.keys(RECIPROCAL_RELATIONSHIPS).includes(type as RelationshipType);
}