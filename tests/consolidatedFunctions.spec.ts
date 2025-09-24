import { describe, it, expect } from 'vitest';
import { 
  parseRelatedFieldsForRendering, 
  convertRelationshipsToFrontMatter, 
  renderRelatedSection 
} from '../src/contacts/contactMdTemplate';

describe('Consolidated Relationship Functions in contactMdTemplate', () => {
  describe('parseRelatedFieldsForRendering', () => {
    it('should parse and sort RELATED fields from front matter', () => {
      const frontMatter = {
        'RELATED[friend]': 'name:Alice Smith',
        'RELATED[1:friend]': 'name:Bob Johnson',
        'RELATED[colleague]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440000'
      };

      const relationships = parseRelatedFieldsForRendering(frontMatter);
      
      expect(relationships).toHaveLength(3);
      // Should be sorted by kind first
      expect(relationships[0].kind).toBe('colleague');
      expect(relationships[1].kind).toBe('friend');
      expect(relationships[2].kind).toBe('friend');
      
      // Should correctly parse different reference formats
      expect(relationships[0].contactName).toBe('[urn:uuid:550e8400-e29b-41d4-a716-446655440000]');
      expect(relationships[1].contactName).toBe('Alice Smith');
      expect(relationships[2].contactName).toBe('Bob Johnson');
    });
  });

  describe('convertRelationshipsToFrontMatter', () => {
    it('should convert relationships to sorted front matter fields', () => {
      const relationships = [
        {
          relationshipKind: 'friend',
          reference: { namespace: 'name', name: 'Alice Smith' }
        },
        {
          relationshipKind: 'colleague',
          reference: { namespace: 'uid', uid: 'test-uid-123' }
        },
        {
          relationshipKind: 'friend', 
          reference: { namespace: 'urn:uuid', uid: '550e8400-e29b-41d4-a716-446655440000' }
        }
      ];

      const frontMatter = convertRelationshipsToFrontMatter(relationships as any);
      
      // Should have proper keys with indexing
      expect(frontMatter).toHaveProperty('RELATED[colleague]');
      expect(frontMatter).toHaveProperty('RELATED[friend]');
      expect(frontMatter).toHaveProperty('RELATED[1:friend]');
      
      // Should have proper reference formatting
      expect(frontMatter['RELATED[colleague]']).toBe('uid:test-uid-123');
      expect(frontMatter['RELATED[friend]']).toBe('name:Alice Smith');
      expect(frontMatter['RELATED[1:friend]']).toBe('urn:uuid:550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('renderRelatedSection', () => {
    it('should render relationships as markdown list', () => {
      const content = `---
title: John Doe
---

## Notes

Some notes here.
`;

      const relationships = [
        { kind: 'friend', contactName: 'Alice Smith' },
        { kind: 'colleague', contactName: 'Bob Johnson' }
      ];

      const result = renderRelatedSection(content, relationships);
      
      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[Alice Smith]]');
      expect(result).toContain('- colleague [[Bob Johnson]]');
    });

    it('should update existing Related section', () => {
      const content = `---
title: John Doe  
---

## Related

- old relationship [[Old Contact]]

## Notes

Some notes.
`;

      const relationships = [
        { kind: 'friend', contactName: 'Alice Smith' }
      ];

      const result = renderRelatedSection(content, relationships);
      
      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[Alice Smith]]');
      expect(result).not.toContain('old relationship');
    });

    it('should remove Related section when no relationships', () => {
      const content = `---
title: John Doe
---

## Related

- friend [[Alice Smith]]

## Notes

Some notes.
`;

      const result = renderRelatedSection(content, []);
      
      expect(result).not.toContain('## Related');
      expect(result).not.toContain('- friend [[Alice Smith]]');
      expect(result).toContain('## Notes');
    });
  });
});