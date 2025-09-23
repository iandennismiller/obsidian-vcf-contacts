import { describe, it, expect, beforeEach } from 'vitest';
import { 
  parseRelatedField, 
  formatRelatedField, 
  frontMatterToRelationships, 
  relationshipsToFrontMatter,
  extractInferredGender 
} from 'src/relationships/relatedFieldUtils';
import { 
  parseRelatedListItem, 
  formatRelatedListItem,
  extractRelatedSection,
  buildMarkdownWithRelatedSection,
  cleanupDuplicateRelatedHeadings 
} from 'src/relationships/markdownRelated';
import { RelationshipGraph } from 'src/relationships/relationshipGraph';

// Mock the obsidian app context
const mockApp = {
  vault: {},
  metadataCache: {}
} as any;

describe('RELATED Field Utils', () => {
  
  it('should parse valid RELATED field', () => {
    const result = parseRelatedField('urn:uuid:12345-67890', 'RELATED;TYPE=friend');
    expect(result).toEqual({
      relationshipType: 'friend',
      contactReference: '12345-67890',
      namespace: 'uuid',
      originalValue: 'urn:uuid:12345-67890'
    });
  });

  it('should parse RELATED field with name namespace', () => {
    const result = parseRelatedField('name:John Doe', 'RELATED;TYPE=parent');
    expect(result).toEqual({
      relationshipType: 'parent',
      contactReference: 'John Doe',
      namespace: 'name',
      originalValue: 'name:John Doe'
    });
  });

  it('should format RELATED field with UUID', () => {
    const result = formatRelatedField('friend', '12345678-1234-4234-a234-123456789abc');
    expect(result).toEqual({
      key: 'RELATED;TYPE=friend',
      value: 'urn:uuid:12345678-1234-4234-a234-123456789abc'
    });
  });

  it('should format RELATED field with name', () => {
    const result = formatRelatedField('parent', 'custom-uid', 'John Doe');
    expect(result).toEqual({
      key: 'RELATED;TYPE=parent',
      value: 'uid:custom-uid'
    });
  });

  it('should convert front matter to relationships', () => {
    const frontMatter = {
      'RELATED[friend]': 'urn:uuid:12345-67890',
      'RELATED[1:friend]': 'name:Jane Doe',
      'RELATED[parent]': 'name:Bob Smith'
    };
    
    const relationships = frontMatterToRelationships(frontMatter, 'my-uid');
    
    expect(relationships).toHaveLength(3);
    expect(relationships[0]).toEqual({
      subject: 'my-uid',
      relationshipKind: 'friend',
      object: '12345-67890'
    });
  });

  it('should convert relationships to front matter', () => {
    const relationships = [
      { subject: 'my-uid', relationshipKind: 'friend', object: 'friend1' },
      { subject: 'my-uid', relationshipKind: 'friend', object: 'friend2' },
      { subject: 'my-uid', relationshipKind: 'parent', object: 'parent1' }
    ];
    
    const frontMatter = relationshipsToFrontMatter(relationships, 'my-uid');
    
    expect(frontMatter['RELATED[friend]']).toEqual('uid:friend1');
    expect(frontMatter['RELATED[1:friend]']).toEqual('uid:friend2');
    expect(frontMatter['RELATED[parent]']).toEqual('uid:parent1');
  });

  it('should extract inferred gender', () => {
    expect(extractInferredGender('father')).toBe('M');
    expect(extractInferredGender('mother')).toBe('F');
    expect(extractInferredGender('friend')).toBe(null);
  });

});

describe('Markdown Related Utils', () => {

  it('should parse valid related list item', () => {
    const result = parseRelatedListItem('- friend [[John Doe]]');
    expect(result).toEqual({
      relationshipKind: 'friend',
      contactName: 'John Doe',
      isValid: true,
      rawLine: '- friend [[John Doe]]'
    });
  });

  it('should reject invalid list item', () => {
    const result = parseRelatedListItem('- not a valid format');
    expect(result.isValid).toBe(false);
  });

  it('should format related list item', () => {
    const result = formatRelatedListItem('parent', 'John Doe', 'M');
    expect(result).toBe('- father [[John Doe]]');
  });

  it('should format related list item with female gender', () => {
    const result = formatRelatedListItem('parent', 'Jane Doe', 'F');
    expect(result).toBe('- mother [[Jane Doe]]');
  });

  it('should extract related section from markdown', () => {
    const content = `# Contact
Some content

## Related
- friend [[John]]
- parent [[Mom]]

## Other Section
Other content`;

    const result = extractRelatedSection(content);
    expect(result.hasRelatedHeading).toBe(true);
    expect(result.relatedLines).toEqual(['- friend [[John]]', '- parent [[Mom]]']);
  });

  it('should build markdown with related section', () => {
    const items = ['- friend [[John]]', '- parent [[Mom]]'];
    const result = buildMarkdownWithRelatedSection('# Contact\nSome content', items, '\n## Other\nOther content');
    
    expect(result).toContain('## Related');
    expect(result).toContain('- friend [[John]]');
    expect(result).toContain('- parent [[Mom]]');
  });

  it('should cleanup duplicate related headings', () => {
    const content = `# Contact

## Related

## Related
- friend [[John]]

## Other`;

    const result = cleanupDuplicateRelatedHeadings(content);
    const headingCount = (result.match(/^## Related$/gm) || []).length;
    expect(headingCount).toBe(1);
    expect(result).toContain('- friend [[John]]');
  });

});

describe('Relationship Graph', () => {

  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph(mockApp);
  });

  it('should add and retrieve contacts', () => {
    graph.addOrUpdateContactNode('uid1', 'John Doe', 'M', true);
    
    const contact = graph.getContact('uid1');
    expect(contact).toEqual({
      uid: 'uid1',
      name: 'John Doe',
      gender: 'M',
      exists: true
    });
  });

  it('should add relationships', () => {
    graph.addOrUpdateContactNode('uid1', 'John', 'M', true);
    graph.addOrUpdateContactNode('uid2', 'Jane', 'F', true);
    
    graph.addRelationship('uid1', 'uid2', 'friend');
    
    const relationships = graph.getContactRelationships('uid1');
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toEqual({
      subject: 'uid1',
      relationshipKind: 'friend',
      object: 'uid2'
    });
  });

  it('should normalize gendered relationship terms', () => {
    graph.addOrUpdateContactNode('uid1', 'John', 'M', true);
    graph.addOrUpdateContactNode('uid2', 'Jane', 'F', true);
    
    graph.addRelationship('uid1', 'uid2', 'father');
    
    const relationships = graph.getContactRelationships('uid1');
    expect(relationships[0].relationshipKind).toBe('parent');
  });

  it('should infer and update gender', () => {
    graph.addOrUpdateContactNode('uid1', 'Unknown', undefined, true);
    
    const updated = graph.inferAndUpdateGender('uid1', 'father');
    expect(updated).toBe(true);
    
    const contact = graph.getContact('uid1');
    expect(contact?.gender).toBe('M');
  });

  it('should get graph statistics', () => {
    graph.addOrUpdateContactNode('uid1', 'John', 'M', true);
    graph.addOrUpdateContactNode('uid2', 'Jane', 'F', true);
    graph.addRelationship('uid1', 'uid2', 'friend');
    
    const stats = graph.getStats();
    expect(stats.nodes).toBe(2);
    expect(stats.edges).toBe(1);
  });

});