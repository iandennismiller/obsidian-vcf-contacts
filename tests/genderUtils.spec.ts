import { describe, it, expect } from 'vitest';
import { 
  normalizeRelationshipTerm,
  getRelationshipTerm,
  formatRelationshipListItem,
  inferGenderFromTerm,
  isValidRelationshipTerm,
  getReciprocalRelationshipType
} from '../src/relationships/genderUtils';

describe('Gender Utils', () => {
  describe('Relationship Term Normalization', () => {
    it('should normalize gendered terms to genderless forms', () => {
      expect(normalizeRelationshipTerm('father')).toBe('parent');
      expect(normalizeRelationshipTerm('mother')).toBe('parent');
      expect(normalizeRelationshipTerm('parent')).toBe('parent');

      expect(normalizeRelationshipTerm('son')).toBe('child');
      expect(normalizeRelationshipTerm('daughter')).toBe('child');
      expect(normalizeRelationshipTerm('child')).toBe('child');

      expect(normalizeRelationshipTerm('brother')).toBe('sibling');
      expect(normalizeRelationshipTerm('sister')).toBe('sibling');
      expect(normalizeRelationshipTerm('sibling')).toBe('sibling');
    });

    it('should handle case insensitive input', () => {
      expect(normalizeRelationshipTerm('FATHER')).toBe('parent');
      expect(normalizeRelationshipTerm('Mother')).toBe('parent');
      expect(normalizeRelationshipTerm('  brother  ')).toBe('sibling');
    });

    it('should return null for invalid terms', () => {
      expect(normalizeRelationshipTerm('invalid')).toBeNull();
      expect(normalizeRelationshipTerm('')).toBeNull();
      expect(normalizeRelationshipTerm('not-a-relationship')).toBeNull();
    });
  });

  describe('Gender-Aware Display Terms', () => {
    it('should return appropriate gendered terms', () => {
      expect(getRelationshipTerm('parent', 'M')).toBe('father');
      expect(getRelationshipTerm('parent', 'F')).toBe('mother');
      expect(getRelationshipTerm('parent', 'NB')).toBe('parent');
      expect(getRelationshipTerm('parent')).toBe('parent');

      expect(getRelationshipTerm('child', 'M')).toBe('son');
      expect(getRelationshipTerm('child', 'F')).toBe('daughter');
      expect(getRelationshipTerm('child')).toBe('child');
    });

    it('should handle gender-neutral relationships', () => {
      expect(getRelationshipTerm('spouse', 'M')).toBe('spouse');
      expect(getRelationshipTerm('spouse', 'F')).toBe('spouse');
      expect(getRelationshipTerm('friend', 'M')).toBe('friend');
      expect(getRelationshipTerm('friend', 'F')).toBe('friend');
    });
  });

  describe('List Item Formatting', () => {
    it('should format list items with appropriate gender terms', () => {
      expect(formatRelationshipListItem('parent', 'John Smith', 'M')).toBe('- father [[John Smith]]');
      expect(formatRelationshipListItem('parent', 'Jane Smith', 'F')).toBe('- mother [[Jane Smith]]');
      expect(formatRelationshipListItem('parent', 'Alex Smith')).toBe('- parent [[Alex Smith]]');

      expect(formatRelationshipListItem('child', 'Bobby', 'M')).toBe('- son [[Bobby]]');
      expect(formatRelationshipListItem('child', 'Alice', 'F')).toBe('- daughter [[Alice]]');
    });

    it('should handle complex names correctly', () => {
      expect(formatRelationshipListItem('sibling', 'Mary-Jane Watson', 'F')).toBe('- sister [[Mary-Jane Watson]]');
      expect(formatRelationshipListItem('cousin', 'Dr. Smith Jr.', 'M')).toBe('- cousin [[Dr. Smith Jr.]]');
    });
  });

  describe('Gender Inference', () => {
    it('should infer gender from gendered relationship terms', () => {
      expect(inferGenderFromTerm('father')).toBe('M');
      expect(inferGenderFromTerm('mother')).toBe('F');
      expect(inferGenderFromTerm('son')).toBe('M');
      expect(inferGenderFromTerm('daughter')).toBe('F');
      expect(inferGenderFromTerm('brother')).toBe('M');
      expect(inferGenderFromTerm('sister')).toBe('F');
      
      expect(inferGenderFromTerm('uncle')).toBe('M');
      expect(inferGenderFromTerm('aunt')).toBe('F');
      expect(inferGenderFromTerm('nephew')).toBe('M');
      expect(inferGenderFromTerm('niece')).toBe('F');
      
      expect(inferGenderFromTerm('grandfather')).toBe('M');
      expect(inferGenderFromTerm('grandmother')).toBe('F');
      expect(inferGenderFromTerm('grandson')).toBe('M');
      expect(inferGenderFromTerm('granddaughter')).toBe('F');
    });

    it('should return undefined for neutral terms', () => {
      expect(inferGenderFromTerm('parent')).toBeUndefined();
      expect(inferGenderFromTerm('child')).toBeUndefined();
      expect(inferGenderFromTerm('sibling')).toBeUndefined();
      expect(inferGenderFromTerm('spouse')).toBeUndefined();
      expect(inferGenderFromTerm('friend')).toBeUndefined();
      expect(inferGenderFromTerm('cousin')).toBeUndefined();
    });

    it('should handle case insensitive input', () => {
      expect(inferGenderFromTerm('FATHER')).toBe('M');
      expect(inferGenderFromTerm('Mother')).toBe('F');
      expect(inferGenderFromTerm('  brother  ')).toBe('M');
    });
  });

  describe('Relationship Term Validation', () => {
    it('should validate known relationship terms', () => {
      expect(isValidRelationshipTerm('father')).toBe(true);
      expect(isValidRelationshipTerm('mother')).toBe(true);
      expect(isValidRelationshipTerm('parent')).toBe(true);
      expect(isValidRelationshipTerm('spouse')).toBe(true);
      expect(isValidRelationshipTerm('friend')).toBe(true);
      expect(isValidRelationshipTerm('colleague')).toBe(true);
    });

    it('should reject invalid relationship terms', () => {
      expect(isValidRelationshipTerm('invalid')).toBe(false);
      expect(isValidRelationshipTerm('')).toBe(false);
      expect(isValidRelationshipTerm('random-term')).toBe(false);
    });
  });

  describe('Reciprocal Relationships', () => {
    it('should return correct reciprocal relationship types', () => {
      expect(getReciprocalRelationshipType('parent')).toBe('child');
      expect(getReciprocalRelationshipType('child')).toBe('parent');
      expect(getReciprocalRelationshipType('grandparent')).toBe('grandchild');
      expect(getReciprocalRelationshipType('grandchild')).toBe('grandparent');
      expect(getReciprocalRelationshipType('auncle')).toBe('nibling');
      expect(getReciprocalRelationshipType('nibling')).toBe('auncle');
    });

    it('should handle symmetric relationships', () => {
      expect(getReciprocalRelationshipType('sibling')).toBe('sibling');
      expect(getReciprocalRelationshipType('spouse')).toBe('spouse');
      expect(getReciprocalRelationshipType('partner')).toBe('partner');
      expect(getReciprocalRelationshipType('cousin')).toBe('cousin');
      expect(getReciprocalRelationshipType('friend')).toBe('friend');
      expect(getReciprocalRelationshipType('colleague')).toBe('colleague');
      expect(getReciprocalRelationshipType('relative')).toBe('relative');
    });
  });
});