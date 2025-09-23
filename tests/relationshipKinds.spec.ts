import { describe, it, expect } from 'vitest';
import { 
  getBaseRelationshipKind, 
  getGenderedRelationshipKind, 
  isGenderedRelationshipKind,
  inferGenderFromRelationshipKind,
  isValidRelationshipKind
} from 'src/util/relationshipKinds';

describe('Relationship Kinds Utility', () => {
  it('should get base relationship kinds correctly', () => {
    expect(getBaseRelationshipKind('uncle')).toBe('auncle');
    expect(getBaseRelationshipKind('aunt')).toBe('auncle');
    expect(getBaseRelationshipKind('auncle')).toBe('auncle');
    expect(getBaseRelationshipKind('friend')).toBe('friend');
    expect(getBaseRelationshipKind('father')).toBe('parent');
    expect(getBaseRelationshipKind('mother')).toBe('parent');
  });

  it('should get gendered relationship kinds correctly', () => {
    expect(getGenderedRelationshipKind('auncle', 'male')).toBe('uncle');
    expect(getGenderedRelationshipKind('auncle', 'female')).toBe('aunt');
    expect(getGenderedRelationshipKind('auncle')).toBe('auncle');
    
    expect(getGenderedRelationshipKind('parent', 'male')).toBe('father');
    expect(getGenderedRelationshipKind('parent', 'female')).toBe('mother');
    
    expect(getGenderedRelationshipKind('friend', 'male')).toBe('friend');
    expect(getGenderedRelationshipKind('friend', 'female')).toBe('friend');
  });

  it('should identify gendered relationship kinds', () => {
    expect(isGenderedRelationshipKind('uncle')).toBe(true);
    expect(isGenderedRelationshipKind('aunt')).toBe(true);
    expect(isGenderedRelationshipKind('father')).toBe(true);
    expect(isGenderedRelationshipKind('mother')).toBe(true);
    expect(isGenderedRelationshipKind('friend')).toBe(true);
    expect(isGenderedRelationshipKind('invalid')).toBe(false);
  });

  it('should infer gender from relationship kinds', () => {
    expect(inferGenderFromRelationshipKind('uncle')).toBe('male');
    expect(inferGenderFromRelationshipKind('aunt')).toBe('female');
    expect(inferGenderFromRelationshipKind('father')).toBe('male');
    expect(inferGenderFromRelationshipKind('mother')).toBe('female');
    expect(inferGenderFromRelationshipKind('friend')).toBeNull();
    expect(inferGenderFromRelationshipKind('parent')).toBeNull();
  });

  it('should validate relationship kinds', () => {
    expect(isValidRelationshipKind('friend')).toBe(true);
    expect(isValidRelationshipKind('uncle')).toBe(true);
    expect(isValidRelationshipKind('parent')).toBe(true);
    expect(isValidRelationshipKind('invalid')).toBe(false);
  });
});