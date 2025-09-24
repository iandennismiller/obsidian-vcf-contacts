import { describe, it, expect } from 'vitest';
import { RelationshipSet, RelationshipEntry } from '../src/relationships/relationshipSet';
import { RelationshipType } from '../src/relationships/relationshipGraph';

describe('RelationshipSet', () => {
  describe('construction and basic operations', () => {
    it('should create an empty set by default', () => {
      const set = new RelationshipSet();
      expect(set.isEmpty()).toBe(true);
      expect(set.size()).toBe(0);
    });

    it('should create a set from valid entries', () => {
      const entries: RelationshipEntry[] = [
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ];
      const set = new RelationshipSet(entries);
      
      expect(set.size()).toBe(2);
      expect(set.getEntries()).toEqual(entries);
    });

    it('should filter out invalid entries during construction', () => {
      const entries: RelationshipEntry[] = [
        { type: 'parent', value: 'Jane Doe' },       // Valid
        { type: 'invalidtype' as RelationshipType, value: 'Invalid' }, // Invalid type
        { type: 'sibling', value: '' },             // Blank value
        { type: 'friend', value: '   ' },           // Whitespace only
        { type: 'spouse', value: 'Valid Spouse' }   // Valid
      ];
      const set = new RelationshipSet(entries);
      
      expect(set.size()).toBe(2);
      expect(set.getEntries()).toEqual([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'spouse', value: 'Valid Spouse' }
      ]);
    });

    it('should deduplicate identical entries', () => {
      const entries: RelationshipEntry[] = [
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'Jane Doe' }, // Duplicate
        { type: 'sibling', value: 'John Doe' }
      ];
      const set = new RelationshipSet(entries);
      
      expect(set.size()).toBe(2);
      expect(set.getEntries()).toEqual([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ]);
    });
  });

  describe('fromFrontMatter', () => {
    it('should parse valid front matter fields', () => {
      const frontmatter = {
        UID: 'test-uid',
        'RELATED[parent]': 'Jane Doe',
        'RELATED[1:sibling]': 'John Doe',
        'RELATED[friend]': 'Best Friend',
        'RELATED[2:colleague]': 'Work Buddy'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      expect(set.size()).toBe(4);
      
      const entries = set.getEntries();
      expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
      expect(entries).toContainEqual({ type: 'sibling', value: 'John Doe' });
      expect(entries).toContainEqual({ type: 'friend', value: 'Best Friend' });
      expect(entries).toContainEqual({ type: 'colleague', value: 'Work Buddy' });
    });

    it('should normalize gendered terms to genderless types', () => {
      const frontmatter = {
        'RELATED[mother]': 'Jane Doe',     // Should become parent
        'RELATED[father]': 'John Doe',     // Should become parent  
        'RELATED[son]': 'Bob Doe',         // Should become child
        'RELATED[sister]': 'Alice Doe'     // Should become sibling
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      expect(set.size()).toBe(4);
      
      const entries = set.getEntries();
      expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
      expect(entries).toContainEqual({ type: 'parent', value: 'John Doe' });
      expect(entries).toContainEqual({ type: 'child', value: 'Bob Doe' });
      expect(entries).toContainEqual({ type: 'sibling', value: 'Alice Doe' });
    });

    it('should filter out blank values and invalid types', () => {
      const frontmatter = {
        'RELATED[parent]': 'Jane Doe',          // Valid
        'RELATED[1:child]': '',                 // Blank value
        'RELATED[2:sibling]': '   ',            // Whitespace only
        'RELATED[3:invalidtype]': 'Invalid',    // Invalid type
        'RELATED[4:spouse]': null,              // Null value
        'RELATED[5:friend]': 'undefined',       // String "undefined" 
        'RELATED[6:colleague]': 'Valid Person'  // Valid
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      expect(set.size()).toBe(2);
      
      const entries = set.getEntries();
      expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
      expect(entries).toContainEqual({ type: 'colleague', value: 'Valid Person' });
    });

    it('should ignore non-RELATED fields', () => {
      const frontmatter = {
        UID: 'test-uid',
        NAME: 'Test Person',
        'RELATED[parent]': 'Jane Doe',
        EMAIL: 'test@example.com'
      };

      const set = RelationshipSet.fromFrontMatter(frontmatter);
      expect(set.size()).toBe(1);
      expect(set.getEntries()).toEqual([{ type: 'parent', value: 'Jane Doe' }]);
    });
  });

  describe('toFrontMatterFields', () => {
    it('should generate properly indexed front matter fields', () => {
      const entries: RelationshipEntry[] = [
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'John Doe' },
        { type: 'sibling', value: 'Alice Doe' },
        { type: 'friend', value: 'Best Friend' }
      ];
      const set = new RelationshipSet(entries);

      const fields = set.toFrontMatterFields();

      // Should have deterministic, sorted output
      expect(fields).toEqual({
        'RELATED[friend]': 'Best Friend',
        'RELATED[parent]': 'Jane Doe',
        'RELATED[1:parent]': 'John Doe', 
        'RELATED[sibling]': 'Alice Doe'
      });
    });

    it('should handle single entries without indices', () => {
      const set = new RelationshipSet([{ type: 'parent', value: 'Jane Doe' }]);
      const fields = set.toFrontMatterFields();

      expect(fields).toEqual({
        'RELATED[parent]': 'Jane Doe'
      });
    });

    it('should produce deterministic output regardless of input order', () => {
      const entries1: RelationshipEntry[] = [
        { type: 'friend', value: 'Friend A' },
        { type: 'parent', value: 'Parent B' },
        { type: 'parent', value: 'Parent A' }
      ];
      const entries2: RelationshipEntry[] = [
        { type: 'parent', value: 'Parent A' },
        { type: 'parent', value: 'Parent B' },
        { type: 'friend', value: 'Friend A' }
      ];

      const set1 = new RelationshipSet(entries1);
      const set2 = new RelationshipSet(entries2);

      expect(set1.toFrontMatterFields()).toEqual(set2.toFrontMatterFields());
    });
  });

  describe('array manipulation', () => {
    it('should add new entries correctly', () => {
      const set = new RelationshipSet();
      
      set.add('parent', 'Jane Doe');
      set.add('sibling', 'John Doe');
      
      expect(set.size()).toBe(2);
      expect(set.getEntries()).toContainEqual({ type: 'parent', value: 'Jane Doe' });
      expect(set.getEntries()).toContainEqual({ type: 'sibling', value: 'John Doe' });
    });

    it('should reject invalid relationship types', () => {
      const set = new RelationshipSet();
      
      expect(() => set.add('invalidtype' as RelationshipType, 'Some Person')).toThrow('Invalid relationship type: invalidtype');
    });

    it('should silently skip blank values when adding', () => {
      const set = new RelationshipSet();
      
      set.add('parent', '');       // Empty string
      set.add('sibling', '   ');   // Whitespace only
      set.add('friend', 'Valid');  // Valid value
      
      expect(set.size()).toBe(1);
      expect(set.getEntries()).toEqual([{ type: 'friend', value: 'Valid' }]);
    });

    it('should remove entries by predicate', () => {
      const set = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'John Doe' },
        { type: 'sibling', value: 'Alice Doe' }
      ]);

      set.remove(entry => entry.type === 'parent');
      
      expect(set.size()).toBe(1);
      expect(set.getEntries()).toEqual([{ type: 'sibling', value: 'Alice Doe' }]);
    });

    it('should remove specific entries by type and value', () => {
      const set = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'John Doe' },
        { type: 'sibling', value: 'Alice Doe' }
      ]);

      set.removeByTypeAndValue('parent', 'Jane Doe');
      
      expect(set.size()).toBe(2);
      expect(set.getEntries()).toContainEqual({ type: 'parent', value: 'John Doe' });
      expect(set.getEntries()).toContainEqual({ type: 'sibling', value: 'Alice Doe' });
    });

    it('should clear all entries', () => {
      const set = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ]);

      set.clear();
      
      expect(set.isEmpty()).toBe(true);
      expect(set.size()).toBe(0);
    });
  });

  describe('orphaned index handling', () => {
    it('should properly reindex when items are removed from the middle', () => {
      const set = new RelationshipSet([
        { type: 'parent', value: 'Parent A' },
        { type: 'parent', value: 'Parent B' }, 
        { type: 'parent', value: 'Parent C' }
      ]);

      // Remove middle parent
      set.removeByTypeAndValue('parent', 'Parent B');

      const fields = set.toFrontMatterFields();
      
      // Should reindex without gaps
      expect(fields).toEqual({
        'RELATED[parent]': 'Parent A',
        'RELATED[1:parent]': 'Parent C'
      });
    });

    it('should handle shrinking arrays correctly', () => {
      // Start with a large array
      const set = new RelationshipSet([
        { type: 'friend', value: 'Friend 1' },
        { type: 'friend', value: 'Friend 2' },
        { type: 'friend', value: 'Friend 3' },
        { type: 'friend', value: 'Friend 4' },
        { type: 'friend', value: 'Friend 5' }
      ]);

      // Remove most friends
      set.remove(entry => entry.value.includes('2') || entry.value.includes('3') || entry.value.includes('4'));

      const fields = set.toFrontMatterFields();
      
      // Should only have 2 friends with proper indexing
      expect(fields).toEqual({
        'RELATED[friend]': 'Friend 1',
        'RELATED[1:friend]': 'Friend 5'
      });
    });
  });

  describe('utility methods', () => {
    it('should group entries by type', () => {
      const set = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'John Doe' },
        { type: 'sibling', value: 'Alice Doe' },
        { type: 'friend', value: 'Best Friend' }
      ]);

      const grouped = set.getEntriesByType();
      
      expect(grouped.get('parent')).toEqual([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'John Doe' }
      ]);
      expect(grouped.get('sibling')).toEqual([
        { type: 'sibling', value: 'Alice Doe' }
      ]);
      expect(grouped.get('friend')).toEqual([
        { type: 'friend', value: 'Best Friend' }
      ]);
    });

    it('should clone correctly', () => {
      const original = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ]);

      const clone = original.clone();
      
      // Should be equal but not the same object
      expect(clone.equals(original)).toBe(true);
      expect(clone).not.toBe(original);
      
      // Modifying clone shouldn't affect original
      clone.add('friend', 'New Friend');
      expect(original.size()).toBe(2);
      expect(clone.size()).toBe(3);
    });

    it('should compare equality correctly', () => {
      const set1 = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ]);

      const set2 = new RelationshipSet([
        { type: 'sibling', value: 'John Doe' },  // Different order
        { type: 'parent', value: 'Jane Doe' }
      ]);

      const set3 = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' }    // Missing entry
      ]);

      expect(set1.equals(set2)).toBe(true);   // Same entries, different order
      expect(set1.equals(set3)).toBe(false);  // Different entries
    });
  });

  describe('integration with RelatedField', () => {
    it('should convert from RelatedFields correctly', () => {
      const relatedFields = [
        { type: 'parent' as RelationshipType, value: 'Jane Doe' },
        { type: 'sibling' as RelationshipType, value: 'John Doe' },
        { type: 'friend' as RelationshipType, value: '' }, // Should be filtered
        { type: 'spouse' as RelationshipType, value: 'null' } // Should be filtered
      ];

      const set = RelationshipSet.fromRelatedFields(relatedFields);
      
      expect(set.size()).toBe(2);
      expect(set.getEntries()).toContainEqual({ type: 'parent', value: 'Jane Doe' });
      expect(set.getEntries()).toContainEqual({ type: 'sibling', value: 'John Doe' });
    });

    it('should convert to RelatedFields correctly', () => {
      const set = new RelationshipSet([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ]);

      const relatedFields = set.toRelatedFields();
      
      expect(relatedFields).toEqual([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'sibling', value: 'John Doe' }
      ]);
    });
  });
});