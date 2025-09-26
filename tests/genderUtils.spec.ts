import { describe, it, expect } from 'vitest';
import { ContactNote } from 'src/contacts/contactNote';

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
      expect(contactNote.parseGender('INVALID')).toBe(null);
      expect(contactNote.parseGender('X')).toBe(null);
    });
  });

  describe('getGenderedRelationshipTerm', () => {
    it('should return gendered parent terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('parent', 'M')).toBe('father');
      expect(contactNote.getGenderedRelationshipTerm('parent', 'F')).toBe('mother');
    });

    it('should return gendered auncle terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('auncle', 'M')).toBe('uncle');
      expect(contactNote.getGenderedRelationshipTerm('auncle', 'F')).toBe('aunt');
    });

    it('should return gendered child terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('child', 'M')).toBe('son');
      expect(contactNote.getGenderedRelationshipTerm('child', 'F')).toBe('daughter');
    });

    it('should return gendered sibling terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('sibling', 'M')).toBe('brother');
      expect(contactNote.getGenderedRelationshipTerm('sibling', 'F')).toBe('sister');
    });

    it('should return gendered spouse terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('spouse', 'M')).toBe('husband');
      expect(contactNote.getGenderedRelationshipTerm('spouse', 'F')).toBe('wife');
    });

    it('should return unchanged terms for non-gendered relationships', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.getGenderedRelationshipTerm('friend', 'M')).toBe('friend');
      expect(contactNote.getGenderedRelationshipTerm('friend', 'F')).toBe('friend');
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
      expect(contactNote.convertToGenderlessType('brother')).toBe('sibling');
      expect(contactNote.convertToGenderlessType('sister')).toBe('sibling');
    });
  });

  describe('inferGenderFromRelationship', () => {
    it('should infer gender from relationship terms', () => {
      const contactNote = createTestContactNote();
      expect(contactNote.inferGenderFromRelationship('father')).toBe('M');
      expect(contactNote.inferGenderFromRelationship('mother')).toBe('F');
      expect(contactNote.inferGenderFromRelationship('brother')).toBe('M');
      expect(contactNote.inferGenderFromRelationship('sister')).toBe('F');
    });
  });
});
