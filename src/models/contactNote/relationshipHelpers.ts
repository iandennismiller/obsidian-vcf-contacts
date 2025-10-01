/**
 * Helper methods for relationship type handling and reciprocal relationships
 */

import { Gender } from './types';

/**
 * Helper methods for relationship type conversions and reciprocal relationships
 */
export class RelationshipHelpers {
  /**
   * Get reciprocal relationship type with gender awareness
   */
  getReciprocalRelationshipType(relationshipType: string, targetGender?: Gender): string | null {
    const reciprocalMap: Record<string, string | Record<string, string>> = {
      'father': {
        'M': 'son',
        'F': 'daughter',
        'NB': 'child',
        'O': 'child',
        'N': 'child',
        'U': 'child',
        'default': 'child'
      },
      'mother': {
        'M': 'son',
        'F': 'daughter',
        'NB': 'child',
        'O': 'child',
        'N': 'child',
        'U': 'child',
        'default': 'child'
      },
      'parent': {
        'M': 'son',
        'F': 'daughter',
        'NB': 'child',
        'O': 'child', 
        'N': 'child',
        'U': 'child',
        'default': 'child'
      },
      'son': 'parent',
      'daughter': 'parent',
      'child': 'parent',
      'brother': {
        'M': 'brother',
        'F': 'sister',
        'NB': 'sibling',
        'O': 'sibling',
        'N': 'sibling', 
        'U': 'sibling',
        'default': 'sibling'
      },
      'sister': {
        'M': 'brother',
        'F': 'sister',
        'NB': 'sibling',
        'O': 'sibling',
        'N': 'sibling',
        'U': 'sibling', 
        'default': 'sibling'
      },
      'sibling': 'sibling',
      'spouse': 'spouse',
      'husband': 'wife',
      'wife': 'husband',
      'friend': 'friend',
      'colleague': 'colleague',
      'manager': 'employee',
      'employee': 'manager',
      'boss': 'employee',
      'mentor': 'mentee',
      'mentee': 'mentor',
      'uncle': {
        'M': 'nephew',
        'F': 'niece',
        'NB': 'nephew',
        'O': 'nephew',
        'N': 'nephew',
        'U': 'nephew',
        'default': 'nephew'
      },
      'aunt': {
        'M': 'nephew',
        'F': 'niece',
        'NB': 'nephew',
        'O': 'nephew',
        'N': 'nephew',
        'U': 'nephew',
        'default': 'nephew'
      },
      'nephew': {
        'M': 'uncle',
        'F': 'aunt',
        'NB': 'uncle',
        'O': 'uncle',
        'N': 'uncle',
        'U': 'uncle',
        'default': 'uncle'
      },
      'niece': {
        'M': 'uncle',
        'F': 'aunt',
        'NB': 'aunt',
        'O': 'uncle',
        'N': 'uncle',
        'U': 'uncle',
        'default': 'uncle'
      }
    };
    
    const mapping = reciprocalMap[relationshipType.toLowerCase()];
    if (!mapping) return null;
    
    if (typeof mapping === 'string') {
      return mapping;
    }
    
    // Use gender-specific mapping if available
    if (targetGender && mapping[targetGender]) {
      return mapping[targetGender];
    }
    
    return mapping.default || null;
  }

  /**
   * Check if two relationship types are equivalent
   */
  areRelationshipTypesEquivalent(type1: string, type2: string, convertToGenderlessType: (type: string) => string): boolean {
    const genderless1 = convertToGenderlessType(type1);
    const genderless2 = convertToGenderlessType(type2);
    return genderless1 === genderless2;
  }
}
