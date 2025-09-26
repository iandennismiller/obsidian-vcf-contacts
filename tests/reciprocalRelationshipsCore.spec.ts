import { describe, it, expect } from 'vitest';
import {
  getReciprocalRelationshipType,
  isSymmetricRelationship
} from 'src/util/reciprocalRelationships';

describe('reciprocalRelationships - core functions', () => {
  describe('getReciprocalRelationshipType', () => {
    it('should return correct reciprocals for asymmetric relationships', () => {
      expect(getReciprocalRelationshipType('parent')).toBe('child');
      expect(getReciprocalRelationshipType('child')).toBe('parent');
      expect(getReciprocalRelationshipType('grandparent')).toBe('grandchild');
      expect(getReciprocalRelationshipType('grandchild')).toBe('grandparent');
      expect(getReciprocalRelationshipType('auncle')).toBe('nibling');
      expect(getReciprocalRelationshipType('nibling')).toBe('auncle');
    });

    it('should return same type for symmetric relationships', () => {
      expect(getReciprocalRelationshipType('sibling')).toBe('sibling');
      expect(getReciprocalRelationshipType('spouse')).toBe('spouse');
      expect(getReciprocalRelationshipType('partner')).toBe('partner');
      expect(getReciprocalRelationshipType('friend')).toBe('friend');
      expect(getReciprocalRelationshipType('colleague')).toBe('colleague');
      expect(getReciprocalRelationshipType('relative')).toBe('relative');
      expect(getReciprocalRelationshipType('cousin')).toBe('cousin');
    });

    it('should return null for relationships without reciprocals', () => {
      expect(getReciprocalRelationshipType('boss')).toBeNull();
      expect(getReciprocalRelationshipType('employee')).toBeNull();
      expect(getReciprocalRelationshipType('unknown')).toBeNull();
    });

    it('should handle different case inputs', () => {
      expect(getReciprocalRelationshipType('Parent')).toBe('child');
      expect(getReciprocalRelationshipType('CHILD')).toBe('parent');
      expect(getReciprocalRelationshipType('Friend')).toBe('friend');
    });
  });

  describe('isSymmetricRelationship', () => {
    it('should identify symmetric relationships', () => {
      expect(isSymmetricRelationship('sibling')).toBe(true);
      expect(isSymmetricRelationship('spouse')).toBe(true);
      expect(isSymmetricRelationship('partner')).toBe(true);
      expect(isSymmetricRelationship('friend')).toBe(true);
      expect(isSymmetricRelationship('colleague')).toBe(true);
      expect(isSymmetricRelationship('relative')).toBe(true);
      expect(isSymmetricRelationship('cousin')).toBe(true);
    });

    it('should identify asymmetric relationships', () => {
      expect(isSymmetricRelationship('parent')).toBe(false);
      expect(isSymmetricRelationship('child')).toBe(false);
      expect(isSymmetricRelationship('grandparent')).toBe(false);
      expect(isSymmetricRelationship('grandchild')).toBe(false);
      expect(isSymmetricRelationship('auncle')).toBe(false);
      expect(isSymmetricRelationship('nibling')).toBe(false);
    });

    it('should handle case insensitive inputs', () => {
      expect(isSymmetricRelationship('FRIEND')).toBe(true);
      expect(isSymmetricRelationship('Parent')).toBe(false);
    });
  });
});