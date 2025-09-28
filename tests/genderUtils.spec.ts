import { describe, it, expect } from 'vitest';
import { ContactNote } from 'src/contactNote';

// Create a test ContactNote instance for testing static methods
const createTestContactNote = () => new ContactNote(null as any, null as any, null as any);

describe('genderUtils', () => {
  describe('parseGender', () => {
    it('should parse male gender values', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.parseGender('M')).toBe('M');
      expect(contactNote.parseGender('MALE')).toBe('M');
      expect(contactNote.parseGender('m')).toBe('M');
      expect(contactNote.parseGender('male')).toBe('M');
    });

    it('should parse female gender values', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.parseGender('F')).toBe('F');
      expect(contactNote.parseGender('FEMALE')).toBe('F');
      expect(contactNote.parseGender('f')).toBe('F');
      expect(contactNote.parseGender('female')).toBe('F');
    });

    it('should parse non-binary gender values', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.parseGender('NB')).toBe('NB');
      expect(contactNote.parseGender('NON-BINARY')).toBe('NB');
      expect(contactNote.parseGender('NONBINARY')).toBe('NB');
      expect(contactNote.parseGender('nb')).toBe('NB');
      expect(contactNote.parseGender('non-binary')).toBe('NB');
    });

    it('should parse unspecified gender values', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.parseGender('U')).toBe('U');
      expect(contactNote.parseGender('UNSPECIFIED')).toBe('U');
      expect(contactNote.parseGender('u')).toBe('U');
      expect(contactNote.parseGender('unspecified')).toBe('U');
    });

    it('should return null for empty or invalid values', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.parseGender('')).toBe(null);
      expect(contactNote.parseGender('   ')).toBe(null);
      expect(contactNote.parseGender('invalid')).toBe(null);
    });
  });

  describe('getGenderedRelationshipTerm', () => {
    it('should return gendered terms for parent relationships', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('parent', 'M')).toBe('father');
      expect(contactNote.getGenderedRelationshipTerm('parent', 'F')).toBe('mother');
      expect(contactNote.getGenderedRelationshipTerm('parent', 'NB')).toBe('parent');
      expect(contactNote.getGenderedRelationshipTerm('parent', null)).toBe('parent');
    });

    it('should return gendered terms for child relationships', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('child', 'M')).toBe('son');
      expect(contactNote.getGenderedRelationshipTerm('child', 'F')).toBe('daughter');
      expect(contactNote.getGenderedRelationshipTerm('child', 'NB')).toBe('child');
    });

    it('should return unchanged terms for genderless relationships', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('colleague', 'M')).toBe('colleague');
    });

    it('should return original term for unknown relationship types', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('unknown', 'M')).toBe('unknown');
      expect(contactNote.getGenderedRelationshipTerm('custom', 'F')).toBe('custom');
    });

    it('should handle case insensitivity', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('PARENT', 'M')).toBe('father');
      expect(contactNote.getGenderedRelationshipTerm('Parent', 'F')).toBe('mother');
    });
  });

  describe('convertToGenderlessType', () => {
    it('should convert gendered terms to genderless equivalents', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.convertToGenderlessType('father')).toBe('parent');
      expect(contactNote.convertToGenderlessType('mother')).toBe('parent');
      expect(contactNote.convertToGenderlessType('son')).toBe('child');
      expect(contactNote.convertToGenderlessType('daughter')).toBe('child');
      expect(contactNote.convertToGenderlessType('brother')).toBe('sibling');
      expect(contactNote.convertToGenderlessType('sister')).toBe('sibling');
    });

    it('should return original term for already genderless terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.convertToGenderlessType('parent')).toBe('parent');
      expect(contactNote.convertToGenderlessType('child')).toBe('child');
      expect(contactNote.convertToGenderlessType('sibling')).toBe('sibling');
      expect(contactNote.convertToGenderlessType('friend')).toBe('friend');
    });
  });
});