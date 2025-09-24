import { describe, it, expect } from 'vitest';
import { RelationshipSet } from '../src/relationships/relationshipSet';

describe('RelationshipSet Integration - Orphaned Index Handling', () => {
  it('should demonstrate the complete lifecycle of relationship array management', () => {
    // SCENARIO: A contact starts with many relationships, then some are removed,
    // creating orphaned indices that need to be cleaned up.
    
    // Step 1: Start with a messy front matter with various issues
    const messyFrontMatter = {
      UID: 'john-doe-123',
      NAME: 'John Doe',
      
      // Multiple friends with gaps (simulating orphaned indices)
      'RELATED[friend]': 'Alice Smith',
      'RELATED[1:friend]': 'Bob Johnson', 
      'RELATED[2:friend]': '',              // Blank value - should be removed
      'RELATED[3:friend]': 'Charlie Brown',
      'RELATED[4:friend]': '   ',           // Whitespace only - should be removed
      'RELATED[5:friend]': 'Diana Prince',
      
      // Mixed relationship types with issues
      'RELATED[mother]': 'Mary Doe',        // Gendered term - should normalize to parent
      'RELATED[father]': 'James Doe',       // Gendered term - should normalize to parent
      'RELATED[1:parent]': 'Step Parent',   // Already indexed parent
      
      'RELATED[son]': 'Tom Doe',            // Gendered term - should normalize to child
      'RELATED[daughter]': 'Sarah Doe',     // Gendered term - should normalize to child
      
      'RELATED[invalidtype]': 'Invalid Person',      // Invalid type - should be removed
      'RELATED[1:badrelation]': 'Another Invalid',   // Invalid type - should be removed
      
      'RELATED[spouse]': null,              // Null value - should be removed
      'RELATED[1:spouse]': 'Valid Spouse',  // Valid spouse
      
      // Some other non-RELATED fields that should be ignored
      EMAIL: 'john@example.com',
      PHONE: '555-1234'
    };

    // Step 2: Parse using RelationshipSet
    const relationshipSet = RelationshipSet.fromFrontMatter(messyFrontMatter);

    // Step 3: Verify that problematic entries were filtered out and normalized
    const entries = relationshipSet.getEntries();
    
    // Should have filtered out blank values, invalid types, and normalized gendered terms
    expect(entries).toHaveLength(10); // Valid entries: 4 friends + 3 parents + 2 children + 1 spouse
    
    // Check that gendered terms were normalized
    const parents = entries.filter(e => e.type === 'parent');
    expect(parents).toHaveLength(3);
    expect(parents.map(p => p.value).sort()).toEqual(['James Doe', 'Mary Doe', 'Step Parent']);
    
    const children = entries.filter(e => e.type === 'child');
    expect(children).toHaveLength(2);
    expect(children.map(c => c.value).sort()).toEqual(['Sarah Doe', 'Tom Doe']);
    
    const friends = entries.filter(e => e.type === 'friend');
    expect(friends).toHaveLength(4); // Alice, Bob, Charlie, and Diana
    expect(friends.map(f => f.value).sort()).toEqual(['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince']);
    
    const spouses = entries.filter(e => e.type === 'spouse');
    expect(spouses).toHaveLength(1);
    expect(spouses[0].value).toBe('Valid Spouse');

    // Step 4: Convert back to front matter fields - should be properly indexed without gaps
    const cleanFrontMatter = relationshipSet.toFrontMatterFields();
    
    // Should have deterministic, properly indexed output
    expect(cleanFrontMatter).toEqual({
      // Children (alphabetically first)
      'RELATED[child]': 'Sarah Doe',
      'RELATED[1:child]': 'Tom Doe',
      
      // Friends (4 friends now)
      'RELATED[friend]': 'Alice Smith',
      'RELATED[1:friend]': 'Bob Johnson',
      'RELATED[2:friend]': 'Charlie Brown', 
      'RELATED[3:friend]': 'Diana Prince',
      
      // Parents  
      'RELATED[parent]': 'James Doe',
      'RELATED[1:parent]': 'Mary Doe',
      'RELATED[2:parent]': 'Step Parent',
      
      // Spouse
      'RELATED[spouse]': 'Valid Spouse'
    });

    // Step 5: Demonstrate array shrinking by removing some friends
    relationshipSet.remove(entry => entry.type === 'friend' && entry.value.includes('Charlie'));
    relationshipSet.removeByTypeAndValue('friend', 'Diana Prince');
    relationshipSet.removeByTypeAndValue('friend', 'Bob Johnson');
    
    // Step 6: Verify that indices are properly recompacted
    const shrunkFrontMatter = relationshipSet.toFrontMatterFields();
    
    expect(shrunkFrontMatter['RELATED[friend]']).toBe('Alice Smith');
    expect(shrunkFrontMatter['RELATED[1:friend]']).toBeUndefined(); // No gap, only one friend left
    expect(shrunkFrontMatter['RELATED[2:friend]']).toBeUndefined(); // No orphaned indices
  });

  it('should handle edge case of removing all entries of a type', () => {
    // Start with multiple entries of each type
    const frontMatter = {
      'RELATED[friend]': 'Friend 1',
      'RELATED[1:friend]': 'Friend 2',
      'RELATED[2:friend]': 'Friend 3',
      'RELATED[parent]': 'Parent 1',
      'RELATED[spouse]': 'Spouse 1'
    };

    const relationshipSet = RelationshipSet.fromFrontMatter(frontMatter);
    expect(relationshipSet.size()).toBe(5);

    // Remove all friends
    relationshipSet.remove(entry => entry.type === 'friend');
    
    // Should only have parent and spouse left
    expect(relationshipSet.size()).toBe(2);
    
    const finalFrontMatter = relationshipSet.toFrontMatterFields();
    expect(finalFrontMatter).toEqual({
      'RELATED[parent]': 'Parent 1',
      'RELATED[spouse]': 'Spouse 1'
    });
    
    // Should not have any orphaned friend indices
    expect(Object.keys(finalFrontMatter).some(key => key.includes('friend'))).toBe(false);
  });

  it('should maintain deterministic output across multiple operations', () => {
    const relationshipSet = new RelationshipSet();

    // Add relationships in random order
    relationshipSet.add('friend', 'Zebra Friend');
    relationshipSet.add('parent', 'Alpha Parent');
    relationshipSet.add('friend', 'Beta Friend');
    relationshipSet.add('parent', 'Gamma Parent');
    relationshipSet.add('sibling', 'Delta Sibling');

    const output1 = relationshipSet.toFrontMatterFields();

    // Remove and re-add some entries
    relationshipSet.removeByTypeAndValue('friend', 'Beta Friend');
    relationshipSet.add('friend', 'Beta Friend'); // Re-add the same friend

    const output2 = relationshipSet.toFrontMatterFields();

    // Outputs should be identical (deterministic)
    expect(output1).toEqual(output2);
  });

  it('should demonstrate proper cleanup when arrays grow and shrink dynamically', () => {
    const relationshipSet = new RelationshipSet();

    // Simulate dynamic array that grows
    const friendNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    
    for (const name of friendNames) {
      relationshipSet.add('friend', name);
    }

    let frontMatter = relationshipSet.toFrontMatterFields();
    expect(Object.keys(frontMatter).filter(k => k.includes('friend'))).toHaveLength(6);
    expect(frontMatter['RELATED[friend]']).toBe('Alice');
    expect(frontMatter['RELATED[5:friend]']).toBe('Frank');

    // Now simulate shrinking by removing every other friend
    relationshipSet.remove(entry => 
      entry.type === 'friend' && ['Bob', 'Diana', 'Frank'].includes(entry.value)
    );

    frontMatter = relationshipSet.toFrontMatterFields();
    
    // Should have exactly 3 friends with proper indexing (no gaps)
    expect(Object.keys(frontMatter).filter(k => k.includes('friend'))).toHaveLength(3);
    expect(frontMatter['RELATED[friend]']).toBe('Alice');
    expect(frontMatter['RELATED[1:friend]']).toBe('Charlie');
    expect(frontMatter['RELATED[2:friend]']).toBe('Eve');
    
    // Should not have orphaned high indices
    expect(frontMatter['RELATED[3:friend]']).toBeUndefined();
    expect(frontMatter['RELATED[4:friend]']).toBeUndefined();
    expect(frontMatter['RELATED[5:friend]']).toBeUndefined();
  });
});