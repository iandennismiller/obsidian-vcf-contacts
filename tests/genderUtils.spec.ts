import { describe, it, expect } from 'vitest';
import { 
  inferGenderFromTerm, 
  getGenderedRelationshipTerm, 
  parseRelationshipListItem,
  formatRelationshipListItem,
  normalizeGender
} from '../src/relationships/genderUtils';
import { Gender, RelationshipType } from '../src/relationships/relationshipGraph';

describe('GenderUtils', () => {
  describe('inferGenderFromTerm', () => {
    it('should infer gender from parent terms', () => {
      expect(inferGenderFromTerm('father')).toEqual({ gender: 'M', type: 'parent' });
      expect(inferGenderFromTerm('dad')).toEqual({ gender: 'M', type: 'parent' });
      expect(inferGenderFromTerm('mother')).toEqual({ gender: 'F', type: 'parent' });
      expect(inferGenderFromTerm('mom')).toEqual({ gender: 'F', type: 'parent' });
    });

    it('should infer gender from child terms', () => {
      expect(inferGenderFromTerm('son')).toEqual({ gender: 'M', type: 'child' });
      expect(inferGenderFromTerm('daughter')).toEqual({ gender: 'F', type: 'child' });
    });

    it('should infer gender from sibling terms', () => {
      expect(inferGenderFromTerm('brother')).toEqual({ gender: 'M', type: 'sibling' });
      expect(inferGenderFromTerm('sister')).toEqual({ gender: 'F', type: 'sibling' });
    });

    it('should return null for unknown terms', () => {
      expect(inferGenderFromTerm('unknown')).toBeNull();
      expect(inferGenderFromTerm('friend')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(inferGenderFromTerm('FATHER')).toEqual({ gender: 'M', type: 'parent' });
      expect(inferGenderFromTerm('Mother')).toEqual({ gender: 'F', type: 'parent' });
    });
  });

  describe('getGenderedRelationshipTerm', () => {
    it('should return gendered terms for parents', () => {
      expect(getGenderedRelationshipTerm('parent', 'M')).toBe('father');
      expect(getGenderedRelationshipTerm('parent', 'F')).toBe('mother');
      expect(getGenderedRelationshipTerm('parent', 'NB')).toBe('parent');
    });

    it('should return neutral terms for unspecified gender', () => {
      expect(getGenderedRelationshipTerm('parent', '')).toBe('parent');
      expect(getGenderedRelationshipTerm('parent', undefined)).toBe('parent');
      expect(getGenderedRelationshipTerm('parent', 'U')).toBe('parent');
    });

    it('should handle auncle relationships', () => {
      expect(getGenderedRelationshipTerm('auncle', 'M')).toBe('uncle');
      expect(getGenderedRelationshipTerm('auncle', 'F')).toBe('aunt');
      expect(getGenderedRelationshipTerm('auncle', 'NB')).toBe('auncle');
    });

    it('should return original term for non-gendered relationships', () => {
      expect(getGenderedRelationshipTerm('friend', 'M')).toBe('friend');
      expect(getGenderedRelationshipTerm('friend', 'F')).toBe('friend');
    });
  });

  describe('parseRelationshipListItem', () => {
    it('should parse valid relationship list items', () => {
      const result = parseRelationshipListItem('- father [[John Doe]]');
      expect(result).toEqual({
        type: 'parent',
        contactName: 'John Doe',
        impliedGender: 'M'
      });
    });

    it('should parse neutral relationship terms', () => {
      const result = parseRelationshipListItem('- friend [[Jane Smith]]');
      expect(result).toEqual({
        type: 'friend',
        contactName: 'Jane Smith'
      });
    });

    it('should handle extra whitespace', () => {
      const result = parseRelationshipListItem('  -   mother   [[  Mary Doe  ]]  ');
      expect(result).toEqual({
        type: 'parent',
        contactName: 'Mary Doe',
        impliedGender: 'F'
      });
    });

    it('should return null for invalid formats', () => {
      expect(parseRelationshipListItem('not a list item')).toBeNull();
      expect(parseRelationshipListItem('- missing brackets')).toBeNull();
      expect(parseRelationshipListItem('[[missing dash]]')).toBeNull();
    });

    it('should handle case variations', () => {
      const result = parseRelationshipListItem('- BROTHER [[Bob Smith]]');
      expect(result).toEqual({
        type: 'sibling',
        contactName: 'Bob Smith',
        impliedGender: 'M'
      });
    });
  });

  describe('formatRelationshipListItem', () => {
    it('should format with gendered terms', () => {
      expect(formatRelationshipListItem('parent', 'John Doe', 'M')).toBe('- father [[John Doe]]');
      expect(formatRelationshipListItem('parent', 'Jane Doe', 'F')).toBe('- mother [[Jane Doe]]');
    });

    it('should format with neutral terms', () => {
      expect(formatRelationshipListItem('parent', 'Alex Doe', 'NB')).toBe('- parent [[Alex Doe]]');
      expect(formatRelationshipListItem('friend', 'Sam Smith', 'M')).toBe('- friend [[Sam Smith]]');
    });

    it('should handle undefined gender', () => {
      expect(formatRelationshipListItem('parent', 'Pat Doe', undefined)).toBe('- parent [[Pat Doe]]');
    });
  });

  describe('normalizeGender', () => {
    it('should normalize male variants', () => {
      expect(normalizeGender('M')).toBe('M');
      expect(normalizeGender('MALE')).toBe('M');
      expect(normalizeGender('man')).toBe('M');
      expect(normalizeGender('m')).toBe('M');
    });

    it('should normalize female variants', () => {
      expect(normalizeGender('F')).toBe('F');
      expect(normalizeGender('FEMALE')).toBe('F');
      expect(normalizeGender('woman')).toBe('F');
      expect(normalizeGender('f')).toBe('F');
    });

    it('should normalize non-binary variants', () => {
      expect(normalizeGender('NB')).toBe('NB');
      expect(normalizeGender('NON-BINARY')).toBe('NB');
      expect(normalizeGender('nonbinary')).toBe('NB');
      expect(normalizeGender('enby')).toBe('NB');
    });

    it('should normalize unspecified variants', () => {
      expect(normalizeGender('U')).toBe('U');
      expect(normalizeGender('UNKNOWN')).toBe('U');
      expect(normalizeGender('unspecified')).toBe('U');
    });

    it('should return empty string for invalid input', () => {
      expect(normalizeGender('invalid')).toBe('');
      expect(normalizeGender('xyz')).toBe('');
      expect(normalizeGender('')).toBe('');
    });

    it('should handle whitespace', () => {
      expect(normalizeGender('  MALE  ')).toBe('M');
      expect(normalizeGender(' f ')).toBe('F');
    });
  });
});