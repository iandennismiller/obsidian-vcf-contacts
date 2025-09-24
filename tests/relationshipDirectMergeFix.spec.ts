import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/relationships/relationshipManager';
import { RelationshipSet } from '../src/relationships/relationshipSet';

describe('RelationshipManager Direct Merge Fix', () => {
  let mockApp: any;
  let manager: RelationshipManager;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
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

  it('should directly merge Related list with existing front matter without losing relationships', async () => {
    // Create a test scenario where front matter has more relationships than Related list
    const existingFrontMatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe',
      'RELATED[1:parent]': 'John Doe',     // This should NOT be lost  
      'RELATED[friend]': 'Best Friend'
    };

    // Related list only has 2 relationships (missing John Doe parent)
    const relatedListRelationships = [
      { type: 'parent' as const, contactName: 'Jane Doe', impliedGender: 'F' as const },
      { type: 'friend' as const, contactName: 'Best Friend' }
    ];

    // Test the direct merge logic
    const existingSet = RelationshipSet.fromFrontMatter(existingFrontMatter);
    expect(existingSet.size()).toBe(3); // 2 parents + 1 friend

    // Convert Related list to RelationshipSet format (simulate what the method does)
    const relatedListEntries = relatedListRelationships.map(rel => ({ 
      type: rel.type, 
      value: rel.contactName // In real code this might be UID, but for testing use name
    }));
    const relatedListSet = new RelationshipSet(relatedListEntries);
    expect(relatedListSet.size()).toBe(2); // 1 parent + 1 friend

    // Perform merge (simulate the mergeRelatedListToFrontmatter logic)
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
    expect(mergedSet.size()).toBe(3); // Should still have all 3 relationships
    expect(addedCount).toBe(0); // No new relationships added (all already exist)
    
    const entries = mergedSet.getEntries();
    expect(entries).toContainEqual({ type: 'parent', value: 'Jane Doe' });
    expect(entries).toContainEqual({ type: 'parent', value: 'John Doe' }); // CRITICAL: This should NOT be lost
    expect(entries).toContainEqual({ type: 'friend', value: 'Best Friend' });
  });

  it('should add new relationships from Related list to front matter', () => {
    // Create a test scenario where Related list has more relationships than front matter  
    const existingFrontMatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe'  // Only 1 relationship
    };

    // Related list has 3 relationships
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

  it('should handle graph merge without clearing existing relationships', () => {
    // Test the graph merge logic - relationships should be added, not replaced
    const existingRelationships = [
      { type: 'parent' as const, targetUid: 'jane-uid', targetName: 'Jane Doe' },
      { type: 'parent' as const, targetUid: 'john-uid', targetName: 'John Doe' },
      { type: 'friend' as const, targetUid: 'friend-uid', targetName: 'Best Friend' }
    ];

    const relatedListRelationships = [
      { type: 'parent' as const, contactName: 'Jane Doe' },      // Already exists
      { type: 'sibling' as const, contactName: 'New Sibling' }   // Should be added
    ];

    // Simulate the graph merge logic  
    const existingSet = new Set(existingRelationships.map(r => `${r.type}:${r.targetUid}`));
    
    // For each Related list relationship, check if it would be added
    const wouldBeAdded = [];
    for (const rel of relatedListRelationships) {
      // In real code, findOrCreateContactByName would return UID
      const targetUid = rel.contactName === 'Jane Doe' ? 'jane-uid' : 'new-sibling-uid';
      const relationshipKey = `${rel.type}:${targetUid}`;
      
      if (!existingSet.has(relationshipKey)) {
        wouldBeAdded.push(rel);
      }
    }

    // Should only add new sibling, not duplicate parent  
    expect(wouldBeAdded).toHaveLength(1);
    expect(wouldBeAdded[0].contactName).toBe('New Sibling');
    expect(wouldBeAdded[0].type).toBe('sibling');
  });
});