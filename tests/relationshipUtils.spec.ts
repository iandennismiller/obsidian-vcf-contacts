import { describe, it, expect } from 'vitest';
import { 
  parseGenderedTerm, 
  getGenderedTerm, 
  formatRelationshipListItem, 
  parseRelationshipFromListItem,
  formatRelatedValue,
  parseRelatedValue,
  generateRelatedFrontMatterKey,
  parseRelatedFrontMatterKey,
  isValidUuid
} from '../src/relationships/relationshipUtils';
import { RelationshipType, Gender } from '../src/relationships/relationshipTypes';

describe('RelationshipUtils', () => {
  describe('parseGenderedTerm', () => {
    it('should parse gendered terms correctly', () => {
      expect(parseGenderedTerm('father')).toEqual({ type: 'parent', gender: 'M' });
      expect(parseGenderedTerm('mother')).toEqual({ type: 'parent', gender: 'F' });
      expect(parseGenderedTerm('parent')).toEqual({ type: 'parent' });
      expect(parseGenderedTerm('brother')).toEqual({ type: 'sibling', gender: 'M' });
      expect(parseGenderedTerm('sister')).toEqual({ type: 'sibling', gender: 'F' });
    });

    it('should return null for invalid terms', () => {
      expect(parseGenderedTerm('invalid')).toBe(null);
      expect(parseGenderedTerm('')).toBe(null);
    });

    it('should handle case insensitive matching', () => {
      expect(parseGenderedTerm('FATHER')).toEqual({ type: 'parent', gender: 'M' });
      expect(parseGenderedTerm('Mother')).toEqual({ type: 'parent', gender: 'F' });
    });
  });

  describe('getGenderedTerm', () => {
    it('should return gendered terms based on gender', () => {
      expect(getGenderedTerm('parent', 'M')).toBe('father');
      expect(getGenderedTerm('parent', 'F')).toBe('mother');
      expect(getGenderedTerm('parent', 'NB')).toBe('parent');
      expect(getGenderedTerm('parent', undefined)).toBe('parent');
    });

    it('should return genderless terms for relationships without gender variants', () => {
      expect(getGenderedTerm('friend', 'M')).toBe('friend');
      expect(getGenderedTerm('friend', 'F')).toBe('friend');
      expect(getGenderedTerm('cousin', 'M')).toBe('cousin');
    });
  });

  describe('formatRelationshipListItem', () => {
    it('should format relationship list items correctly', () => {
      expect(formatRelationshipListItem('parent', 'John Doe', 'M')).toBe('- father [[John Doe]]');
      expect(formatRelationshipListItem('parent', 'Jane Doe', 'F')).toBe('- mother [[Jane Doe]]');
      expect(formatRelationshipListItem('friend', 'Best Friend')).toBe('- friend [[Best Friend]]');
    });
  });

  describe('parseRelationshipFromListItem', () => {
    it('should parse relationship list items correctly', () => {
      expect(parseRelationshipFromListItem('- father [[John Doe]]')).toEqual({
        type: 'parent',
        contactName: 'John Doe',
        impliedGender: 'M'
      });

      expect(parseRelationshipFromListItem('- friend [[Best Friend]]')).toEqual({
        type: 'friend',
        contactName: 'Best Friend'
      });

      expect(parseRelationshipFromListItem('- sister [[Jane Smith]]')).toEqual({
        type: 'sibling',
        contactName: 'Jane Smith',
        impliedGender: 'F'
      });
    });

    it('should return null for invalid list items', () => {
      expect(parseRelationshipFromListItem('invalid line')).toBe(null);
      expect(parseRelationshipFromListItem('- invalid relationship [[Name]]')).toBe(null);
      expect(parseRelationshipFromListItem('- friend Name without brackets')).toBe(null);
    });
  });

  describe('formatRelatedValue', () => {
    it('should format UUID values correctly', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(formatRelatedValue(uuid, 'John Doe')).toBe(`urn:uuid:${uuid}`);
    });

    it('should format non-UUID values with uid: prefix', () => {
      expect(formatRelatedValue('some-id', 'John Doe')).toBe('uid:some-id');
    });

    it('should use name: prefix when UID equals name', () => {
      expect(formatRelatedValue('John Doe', 'John Doe')).toBe('name:John Doe');
    });
  });

  describe('parseRelatedValue', () => {
    it('should parse urn:uuid: values correctly', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(parseRelatedValue(`urn:uuid:${uuid}`)).toEqual({ uid: uuid });
    });

    it('should parse uid: values correctly', () => {
      expect(parseRelatedValue('uid:some-id')).toEqual({ uid: 'some-id' });
    });

    it('should parse name: values correctly', () => {
      expect(parseRelatedValue('name:John Doe')).toEqual({ uid: 'John Doe', name: 'John Doe' });
    });

    it('should parse values without prefix as UID', () => {
      expect(parseRelatedValue('some-value')).toEqual({ uid: 'some-value' });
    });
  });

  describe('generateRelatedFrontMatterKey', () => {
    it('should generate front matter keys correctly', () => {
      expect(generateRelatedFrontMatterKey('parent', 0)).toBe('RELATED[parent]');
      expect(generateRelatedFrontMatterKey('parent', 1)).toBe('RELATED[1:parent]');
      expect(generateRelatedFrontMatterKey('friend', 2)).toBe('RELATED[2:friend]');
    });
  });

  describe('parseRelatedFrontMatterKey', () => {
    it('should parse front matter keys correctly', () => {
      expect(parseRelatedFrontMatterKey('RELATED[parent]')).toEqual({ type: 'parent', index: 0 });
      expect(parseRelatedFrontMatterKey('RELATED[1:parent]')).toEqual({ type: 'parent', index: 1 });
      expect(parseRelatedFrontMatterKey('RELATED[2:friend]')).toEqual({ type: 'friend', index: 2 });
    });

    it('should return null for invalid keys', () => {
      expect(parseRelatedFrontMatterKey('INVALID[parent]')).toBe(null);
      expect(parseRelatedFrontMatterKey('RELATED[invalid]')).toBe(null);
      expect(parseRelatedFrontMatterKey('RELATED[parent')).toBe(null);
    });
  });

  describe('isValidUuid', () => {
    it('should validate UUIDs correctly', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isValidUuid('invalid-uuid')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUuid('')).toBe(false);
    });
  });
});