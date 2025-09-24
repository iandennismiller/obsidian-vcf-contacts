import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/relationships/relationshipManager';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';
import { parseRelationshipListItem, formatRelationshipListItem } from '../src/relationships/genderUtils';

describe('End-to-End Relationship Flow', () => {
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

  it('should maintain genderless relationship types throughout the entire flow', () => {
    // STEP 1: Parse "mother" from Related list - should normalize to parent
    const parsed = parseRelationshipListItem('- mother [[Jane Doe]]');
    expect(parsed).toEqual({
      type: 'parent',
      contactName: 'Jane Doe', 
      impliedGender: 'F'
    });

    // STEP 2: Add to graph - should use genderless type
    graph.addContact('john-uid', 'John Doe', 'M');
    graph.addContact('jane-uid', 'Jane Doe', 'F');
    graph.addRelationship('john-uid', 'jane-uid', 'parent');

    const johnRelationships = graph.getContactRelationships('john-uid');
    expect(johnRelationships).toHaveLength(1);
    expect(johnRelationships[0].type).toBe('parent');

    // STEP 3: Convert to vCard RELATED fields - should use genderless type
    const relatedFields = graph.contactToRelatedFields('john-uid');
    expect(relatedFields).toHaveLength(1);
    expect(relatedFields[0].type).toBe('parent');

    // STEP 4: Parse gendered terms from front matter - should normalize to genderless
    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const frontmatterResult = parseMethod({ 'RELATED[mother]': 'Jane Doe' });
    expect(frontmatterResult).toEqual([{ type: 'parent', value: 'Jane Doe' }]);

    // STEP 5: Format for display in Related list - should use gendered term based on target gender
    const formatted = formatRelationshipListItem('parent', 'Jane Doe', 'F');
    expect(formatted).toBe('- mother [[Jane Doe]]');
  });

  it('should handle multiple gendered relationship types correctly', () => {
    // Test with various gendered terms
    const testCases = [
      { input: 'father', expectedType: 'parent', gender: 'M' },
      { input: 'mother', expectedType: 'parent', gender: 'F' },
      { input: 'son', expectedType: 'child', gender: 'M' },
      { input: 'daughter', expectedType: 'child', gender: 'F' },
      { input: 'brother', expectedType: 'sibling', gender: 'M' },
      { input: 'sister', expectedType: 'sibling', gender: 'F' },
      { input: 'husband', expectedType: 'spouse', gender: 'M' },
      { input: 'wife', expectedType: 'spouse', gender: 'F' },
    ];

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);

    testCases.forEach(testCase => {
      // Front matter parsing should normalize to genderless type
      const frontmatter = { [`RELATED[${testCase.input}]`]: 'Target Person' };
      const result = parseMethod(frontmatter);
      
      expect(result).toEqual([{
        type: testCase.expectedType,
        value: 'Target Person'
      }]);

      // Related list parsing should also normalize correctly
      const listResult = parseRelationshipListItem(`- ${testCase.input} [[Target Person]]`);
      expect(listResult?.type).toBe(testCase.expectedType);
      expect(listResult?.impliedGender).toBe(testCase.gender);

      // Formatting should convert back to gendered term
      const formatted = formatRelationshipListItem(testCase.expectedType as any, 'Target Person', testCase.gender as any);
      expect(formatted).toBe(`- ${testCase.input} [[Target Person]]`);
    });
  });

  it('should handle relationship types that do not have gendered variants', () => {
    const neutralTypes = ['friend', 'colleague', 'relative', 'cousin', 'partner'];

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);

    neutralTypes.forEach(type => {
      // Front matter parsing should keep neutral types as-is
      const frontmatter = { [`RELATED[${type}]`]: 'Person Name' };
      const result = parseMethod(frontmatter);
      
      expect(result).toEqual([{
        type: type,
        value: 'Person Name'
      }]);

      // Formatting should keep neutral terms regardless of gender
      const formatted = formatRelationshipListItem(type as any, 'Person Name', 'M');
      expect(formatted).toBe(`- ${type} [[Person Name]]`);
    });
  });
});