/**
 * Relationship type mappings and utilities
 */

// Map of gendered relationships to their genderless equivalents
export const RELATIONSHIP_MAPPING: Record<string, string> = {
  // Family relationships
  'mother': 'parent',
  'father': 'parent',
  'parent': 'parent',
  'son': 'child',
  'daughter': 'child',
  'child': 'child',
  'brother': 'sibling',
  'sister': 'sibling',
  'sibling': 'sibling',
  'grandmother': 'grandparent',
  'grandfather': 'grandparent',
  'grandparent': 'grandparent',
  'grandson': 'grandchild',
  'granddaughter': 'grandchild',
  'grandchild': 'grandchild',
  'aunt': 'auncle',
  'uncle': 'auncle',
  'auncle': 'auncle',
  'niece': 'nibbling',
  'nephew': 'nibbling',
  'nibbling': 'nibbling',
  'cousin': 'cousin',
  
  // Romantic relationships
  'husband': 'spouse',
  'wife': 'spouse',
  'spouse': 'spouse',
  'boyfriend': 'partner',
  'girlfriend': 'partner',
  'partner': 'partner',
  
  // Social relationships
  'friend': 'friend',
  'colleague': 'colleague',
  'coworker': 'colleague',
  'neighbor': 'neighbor',
  'neighbour': 'neighbor',
  'mentor': 'mentor',
  'mentee': 'mentee',
  'student': 'student',
  'teacher': 'teacher',
  'boss': 'boss',
  'employee': 'employee',
  'acquaintance': 'acquaintance',
};

// Reverse mapping for rendering gendered relationships
export const GENDERED_RELATIONSHIPS: Record<string, { male: string; female: string; neutral: string }> = {
  'parent': { male: 'father', female: 'mother', neutral: 'parent' },
  'child': { male: 'son', female: 'daughter', neutral: 'child' },
  'sibling': { male: 'brother', female: 'sister', neutral: 'sibling' },
  'grandparent': { male: 'grandfather', female: 'grandmother', neutral: 'grandparent' },
  'grandchild': { male: 'grandson', female: 'granddaughter', neutral: 'grandchild' },
  'auncle': { male: 'uncle', female: 'aunt', neutral: 'auncle' },
  'nibbling': { male: 'nephew', female: 'niece', neutral: 'nibbling' },
  'spouse': { male: 'husband', female: 'wife', neutral: 'spouse' },
  'partner': { male: 'boyfriend', female: 'girlfriend', neutral: 'partner' },
};

export type Gender = 'M' | 'F' | 'male' | 'female' | 'masculine' | 'feminine' | null | undefined;

/**
 * Normalize a relationship kind to its genderless form
 */
export function normalizeRelationshipKind(kind: string): string {
  const normalized = kind.toLowerCase().trim();
  return RELATIONSHIP_MAPPING[normalized] || normalized;
}

/**
 * Render a relationship kind based on gender
 */
export function renderRelationshipKind(genderlessKind: string, gender?: Gender): string {
  const genderlessNormalized = genderlessKind.toLowerCase().trim();
  const genderedRelationship = GENDERED_RELATIONSHIPS[genderlessNormalized];
  
  if (!genderedRelationship) {
    return genderlessKind;
  }
  
  if (!gender) {
    return genderedRelationship.neutral;
  }
  
  // Normalize gender values
  const normalizedGender = gender.toString().toLowerCase();
  if (normalizedGender === 'm' || normalizedGender === 'male' || normalizedGender === 'masculine') {
    return genderedRelationship.male;
  } else if (normalizedGender === 'f' || normalizedGender === 'female' || normalizedGender === 'feminine') {
    return genderedRelationship.female;
  }
  
  return genderedRelationship.neutral;
}

/**
 * Check if a relationship kind is gendered
 */
export function isGenderedRelationship(kind: string): boolean {
  const normalized = kind.toLowerCase().trim();
  return normalized in RELATIONSHIP_MAPPING && RELATIONSHIP_MAPPING[normalized] !== normalized;
}

/**
 * Infer gender from a gendered relationship
 */
export function inferGenderFromRelationship(kind: string): Gender | null {
  const normalized = kind.toLowerCase().trim();
  
  for (const [genderlessKind, gendered] of Object.entries(GENDERED_RELATIONSHIPS)) {
    if (gendered.male === normalized) {
      return 'M';
    }
    if (gendered.female === normalized) {
      return 'F';
    }
  }
  
  return null;
}