/**
 * Utility functions for handling GENDER field and gender-aware relationship terms
 */

export type Gender = 'M' | 'F' | 'NB' | 'U' | null;

/**
 * Parse GENDER field value from vCard
 * @param value GENDER field value (M, F, NB, U, or empty)
 * @returns Normalized gender value or null if unspecified/empty
 */
export function parseGender(value: string): Gender {
  if (!value || value.trim() === '') {
    return null;
  }
  
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'M':
    case 'MALE':
      return 'M';
    case 'F':
    case 'FEMALE':
      return 'F';
    case 'NB':
    case 'NON-BINARY':
    case 'NONBINARY':
      return 'NB';
    case 'U':
    case 'UNSPECIFIED':
      return 'U';
    default:
      return null;
  }
}

/**
 * Genderless relationship terms mapped to their gendered variants
 */
const RELATIONSHIP_MAPPING: Record<string, { 
  M: string; 
  F: string; 
  default: string; 
}> = {
  // Parent relationships
  parent: { M: 'father', F: 'mother', default: 'parent' },
  
  // Aunt/Uncle relationships - "auncle" is the internal genderless term
  auncle: { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
  
  // Child relationships
  child: { M: 'son', F: 'daughter', default: 'child' },
  
  // Sibling relationships
  sibling: { M: 'brother', F: 'sister', default: 'sibling' },
  
  // Grandparent relationships
  grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
  
  // Grandchild relationships
  grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
  
  // Spouse relationships
  spouse: { M: 'husband', F: 'wife', default: 'spouse' },
  
  // Other relationships remain genderless
  friend: { M: 'friend', F: 'friend', default: 'friend' },
  colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
  acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' },
  neighbor: { M: 'neighbor', F: 'neighbor', default: 'neighbor' },
};

/**
 * Get the display term for a relationship based on the contact's gender
 * @param relationshipType The genderless relationship type from frontmatter/vCard
 * @param contactGender The gender of the related contact
 * @returns The appropriate display term
 */
export function getGenderedRelationshipTerm(
  relationshipType: string, 
  contactGender: Gender
): string {
  const mapping = RELATIONSHIP_MAPPING[relationshipType.toLowerCase()];
  
  if (!mapping) {
    // If no mapping exists, return the original relationship type
    return relationshipType;
  }
  
  // Apply gendered term if gender is specified and binary (M or F)
  if (contactGender === 'M') {
    return mapping.M;
  } else if (contactGender === 'F') {
    return mapping.F;
  } else {
    // For NB, U, null, or blank gender, use the default term
    return mapping.default;
  }
}

/**
 * Get all supported genderless relationship types
 * @returns Array of genderless relationship types
 */
export function getGenderlessRelationshipTypes(): string[] {
  return Object.keys(RELATIONSHIP_MAPPING);
}

/**
 * Check if a relationship type supports gender variants
 * @param relationshipType The relationship type to check
 * @returns True if the relationship type has gender variants
 */
export function isGenderAwareRelationship(relationshipType: string): boolean {
  return relationshipType.toLowerCase() in RELATIONSHIP_MAPPING;
}

/**
 * Infer gender from a gendered relationship term
 * @param relationshipType - The relationship type (e.g., "father", "aunt", "sister")
 * @returns Inferred gender or null if not gendered
 */
export function inferGenderFromRelationship(relationshipType: string): Gender {
  const type = relationshipType.toLowerCase();
  
  // Male terms
  const maleTerms = ['father', 'dad', 'daddy', 'uncle', 'brother', 'son', 'husband', 'grandfather', 'grandson'];
  if (maleTerms.includes(type)) {
    return 'M';
  }
  
  // Female terms  
  const femaleTerms = ['mother', 'mom', 'mommy', 'aunt', 'sister', 'daughter', 'wife', 'grandmother', 'granddaughter'];
  if (femaleTerms.includes(type)) {
    return 'F';
  }
  
  return null;
}

/**
 * Convert gendered relationship term to genderless equivalent
 * @param relationshipType - The gendered relationship type
 * @returns Genderless relationship type
 */
export function convertToGenderlessType(relationshipType: string): string {
  const type = relationshipType.toLowerCase();
  
  // Parent relationships
  if (['father', 'dad', 'daddy', 'mother', 'mom', 'mommy'].includes(type)) {
    return 'parent';
  }
  
  // Aunt/Uncle relationships
  if (['aunt', 'uncle'].includes(type)) {
    return 'auncle';
  }
  
  // Child relationships
  if (['son', 'daughter'].includes(type)) {
    return 'child';
  }
  
  // Sibling relationships
  if (['brother', 'sister'].includes(type)) {
    return 'sibling';
  }
  
  // Spouse relationships
  if (['husband', 'wife'].includes(type)) {
    return 'spouse';
  }
  
  // Grandparent relationships
  if (['grandfather', 'grandmother'].includes(type)) {
    return 'grandparent';
  }
  
  // Grandchild relationships
  if (['grandson', 'granddaughter'].includes(type)) {
    return 'grandchild';
  }
  
  // Return as-is if no mapping found
  return relationshipType;
}