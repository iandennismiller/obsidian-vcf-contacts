import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';
import { RelationshipContentParser } from '../src/relationships/relationshipContentParser';
import { RelationshipSet } from '../src/relationships/relationshipSet';
import { formatRelationshipListItem, parseRelationshipFromListItem } from '../src/relationships/relationshipUtils';

// Mock Obsidian App for testing
const mockApp = {
  metadataCache: {
    getFileCache: vi.fn()
  }
} as any;

describe('Relationship Management Integration', () => {
  let graph: RelationshipGraph;
  let contentParser: RelationshipContentParser;

  beforeEach(() => {
    graph = new RelationshipGraph();
    contentParser = new RelationshipContentParser(mockApp);
  });

  it('should handle complete relationship workflow', () => {
    // Step 1: Add contacts to the graph
    graph.addContact('john-uid', 'John Doe', 'M');
    graph.addContact('jane-uid', 'Jane Doe', 'F');
    graph.addContact('alice-uid', 'Alice Smith');

    // Step 2: Add relationships
    graph.addRelationship('john-uid', 'jane-uid', 'spouse');
    graph.addRelationship('john-uid', 'alice-uid', 'friend');
    graph.addRelationship('jane-uid', 'john-uid', 'spouse');

    // Step 3: Verify graph relationships
    const johnRelationships = graph.getContactRelationships('john-uid');
    expect(johnRelationships).toHaveLength(2);
    expect(johnRelationships.find(r => r.type === 'spouse' && r.targetUid === 'jane-uid')).toBeDefined();
    expect(johnRelationships.find(r => r.type === 'friend' && r.targetUid === 'alice-uid')).toBeDefined();

    // Step 4: Convert to vCard RELATED fields
    const relatedFields = graph.contactToRelatedFields('john-uid');
    expect(relatedFields).toHaveLength(2);
    expect(relatedFields.find(f => f.type === 'spouse')).toBeDefined();
    expect(relatedFields.find(f => f.type === 'friend')).toBeDefined();

    // Step 5: Convert to front matter format
    const relationshipSet = new RelationshipSet(relatedFields);
    const frontMatter = relationshipSet.toFrontMatter();
    
    expect(frontMatter).toHaveProperty('RELATED[friend]');
    expect(frontMatter).toHaveProperty('RELATED[spouse]');
  });

  it('should parse markdown Related lists correctly', () => {
    const markdownContent = `
# John Doe

Some content here.

## Related

- father [[Robert Doe]]
- mother [[Mary Doe]]
- friend [[Best Friend]]
- sister [[Sarah Doe]]

## Other Section

More content here.
`;

    // Extract the Related section
    const relatedSection = contentParser.extractRelatedSection(markdownContent);
    expect(relatedSection).toBeTruthy();

    // Parse relationships from the section
    const relationships = contentParser.parseRelatedSection(relatedSection!);
    expect(relationships).toHaveLength(4);

    // Verify parsed relationships
    expect(relationships.find(r => r.type === 'parent' && r.contactName === 'Robert Doe' && r.impliedGender === 'M')).toBeDefined();
    expect(relationships.find(r => r.type === 'parent' && r.contactName === 'Mary Doe' && r.impliedGender === 'F')).toBeDefined();
    expect(relationships.find(r => r.type === 'friend' && r.contactName === 'Best Friend')).toBeDefined();
    expect(relationships.find(r => r.type === 'sibling' && r.contactName === 'Sarah Doe' && r.impliedGender === 'F')).toBeDefined();
  });

  it('should handle gender-aware relationship rendering', () => {
    // Test gendered relationship formatting
    expect(formatRelationshipListItem('parent', 'John Doe', 'M')).toBe('- father [[John Doe]]');
    expect(formatRelationshipListItem('parent', 'Jane Doe', 'F')).toBe('- mother [[Jane Doe]]');
    expect(formatRelationshipListItem('sibling', 'Bob Smith', 'M')).toBe('- brother [[Bob Smith]]');
    expect(formatRelationshipListItem('sibling', 'Alice Smith', 'F')).toBe('- sister [[Alice Smith]]');
    
    // Test genderless fallbacks
    expect(formatRelationshipListItem('parent', 'Alex Doe')).toBe('- parent [[Alex Doe]]');
    expect(formatRelationshipListItem('friend', 'Best Friend')).toBe('- friend [[Best Friend]]');
  });

  it('should handle bidirectional relationship parsing', () => {
    // Parse gendered terms and extract implied gender
    const fatherRelation = parseRelationshipFromListItem('- father [[John Doe]]');
    expect(fatherRelation).toEqual({
      type: 'parent',
      contactName: 'John Doe',
      impliedGender: 'M'
    });

    const motherRelation = parseRelationshipFromListItem('- mother [[Jane Smith]]');
    expect(motherRelation).toEqual({
      type: 'parent',
      contactName: 'Jane Smith',
      impliedGender: 'F'
    });

    const friendRelation = parseRelationshipFromListItem('- friend [[Best Friend]]');
    expect(friendRelation).toEqual({
      type: 'friend',
      contactName: 'Best Friend'
      // No impliedGender for genderless terms
    });
  });

  it('should maintain consistent relationship ordering', () => {
    const relationships = [
      { type: 'parent' as const, value: 'John Doe' },
      { type: 'friend' as const, value: 'Alice Smith' },
      { type: 'parent' as const, value: 'Jane Doe' },
      { type: 'sibling' as const, value: 'Bob Smith' }
    ];

    const set = new RelationshipSet(relationships);
    const entries = set.getEntries();

    // Should be sorted by type first, then by value
    expect(entries).toEqual([
      { type: 'friend', value: 'Alice Smith' },
      { type: 'parent', value: 'Jane Doe' },
      { type: 'parent', value: 'John Doe' },
      { type: 'sibling', value: 'Bob Smith' }
    ]);

    // Front matter should maintain this ordering
    const frontMatter = set.toFrontMatter();
    expect(Object.keys(frontMatter)).toEqual([
      'RELATED[friend]',
      'RELATED[parent]',
      'RELATED[1:parent]',
      'RELATED[sibling]'
    ]);
  });

  it('should handle the complete sync scenario', () => {
    // Simulate existing front matter
    const existingFrontMatter = {
      'UID': 'john-uid',
      'FN': 'John Doe',
      'RELATED[parent]': 'urn:uuid:jane-uid'
    };

    // Simulate a Related list in markdown
    const markdownContent = `
# John Doe

## Related

- mother [[Jane Doe]]
- father [[Robert Doe]]
- friend [[Best Friend]]
`;

    // Step 1: Parse existing relationships from front matter
    const existingRelated = contentParser.parseRelatedFromFrontmatter(existingFrontMatter);
    const existingSet = new RelationshipSet(existingRelated);
    expect(existingSet.size()).toBe(1);

    // Step 2: Parse new relationships from Related section
    const relatedSection = contentParser.extractRelatedSection(markdownContent);
    const relatedRelationships = contentParser.parseRelatedSection(relatedSection!);
    expect(relatedRelationships).toHaveLength(3);

    // Step 3: Merge with existing (simulating the sync manager behavior)
    const newEntries = relatedRelationships.map(rel => ({
      type: rel.type,
      value: rel.contactName // Simplified - would normally resolve to UID
    }));
    const newSet = new RelationshipSet(newEntries);

    const mergedSet = existingSet.clone();
    mergedSet.merge(newSet);

    // Step 4: Verify merge results
    expect(mergedSet.size()).toBe(4); // 1 existing + 3 new (with Jane Doe updated)
    expect(mergedSet.has('parent', 'urn:uuid:jane-uid')).toBe(true);
    expect(mergedSet.has('parent', 'Jane Doe')).toBe(true); // New entry for Jane
    expect(mergedSet.has('parent', 'Robert Doe')).toBe(true);
    expect(mergedSet.has('friend', 'Best Friend')).toBe(true);

    // Step 5: Generate updated front matter
    const updatedFrontMatter = mergedSet.toFrontMatter();
    expect(updatedFrontMatter).toHaveProperty('RELATED[friend]', 'Best Friend');
    expect(updatedFrontMatter).toHaveProperty('RELATED[parent]');
    expect(updatedFrontMatter).toHaveProperty('RELATED[1:parent]');
    expect(updatedFrontMatter).toHaveProperty('RELATED[2:parent]');
  });

  it('should handle graph consistency operations', () => {
    // Add contacts and relationships
    graph.addContact('john-uid', 'John Doe');
    graph.addContact('jane-uid', 'Jane Doe');
    graph.addRelationship('john-uid', 'jane-uid', 'spouse');

    // Check initial state
    expect(graph.getStatistics()).toEqual({
      contactCount: 2,
      relationshipCount: 1
    });

    // Test the consistency check on a clean graph
    const initialConsistencyResult = graph.checkConsistency();
    expect(initialConsistencyResult.issues.length).toBe(0);
    expect(initialConsistencyResult.repaired).toBe(false);
    
    // Verify the graph maintains correct counts after operations
    const finalStats = graph.getStatistics();
    expect(finalStats.contactCount).toBe(2);
    expect(finalStats.relationshipCount).toBe(1);
    
    // Test adding and removing relationships
    graph.addRelationship('jane-uid', 'john-uid', 'spouse'); // Reciprocal relationship
    expect(graph.getStatistics().relationshipCount).toBe(2);
    
    graph.removeRelationship('jane-uid', 'john-uid', 'spouse');
    expect(graph.getStatistics().relationshipCount).toBe(1);
  });
});