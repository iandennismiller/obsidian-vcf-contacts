import { describe, test, expect, beforeEach } from 'vitest';
import { RelationshipSet } from '../src/relationships/relationshipSet';
import { RelationshipType } from '../src/relationships/relationshipGraph';

describe('RelationshipSet', () => {
  let relationshipSet: RelationshipSet;

  beforeEach(() => {
    relationshipSet = new RelationshipSet();
  });

  describe('Basic Operations', () => {
    test('should add relationships', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      
      expect(relationshipSet.has('friend', 'John Doe')).toBe(true);
      expect(relationshipSet.has('colleague', 'Jane Smith')).toBe(true);
      expect(relationshipSet.size()).toBe(2);
    });

    test('should not add duplicate relationships', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('friend', 'John Doe');
      
      expect(relationshipSet.size()).toBe(1);
    });

    test('should remove relationships', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      
      relationshipSet.remove('friend', 'John Doe');
      
      expect(relationshipSet.has('friend', 'John Doe')).toBe(false);
      expect(relationshipSet.has('colleague', 'Jane Smith')).toBe(true);
      expect(relationshipSet.size()).toBe(1);
    });

    test('should handle removing non-existent relationships', () => {
      relationshipSet.remove('friend', 'Non-existent');
      expect(relationshipSet.size()).toBe(0);
    });

    test('should get relationships by type', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('friend', 'Alice Johnson');
      relationshipSet.add('colleague', 'Jane Smith');
      
      const friends = relationshipSet.getByType('friend');
      expect(friends).toHaveLength(2);
      expect(friends).toContain('John Doe');
      expect(friends).toContain('Alice Johnson');
      
      const colleagues = relationshipSet.getByType('colleague');
      expect(colleagues).toHaveLength(1);
      expect(colleagues).toContain('Jane Smith');
    });

    test('should sort relationships by type', () => {
      relationshipSet.add('friend', 'Zara Wilson');
      relationshipSet.add('friend', 'Alice Johnson');
      
      const friends = relationshipSet.getByType('friend');
      expect(friends).toEqual(['Alice Johnson', 'Zara Wilson']);
    });

    test('should get all relationship types', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      relationshipSet.add('relative', 'Bob Johnson');
      
      const types = relationshipSet.getAllTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain('friend');
      expect(types).toContain('colleague');
      expect(types).toContain('relative');
    });

    test('should get all relationships sorted', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      relationshipSet.add('friend', 'Alice Johnson');
      
      const all = relationshipSet.getAll();
      expect(all).toHaveLength(3);
      
      // Should be sorted by type first, then by value
      expect(all[0]).toEqual({ type: 'colleague', value: 'Jane Smith' });
      expect(all[1]).toEqual({ type: 'friend', value: 'Alice Johnson' });
      expect(all[2]).toEqual({ type: 'friend', value: 'John Doe' });
    });

    test('should clear all relationships', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      
      relationshipSet.clear();
      
      expect(relationshipSet.size()).toBe(0);
      expect(relationshipSet.getAllTypes()).toHaveLength(0);
    });
  });

  describe('Front Matter Integration', () => {
    test('should create from front matter with single relationships', () => {
      const frontmatter = {
        'RELATED;TYPE=friend': 'uid:john-doe',
        'RELATED;TYPE=colleague': 'uid:jane-smith',
        'RELATED;TYPE=relative': 'name:Bob Johnson'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      
      expect(set.size()).toBe(3);
      expect(set.has('friend', 'uid:john-doe')).toBe(true);
      expect(set.has('colleague', 'uid:jane-smith')).toBe(true);
      expect(set.has('relative', 'name:Bob Johnson')).toBe(true);
    });

    test('should create from front matter with multiple same-type relationships', () => {
      const frontmatter = {
        'RELATED;TYPE=friend': 'uid:john-doe',
        'RELATED;TYPE=friend2': 'uid:jane-smith',
        'RELATED;TYPE=friend3': 'uid:alice-johnson'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      
      expect(set.size()).toBe(3);
      expect(set.getByType('friend')).toHaveLength(3);
    });

    test('should handle RELATED fields without type (default to relative)', () => {
      const frontmatter = {
        'RELATED': 'uid:john-doe'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      
      expect(set.size()).toBe(1);
      expect(set.has('relative', 'uid:john-doe')).toBe(true);
    });

    test('should convert to front matter fields', () => {
      relationshipSet.add('friend', 'uid:john-doe');
      relationshipSet.add('colleague', 'uid:jane-smith');
      
      const fields = relationshipSet.toFrontMatterFields();
      
      expect(fields).toEqual({
        'RELATED;TYPE=colleague': 'uid:jane-smith',
        'RELATED;TYPE=friend': 'uid:john-doe'
      });
    });

    test('should handle multiple relationships of same type in front matter', () => {
      relationshipSet.add('friend', 'uid:john-doe');
      relationshipSet.add('friend', 'uid:jane-smith');
      relationshipSet.add('friend', 'uid:alice-johnson');
      
      const fields = relationshipSet.toFrontMatterFields();
      
      expect(fields['RELATED;TYPE=friend']).toBe('uid:alice-johnson'); // First alphabetically
      expect(fields['RELATED;TYPE=friend2']).toBe('uid:jane-smith');
      expect(fields['RELATED;TYPE=friend3']).toBe('uid:john-doe');
    });
  });

  describe('Set Operations', () => {
    test('should merge with another RelationshipSet', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      
      const otherSet = new RelationshipSet();
      otherSet.add('friend', 'Alice Johnson');
      otherSet.add('relative', 'Bob Johnson');
      
      relationshipSet.merge(otherSet);
      
      expect(relationshipSet.size()).toBe(4);
      expect(relationshipSet.getByType('friend')).toHaveLength(2);
      expect(relationshipSet.has('relative', 'Bob Johnson')).toBe(true);
    });

    test('should not create duplicates when merging', () => {
      relationshipSet.add('friend', 'John Doe');
      
      const otherSet = new RelationshipSet();
      otherSet.add('friend', 'John Doe');
      otherSet.add('colleague', 'Jane Smith');
      
      relationshipSet.merge(otherSet);
      
      expect(relationshipSet.size()).toBe(2);
      expect(relationshipSet.getByType('friend')).toHaveLength(1);
    });

    test('should check equality with another RelationshipSet', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      
      const otherSet = new RelationshipSet();
      otherSet.add('colleague', 'Jane Smith');
      otherSet.add('friend', 'John Doe'); // Order shouldn't matter
      
      expect(relationshipSet.equals(otherSet)).toBe(true);
      
      otherSet.add('relative', 'Bob Johnson');
      expect(relationshipSet.equals(otherSet)).toBe(false);
    });

    test('should clone RelationshipSet', () => {
      relationshipSet.add('friend', 'John Doe');
      relationshipSet.add('colleague', 'Jane Smith');
      
      const clone = relationshipSet.clone();
      
      expect(clone.equals(relationshipSet)).toBe(true);
      
      // Modifying clone should not affect original
      clone.add('relative', 'Bob Johnson');
      expect(relationshipSet.size()).toBe(2);
      expect(clone.size()).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty front matter', () => {
      const set = RelationshipSet.fromFrontMatter({});
      expect(set.size()).toBe(0);
    });

    test('should handle front matter without RELATED fields', () => {
      const frontmatter = {
        'NAME': 'John Doe',
        'EMAIL': 'john@example.com'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      expect(set.size()).toBe(0);
    });

    test('should handle removing from empty type', () => {
      relationshipSet.remove('friend', 'Non-existent');
      expect(relationshipSet.size()).toBe(0);
    });

    test('should handle getting non-existent type', () => {
      const friends = relationshipSet.getByType('friend');
      expect(friends).toHaveLength(0);
    });

    test('should handle empty set operations', () => {
      const emptySet = new RelationshipSet();
      
      expect(relationshipSet.equals(emptySet)).toBe(true);
      expect(emptySet.toFrontMatterFields()).toEqual({});
      expect(emptySet.getAll()).toHaveLength(0);
    });
  });
});