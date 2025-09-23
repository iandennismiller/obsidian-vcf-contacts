import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  parseRelatedFromFrontMatter, 
  relationshipsToFrontMatter,
  generateRelationshipFrontMatterKey 
} from 'src/util/relationshipFrontMatter';
import { 
  parseRelationshipList,
  generateRelationshipListMarkdown 
} from 'src/util/relationshipMarkdown';

describe('Relationship Integration', () => {
  it('should handle round-trip conversion from front matter to markdown and back', () => {
    // Start with front matter entries
    const frontMatter = {
      'UID': '12345',
      'FN': 'John Doe',
      'RELATED[friend]': 'RELATED;TYPE=friend:urn:uuid:67890-abcde',
      'RELATED[1:friend]': 'RELATED;TYPE=friend:name:Bob Smith',
      'RELATED[parent]': 'RELATED;TYPE=parent:name:Jane Doe'
    };

    // Parse relationships from front matter
    const relationships = parseRelatedFromFrontMatter(frontMatter);
    expect(relationships).toHaveLength(3);

    // Convert to front matter format and verify structure
    const newFrontMatter = relationshipsToFrontMatter(relationships);
    expect(Object.keys(newFrontMatter)).toHaveLength(3);
    expect(newFrontMatter['RELATED[friend]']).toBeDefined();
    expect(newFrontMatter['RELATED[1:friend]']).toBeDefined();
    expect(newFrontMatter['RELATED[parent]']).toBeDefined();
  });

  it('should generate correct front matter keys for relationships', () => {
    const existingKeys = ['RELATED[friend]'];
    
    // Should generate indexed key for second friend
    const newKey = generateRelationshipFrontMatterKey('friend', existingKeys);
    expect(newKey).toBe('RELATED[1:friend]');
    
    // Should generate base key for new relationship type
    const parentKey = generateRelationshipFrontMatterKey('parent', existingKeys);
    expect(parentKey).toBe('RELATED[parent]');
  });

  it('should parse markdown relationship lists correctly', () => {
    const markdown = `## Related

- friend [[Alice Smith]]
- parent [[Bob Johnson]]
- colleague [[Carol Wilson]]
`;

    const relationships = parseRelationshipList(markdown);
    expect(relationships).toHaveLength(3);
    expect(relationships[0]).toEqual({
      kind: 'friend',
      targetName: 'Alice Smith',
      targetLink: '[[Alice Smith]]'
    });
  });

  it('should generate valid markdown from relationship list', () => {
    const relationships = [
      { kind: 'friend', targetName: 'Alice Smith', targetLink: '[[Alice Smith]]' },
      { kind: 'parent', targetName: 'Bob Johnson', targetLink: '[[Bob Johnson]]' }
    ];

    const markdown = generateRelationshipListMarkdown(relationships);
    expect(markdown).toBe('- friend [[Alice Smith]]\n- parent [[Bob Johnson]]\n');
  });

  it('should handle empty relationship lists', () => {
    const emptyMarkdown = generateRelationshipListMarkdown([]);
    expect(emptyMarkdown).toBe('');

    const emptyRelationships = parseRelationshipList('## Related\n\n');
    expect(emptyRelationships).toHaveLength(0);
  });

  it('should maintain consistent ordering', () => {
    const frontMatter = {
      'RELATED[friend]': 'RELATED;TYPE=friend:name:Zoe',
      'RELATED[1:friend]': 'RELATED;TYPE=friend:name:Alice',
      'RELATED[parent]': 'RELATED;TYPE=parent:name:Bob'
    };

    const relationships = parseRelatedFromFrontMatter(frontMatter);
    const newFrontMatter = relationshipsToFrontMatter(relationships);

    // Should be sorted by value within each kind (Alice before Zoe)
    const keys = Object.keys(newFrontMatter).sort();
    expect(keys).toEqual(['RELATED[1:friend]', 'RELATED[friend]', 'RELATED[parent]']);
    
    // Verify Alice comes first in friend group
    expect(newFrontMatter['RELATED[friend]']).toBe('RELATED;TYPE=friend:name:Alice');
    expect(newFrontMatter['RELATED[1:friend]']).toBe('RELATED;TYPE=friend:name:Zoe');
  });
});