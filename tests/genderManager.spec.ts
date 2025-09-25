/**
 * Tests for the GenderManager functionality
 */

import { describe, it, expect } from 'vitest';
import { GenderManager } from '../src/relationships/genderManager';

describe('GenderManager', () => {
  let manager: GenderManager;

  beforeEach(() => {
    manager = new GenderManager();
  });

  describe('encodeToGenderless', () => {
    it('should convert gendered terms to genderless equivalents', () => {
      expect(manager.encodeToGenderless('mother')).toBe('parent');
      expect(manager.encodeToGenderless('father')).toBe('parent');
      expect(manager.encodeToGenderless('son')).toBe('child');
      expect(manager.encodeToGenderless('daughter')).toBe('child');
      expect(manager.encodeToGenderless('brother')).toBe('sibling');
      expect(manager.encodeToGenderless('sister')).toBe('sibling');
    });

    it('should leave genderless terms unchanged', () => {
      expect(manager.encodeToGenderless('parent')).toBe('parent');
      expect(manager.encodeToGenderless('child')).toBe('child');
      expect(manager.encodeToGenderless('friend')).toBe('friend');
      expect(manager.encodeToGenderless('colleague')).toBe('colleague');
    });

    it('should handle case insensitive input', () => {
      expect(manager.encodeToGenderless('MOTHER')).toBe('parent');
      expect(manager.encodeToGenderless('Mother')).toBe('parent');
    });
  });

  describe('decodeToGendered', () => {
    it('should convert genderless terms to appropriate gendered forms', () => {
      expect(manager.decodeToGendered('parent', 'M')).toBe('father');
      expect(manager.decodeToGendered('parent', 'F')).toBe('mother');
      expect(manager.decodeToGendered('child', 'M')).toBe('son');
      expect(manager.decodeToGendered('child', 'F')).toBe('daughter');
    });

    it('should use default forms when gender is not specified', () => {
      expect(manager.decodeToGendered('parent')).toBe('parent');
      expect(manager.decodeToGendered('child')).toBe('child');
      expect(manager.decodeToGendered('auncle')).toBe('aunt/uncle');
    });

    it('should handle terms without gendered variants', () => {
      expect(manager.decodeToGendered('friend', 'M')).toBe('friend');
      expect(manager.decodeToGendered('friend', 'F')).toBe('friend');
      expect(manager.decodeToGendered('colleague')).toBe('colleague');
    });
  });

  describe('inferGenderFromRelationship', () => {
    it('should infer gender from gendered relationship terms', () => {
      const motherResult = manager.inferGenderFromRelationship('mother');
      expect(motherResult.inferredGender).toBe('F');
      expect(motherResult.genderlessKind).toBe('parent');
      expect(motherResult.reciprocalKind).toBe('child');

      const fatherResult = manager.inferGenderFromRelationship('father');
      expect(fatherResult.inferredGender).toBe('M');
      expect(fatherResult.genderlessKind).toBe('parent');
      expect(fatherResult.reciprocalKind).toBe('child');
    });

    it('should handle genderless terms', () => {
      const result = manager.inferGenderFromRelationship('friend');
      expect(result.inferredGender).toBeUndefined();
      expect(result.genderlessKind).toBe('friend');
      expect(result.reciprocalKind).toBeUndefined();
    });
  });

  describe('getReciprocalKind', () => {
    it('should return correct reciprocal relationships', () => {
      expect(manager.getReciprocalKind('parent')).toBe('child');
      expect(manager.getReciprocalKind('child')).toBe('parent');
      expect(manager.getReciprocalKind('sibling')).toBe('sibling');
      expect(manager.getReciprocalKind('auncle')).toBe('nibling');
      expect(manager.getReciprocalKind('nibling')).toBe('auncle');
    });

    it('should handle symmetric relationships', () => {
      expect(manager.getReciprocalKind('spouse')).toBe('spouse');
      expect(manager.getReciprocalKind('friend')).toBe('friend');
      expect(manager.getReciprocalKind('cousin')).toBe('cousin');
    });
  });

  describe('hasGenderedVariants', () => {
    it('should identify relationships with gendered variants', () => {
      expect(manager.hasGenderedVariants('parent')).toBe(true);
      expect(manager.hasGenderedVariants('child')).toBe(true);
      expect(manager.hasGenderedVariants('sibling')).toBe(true);
    });

    it('should identify relationships without gendered variants', () => {
      expect(manager.hasGenderedVariants('friend')).toBe(false);
      expect(manager.hasGenderedVariants('colleague')).toBe(false);
      expect(manager.hasGenderedVariants('cousin')).toBe(false);
    });
  });

  describe('isGenderedType', () => {
    it('should identify gendered relationship types', () => {
      expect(manager.isGenderedType('mother')).toBe(true);
      expect(manager.isGenderedType('father')).toBe(true);
      expect(manager.isGenderedType('son')).toBe(true);
      expect(manager.isGenderedType('daughter')).toBe(true);
    });

    it('should identify genderless relationship types', () => {
      expect(manager.isGenderedType('parent')).toBe(false);
      expect(manager.isGenderedType('child')).toBe(false);
      expect(manager.isGenderedType('friend')).toBe(false);
    });
  });
});