/**
 * Handles all gender-related operations for contacts
 */

export type Gender = 'M' | 'F' | 'NB' | 'U' | null;

export class GenderOperations {
  /**
   * Parse GENDER field value from vCard
   */
  parseGender(value: string): Gender {
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
   * Get the display term for a relationship based on the contact's gender
   */
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const mapping: Record<string, { M: string; F: string; default: string }> = {
      parent: { M: 'father', F: 'mother', default: 'parent' },
      auncle: { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
      child: { M: 'son', F: 'daughter', default: 'child' },
      sibling: { M: 'brother', F: 'sister', default: 'sibling' },
      grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
      grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
      spouse: { M: 'husband', F: 'wife', default: 'spouse' },
      friend: { M: 'friend', F: 'friend', default: 'friend' },
      colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
      acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' },
      neighbor: { M: 'neighbor', F: 'neighbor', default: 'neighbor' },
    };
    
    const mappingData = mapping[relationshipType.toLowerCase()];
    if (!mappingData) {
      return relationshipType;
    }
    
    if (contactGender === 'M') {
      return mappingData.M;
    } else if (contactGender === 'F') {
      return mappingData.F;
    } else {
      return mappingData.default;
    }
  }

  /**
   * Infer gender from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    const type = relationshipType.toLowerCase();
    
    const maleTerms = ['father', 'dad', 'daddy', 'uncle', 'brother', 'son', 'husband', 'grandfather', 'grandson'];
    if (maleTerms.includes(type)) {
      return 'M';
    }
    
    const femaleTerms = ['mother', 'mom', 'mommy', 'aunt', 'sister', 'daughter', 'wife', 'grandmother', 'granddaughter'];
    if (femaleTerms.includes(type)) {
      return 'F';
    }
    
    return null;
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   */
  convertToGenderlessType(relationshipType: string): string {
    const type = relationshipType.toLowerCase();
    
    if (['father', 'dad', 'daddy', 'mother', 'mom', 'mommy'].includes(type)) {
      return 'parent';
    }
    if (['aunt', 'uncle'].includes(type)) {
      return 'auncle';
    }
    if (['son', 'daughter'].includes(type)) {
      return 'child';
    }
    if (['brother', 'sister'].includes(type)) {
      return 'sibling';
    }
    if (['husband', 'wife'].includes(type)) {
      return 'spouse';
    }
    if (['grandfather', 'grandmother'].includes(type)) {
      return 'grandparent';
    }
    if (['grandson', 'granddaughter'].includes(type)) {
      return 'grandchild';
    }
    
    return relationshipType;
  }
}