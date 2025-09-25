import { describe, it, expect } from 'vitest';
import { 
  parseRelationshipListItem, 
  formatRelationshipListItem,
  inferGenderFromTerm,
  getGenderedRelationshipTerm,
  normalizeGender
} from '../src/relationships/genderUtils';
import { Gender, RelationshipType } from '../src/relationships/types';

describe('GenderUtils', () => {
  describe('parseRelationshipListItem', () => {
    it('should parse a basic relationship item', () => {
      const result = parseRelationshipListItem('- friend [[John Doe]]');
      
      expect(result).toEqual({
        type: 'friend',
        contactName: 'John Doe'
      });
    });

    it('should parse gendered relationship terms and infer gender', () => {
      const result = parseRelationshipListItem('- father [[John Doe]]');
      
      expect(result).toEqual({
        type: 'parent',
        contactName: 'John Doe',
        impliedGender: 'M'
      });
    });

    it('should parse mother as female parent', () => {
      const result = parseRelationshipListItem('- mother [[Jane Doe]]');
      
      expect(result).toEqual({
        type: 'parent',
        contactName: 'Jane Doe',
        impliedGender: 'F'
      });
    });

    it('should parse sibling relationships with gender', () => {
      const brother = parseRelationshipListItem('- brother [[Bob]]');
      const sister = parseRelationshipListItem('- sister [[Alice]]');
      
      expect(brother).toEqual({
        type: 'sibling',
        contactName: 'Bob',
        impliedGender: 'M'
      });
      
      expect(sister).toEqual({
        type: 'sibling',
        contactName: 'Alice',
        impliedGender: 'F'
      });
    });

    it('should handle whitespace variations', () => {
      const result = parseRelationshipListItem('  -   friend   [[  John Doe  ]]  ');
      
      expect(result).toEqual({
        type: 'friend',
        contactName: 'John Doe'
      });
    });

    it('should return null for invalid format', () => {
      expect(parseRelationshipListItem('invalid line')).toBeNull();
      expect(parseRelationshipListItem('- friend John Doe')).toBeNull();
      expect(parseRelationshipListItem('friend [[John Doe]]')).toBeNull();
    });

    it('should return null for unknown relationship terms', () => {
      const result = parseRelationshipListItem('- unknownrelation [[John Doe]]');
      expect(result).toBeNull();
    });
  });

  describe('formatRelationshipListItem', () => {
    it('should format a basic relationship item', () => {
      const result = formatRelationshipListItem('friend', 'John Doe');
      expect(result).toBe('- friend [[John Doe]]');
    });

    it('should use gendered terms when gender is provided', () => {
      const father = formatRelationshipListItem('parent', 'John Doe', 'M');
      const mother = formatRelationshipListItem('parent', 'Jane Doe', 'F');
      
      expect(father).toBe('- father [[John Doe]]');
      expect(mother).toBe('- mother [[Jane Doe]]');
    });

    it('should use neutral terms when gender is unspecified', () => {
      const result = formatRelationshipListItem('parent', 'Pat Doe');
      expect(result).toBe('- parent [[Pat Doe]]');
    });

    it('should handle auncle relationships correctly', () => {
      const uncle = formatRelationshipListItem('auncle', 'Uncle Bob', 'M');
      const aunt = formatRelationshipListItem('auncle', 'Aunt Sue', 'F');
      const neutral = formatRelationshipListItem('auncle', 'Pat', 'NB');
      
      expect(uncle).toBe('- uncle [[Uncle Bob]]');
      expect(aunt).toBe('- aunt [[Aunt Sue]]');
      expect(neutral).toBe('- auncle [[Pat]]');
    });
  });

  describe('inferGenderFromTerm', () => {
    it('should infer male gender from father terms', () => {
      expect(inferGenderFromTerm('father')).toEqual({ gender: 'M', type: 'parent' });
      expect(inferGenderFromTerm('dad')).toEqual({ gender: 'M', type: 'parent' });
      expect(inferGenderFromTerm('daddy')).toEqual({ gender: 'M', type: 'parent' });
    });

    it('should infer female gender from mother terms', () => {
      expect(inferGenderFromTerm('mother')).toEqual({ gender: 'F', type: 'parent' });
      expect(inferGenderFromTerm('mom')).toEqual({ gender: 'F', type: 'parent' });
      expect(inferGenderFromTerm('mama')).toEqual({ gender: 'F', type: 'parent' });
    });

    it('should be case insensitive', () => {
      expect(inferGenderFromTerm('FATHER')).toEqual({ gender: 'M', type: 'parent' });
      expect(inferGenderFromTerm('Mother')).toEqual({ gender: 'F', type: 'parent' });
      expect(inferGenderFromTerm('BrOtHeR')).toEqual({ gender: 'M', type: 'sibling' });
    });

    it('should return null for non-gendered terms', () => {
      expect(inferGenderFromTerm('friend')).toBeNull();
      expect(inferGenderFromTerm('colleague')).toBeNull();
      expect(inferGenderFromTerm('unknown')).toBeNull();
    });
  });

  describe('getGenderedRelationshipTerm', () => {
    it('should return gendered terms based on target gender', () => {
      expect(getGenderedRelationshipTerm('parent', 'M')).toBe('father');
      expect(getGenderedRelationshipTerm('parent', 'F')).toBe('mother');
      expect(getGenderedRelationshipTerm('parent', 'NB')).toBe('parent');
      expect(getGenderedRelationshipTerm('parent')).toBe('parent');
    });

    it('should handle sibling relationships', () => {
      expect(getGenderedRelationshipTerm('sibling', 'M')).toBe('brother');
      expect(getGenderedRelationshipTerm('sibling', 'F')).toBe('sister');
      expect(getGenderedRelationshipTerm('sibling', 'NB')).toBe('sibling');
    });

    it('should handle child relationships', () => {
      expect(getGenderedRelationshipTerm('child', 'M')).toBe('son');
      expect(getGenderedRelationshipTerm('child', 'F')).toBe('daughter');
      expect(getGenderedRelationshipTerm('child', 'U')).toBe('child');
    });

    it('should return neutral terms for relationships without gender variants', () => {
      expect(getGenderedRelationshipTerm('friend', 'M')).toBe('friend');
      expect(getGenderedRelationshipTerm('friend', 'F')).toBe('friend');
      expect(getGenderedRelationshipTerm('cousin', 'M')).toBe('cousin');
      expect(getGenderedRelationshipTerm('cousin', 'F')).toBe('cousin');
    });
  });

  describe('normalizeGender', () => {
    it('should normalize male gender variants', () => {
      expect(normalizeGender('M')).toBe('M');
      expect(normalizeGender('male')).toBe('M');
      expect(normalizeGender('MALE')).toBe('M');
      expect(normalizeGender('man')).toBe('M');
      expect(normalizeGender('MAN')).toBe('M');
    });

    it('should normalize female gender variants', () => {
      expect(normalizeGender('F')).toBe('F');
      expect(normalizeGender('female')).toBe('F');
      expect(normalizeGender('FEMALE')).toBe('F');
      expect(normalizeGender('woman')).toBe('F');
      expect(normalizeGender('WOMAN')).toBe('F');
    });

    it('should normalize non-binary gender variants', () => {
      expect(normalizeGender('NB')).toBe('NB');
      expect(normalizeGender('non-binary')).toBe('NB');
      expect(normalizeGender('NONBINARY')).toBe('NB');
      expect(normalizeGender('enby')).toBe('NB');
    });

    it('should normalize unspecified gender variants', () => {
      expect(normalizeGender('U')).toBe('U');
      expect(normalizeGender('unknown')).toBe('U');
      expect(normalizeGender('UNSPECIFIED')).toBe('U');
    });

    it('should return empty string for invalid values', () => {
      expect(normalizeGender('')).toBe('');
      expect(normalizeGender('invalid')).toBe('');
      expect(normalizeGender('xyz')).toBe('');
    });

    it('should handle whitespace', () => {
      expect(normalizeGender('  M  ')).toBe('M');
      expect(normalizeGender('  female  ')).toBe('F');
    });
  });
});