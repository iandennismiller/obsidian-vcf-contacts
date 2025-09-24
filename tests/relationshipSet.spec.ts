import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipSet } from '../src/relationships/relationshipSet';
import { RelationshipType } from '../src/relationships/relationshipTypes';

describe('RelationshipSet', () => {
  let relationshipSet: RelationshipSet;

  beforeEach(() => {
    relationshipSet = new RelationshipSet();
  });

  it('should create an empty relationship set', () => {
    expect(relationshipSet.size()).toBe(0);
  });

  it('should add relationships and maintain uniqueness', () => {
    relationshipSet.add('parent', 'John Doe');
    relationshipSet.add('parent', 'Jane Doe');
    relationshipSet.add('parent', 'John Doe'); // Duplicate should not increase size

    expect(relationshipSet.size()).toBe(2);
    expect(relationshipSet.has('parent', 'John Doe')).toBe(true);
    expect(relationshipSet.has('parent', 'Jane Doe')).toBe(true);
  });

  it('should sort entries consistently', () => {
    relationshipSet.add('parent', 'John Doe');
    relationshipSet.add('friend', 'Best Friend');
    relationshipSet.add('parent', 'Jane Doe');

    const entries = relationshipSet.getEntries();
    expect(entries).toEqual([
      { type: 'friend', value: 'Best Friend' },
      { type: 'parent', value: 'Jane Doe' },
      { type: 'parent', value: 'John Doe' }
    ]);
  });

  it('should convert to front matter format correctly', () => {
    relationshipSet.add('parent', 'Jane Doe');
    relationshipSet.add('parent', 'John Doe');
    relationshipSet.add('friend', 'Best Friend');

    const frontMatter = relationshipSet.toFrontMatter();
    expect(frontMatter).toEqual({
      'RELATED[friend]': 'Best Friend',
      'RELATED[parent]': 'Jane Doe',
      'RELATED[1:parent]': 'John Doe'
    });
  });

  it('should create from front matter correctly', () => {
    const frontMatter = {
      'RELATED[parent]': 'Jane Doe',
      'RELATED[1:parent]': 'John Doe',
      'RELATED[friend]': 'Best Friend',
      'OTHER_FIELD': 'Should be ignored'
    };

    const set = RelationshipSet.fromFrontMatter(frontMatter);
    expect(set.size()).toBe(3);
    expect(set.has('parent', 'Jane Doe')).toBe(true);
    expect(set.has('parent', 'John Doe')).toBe(true);
    expect(set.has('friend', 'Best Friend')).toBe(true);
  });

  it('should check equality correctly', () => {
    const set1 = new RelationshipSet();
    set1.add('parent', 'John Doe');
    set1.add('friend', 'Best Friend');

    const set2 = new RelationshipSet();
    set2.add('friend', 'Best Friend');
    set2.add('parent', 'John Doe');

    expect(set1.equals(set2)).toBe(true);

    set2.add('sibling', 'Sister');
    expect(set1.equals(set2)).toBe(false);
  });

  it('should merge sets correctly', () => {
    const set1 = new RelationshipSet();
    set1.add('parent', 'John Doe');
    set1.add('friend', 'Alice');

    const set2 = new RelationshipSet();
    set2.add('parent', 'Jane Doe');
    set2.add('friend', 'Alice'); // Duplicate should not change result

    set1.merge(set2);

    expect(set1.size()).toBe(3);
    expect(set1.has('parent', 'John Doe')).toBe(true);
    expect(set1.has('parent', 'Jane Doe')).toBe(true);
    expect(set1.has('friend', 'Alice')).toBe(true);
  });

  it('should calculate differences correctly', () => {
    const set1 = new RelationshipSet();
    set1.add('parent', 'John Doe');
    set1.add('friend', 'Alice');

    const set2 = new RelationshipSet();
    set2.add('parent', 'Jane Doe');
    set2.add('friend', 'Alice');

    const diff = set1.diff(set2);

    expect(diff.added).toEqual([{ type: 'parent', value: 'John Doe' }]);
    expect(diff.removed).toEqual([{ type: 'parent', value: 'Jane Doe' }]);
  });

  it('should handle the direct merge fix scenario', () => {
    // Test scenario from the problem statement
    const existingFrontMatter = {
      'RELATED[parent]': 'Jane Doe'
    };

    const relatedListRelationships = [
      { type: 'parent' as const, contactName: 'Jane Doe' },      // Already exists
      { type: 'parent' as const, contactName: 'John Doe' },      // Should be added  
      { type: 'friend' as const, contactName: 'Best Friend' }    // Should be added
    ];

    // Test the merge logic
    const existingSet = RelationshipSet.fromFrontMatter(existingFrontMatter);
    expect(existingSet.size()).toBe(1); // 1 parent

    const relatedListEntries = relatedListRelationships.map(rel => ({ type: rel.type, value: rel.contactName }));
    const relatedListSet = new RelationshipSet(relatedListEntries);
    expect(relatedListSet.size()).toBe(3); // 2 parents + 1 friend

    // Perform merge
    const mergedSet = existingSet.clone();
    let addedCount = 0;
    
    for (const entry of relatedListSet.getEntries()) {
      const existingEntries = mergedSet.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      if (!alreadyExists) {
        mergedSet.add(entry.type, entry.value);
        addedCount++;
      }
    }

    // Verify merge results
    expect(mergedSet.size()).toBe(3); // Should have all 3 relationships now
    expect(addedCount).toBe(2); // 2 new relationships added
    
    const entries = mergedSet.getEntries();
    expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
    expect(entries).toContainEqual({ type: 'parent', value: 'John Doe' });
    expect(entries).toContainEqual({ type: 'friend', value: 'Best Friend' });
  });
});