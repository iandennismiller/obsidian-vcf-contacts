/**
 * Tests for the relationship utility functions
 */

import { describe, it, expect } from 'vitest';
import { 
  parseRelatedFromFrontMatter,
  relatedFieldsToFrontMatter,
  parseRelatedSection,
  extractRelatedSection,
  formatRelationshipListItem,
  updateRelatedSection,
  cleanupRelatedSections,
  hasMeaningfulChanges
} from '../src/relationships/relationshipUtils';

describe('RelationshipUtils', () => {
  describe('parseRelatedFromFrontMatter', () => {
    it('should parse basic RELATED fields', () => {
      const frontMatter = {
        'RELATED[friend]': 'John Doe',
        'RELATED[parent]': 'Jane Doe'
      };

      const result = parseRelatedFromFrontMatter(frontMatter);
      
      expect(result).toEqual([
        { type: 'friend', value: 'John Doe' },
        { type: 'parent', value: 'Jane Doe' }
      ]);
    });

    it('should normalize gendered terms to genderless', () => {
      const frontMatter = {
        'RELATED[mother]': 'Jane Doe',
        'RELATED[father]': 'John Doe'
      };

      const result = parseRelatedFromFrontMatter(frontMatter);
      
      expect(result).toEqual([
        { type: 'parent', value: 'Jane Doe' },
        { type: 'parent', value: 'John Doe' }
      ]);
    });

    it('should handle array notation with indices', () => {
      const frontMatter = {
        'RELATED[friend]': 'John Doe',
        'RELATED[1:friend]': 'Jane Smith',
        'RELATED[2:friend]': 'Bob Johnson'
      };

      const result = parseRelatedFromFrontMatter(frontMatter);
      
      expect(result).toHaveLength(3);
      expect(result.every(field => field.type === 'friend')).toBe(true);
      expect(result.map(field => field.value)).toContain('John Doe');
      expect(result.map(field => field.value)).toContain('Jane Smith');
      expect(result.map(field => field.value)).toContain('Bob Johnson');
    });

    it('should return empty array for no RELATED fields', () => {
      const frontMatter = {
        UID: '123',
        FN: 'Test Person'
      };

      const result = parseRelatedFromFrontMatter(frontMatter);
      expect(result).toEqual([]);
    });
  });

  describe('relatedFieldsToFrontMatter', () => {
    it('should convert single relationship to front matter', () => {
      const fields = [
        { type: 'friend' as const, value: 'John Doe' }
      ];

      const result = relatedFieldsToFrontMatter(fields);
      
      expect(result).toEqual({
        'RELATED[friend]': 'John Doe'
      });
    });

    it('should handle multiple relationships of same type with array notation', () => {
      const fields = [
        { type: 'friend' as const, value: 'Alice' },
        { type: 'friend' as const, value: 'Bob' },
        { type: 'friend' as const, value: 'Charlie' }
      ];

      const result = relatedFieldsToFrontMatter(fields);
      
      expect(result).toEqual({
        'RELATED[friend]': 'Alice',
        'RELATED[1:friend]': 'Bob', 
        'RELATED[2:friend]': 'Charlie'
      });
    });

    it('should group different relationship types properly', () => {
      const fields = [
        { type: 'friend' as const, value: 'John' },
        { type: 'parent' as const, value: 'Mom' },
        { type: 'parent' as const, value: 'Dad' }
      ];

      const result = relatedFieldsToFrontMatter(fields);
      
      expect(result['RELATED[friend]']).toBe('John');
      expect(result['RELATED[parent]']).toBeDefined();
      expect(result['RELATED[1:parent]']).toBeDefined();
    });
  });

  describe('parseRelatedSection', () => {
    it('should parse basic Related section', () => {
      const content = `# Some Heading

## Related
- friend [[John Doe]]
- parent [[Jane Smith]]

## Other Section`;

      const result = parseRelatedSection(content);
      
      expect(result).toEqual([
        { type: 'friend', targetName: 'John Doe', impliedGender: undefined },
        { type: 'parent', targetName: 'Jane Smith', impliedGender: undefined }
      ]);
    });

    it('should infer gender from gendered relationship terms', () => {
      const content = `## Related
- mother [[Jane Doe]]
- father [[John Doe]]
- son [[Junior]]`;

      const result = parseRelatedSection(content);
      
      expect(result).toEqual([
        { type: 'mother', targetName: 'Jane Doe', impliedGender: 'F' },
        { type: 'father', targetName: 'John Doe', impliedGender: 'M' },
        { type: 'son', targetName: 'Junior', impliedGender: 'M' }
      ]);
    });

    it('should handle case insensitive Related heading', () => {
      const content = `### related
- friend [[John]]`;

      const result = parseRelatedSection(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].targetName).toBe('John');
    });

    it('should return empty array when no Related section', () => {
      const content = `# Heading
Some content`;

      const result = parseRelatedSection(content);
      expect(result).toEqual([]);
    });
  });

  describe('extractRelatedSection', () => {
    it('should extract Related section content', () => {
      const content = `# Person

## Related
- friend [[John]]
- parent [[Mom]]

## Notes
Some notes here`;

      const result = extractRelatedSection(content);
      
      expect(result?.trim()).toBe(`## Related
- friend [[John]]
- parent [[Mom]]`);
    });

    it('should return null when no Related section exists', () => {
      const content = `# Person
## Notes
Some content`;

      const result = extractRelatedSection(content);
      expect(result).toBeNull();
    });
  });

  describe('formatRelationshipListItem', () => {
    it('should format basic relationship item', () => {
      const result = formatRelationshipListItem('friend', 'John Doe');
      expect(result).toBe('- friend [[John Doe]]');
    });

    it('should format with gender-specific terms', () => {
      const result = formatRelationshipListItem('parent', 'Mom', 'F');
      expect(result).toBe('- mother [[Mom]]');
    });

    it('should use genderless form when no gender specified', () => {
      const result = formatRelationshipListItem('parent', 'Someone');
      expect(result).toBe('- parent [[Someone]]');
    });
  });

  describe('updateRelatedSection', () => {
    it('should create new Related section when none exists', () => {
      const content = `# Person
Some content`;
      const items = [
        { type: 'friend' as const, targetName: 'John' }
      ];

      const result = updateRelatedSection(content, items);
      
      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[John]]');
    });

    it('should update existing Related section', () => {
      const content = `# Person

## Related
- old [[relationship]]

## Notes`;
      const items = [
        { type: 'friend' as const, targetName: 'John' }
      ];

      const result = updateRelatedSection(content, items);
      
      expect(result).toContain('- friend [[John]]');
      expect(result).not.toContain('- old [[relationship]]');
    });

    it('should create empty Related section when no items', () => {
      const content = `# Person`;
      const items: any[] = [];

      const result = updateRelatedSection(content, items);
      
      expect(result).toContain('## Related');
      expect(result).not.toContain('- ');
    });
  });

  describe('hasMeaningfulChanges', () => {
    it('should detect meaningful changes in RELATED fields', () => {
      const oldFrontMatter = {
        'RELATED[friend]': 'John'
      };
      const newFrontMatter = {
        'RELATED[friend]': 'Jane'
      };

      expect(hasMeaningfulChanges(oldFrontMatter, newFrontMatter)).toBe(true);
    });

    it('should ignore reordering of same content', () => {
      const oldFrontMatter = {
        'RELATED[friend]': 'Alice',
        'RELATED[1:friend]': 'Bob'
      };
      const newFrontMatter = {
        'RELATED[1:friend]': 'Bob',
        'RELATED[friend]': 'Alice'
      };

      expect(hasMeaningfulChanges(oldFrontMatter, newFrontMatter)).toBe(false);
    });

    it('should detect addition of new relationships', () => {
      const oldFrontMatter = {
        'RELATED[friend]': 'John'
      };
      const newFrontMatter = {
        'RELATED[friend]': 'John',
        'RELATED[parent]': 'Mom'
      };

      expect(hasMeaningfulChanges(oldFrontMatter, newFrontMatter)).toBe(true);
    });
  });
});