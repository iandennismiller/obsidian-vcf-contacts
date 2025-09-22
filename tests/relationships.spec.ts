/**
 * @fileoverview Tests for relationship management functionality.
 */

import { describe, expect, it } from 'vitest';
import { 
  RELATIONSHIP_TYPES,
  getComplementRelationship,
  isSymmetricRelationship,
  isValidRelationshipType,
  parseRelatedField,
  formatRelatedField,
  renderRelationshipMarkdown,
  parseRelationshipMarkdown
} from '../src/contacts/relationships';

describe('Relationship Types', () => {
  it('should have correct complement relationships', () => {
    expect(getComplementRelationship('parent')).toBe('child');
    expect(getComplementRelationship('child')).toBe('parent');
    expect(getComplementRelationship('friend')).toBe('friend');
    expect(getComplementRelationship('spouse')).toBe('spouse');
    expect(getComplementRelationship('manager')).toBe('subordinate');
    expect(getComplementRelationship('subordinate')).toBe('manager');
  });

  it('should identify symmetric relationships correctly', () => {
    expect(isSymmetricRelationship('friend')).toBe(true);
    expect(isSymmetricRelationship('spouse')).toBe(true);
    expect(isSymmetricRelationship('sibling')).toBe(true);
    expect(isSymmetricRelationship('parent')).toBe(false);
    expect(isSymmetricRelationship('child')).toBe(false);
    expect(isSymmetricRelationship('manager')).toBe(false);
  });

  it('should validate relationship types correctly', () => {
    expect(isValidRelationshipType('friend')).toBe(true);
    expect(isValidRelationshipType('parent')).toBe(true);
    expect(isValidRelationshipType('FRIEND')).toBe(true); // case insensitive
    expect(isValidRelationshipType('unknown')).toBe(false);
    expect(isValidRelationshipType('')).toBe(false);
  });

  it('should handle unknown relationships gracefully', () => {
    expect(getComplementRelationship('unknown')).toBe('related');
  });
});

describe('RELATED Field Parsing', () => {
  it('should parse URN format correctly', () => {
    const result = parseRelatedField('urn:uuid:12345-abcde-67890', 'friend');
    expect(result).toEqual({
      uid: '12345-abcde-67890',
      type: 'friend'
    });
  });

  it('should parse plain UUID correctly', () => {
    const result = parseRelatedField('12345-abcde-67890', 'parent');
    expect(result).toEqual({
      uid: '12345-abcde-67890',
      type: 'parent'
    });
  });

  it('should default to "related" type if none provided', () => {
    const result = parseRelatedField('12345-abcde-67890');
    expect(result).toEqual({
      uid: '12345-abcde-67890',
      type: 'related'
    });
  });

  it('should format UID for vCard correctly', () => {
    expect(formatRelatedField('12345-abcde-67890')).toBe('urn:uuid:12345-abcde-67890');
    expect(formatRelatedField('urn:uuid:12345-abcde-67890')).toBe('urn:uuid:12345-abcde-67890');
  });
});

describe('Relationship Markdown', () => {
  it('should render relationship markdown correctly', () => {
    expect(renderRelationshipMarkdown('John Doe', 'friend', 'Jane Smith'))
      .toBe('- [[John Doe]] is a friend of Jane Smith');
    
    expect(renderRelationshipMarkdown('Bob Johnson', 'parent', 'Alice Johnson'))
      .toBe('- [[Bob Johnson]] is a parent of Alice Johnson');
      
    expect(renderRelationshipMarkdown('Eve Wilson', 'uncle', 'Charlie Wilson'))
      .toBe('- [[Eve Wilson]] is an uncle of Charlie Wilson');
  });

  it('should parse relationship markdown correctly', () => {
    const result1 = parseRelationshipMarkdown('- [[John Doe]] is a friend of Jane Smith');
    expect(result1).toEqual({
      contactName: 'John Doe',
      relationshipType: 'friend'
    });

    const result2 = parseRelationshipMarkdown('- [[Bob Johnson]] is the parent of Alice Johnson');
    expect(result2).toEqual({
      contactName: 'Bob Johnson',
      relationshipType: 'parent'
    });

    const result3 = parseRelationshipMarkdown('- [[Eve Wilson]] is an uncle of Charlie Wilson');
    expect(result3).toEqual({
      contactName: 'Eve Wilson',
      relationshipType: 'uncle'
    });
  });

  it('should handle invalid markdown gracefully', () => {
    expect(parseRelationshipMarkdown('invalid line')).toBeNull();
    expect(parseRelationshipMarkdown('- not a relationship')).toBeNull();
    expect(parseRelationshipMarkdown('')).toBeNull();
  });

  it('should handle names with special characters', () => {
    const result = parseRelationshipMarkdown('- [[O\'Connor, Sean]] is a friend of Jane Smith');
    expect(result).toEqual({
      contactName: 'O\'Connor, Sean',
      relationshipType: 'friend'
    });
  });
});

describe('Relationship Type Registry', () => {
  it('should contain all expected family relationships', () => {
    const familyTypes = ['parent', 'child', 'sibling', 'spouse', 'partner', 'grandparent', 'grandchild'];
    familyTypes.forEach(type => {
      expect(type in RELATIONSHIP_TYPES).toBe(true);
    });
  });

  it('should contain all expected social relationships', () => {
    const socialTypes = ['friend', 'colleague', 'acquaintance'];
    socialTypes.forEach(type => {
      expect(type in RELATIONSHIP_TYPES).toBe(true);
    });
  });

  it('should contain all expected professional relationships', () => {
    const professionalTypes = ['manager', 'subordinate', 'mentor', 'mentee'];
    professionalTypes.forEach(type => {
      expect(type in RELATIONSHIP_TYPES).toBe(true);
    });
  });
});