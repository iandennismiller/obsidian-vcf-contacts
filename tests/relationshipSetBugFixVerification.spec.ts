import { describe, it, expect } from 'vitest';
import { RelationshipSet } from '../src/relationships/relationshipSet';

describe('RelationshipSet - End-to-End Bug Fix Verification', () => {
  it('should completely resolve the duplicate and blank values issue described in the problem statement', () => {
    // Simulate the exact scenario from the problem statement:
    // "I'm getting duplicate values within a relationship type in the front matter.
    // I can see they have different indices. They should have been normalized.
    // I am also seeing blank values in the front matter. These should never be created."
    
    const problematicFrontMatter = {
      UID: 'contact-123',
      
      // PROBLEM 1: Duplicate values with different indices
      'RELATED[parent]': 'Jane Smith',
      'RELATED[1:parent]': 'Jane Smith',    // EXACT DUPLICATE - should be normalized
      'RELATED[2:parent]': 'John Smith',
      'RELATED[3:parent]': 'John Smith',    // EXACT DUPLICATE - should be normalized
      
      'RELATED[friend]': 'Best Friend',
      'RELATED[1:friend]': 'Best Friend',   // EXACT DUPLICATE - should be normalized
      'RELATED[2:friend]': 'Another Friend',
      
      // PROBLEM 2: Blank values that should never be created
      'RELATED[3:friend]': '',              // Empty string - should be filtered
      'RELATED[4:friend]': '   ',           // Whitespace only - should be filtered
      'RELATED[5:friend]': '\t\n\r  ',      // Various whitespace - should be filtered
      
      'RELATED[sibling]': 'Valid Sibling',
      'RELATED[1:sibling]': null,           // Null - should be filtered
      'RELATED[2:sibling]': undefined,      // Undefined - should be filtered
      'RELATED[3:sibling]': 'null',         // String "null" - should be filtered
      'RELATED[4:sibling]': 'undefined',    // String "undefined" - should be filtered
      
      // Some valid entries that should be preserved
      'RELATED[spouse]': 'Valid Spouse',
      'RELATED[colleague]': 'Work Colleague'
    };

    // Step 1: Parse the problematic front matter
    const relationshipSet = RelationshipSet.fromFrontMatter(problematicFrontMatter);
    
    // Step 2: Verify duplicates are removed
    const entries = relationshipSet.getEntries();
    
    // Should only have unique entries (no duplicates)
    const parentEntries = entries.filter(e => e.type === 'parent');
    expect(parentEntries).toHaveLength(2);
    expect(parentEntries).toContainEqual({ type: 'parent', value: 'Jane Smith' });
    expect(parentEntries).toContainEqual({ type: 'parent', value: 'John Smith' });
    
    const friendEntries = entries.filter(e => e.type === 'friend');
    expect(friendEntries).toHaveLength(2);
    expect(friendEntries).toContainEqual({ type: 'friend', value: 'Best Friend' });
    expect(friendEntries).toContainEqual({ type: 'friend', value: 'Another Friend' });
    
    const siblingEntries = entries.filter(e => e.type === 'sibling');
    expect(siblingEntries).toHaveLength(1);
    expect(siblingEntries).toContainEqual({ type: 'sibling', value: 'Valid Sibling' });
    
    // Should have preserved valid entries
    expect(entries).toContainEqual({ type: 'spouse', value: 'Valid Spouse' });
    expect(entries).toContainEqual({ type: 'colleague', value: 'Work Colleague' });
    
    // Total: 2 parents + 2 friends + 1 sibling + 1 spouse + 1 colleague = 7 valid entries
    expect(relationshipSet.size()).toBe(7);
    
    // Step 3: Verify blank values are completely eliminated
    entries.forEach(entry => {
      expect(entry.value).toBeTruthy();
      expect(entry.value.trim()).toBeTruthy();
      expect(entry.value).not.toBe('');
      expect(entry.value).not.toBe('null');
      expect(entry.value).not.toBe('undefined');
    });
    
    // Step 4: Convert back to front matter - should have proper indexing with no gaps
    const cleanFrontMatter = relationshipSet.toFrontMatterFields();
    
    // Should have properly indexed output with no duplicates and no blanks
    const frontMatterKeys = Object.keys(cleanFrontMatter);
    
    // Check that we have the right number of entries for each type
    expect(frontMatterKeys.filter(k => k.includes('parent'))).toHaveLength(2);
    expect(frontMatterKeys.filter(k => k.includes('friend'))).toHaveLength(2);
    expect(frontMatterKeys.filter(k => k.includes('sibling'))).toHaveLength(1);
    expect(frontMatterKeys.filter(k => k.includes('spouse'))).toHaveLength(1);
    expect(frontMatterKeys.filter(k => k.includes('colleague'))).toHaveLength(1);
    
    // All values should be non-blank
    Object.values(cleanFrontMatter).forEach(value => {
      expect(value).toBeTruthy();
      expect(value.trim()).toBeTruthy();
    });
    
    // Should have proper sequential indexing (no gaps)
    expect(cleanFrontMatter['RELATED[friend]']).toBeDefined();
    expect(cleanFrontMatter['RELATED[1:friend]']).toBeDefined();
    expect(cleanFrontMatter['RELATED[2:friend]']).toBeUndefined(); // Should not have index 2
    
    expect(cleanFrontMatter['RELATED[parent]']).toBeDefined();
    expect(cleanFrontMatter['RELATED[1:parent]']).toBeDefined();
    expect(cleanFrontMatter['RELATED[2:parent]']).toBeUndefined(); // Should not have index 2
  });

  it('should handle dynamic addition and removal without creating duplicates or blanks', () => {
    const relationshipSet = new RelationshipSet();
    
    // Add some relationships
    relationshipSet.add('parent', 'Jane Doe');
    relationshipSet.add('parent', 'John Doe');
    relationshipSet.add('friend', 'Best Friend');
    
    // Try to add duplicates (should be ignored due to normalization)
    relationshipSet.add('parent', 'Jane Doe');  // Exact duplicate
    relationshipSet.add('friend', 'Best Friend'); // Exact duplicate
    
    expect(relationshipSet.size()).toBe(3); // Should still be 3, not 5
    
    // Try to add blank values (should be silently ignored)
    relationshipSet.add('parent', '');           // Empty
    relationshipSet.add('parent', '   ');        // Whitespace  
    relationshipSet.add('friend', 'null');       // String "null"
    relationshipSet.add('friend', 'undefined');  // String "undefined"
    
    expect(relationshipSet.size()).toBe(3); // Should still be 3
    
    // Remove one parent
    relationshipSet.removeByTypeAndValue('parent', 'Jane Doe');
    
    expect(relationshipSet.size()).toBe(2);
    
    // Convert to front matter - should be properly indexed with no gaps
    const fields = relationshipSet.toFrontMatterFields();
    
    expect(fields).toEqual({
      'RELATED[friend]': 'Best Friend',
      'RELATED[parent]': 'John Doe'
    });
  });
});