import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/relationships/relationshipManager';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';

describe('RelationshipManager Bug Fix', () => {
  let mockApp: any;
  let graph: RelationshipGraph;
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
        on: vi.fn()
      }
    };
    
    manager = new RelationshipManager(mockApp);
    // Access the private graph property for testing
    graph = (manager as any).graph;
  });

  it('should normalize gendered relationship terms in front matter to genderless types', () => {
    // This test demonstrates the bug: parseRelatedFromFrontmatter should normalize
    // gendered terms like "mother" to genderless "parent"
    
    const frontmatter = {
      UID: 'test-uid',
      'RELATED[mother]': 'Jane Doe', // This is the bug - should be normalized to parent
      'RELATED[father]': 'John Doe', // This should be normalized to parent
      'RELATED[son]': 'Bob Doe',     // This should be normalized to child
      'RELATED[sister]': 'Alice Doe' // This should be normalized to sibling
    };

    // Access the private method for testing (this is a bit hacky but necessary)
    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const result = parseMethod(frontmatter);

    // The current buggy behavior would return gendered types
    // The fixed behavior should return genderless types
    expect(result).toEqual([
      { type: 'parent', value: 'Jane Doe' },  // not 'mother'
      { type: 'parent', value: 'John Doe' },  // not 'father'
      { type: 'child', value: 'Bob Doe' },    // not 'son'
      { type: 'sibling', value: 'Alice Doe' } // not 'sister'
    ]);
  });

  it('should handle front matter with already genderless terms correctly', () => {
    const frontmatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe',
      'RELATED[child]': 'Bob Doe',
      'RELATED[sibling]': 'Alice Doe',
      'RELATED[friend]': 'Tom Smith'
    };

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const result = parseMethod(frontmatter);

    expect(result).toEqual([
      { type: 'parent', value: 'Jane Doe' },
      { type: 'child', value: 'Bob Doe' },
      { type: 'sibling', value: 'Alice Doe' },
      { type: 'friend', value: 'Tom Smith' }
    ]);
  });

  it('should handle mixed gendered and genderless terms', () => {
    const frontmatter = {
      UID: 'test-uid',
      'RELATED[mother]': 'Jane Doe',   // gendered -> parent
      'RELATED[parent]': 'John Doe',   // already genderless
      'RELATED[friend]': 'Tom Smith'   // no gendered variant
    };

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const result = parseMethod(frontmatter);

    expect(result).toEqual([
      { type: 'parent', value: 'Jane Doe' },
      { type: 'parent', value: 'John Doe' },
      { type: 'friend', value: 'Tom Smith' }
    ]);
  });
});