import { describe, test, expect, beforeEach } from 'vitest';
import { RelationshipContentParser } from '../src/relationships/relationshipContentParser';

describe('RelationshipContentParser', () => {
  let parser: RelationshipContentParser;

  beforeEach(() => {
    parser = new RelationshipContentParser();
  });

  describe('findRelatedHeading', () => {
    test('should find Related heading at different depths', () => {
      const content1 = '# Related\nSome content';
      const result1 = parser.findRelatedHeading(content1);
      expect(result1?.match[0]).toBe('# Related');

      const content2 = '## Related\nSome content';
      const result2 = parser.findRelatedHeading(content2);
      expect(result2?.match[0]).toBe('## Related');

      const content3 = '### related\nSome content';
      const result3 = parser.findRelatedHeading(content3);
      expect(result3?.match[0]).toBe('### related');
    });

    test('should be case insensitive', () => {
      const content = '## RELATED\nSome content';
      const result = parser.findRelatedHeading(content);
      expect(result?.match[0]).toBe('## RELATED');
    });

    test('should return null when no Related heading exists', () => {
      const content = '## Notes\nSome content\n## Other\nMore content';
      const result = parser.findRelatedHeading(content);
      expect(result).toBeNull();
    });

    test('should find the first Related heading when multiple exist', () => {
      const content = '## Related\nFirst\n### related\nSecond';
      const result = parser.findRelatedHeading(content);
      expect(result?.match[0]).toBe('## Related');
    });
  });

  describe('parseRelatedSection', () => {
    test('should parse relationships from Related section', () => {
      const content = `## Related
- friend [[John Doe]]
- colleague [[Jane Smith]]
- brother [[Bob Johnson]]

## Notes
Some other content`;

      const relationships = parser.parseRelatedSection(content);
      
      expect(relationships).toHaveLength(3);
      expect(relationships[0]).toEqual({
        type: 'friend',
        contactName: 'John Doe',
        impliedGender: undefined
      });
      expect(relationships[1]).toEqual({
        type: 'colleague',
        contactName: 'Jane Smith',
        impliedGender: undefined
      });
      expect(relationships[2]).toEqual({
        type: 'sibling',
        contactName: 'Bob Johnson',
        impliedGender: 'M'
      });
    });

    test('should handle empty Related section', () => {
      const content = `## Related

## Notes
Some content`;

      const relationships = parser.parseRelatedSection(content);
      expect(relationships).toHaveLength(0);
    });

    test('should ignore invalid relationship items', () => {
      const content = `## Related
- friend [[John Doe]]
This is not a relationship
- invalid [[Jane Smith]]
- colleague [[Bob Johnson]]`;

      const relationships = parser.parseRelatedSection(content);
      expect(relationships).toHaveLength(2);
      expect(relationships[0].contactName).toBe('John Doe');
      expect(relationships[1].contactName).toBe('Bob Johnson');
    });

    test('should return empty array when no Related section exists', () => {
      const content = `## Notes
Some content`;

      const relationships = parser.parseRelatedSection(content);
      expect(relationships).toHaveLength(0);
    });

    test('should handle Related section at end of document', () => {
      const content = `## Notes
Some content

## Related
- friend [[John Doe]]
- colleague [[Jane Smith]]`;

      const relationships = parser.parseRelatedSection(content);
      expect(relationships).toHaveLength(2);
    });
  });

  describe('normalizeRelatedHeading', () => {
    test('should normalize headings to ## Related', () => {
      expect(parser.normalizeRelatedHeading('# Related\nContent'))
        .toBe('## Related\nContent');
      
      expect(parser.normalizeRelatedHeading('### related\nContent'))
        .toBe('## Related\nContent');
      
      expect(parser.normalizeRelatedHeading('#### RELATED\nContent'))
        .toBe('## Related\nContent');
    });

    test('should not change content without Related heading', () => {
      const content = '## Notes\nSome content';
      expect(parser.normalizeRelatedHeading(content)).toBe(content);
    });

    test('should handle multiple lines after heading', () => {
      const content = '# Related\nLine 1\nLine 2\n## Other\nMore content';
      const result = parser.normalizeRelatedHeading(content);
      expect(result).toBe('## Related\nLine 1\nLine 2\n## Other\nMore content');
    });
  });

  describe('cleanupRelatedHeadings', () => {
    test('should remove duplicate Related headings', () => {
      const content = `## Related
- friend [[John]]

### related

## Notes
Content`;

      const result = parser.cleanupRelatedHeadings(content);
      expect(result.match(/related/gi)?.length).toBe(1);
    });

    test('should keep Related heading with content', () => {
      const content = `## Related
- friend [[John]]

### related
- colleague [[Jane]]`;

      const result = parser.cleanupRelatedHeadings(content);
      // Should keep both since they have content
      expect(result.match(/related/gi)?.length).toBe(2);
    });

    test('should not change content with single Related heading', () => {
      const content = `## Related
- friend [[John]]

## Notes
Content`;

      const result = parser.cleanupRelatedHeadings(content);
      expect(result).toBe(content);
    });
  });

  describe('ensureRelatedHeading', () => {
    test('should add Related heading when none exists', () => {
      const content = '## Notes\nSome content';
      const result = parser.ensureRelatedHeading(content);
      
      expect(result).toContain('## Related');
      expect(result.indexOf('## Related')).toBeLessThan(result.indexOf('## Notes'));
    });

    test('should normalize existing Related heading', () => {
      const content = '# Related\n\n## Notes\nContent';
      const result = parser.ensureRelatedHeading(content);
      
      expect(result).toContain('## Related');
      expect(result).toContain('## Notes\nContent');
      expect(result).not.toMatch(/^# Related$/m); // Should not have single # heading
    });

    test('should add Related at end if no other sections exist', () => {
      const content = 'Just some content without headings';
      const result = parser.ensureRelatedHeading(content);
      
      expect(result).toContain('## Related');
      expect(result.indexOf('## Related')).toBeGreaterThan(result.indexOf('Just some content'));
    });
  });

  describe('updateRelatedSection', () => {
    test('should update Related section with new relationships', () => {
      const content = `## Related
- old [[Old Person]]

## Notes
Content`;

      const relationships = [
        { type: 'friend' as const, contactName: 'John Doe', gender: 'M' as const },
        { type: 'colleague' as const, contactName: 'Jane Smith', gender: 'F' as const }
      ];

      const result = parser.updateRelatedSection(content, relationships);
      
      expect(result).toContain('- friend [[John Doe]]');
      expect(result).toContain('- colleague [[Jane Smith]]');
      expect(result).not.toContain('- old [[Old Person]]');
      expect(result).toContain('## Notes\nContent');
    });

    test('should handle empty relationships list', () => {
      const content = `## Related
- friend [[John Doe]]

## Notes
Content`;

      const result = parser.updateRelatedSection(content, []);
      
      expect(result).toContain('## Related\n\n## Notes');
      expect(result).not.toContain('friend');
    });

    test('should add Related section if it doesn\'t exist', () => {
      const content = `## Notes
Content`;

      const relationships = [
        { type: 'friend' as const, contactName: 'John Doe' }
      ];

      const result = parser.updateRelatedSection(content, relationships);
      
      expect(result).toMatch(/## Related\s*- friend \[\[John Doe\]\]/);
      expect(result.indexOf('## Related')).toBeLessThan(result.indexOf('## Notes'));
    });

    test('should handle content without other sections', () => {
      const content = 'Just some content';

      const relationships = [
        { type: 'friend' as const, contactName: 'John Doe' }
      ];

      const result = parser.updateRelatedSection(content, relationships);
      
      expect(result).toContain('Just some content');
      expect(result).toMatch(/## Related\s*- friend \[\[John Doe\]\]/);
    });
  });

  describe('hasRelatedSection', () => {
    test('should return true when Related section exists', () => {
      const content = '## Related\n- friend [[John]]';
      expect(parser.hasRelatedSection(content)).toBe(true);
    });

    test('should return false when Related section does not exist', () => {
      const content = '## Notes\nSome content';
      expect(parser.hasRelatedSection(content)).toBe(false);
    });

    test('should be case insensitive', () => {
      const content = '## RELATED\n- friend [[John]]';
      expect(parser.hasRelatedSection(content)).toBe(true);
    });
  });

  describe('getInsertPosition', () => {
    test('should return position before first section', () => {
      const content = 'Some content\n## First Section\nMore content';
      const position = parser.getInsertPosition(content);
      
      expect(position).toBe(content.indexOf('## First Section'));
    });

    test('should return end position when no sections exist', () => {
      const content = 'Just some content\nwith multiple lines  ';
      const position = parser.getInsertPosition(content);
      
      expect(position).toBe(content.trimEnd().length);
    });

    test('should handle empty content', () => {
      const content = '';
      const position = parser.getInsertPosition(content);
      
      expect(position).toBe(0);
    });
  });
});