import { describe, test, expect } from 'vitest';
import { 
  getReciprocalType, 
  renderRelationshipType, 
  formatRelationshipListItem, 
  parseRelationshipListItem,
  isSymmetricRelationship,
  isValidRelationshipType
} from '../src/relationships/relationshipUtils';
import { RelationshipType, Gender } from '../src/relationships/relationshipGraph';

describe('RelationshipUtils', () => {
  describe('getReciprocalType', () => {
    test('should return correct reciprocal types', () => {
      expect(getReciprocalType('parent')).toBe('child');
      expect(getReciprocalType('child')).toBe('parent');
      expect(getReciprocalType('sibling')).toBe('sibling');
      expect(getReciprocalType('friend')).toBe('friend');
      expect(getReciprocalType('spouse')).toBe('spouse');
      expect(getReciprocalType('auncle')).toBe('nibling');
      expect(getReciprocalType('nibling')).toBe('auncle');
      expect(getReciprocalType('grandparent')).toBe('grandchild');
      expect(getReciprocalType('grandchild')).toBe('grandparent');
      expect(getReciprocalType('cousin')).toBe('cousin');
    });
  });

  describe('renderRelationshipType', () => {
    test('should render gendered relationship types correctly', () => {
      expect(renderRelationshipType('parent', 'M')).toBe('father');
      expect(renderRelationshipType('parent', 'F')).toBe('mother');
      expect(renderRelationshipType('parent', 'NB')).toBe('parent');
      expect(renderRelationshipType('parent', 'U')).toBe('parent');
      expect(renderRelationshipType('parent', '')).toBe('parent');
      expect(renderRelationshipType('parent')).toBe('parent');
    });

    test('should handle all gendered relationship types', () => {
      // Parent/child
      expect(renderRelationshipType('child', 'M')).toBe('son');
      expect(renderRelationshipType('child', 'F')).toBe('daughter');
      
      // Siblings
      expect(renderRelationshipType('sibling', 'M')).toBe('brother');
      expect(renderRelationshipType('sibling', 'F')).toBe('sister');
      
      // Auncle/nibling
      expect(renderRelationshipType('auncle', 'M')).toBe('uncle');
      expect(renderRelationshipType('auncle', 'F')).toBe('aunt');
      expect(renderRelationshipType('nibling', 'M')).toBe('nephew');
      expect(renderRelationshipType('nibling', 'F')).toBe('niece');
      
      // Grandparents/grandchildren
      expect(renderRelationshipType('grandparent', 'M')).toBe('grandfather');
      expect(renderRelationshipType('grandparent', 'F')).toBe('grandmother');
      expect(renderRelationshipType('grandchild', 'M')).toBe('grandson');
      expect(renderRelationshipType('grandchild', 'F')).toBe('granddaughter');
      
      // Spouse
      expect(renderRelationshipType('spouse', 'M')).toBe('husband');
      expect(renderRelationshipType('spouse', 'F')).toBe('wife');
    });

    test('should handle genderless relationship types', () => {
      expect(renderRelationshipType('friend', 'M')).toBe('friend');
      expect(renderRelationshipType('friend', 'F')).toBe('friend');
      expect(renderRelationshipType('colleague', 'M')).toBe('colleague');
      expect(renderRelationshipType('colleague', 'F')).toBe('colleague');
      expect(renderRelationshipType('cousin', 'M')).toBe('cousin');
      expect(renderRelationshipType('cousin', 'F')).toBe('cousin');
    });
  });

  describe('formatRelationshipListItem', () => {
    test('should format relationship list items correctly', () => {
      expect(formatRelationshipListItem('friend', 'John Doe')).toBe('- friend [[John Doe]]');
      expect(formatRelationshipListItem('parent', 'Jane Smith', 'F')).toBe('- mother [[Jane Smith]]');
      expect(formatRelationshipListItem('sibling', 'Bob Johnson', 'M')).toBe('- brother [[Bob Johnson]]');
    });

    test('should handle contacts with special characters in names', () => {
      expect(formatRelationshipListItem('friend', 'Jean-Luc Picard')).toBe('- friend [[Jean-Luc Picard]]');
      expect(formatRelationshipListItem('colleague', "O'Brien")).toBe("- colleague [[O'Brien]]");
    });
  });

  describe('parseRelationshipListItem', () => {
    test('should parse simple relationship list items', () => {
      const result = parseRelationshipListItem('- friend [[John Doe]]');
      expect(result).toEqual({
        type: 'friend',
        contactName: 'John Doe',
        impliedGender: undefined
      });
    });

    test('should parse gendered relationship terms', () => {
      const father = parseRelationshipListItem('- father [[John Doe]]');
      expect(father).toEqual({
        type: 'parent',
        contactName: 'John Doe',
        impliedGender: 'M'
      });

      const mother = parseRelationshipListItem('- mother [[Jane Smith]]');
      expect(mother).toEqual({
        type: 'parent',
        contactName: 'Jane Smith',
        impliedGender: 'F'
      });

      const sister = parseRelationshipListItem('- sister [[Alice Johnson]]');
      expect(sister).toEqual({
        type: 'sibling',
        contactName: 'Alice Johnson',
        impliedGender: 'F'
      });
    });

    test('should handle various whitespace patterns', () => {
      expect(parseRelationshipListItem('-friend[[John Doe]]')).toEqual({
        type: 'friend',
        contactName: 'John Doe',
        impliedGender: undefined
      });

      expect(parseRelationshipListItem('  -   friend   [[John Doe]]  ')).toEqual({
        type: 'friend',
        contactName: 'John Doe',
        impliedGender: undefined
      });
    });

    test('should return null for invalid formats', () => {
      expect(parseRelationshipListItem('friend [[John Doe]]')).toBeNull(); // Missing dash
      expect(parseRelationshipListItem('- friend John Doe')).toBeNull(); // Missing brackets
      expect(parseRelationshipListItem('- invalidtype [[John Doe]]')).toBeNull(); // Invalid type
      expect(parseRelationshipListItem('Not a relationship item')).toBeNull();
    });

    test('should handle contact names with special characters', () => {
      const result = parseRelationshipListItem('- friend [[Jean-Luc Picard]]');
      expect(result?.contactName).toBe('Jean-Luc Picard');

      const result2 = parseRelationshipListItem("- colleague [[O'Brien]]");
      expect(result2?.contactName).toBe("O'Brien");
    });
  });

  describe('isSymmetricRelationship', () => {
    test('should identify symmetric relationships', () => {
      expect(isSymmetricRelationship('friend')).toBe(true);
      expect(isSymmetricRelationship('sibling')).toBe(true);
      expect(isSymmetricRelationship('spouse')).toBe(true);
      expect(isSymmetricRelationship('cousin')).toBe(true);
      expect(isSymmetricRelationship('colleague')).toBe(true);
      expect(isSymmetricRelationship('partner')).toBe(true);
    });

    test('should identify asymmetric relationships', () => {
      expect(isSymmetricRelationship('parent')).toBe(false);
      expect(isSymmetricRelationship('child')).toBe(false);
      expect(isSymmetricRelationship('auncle')).toBe(false);
      expect(isSymmetricRelationship('nibling')).toBe(false);
      expect(isSymmetricRelationship('grandparent')).toBe(false);
      expect(isSymmetricRelationship('grandchild')).toBe(false);
    });
  });

  describe('isValidRelationshipType', () => {
    test('should validate correct relationship types', () => {
      expect(isValidRelationshipType('friend')).toBe(true);
      expect(isValidRelationshipType('parent')).toBe(true);
      expect(isValidRelationshipType('child')).toBe(true);
      expect(isValidRelationshipType('sibling')).toBe(true);
      expect(isValidRelationshipType('spouse')).toBe(true);
      expect(isValidRelationshipType('colleague')).toBe(true);
      expect(isValidRelationshipType('relative')).toBe(true);
      expect(isValidRelationshipType('auncle')).toBe(true);
      expect(isValidRelationshipType('nibling')).toBe(true);
      expect(isValidRelationshipType('grandparent')).toBe(true);
      expect(isValidRelationshipType('grandchild')).toBe(true);
      expect(isValidRelationshipType('cousin')).toBe(true);
      expect(isValidRelationshipType('partner')).toBe(true);
    });

    test('should reject invalid relationship types', () => {
      expect(isValidRelationshipType('invalid')).toBe(false);
      expect(isValidRelationshipType('random')).toBe(false);
      expect(isValidRelationshipType('')).toBe(false);
      expect(isValidRelationshipType('123')).toBe(false);
    });
  });
});