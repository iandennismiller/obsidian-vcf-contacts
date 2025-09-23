import { describe, expect, it } from 'vitest';
import { 
  normalizeRelationshipKind, 
  renderRelationshipKind, 
  isGenderedRelationship,
  inferGenderFromRelationship
} from 'src/relationships/relationshipMapping';

describe('relationshipMapping', () => {
  describe('normalizeRelationshipKind', () => {
    it('should normalize gendered relationships to genderless forms', () => {
      expect(normalizeRelationshipKind('father')).toBe('parent');
      expect(normalizeRelationshipKind('mother')).toBe('parent');
      expect(normalizeRelationshipKind('son')).toBe('child');
      expect(normalizeRelationshipKind('daughter')).toBe('child');
      expect(normalizeRelationshipKind('aunt')).toBe('auncle');
      expect(normalizeRelationshipKind('uncle')).toBe('auncle');
    });

    it('should leave genderless relationships unchanged', () => {
      expect(normalizeRelationshipKind('friend')).toBe('friend');
      expect(normalizeRelationshipKind('colleague')).toBe('colleague');
      expect(normalizeRelationshipKind('cousin')).toBe('cousin');
    });

    it('should handle unknown relationships', () => {
      expect(normalizeRelationshipKind('unknown-relation')).toBe('unknown-relation');
    });

    it('should be case insensitive', () => {
      expect(normalizeRelationshipKind('FATHER')).toBe('parent');
      expect(normalizeRelationshipKind('Mother')).toBe('parent');
    });
  });

  describe('renderRelationshipKind', () => {
    it('should render gendered relationships based on gender', () => {
      expect(renderRelationshipKind('parent', 'M')).toBe('father');
      expect(renderRelationshipKind('parent', 'F')).toBe('mother');
      expect(renderRelationshipKind('parent', 'male')).toBe('father');
      expect(renderRelationshipKind('parent', 'female')).toBe('mother');
    });

    it('should render neutral form when no gender provided', () => {
      expect(renderRelationshipKind('parent')).toBe('parent');
      expect(renderRelationshipKind('child')).toBe('child');
    });

    it('should handle auncle relationships', () => {
      expect(renderRelationshipKind('auncle', 'M')).toBe('uncle');
      expect(renderRelationshipKind('auncle', 'F')).toBe('aunt');
      expect(renderRelationshipKind('auncle')).toBe('auncle');
    });

    it('should return original for non-gendered relationships', () => {
      expect(renderRelationshipKind('friend', 'M')).toBe('friend');
      expect(renderRelationshipKind('colleague', 'F')).toBe('colleague');
    });
  });

  describe('isGenderedRelationship', () => {
    it('should identify gendered relationships', () => {
      expect(isGenderedRelationship('father')).toBe(true);
      expect(isGenderedRelationship('mother')).toBe(true);
      expect(isGenderedRelationship('aunt')).toBe(true);
      expect(isGenderedRelationship('uncle')).toBe(true);
    });

    it('should identify non-gendered relationships', () => {
      expect(isGenderedRelationship('friend')).toBe(false);
      expect(isGenderedRelationship('colleague')).toBe(false);
      expect(isGenderedRelationship('parent')).toBe(false);
      expect(isGenderedRelationship('child')).toBe(false);
    });
  });

  describe('inferGenderFromRelationship', () => {
    it('should infer male gender from male-specific relationships', () => {
      expect(inferGenderFromRelationship('father')).toBe('M');
      expect(inferGenderFromRelationship('son')).toBe('M');
      expect(inferGenderFromRelationship('uncle')).toBe('M');
      expect(inferGenderFromRelationship('husband')).toBe('M');
    });

    it('should infer female gender from female-specific relationships', () => {
      expect(inferGenderFromRelationship('mother')).toBe('F');
      expect(inferGenderFromRelationship('daughter')).toBe('F');
      expect(inferGenderFromRelationship('aunt')).toBe('F');
      expect(inferGenderFromRelationship('wife')).toBe('F');
    });

    it('should return null for neutral relationships', () => {
      expect(inferGenderFromRelationship('friend')).toBeNull();
      expect(inferGenderFromRelationship('colleague')).toBeNull();
      expect(inferGenderFromRelationship('parent')).toBeNull();
      expect(inferGenderFromRelationship('child')).toBeNull();
    });
  });
});