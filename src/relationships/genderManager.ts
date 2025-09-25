/**
 * Handles gender-specific relationship types and encoding/decoding
 */

import { Gender, GenderlessKind, RelationshipType } from './types';

/**
 * Mapping of gendered relationship terms to their genderless equivalents
 */
const GENDERED_TO_GENDERLESS: Record<string, GenderlessKind> = {
  // Parents
  'mother': 'parent',
  'father': 'parent',
  'mom': 'parent',
  'dad': 'parent',
  
  // Children
  'son': 'child',
  'daughter': 'child',
  'boy': 'child',
  'girl': 'child',
  
  // Siblings
  'brother': 'sibling',
  'sister': 'sibling',
  'bro': 'sibling',
  'sis': 'sibling',
  
  // Spouses
  'wife': 'spouse',
  'husband': 'spouse',
  
  // Aunt/Uncle/Niece/Nephew
  'aunt': 'auncle',
  'uncle': 'auncle',
  'nephew': 'nibling',
  'niece': 'nibling',
  
  // Grandparents/Grandchildren
  'grandmother': 'grandparent',
  'grandfather': 'grandparent',
  'grandson': 'grandchild',
  'granddaughter': 'grandchild',
  
  // Partners
  'boyfriend': 'partner',
  'girlfriend': 'partner'
};

/**
 * Mapping of relationship types to inferred gender information
 */
const GENDER_INFERENCES: Record<string, { inferredGender: Gender; reciprocalKind: GenderlessKind }> = {
  'mother': { inferredGender: 'F', reciprocalKind: 'child' },
  'father': { inferredGender: 'M', reciprocalKind: 'child' },
  'mom': { inferredGender: 'F', reciprocalKind: 'child' },
  'dad': { inferredGender: 'M', reciprocalKind: 'child' },
  'son': { inferredGender: 'M', reciprocalKind: 'parent' },
  'daughter': { inferredGender: 'F', reciprocalKind: 'parent' },
  'boy': { inferredGender: 'M', reciprocalKind: 'parent' },
  'girl': { inferredGender: 'F', reciprocalKind: 'parent' },
  'brother': { inferredGender: 'M', reciprocalKind: 'sibling' },
  'sister': { inferredGender: 'F', reciprocalKind: 'sibling' },
  'bro': { inferredGender: 'M', reciprocalKind: 'sibling' },
  'sis': { inferredGender: 'F', reciprocalKind: 'sibling' },
  'wife': { inferredGender: 'F', reciprocalKind: 'spouse' },
  'husband': { inferredGender: 'M', reciprocalKind: 'spouse' },
  'aunt': { inferredGender: 'F', reciprocalKind: 'nibling' },
  'uncle': { inferredGender: 'M', reciprocalKind: 'nibling' },
  'nephew': { inferredGender: 'M', reciprocalKind: 'auncle' },
  'niece': { inferredGender: 'F', reciprocalKind: 'auncle' },
  'grandmother': { inferredGender: 'F', reciprocalKind: 'grandchild' },
  'grandfather': { inferredGender: 'M', reciprocalKind: 'grandchild' },
  'grandson': { inferredGender: 'M', reciprocalKind: 'grandparent' },
  'granddaughter': { inferredGender: 'F', reciprocalKind: 'grandparent' },
  'boyfriend': { inferredGender: 'M', reciprocalKind: 'partner' },
  'girlfriend': { inferredGender: 'F', reciprocalKind: 'partner' }
};

/**
 * Mapping of genderless terms to their gendered display variants
 */
const GENDERLESS_TO_GENDERED: Record<GenderlessKind, { M: string; F: string; default: string }> = {
  'parent': { M: 'father', F: 'mother', default: 'parent' },
  'child': { M: 'son', F: 'daughter', default: 'child' },
  'sibling': { M: 'brother', F: 'sister', default: 'sibling' },
  'spouse': { M: 'husband', F: 'wife', default: 'spouse' },
  'auncle': { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
  'nibling': { M: 'nephew', F: 'niece', default: 'niece/nephew' },
  'grandparent': { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
  'grandchild': { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
  'partner': { M: 'boyfriend', F: 'girlfriend', default: 'partner' },
  
  // These don't have gender variants
  'friend': { M: 'friend', F: 'friend', default: 'friend' },
  'colleague': { M: 'colleague', F: 'colleague', default: 'colleague' },
  'relative': { M: 'relative', F: 'relative', default: 'relative' },
  'cousin': { M: 'cousin', F: 'cousin', default: 'cousin' }
};

export class GenderManager {
  /**
   * Encode a relationship type (potentially gendered) to its genderless form
   */
  encodeToGenderless(relationshipType: RelationshipType): GenderlessKind {
    const lowerType = relationshipType.toLowerCase();
    return GENDERED_TO_GENDERLESS[lowerType] || relationshipType as GenderlessKind;
  }

  /**
   * Decode a genderless relationship type to the appropriate gendered form for display
   */
  decodeToGendered(genderlessKind: GenderlessKind, targetGender?: Gender): string {
    const mapping = GENDERLESS_TO_GENDERED[genderlessKind];
    if (!mapping) return genderlessKind;

    if (targetGender === 'M') return mapping.M;
    if (targetGender === 'F') return mapping.F;
    return mapping.default;
  }

  /**
   * Infer gender information from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: RelationshipType): {
    inferredGender?: Gender;
    genderlessKind: GenderlessKind;
    reciprocalKind?: GenderlessKind;
  } {
    const lowerType = relationshipType.toLowerCase();
    const genderInfo = GENDER_INFERENCES[lowerType];
    const genderlessKind = this.encodeToGenderless(relationshipType);

    if (genderInfo) {
      return {
        inferredGender: genderInfo.inferredGender,
        genderlessKind,
        reciprocalKind: genderInfo.reciprocalKind
      };
    }

    return { genderlessKind };
  }

  /**
   * Check if a relationship type has gendered variants
   */
  hasGenderedVariants(genderlessKind: GenderlessKind): boolean {
    const mapping = GENDERLESS_TO_GENDERED[genderlessKind];
    return mapping && mapping.M !== mapping.default;
  }

  /**
   * Get all possible gendered variants of a genderless relationship
   */
  getGenderedVariants(genderlessKind: GenderlessKind): string[] {
    const mapping = GENDERLESS_TO_GENDERED[genderlessKind];
    if (!mapping) return [genderlessKind];

    const variants = new Set([mapping.M, mapping.F, mapping.default]);
    return Array.from(variants);
  }

  /**
   * Normalize a relationship type to ensure consistent casing
   */
  normalizeRelationshipType(type: string): RelationshipType {
    return type.toLowerCase() as RelationshipType;
  }

  /**
   * Check if a relationship type is gendered
   */
  isGenderedType(type: RelationshipType): boolean {
    const lowerType = type.toLowerCase();
    return lowerType in GENDERED_TO_GENDERLESS;
  }

  /**
   * Get reciprocal relationship kind for a given relationship
   */
  getReciprocalKind(kind: GenderlessKind): GenderlessKind | null {
    const reciprocalMap: Record<GenderlessKind, GenderlessKind> = {
      'parent': 'child',
      'child': 'parent',
      'sibling': 'sibling',
      'spouse': 'spouse',
      'auncle': 'nibling',
      'nibling': 'auncle',
      'grandparent': 'grandchild',
      'grandchild': 'grandparent',
      'cousin': 'cousin',
      // These relationships don't have clear reciprocals
      'friend': 'friend',
      'colleague': 'colleague',
      'relative': 'relative',
      'partner': 'partner'
    };

    return reciprocalMap[kind] || null;
  }
}