/**
 * RelationshipType represents a type of relationship with gender-aware terminology.
 * 
 * This value object encapsulates relationship type information and provides
 * gender-aware term conversion for displaying relationships appropriately
 * based on the contact's gender.
 */

import { Gender } from '../valueObjects/Gender';

/**
 * Mapping of gender-neutral relationship types to their gendered equivalents
 */
const GENDERED_TERMS: Record<string, { male: string; female: string; other: string }> = {
  // Family relationships
  'spouse': { male: 'husband', female: 'wife', other: 'spouse' },
  'parent': { male: 'father', female: 'mother', other: 'parent' },
  'child': { male: 'son', female: 'daughter', other: 'child' },
  'sibling': { male: 'brother', female: 'sister', other: 'sibling' },
  'grandparent': { male: 'grandfather', female: 'grandmother', other: 'grandparent' },
  'grandchild': { male: 'grandson', female: 'granddaughter', other: 'grandchild' },
  
  // Extended family
  'uncle-aunt': { male: 'uncle', female: 'aunt', other: 'uncle/aunt' },
  'nephew-niece': { male: 'nephew', female: 'niece', other: 'nephew/niece' },
  'cousin': { male: 'cousin', female: 'cousin', other: 'cousin' },
  
  // Professional relationships
  'colleague': { male: 'colleague', female: 'colleague', other: 'colleague' },
  'manager': { male: 'manager', female: 'manager', other: 'manager' },
  'assistant': { male: 'assistant', female: 'assistant', other: 'assistant' },
  
  // Social relationships
  'friend': { male: 'friend', female: 'friend', other: 'friend' },
  'acquaintance': { male: 'acquaintance', female: 'acquaintance', other: 'acquaintance' },
  'partner': { male: 'partner', female: 'partner', other: 'partner' },
};

/**
 * Reverse mapping: gendered terms back to their neutral form
 */
const GENDERED_TO_NEUTRAL: Record<string, string> = {};
Object.keys(GENDERED_TERMS).forEach(neutral => {
  const terms = GENDERED_TERMS[neutral];
  if (terms.male !== neutral) GENDERED_TO_NEUTRAL[terms.male] = neutral;
  if (terms.female !== neutral) GENDERED_TO_NEUTRAL[terms.female] = neutral;
  if (terms.other !== neutral) GENDERED_TO_NEUTRAL[terms.other] = neutral;
});

/**
 * RelationshipType represents a type of relationship between contacts.
 * It supports both gender-neutral and gender-specific terminology.
 */
export class RelationshipType {
  private readonly type: string;

  private constructor(type: string) {
    this.type = type.toLowerCase().trim();
  }

  /**
   * Create a RelationshipType from a string
   */
  static fromString(type: string): RelationshipType {
    if (!type || typeof type !== 'string' || type.trim() === '') {
      throw new Error('Relationship type must be a non-empty string');
    }
    return new RelationshipType(type);
  }

  /**
   * Get the gender-neutral form of this relationship type
   */
  getNeutralType(): string {
    return GENDERED_TO_NEUTRAL[this.type] || this.type;
  }

  /**
   * Get the gender-specific term for this relationship type
   */
  getGenderedTerm(gender: Gender): string {
    const neutralType = this.getNeutralType();
    const terms = GENDERED_TERMS[neutralType];
    
    if (!terms) {
      // No gendered variants, return as-is
      return this.type;
    }
    
    if (gender.isMale()) {
      return terms.male;
    } else if (gender.isFemale()) {
      return terms.female;
    } else {
      return terms.other;
    }
  }

  /**
   * Infer gender from a gendered relationship term
   * Returns null if the term doesn't imply a specific gender
   */
  inferGender(): Gender | null {
    const neutralType = this.getNeutralType();
    const terms = GENDERED_TERMS[neutralType];
    
    if (!terms) {
      // Not a gendered term
      return null;
    }
    
    // Only infer gender if the term is different from the neutral form
    if (this.type === terms.male && terms.male !== neutralType) {
      return Gender.MALE;
    } else if (this.type === terms.female && terms.female !== neutralType) {
      return Gender.FEMALE;
    }
    
    return null;
  }

  /**
   * Check if this is a family relationship
   */
  isFamilyRelationship(): boolean {
    const familyTypes = ['spouse', 'parent', 'child', 'sibling', 'grandparent', 
                         'grandchild', 'uncle-aunt', 'nephew-niece', 'cousin',
                         'husband', 'wife', 'father', 'mother', 'son', 'daughter',
                         'brother', 'sister', 'grandfather', 'grandmother', 
                         'grandson', 'granddaughter', 'uncle', 'aunt', 
                         'nephew', 'niece'];
    return familyTypes.includes(this.type) || familyTypes.includes(this.getNeutralType());
  }

  /**
   * Check if this is a professional relationship
   */
  isProfessionalRelationship(): boolean {
    const professionalTypes = ['colleague', 'manager', 'assistant', 'supervisor', 
                               'employee', 'coworker', 'boss'];
    return professionalTypes.includes(this.type) || professionalTypes.includes(this.getNeutralType());
  }

  /**
   * Get the raw type string
   */
  toString(): string {
    return this.type;
  }

  /**
   * Check equality with another RelationshipType
   */
  equals(other: RelationshipType): boolean {
    if (!other) return false;
    // Compare neutral forms to consider "husband" and "wife" as the same type
    return this.getNeutralType() === other.getNeutralType();
  }

  /**
   * Get reciprocal relationship type
   * For example: parent <-> child, spouse <-> spouse
   */
  getReciprocal(): RelationshipType {
    const reciprocals: Record<string, string> = {
      'parent': 'child',
      'child': 'parent',
      'spouse': 'spouse',
      'sibling': 'sibling',
      'grandparent': 'grandchild',
      'grandchild': 'grandparent',
      'uncle-aunt': 'nephew-niece',
      'nephew-niece': 'uncle-aunt',
      'cousin': 'cousin',
      'manager': 'employee',
      'employee': 'manager',
      'friend': 'friend',
      'partner': 'partner',
    };
    
    const neutralType = this.getNeutralType();
    const reciprocalType = reciprocals[neutralType] || neutralType;
    return RelationshipType.fromString(reciprocalType);
  }
}
