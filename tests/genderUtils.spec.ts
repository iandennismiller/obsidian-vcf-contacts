import { describe, it, expect } from 'vitest';
import { 
  parseGender, 
  getGenderedRelationshipTerm, 
  getGenderlessRelationshipTypes,
  isGenderAwareRelationship,
  type Gender
} from 'src/contacts/genderUtils';

describe('genderUtils', () => {
  describe('parseGender', () => {
    it('should parse male gender values', () => {
      expect(parseGender('M')).toBe('M');
      expect(parseGender('MALE')).toBe('M');
      expect(parseGender('m')).toBe('M');
      expect(parseGender('male')).toBe('M');
    });

    it('should parse female gender values', () => {
      expect(parseGender('F')).toBe('F');
      expect(parseGender('FEMALE')).toBe('F');
      expect(parseGender('f')).toBe('F');
      expect(parseGender('female')).toBe('F');
    });

    it('should parse non-binary gender values', () => {
      expect(parseGender('NB')).toBe('NB');
      expect(parseGender('NON-BINARY')).toBe('NB');
      expect(parseGender('NONBINARY')).toBe('NB');
      expect(parseGender('nb')).toBe('NB');
      expect(parseGender('non-binary')).toBe('NB');
    });

    it('should parse unspecified gender values', () => {
      expect(parseGender('U')).toBe('U');
      expect(parseGender('UNSPECIFIED')).toBe('U');
      expect(parseGender('u')).toBe('U');
      expect(parseGender('unspecified')).toBe('U');
    });

    it('should return null for empty or invalid values', () => {
      expect(parseGender('')).toBe(null);
      expect(parseGender('   ')).toBe(null);
      expect(parseGender('INVALID')).toBe(null);
      expect(parseGender('X')).toBe(null);
    });
  });

  describe('getGenderedRelationshipTerm', () => {
    it('should return gendered parent terms', () => {
      expect(getGenderedRelationshipTerm('parent', 'M')).toBe('father');
      expect(getGenderedRelationshipTerm('parent', 'F')).toBe('mother');
      expect(getGenderedRelationshipTerm('parent', 'NB')).toBe('parent');
      expect(getGenderedRelationshipTerm('parent', 'U')).toBe('parent');
      expect(getGenderedRelationshipTerm('parent', null)).toBe('parent');
    });

    it('should return gendered auncle terms', () => {
      expect(getGenderedRelationshipTerm('auncle', 'M')).toBe('uncle');
      expect(getGenderedRelationshipTerm('auncle', 'F')).toBe('aunt');
      expect(getGenderedRelationshipTerm('auncle', 'NB')).toBe('aunt/uncle');
      expect(getGenderedRelationshipTerm('auncle', 'U')).toBe('aunt/uncle');
      expect(getGenderedRelationshipTerm('auncle', null)).toBe('aunt/uncle');
    });

    it('should return gendered child terms', () => {
      expect(getGenderedRelationshipTerm('child', 'M')).toBe('son');
      expect(getGenderedRelationshipTerm('child', 'F')).toBe('daughter');
      expect(getGenderedRelationshipTerm('child', 'NB')).toBe('child');
    });

    it('should return gendered sibling terms', () => {
      expect(getGenderedRelationshipTerm('sibling', 'M')).toBe('brother');
      expect(getGenderedRelationshipTerm('sibling', 'F')).toBe('sister');
      expect(getGenderedRelationshipTerm('sibling', 'NB')).toBe('sibling');
    });

    it('should return gendered spouse terms', () => {
      expect(getGenderedRelationshipTerm('spouse', 'M')).toBe('husband');
      expect(getGenderedRelationshipTerm('spouse', 'F')).toBe('wife');
      expect(getGenderedRelationshipTerm('spouse', 'NB')).toBe('spouse');
    });

    it('should return unchanged terms for non-gendered relationships', () => {
      expect(getGenderedRelationshipTerm('friend', 'M')).toBe('friend');
      expect(getGenderedRelationshipTerm('friend', 'F')).toBe('friend');
      expect(getGenderedRelationshipTerm('colleague', 'M')).toBe('colleague');
      expect(getGenderedRelationshipTerm('colleague', 'F')).toBe('colleague');
    });

    it('should return original term for unknown relationship types', () => {
      expect(getGenderedRelationshipTerm('mentor', 'M')).toBe('mentor');
      expect(getGenderedRelationshipTerm('mentor', 'F')).toBe('mentor');
      expect(getGenderedRelationshipTerm('custom-relationship', 'M')).toBe('custom-relationship');
    });

    it('should handle case insensitivity', () => {
      expect(getGenderedRelationshipTerm('PARENT', 'M')).toBe('father');
      expect(getGenderedRelationshipTerm('Parent', 'F')).toBe('mother');
      expect(getGenderedRelationshipTerm('AUNCLE', 'M')).toBe('uncle');
    });
  });

  describe('getGenderlessRelationshipTypes', () => {
    it('should return array of genderless relationship types', () => {
      const types = getGenderlessRelationshipTypes();
      expect(types).toContain('parent');
      expect(types).toContain('auncle');
      expect(types).toContain('child');
      expect(types).toContain('sibling');
      expect(types).toContain('spouse');
      expect(types).toContain('friend');
      expect(types).toContain('colleague');
      expect(Array.isArray(types)).toBe(true);
    });
  });

  describe('isGenderAwareRelationship', () => {
    it('should identify gender-aware relationships', () => {
      expect(isGenderAwareRelationship('parent')).toBe(true);
      expect(isGenderAwareRelationship('auncle')).toBe(true);
      expect(isGenderAwareRelationship('child')).toBe(true);
      expect(isGenderAwareRelationship('sibling')).toBe(true);
      expect(isGenderAwareRelationship('spouse')).toBe(true);
    });

    it('should identify non-gender-aware relationships', () => {
      expect(isGenderAwareRelationship('friend')).toBe(true); // friend is in the mapping but returns same value
      expect(isGenderAwareRelationship('mentor')).toBe(false);
      expect(isGenderAwareRelationship('custom-relationship')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(isGenderAwareRelationship('PARENT')).toBe(true);
      expect(isGenderAwareRelationship('Parent')).toBe(true);
    });
  });
});