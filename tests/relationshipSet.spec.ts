import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipSet, RelationshipEntry } from '../src/relationships/relationshipSet';
import { RelationshipType } from '../src/relationships/relationshipGraph';

describe('RelationshipSet', () => {
  let relationshipSet: RelationshipSet;

  beforeEach(() => {
    relationshipSet = new RelationshipSet();
  });

  describe('Basic Operations', () => {
    it('should create an empty relationship set', () => {
      expect(relationshipSet.size()).toBe(0);
      expect(relationshipSet.isEmpty()).toBe(true);
      expect(relationshipSet.getEntries()).toEqual([]);
    });

    it('should add relationship entries', () => {
      relationshipSet.add('spouse', 'uid:jane-123');
      relationshipSet.add('child', 'name:John Jr.');

      expect(relationshipSet.size()).toBe(2);
      expect(relationshipSet.isEmpty()).toBe(false);
      expect(relationshipSet.has('spouse', 'uid:jane-123')).toBe(true);
      expect(relationshipSet.has('child', 'name:John Jr.')).toBe(true);
    });

    it('should not add duplicate entries', () => {
      relationshipSet.add('spouse', 'uid:jane-123');
      relationshipSet.add('spouse', 'uid:jane-123'); // Duplicate

      expect(relationshipSet.size()).toBe(1);
    });

    it('should remove relationship entries', () => {
      relationshipSet.add('spouse', 'uid:jane-123');
      relationshipSet.add('child', 'name:John Jr.');
      
      expect(relationshipSet.size()).toBe(2);
      
      relationshipSet.remove('spouse', 'uid:jane-123');
      
      expect(relationshipSet.size()).toBe(1);
      expect(relationshipSet.has('spouse', 'uid:jane-123')).toBe(false);
      expect(relationshipSet.has('child', 'name:John Jr.')).toBe(true);
    });
  });

  describe('Front Matter Integration', () => {
    it('should create from front matter fields', () => {
      const frontmatter = {
        'RELATED.SPOUSE[1]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
        'RELATED.CHILD[1]': 'uid:child-123',
        'RELATED.CHILD[2]': 'name:Jane Jr.',
        'RELATED.PARENT[1]': 'name:Mary Smith'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      
      expect(set.size()).toBe(4);
      expect(set.has('spouse', 'urn:uuid:550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(set.has('child', 'uid:child-123')).toBe(true);
      expect(set.has('child', 'name:Jane Jr.')).toBe(true);
      expect(set.has('parent', 'name:Mary Smith')).toBe(true);
    });

    it('should ignore invalid front matter fields', () => {
      const frontmatter = {
        'RELATED.SPOUSE[1]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
        'RELATED.INVALID[1]': 'some-value', // Invalid relationship type
        'NOT_RELATED.CHILD[1]': 'uid:child-123', // Invalid field name
        'RELATED.CHILD[1]': '', // Empty value
        'RELATED.PARENT[1]': null, // Null value
        'RELATED.SIBLING[1]': '   ', // Blank value
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      
      expect(set.size()).toBe(1); // Only the valid spouse relationship
      expect(set.has('spouse', 'urn:uuid:550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should convert to front matter fields with proper indexing', () => {
      relationshipSet.add('spouse', 'urn:uuid:550e8400-e29b-41d4-a716-446655440000');
      relationshipSet.add('child', 'uid:child-123');
      relationshipSet.add('child', 'name:Jane Jr.');
      relationshipSet.add('parent', 'name:Mary Smith');

      const frontMatterFields = relationshipSet.toFrontMatterFields();
      
      expect(frontMatterFields).toHaveProperty('RELATED.SPOUSE[1]', 'urn:uuid:550e8400-e29b-41d4-a716-446655440000');
      expect(frontMatterFields).toHaveProperty('RELATED.CHILD[1]', 'uid:child-123');
      expect(frontMatterFields).toHaveProperty('RELATED.CHILD[2]', 'name:Jane Jr.');
      expect(frontMatterFields).toHaveProperty('RELATED.PARENT[1]', 'name:Mary Smith');
    });
  });

  describe('RelatedField Integration', () => {
    it('should create from RelatedField array', () => {
      const relatedFields = [
        { type: 'spouse' as RelationshipType, value: 'urn:uuid:550e8400-e29b-41d4-a716-446655440000' },
        { type: 'child' as RelationshipType, value: 'uid:child-123' },
        { type: 'parent' as RelationshipType, value: 'name:Mary Smith' }
      ];

      const set = RelationshipSet.fromRelatedFields(relatedFields);
      
      expect(set.size()).toBe(3);
      expect(set.has('spouse', 'urn:uuid:550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(set.has('child', 'uid:child-123')).toBe(true);
      expect(set.has('parent', 'name:Mary Smith')).toBe(true);
    });

    it('should convert to RelatedField array', () => {
      relationshipSet.add('spouse', 'urn:uuid:550e8400-e29b-41d4-a716-446655440000');
      relationshipSet.add('child', 'uid:child-123');

      const relatedFields = relationshipSet.toRelatedFields();
      
      expect(relatedFields).toHaveLength(2);
      expect(relatedFields).toEqual(expect.arrayContaining([
        { type: 'spouse', value: 'urn:uuid:550e8400-e29b-41d4-a716-446655440000' },
        { type: 'child', value: 'uid:child-123' }
      ]));
    });
  });

  describe('Set Operations', () => {
    it('should merge two RelationshipSets', () => {
      const set1 = new RelationshipSet();
      set1.add('spouse', 'uid:jane-123');
      set1.add('child', 'name:John Jr.');

      const set2 = new RelationshipSet();
      set2.add('parent', 'name:Mary Smith');
      set2.add('child', 'name:Alice Jr.'); // Different child

      const merged = set1.merge(set2);
      
      expect(merged.size()).toBe(4);
      expect(merged.has('spouse', 'uid:jane-123')).toBe(true);
      expect(merged.has('child', 'name:John Jr.')).toBe(true);
      expect(merged.has('parent', 'name:Mary Smith')).toBe(true);
      expect(merged.has('child', 'name:Alice Jr.')).toBe(true);
    });

    it('should handle duplicate entries in merge', () => {
      const set1 = new RelationshipSet();
      set1.add('spouse', 'uid:jane-123');
      set1.add('child', 'name:John Jr.');

      const set2 = new RelationshipSet();
      set2.add('spouse', 'uid:jane-123'); // Duplicate
      set2.add('parent', 'name:Mary Smith');

      const merged = set1.merge(set2);
      
      expect(merged.size()).toBe(3); // Should not duplicate the spouse relationship
    });

    it('should check equality correctly', () => {
      const set1 = new RelationshipSet();
      set1.add('spouse', 'uid:jane-123');
      set1.add('child', 'name:John Jr.');

      const set2 = new RelationshipSet();
      set2.add('child', 'name:John Jr.'); // Different order
      set2.add('spouse', 'uid:jane-123');

      const set3 = new RelationshipSet();
      set3.add('spouse', 'uid:jane-123');
      set3.add('parent', 'name:Mary Smith'); // Different relationship

      expect(set1.equals(set2)).toBe(true); // Same content, different order
      expect(set1.equals(set3)).toBe(false); // Different content
    });

    it('should clone correctly', () => {
      relationshipSet.add('spouse', 'uid:jane-123');
      relationshipSet.add('child', 'name:John Jr.');

      const cloned = relationshipSet.clone();
      
      expect(cloned.equals(relationshipSet)).toBe(true);
      
      // Ensure it's a deep copy
      cloned.add('parent', 'name:Mary Smith');
      expect(cloned.equals(relationshipSet)).toBe(false);
    });

    it('should clear all entries', () => {
      relationshipSet.add('spouse', 'uid:jane-123');
      relationshipSet.add('child', 'name:John Jr.');
      
      expect(relationshipSet.size()).toBe(2);
      
      relationshipSet.clear();
      
      expect(relationshipSet.size()).toBe(0);
      expect(relationshipSet.isEmpty()).toBe(true);
    });
  });

  describe('Filtering and Querying', () => {
    beforeEach(() => {
      relationshipSet.add('spouse', 'uid:jane-123');
      relationshipSet.add('child', 'name:John Jr.');
      relationshipSet.add('child', 'name:Alice Jr.');
      relationshipSet.add('parent', 'name:Mary Smith');
    });

    it('should get entries by type', () => {
      const children = relationshipSet.getEntriesByType('child');
      
      expect(children).toHaveLength(2);
      expect(children).toEqual(expect.arrayContaining([
        { type: 'child', value: 'name:John Jr.' },
        { type: 'child', value: 'name:Alice Jr.' }
      ]));
    });

    it('should return empty array for non-existent type', () => {
      const colleagues = relationshipSet.getEntriesByType('colleague');
      expect(colleagues).toEqual([]);
    });
  });

  describe('Data Validation and Normalization', () => {
    it('should reject invalid relationship types', () => {
      const invalidEntries: RelationshipEntry[] = [
        { type: 'spouse', value: 'uid:jane-123' }, // Valid
        { type: 'invalid' as RelationshipType, value: 'uid:invalid-123' }, // Invalid type
        { type: 'child', value: 'name:John Jr.' } // Valid
      ];

      const set = new RelationshipSet(invalidEntries);
      
      expect(set.size()).toBe(2); // Only valid entries
      expect(set.has('spouse', 'uid:jane-123')).toBe(true);
      expect(set.has('child', 'name:John Jr.')).toBe(true);
    });

    it('should filter out blank values', () => {
      const entriesWithBlanks: RelationshipEntry[] = [
        { type: 'spouse', value: 'uid:jane-123' }, // Valid
        { type: 'child', value: '' }, // Empty
        { type: 'parent', value: '   ' }, // Whitespace only
        { type: 'sibling', value: 'name:Bob' } // Valid
      ];

      const set = new RelationshipSet(entriesWithBlanks);
      
      expect(set.size()).toBe(2); // Only non-blank entries
      expect(set.has('spouse', 'uid:jane-123')).toBe(true);
      expect(set.has('sibling', 'name:Bob')).toBe(true);
    });

    it('should trim whitespace from values', () => {
      const set = new RelationshipSet();
      set.add('spouse', '  uid:jane-123  '); // Whitespace around value

      expect(set.has('spouse', 'uid:jane-123')).toBe(true);
      expect(set.has('spouse', '  uid:jane-123  ')).toBe(false);
    });
  });
});