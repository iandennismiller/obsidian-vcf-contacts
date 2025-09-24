import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/relationships/relationshipManager';
import { RelationshipSet } from '../src/relationships/relationshipSet';

describe('RelationshipManager Consistency and Merging', () => {
  let mockApp: any;
  let manager: RelationshipManager;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        getMarkdownFiles: vi.fn().mockReturnValue([])
      },
      metadataCache: {
        getFileCache: vi.fn()
      },
      workspace: {
        on: vi.fn(),
        getActiveViewOfType: vi.fn()
      }
    };
    
    manager = new RelationshipManager(mockApp);
  });

  it('should merge front matter relationships without removing existing ones', () => {
    // Test the core merging logic without calling actual file operations
    
    // Mock front matter with 3 relationships
    const existingFrontMatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe',
      'RELATED[1:parent]': 'John Doe', 
      'RELATED[friend]': 'Best Friend'
    };
    
    // Mock Related list with fewer relationships (missing John Doe parent)
    const relatedListRelationships = [
      { type: 'parent' as const, value: 'Jane Doe' },     // from "mother [[Jane Doe]]"
      { type: 'friend' as const, value: 'Best Friend' }   // from "friend [[Best Friend]]"
    ];
    
    // Test the merging logic 
    const existingSet = RelationshipSet.fromFrontMatter(existingFrontMatter);
    const relatedListSet = new RelationshipSet(relatedListRelationships);
    
    expect(existingSet.size()).toBe(3); // 2 parents + 1 friend
    expect(relatedListSet.size()).toBe(2); // 1 parent + 1 friend
    
    // Merge: start with existing, add missing from Related list
    const merged = existingSet.clone();
    for (const entry of relatedListSet.getEntries()) {
      const existingEntries = merged.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      if (!alreadyExists) {
        merged.add(entry.type, entry.value);
      }
    }
    
    // Should still have 3 relationships (no duplicates, no removals)
    expect(merged.size()).toBe(3);
    
    const entries = merged.getEntries();
    expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
    expect(entries).toContainEqual({ type: 'parent', value: 'John Doe' }); // This should NOT be removed
    expect(entries).toContainEqual({ type: 'friend', value: 'Best Friend' });
  });

  it('should add missing relationships from Related list to front matter', async () => {
    // Mock a contact file with front matter that has fewer relationships than the Related list
    const mockCache = {
      frontmatter: {
        UID: 'test-uid',
        // Front matter has only 1 relationship
        'RELATED[parent]': 'Jane Doe'
      }
    };
    
    const frontMatterSet = RelationshipSet.fromFrontMatter(mockCache.frontmatter);
    expect(frontMatterSet.size()).toBe(1);
    
    // Mock Related list that has more relationships  
    const relatedListSet = RelationshipSet.fromFrontMatter({
      'RELATED[parent]': 'Jane Doe',     // Already exists
      'RELATED[1:parent]': 'John Doe',   // Should be added
      'RELATED[friend]': 'Best Friend'   // Should be added
    });
    expect(relatedListSet.size()).toBe(3);
    
    // Test merging logic
    const merged = frontMatterSet.clone();
    for (const entry of relatedListSet.getEntries()) {
      const existingEntries = merged.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      if (!alreadyExists) {
        merged.add(entry.type, entry.value);
      }
    }
    
    // Should have all 3 relationships now
    expect(merged.size()).toBe(3);
    
    const entries = merged.getEntries();
    expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
    expect(entries).toContainEqual({ type: 'parent', value: 'John Doe' });
    expect(entries).toContainEqual({ type: 'friend', value: 'Best Friend' });
  });

  it('should handle duplicate relationships correctly during merge', () => {
    // Test that duplicate relationships are not added
    const existingSet = RelationshipSet.fromFrontMatter({
      'RELATED[parent]': 'Jane Doe',
      'RELATED[friend]': 'Best Friend'
    });
    
    const newSet = RelationshipSet.fromFrontMatter({
      'RELATED[parent]': 'Jane Doe',     // Duplicate - should not be added again
      'RELATED[sibling]': 'John Doe'     // New - should be added
    });
    
    const merged = existingSet.clone();
    for (const entry of newSet.getEntries()) {
      const existingEntries = merged.getEntries();
      const alreadyExists = existingEntries.some(existing => 
        existing.type === entry.type && existing.value === entry.value
      );
      
      if (!alreadyExists) {
        merged.add(entry.type, entry.value);
      }
    }
    
    // Should have 3 relationships (2 original + 1 new, no duplicate)
    expect(merged.size()).toBe(3);
    
    const entries = merged.getEntries();
    expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
    expect(entries).toContainEqual({ type: 'friend', value: 'Best Friend' });
    expect(entries).toContainEqual({ type: 'sibling', value: 'John Doe' });
  });
});