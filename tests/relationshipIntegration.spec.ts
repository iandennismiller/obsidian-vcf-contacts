/**
 * Integration tests for the relationship management system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';
import { GenderManager } from '../src/relationships/genderManager';
import { 
  parseRelatedFromFrontMatter, 
  relatedFieldsToFrontMatter,
  parseRelatedSection,
  updateRelatedSection
} from '../src/relationships/relationshipUtils';

describe('Relationship Management Integration', () => {
  let graph: RelationshipGraph;
  let genderManager: GenderManager;

  beforeEach(() => {
    graph = new RelationshipGraph();
    genderManager = new GenderManager();
  });

  it('should handle complete bidirectional sync workflow', () => {
    // Step 1: Add contacts to graph
    graph.addNode('alice-123', 'Alice Smith', 'F');
    graph.addNode('bob-456', 'Bob Johnson', 'M');
    graph.addNode('charlie-789', 'Charlie Brown');

    // Step 2: Add relationships
    graph.addRelationship('alice-123', 'bob-456', 'spouse');
    graph.addRelationship('alice-123', 'charlie-789', 'friend');
    graph.addRelationship('bob-456', 'alice-123', 'spouse');

    // Step 3: Export to front matter
    const aliceFields = graph.contactToRelatedFields('alice-123');
    const aliceFrontMatter = relatedFieldsToFrontMatter(aliceFields);

    expect(aliceFrontMatter).toEqual({
      'RELATED[friend]': 'uid:charlie-789',
      'RELATED[spouse]': 'uid:bob-456'
    });

    // Step 4: Convert to markdown list
    const markdownItems = aliceFields.map(field => {
      const targetNode = graph.getNode(field.value.replace('uid:', ''));
      const displayType = genderManager.decodeToGendered(field.type, targetNode?.gender);
      return `- ${displayType} [[${targetNode?.fullName}]]`;
    });

    expect(markdownItems).toContain('- friend [[Charlie Brown]]');
    expect(markdownItems).toContain('- husband [[Bob Johnson]]'); // Shows gendered form
  });

  it('should parse gendered relationships from markdown and normalize', () => {
    const content = `# Alice Smith

## Related
- husband [[Bob Johnson]]
- friend [[Charlie Brown]]
- mother [[Dorothy Smith]]

## Notes
Some notes here`;

    // Parse the Related section
    const relatedItems = parseRelatedSection(content);
    
    expect(relatedItems).toEqual([
      { type: 'husband', targetName: 'Bob Johnson', impliedGender: 'M' },
      { type: 'friend', targetName: 'Charlie Brown', impliedGender: undefined },
      { type: 'mother', targetName: 'Dorothy Smith', impliedGender: 'F' }
    ]);

    // Convert to genderless relationships for graph storage
    const genderlessRelations = relatedItems.map(item => ({
      type: genderManager.encodeToGenderless(item.type),
      targetName: item.targetName,
      impliedGender: item.impliedGender
    }));

    expect(genderlessRelations).toEqual([
      { type: 'spouse', targetName: 'Bob Johnson', impliedGender: 'M' },
      { type: 'friend', targetName: 'Charlie Brown', impliedGender: undefined },
      { type: 'parent', targetName: 'Dorothy Smith', impliedGender: 'F' }
    ]);
  });

  it('should handle reciprocal relationships correctly', () => {
    // Add parent-child relationship
    graph.addNode('parent-123', 'John Doe', 'M');
    graph.addNode('child-456', 'Jane Doe', 'F');
    
    // Add parent -> child relationship
    graph.addRelationship('parent-123', 'child-456', 'child');
    
    // Add reciprocal relationship
    const reciprocalKind = genderManager.getReciprocalKind('child');
    expect(reciprocalKind).toBe('parent');
    
    graph.addRelationship('child-456', 'parent-123', 'parent');

    // Verify both relationships exist
    expect(graph.hasRelationship('parent-123', 'child-456', 'child')).toBe(true);
    expect(graph.hasRelationship('child-456', 'parent-123', 'parent')).toBe(true);

    // Generate front matter for both contacts
    const parentFields = graph.contactToRelatedFields('parent-123');
    const childFields = graph.contactToRelatedFields('child-456');

    expect(parentFields).toEqual([
      { type: 'child', value: 'uid:child-456' }
    ]);
    
    expect(childFields).toEqual([
      { type: 'parent', value: 'uid:parent-123' }
    ]);
  });

  it('should generate proper Related sections with gendered terms', () => {
    // Mock relationships data
    const relationships = [
      { type: 'spouse' as const, targetName: 'John Doe' },
      { type: 'parent' as const, targetName: 'Mom' },
      { type: 'child' as const, targetName: 'Junior' },
      { type: 'friend' as const, targetName: 'Best Friend' }
    ];

    const content = `# Alice Smith

## Notes
Some existing content`;

    const updatedContent = updateRelatedSection(content, relationships);

    expect(updatedContent).toContain('## Related');
    expect(updatedContent).toContain('- spouse [[John Doe]]');
    expect(updatedContent).toContain('- parent [[Mom]]');
    expect(updatedContent).toContain('- child [[Junior]]');
    expect(updatedContent).toContain('- friend [[Best Friend]]');
    expect(updatedContent).toContain('## Notes'); // Preserves existing content
  });

  it('should handle complex family relationships with proper reciprocals', () => {
    // Create a family graph
    graph.addNode('grandpa-1', 'Grandpa Joe', 'M');
    graph.addNode('grandma-1', 'Grandma Sue', 'F');
    graph.addNode('dad-1', 'Dad Mike', 'M');
    graph.addNode('mom-1', 'Mom Lisa', 'F');
    graph.addNode('child1-1', 'Alice', 'F');
    graph.addNode('child2-1', 'Bob', 'M');

    // Add relationships
    // Grandparents -> Parents
    graph.addRelationship('grandpa-1', 'dad-1', 'child');
    graph.addRelationship('dad-1', 'grandpa-1', 'parent');
    graph.addRelationship('grandma-1', 'mom-1', 'child');
    graph.addRelationship('mom-1', 'grandma-1', 'parent');

    // Parents -> Children
    graph.addRelationship('dad-1', 'child1-1', 'child');
    graph.addRelationship('dad-1', 'child2-1', 'child');
    graph.addRelationship('mom-1', 'child1-1', 'child');
    graph.addRelationship('mom-1', 'child2-1', 'child');
    
    // Children -> Parents
    graph.addRelationship('child1-1', 'dad-1', 'parent');
    graph.addRelationship('child1-1', 'mom-1', 'parent');
    graph.addRelationship('child2-1', 'dad-1', 'parent');
    graph.addRelationship('child2-1', 'mom-1', 'parent');

    // Siblings
    graph.addRelationship('child1-1', 'child2-1', 'sibling');
    graph.addRelationship('child2-1', 'child1-1', 'sibling');

    // Verify Alice's relationships
    const aliceRelationships = graph.getContactRelationships('child1-1');
    const relationshipsByType = aliceRelationships.reduce((acc, rel) => {
      if (!acc[rel.type]) acc[rel.type] = [];
      acc[rel.type].push(rel.target);
      return acc;
    }, {} as Record<string, string[]>);

    expect(relationshipsByType.parent).toContain('dad-1');
    expect(relationshipsByType.parent).toContain('mom-1');
    expect(relationshipsByType.sibling).toContain('child2-1');

    // Generate front matter
    const aliceFields = graph.contactToRelatedFields('child1-1');
    const frontMatter = relatedFieldsToFrontMatter(aliceFields);

    // Should have proper array notation for multiple parents
    expect(frontMatter['RELATED[parent]']).toBeDefined();
    expect(frontMatter['RELATED[1:parent]']).toBeDefined();
    expect(frontMatter['RELATED[sibling]']).toBe('uid:child2-1');
  });

  it('should handle front matter parsing with mixed gendered and genderless terms', () => {
    const frontMatter = {
      UID: 'test-123',
      'RELATED[mother]': 'uid:mom-123',      // gendered -> parent
      'RELATED[parent]': 'uid:parent-456',   // already genderless
      'RELATED[friend]': 'uid:friend-789',   // no gendered variant
      'RELATED[son]': 'uid:son-123',         // gendered -> child
      'RELATED[1:son]': 'uid:son-456'        // array notation with gendered term
    };

    const parsed = parseRelatedFromFrontMatter(frontMatter);

    // Should normalize all to genderless types
    const expectedTypes = parsed.map(p => p.type).sort();
    expect(expectedTypes).toEqual(['child', 'child', 'friend', 'parent', 'parent']);

    // Should preserve values
    const values = parsed.map(p => p.value).sort();
    expect(values).toEqual([
      'uid:friend-789',
      'uid:mom-123',
      'uid:parent-456',
      'uid:son-123', 
      'uid:son-456'
    ]);
  });

  it('should maintain consistency during round-trip conversion', () => {
    // Original front matter with mixed gendered/genderless terms
    const originalFrontMatter = {
      'RELATED[mother]': 'uid:mom-123',
      'RELATED[child]': 'uid:kid-456',
      'RELATED[friend]': 'uid:friend-789',
      'RELATED[1:friend]': 'uid:friend-abc'
    };

    // Parse to normalized form
    const parsed = parseRelatedFromFrontMatter(originalFrontMatter);
    
    // Convert back to front matter
    const reconstructed = relatedFieldsToFrontMatter(parsed);

    // Should be normalized (all genderless) but semantically equivalent
    expect(reconstructed).toEqual({
      'RELATED[child]': 'uid:kid-456',
      'RELATED[friend]': 'uid:friend-789',
      'RELATED[1:friend]': 'uid:friend-abc',
      'RELATED[parent]': 'uid:mom-123'  // normalized from 'mother'
    });
  });
});