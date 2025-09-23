import { describe, expect, it } from 'vitest';
import { 
  parseRelatedSection, 
  parseRelatedListItem, 
  renderRelatedSection,
  updateRelatedSection,
  cleanupRelatedHeadings
} from 'src/relationships/markdownParser';

describe('markdownParser', () => {
  describe('parseRelatedListItem', () => {
    it('should parse wiki link format', () => {
      const result = parseRelatedListItem('friend [[John Doe]]');
      expect(result).toEqual({
        kind: 'friend',
        target: 'John Doe'
      });
    });

    it('should parse wiki link with display text', () => {
      const result = parseRelatedListItem('sister [[Jane Smith|Jane]]');
      expect(result).toEqual({
        kind: 'sister',
        target: 'Jane Smith'
      });
    });

    it('should parse plain text format', () => {
      const result = parseRelatedListItem('parent John Doe');
      expect(result).toEqual({
        kind: 'parent',
        target: 'John Doe'
      });
    });

    it('should return null for invalid format', () => {
      expect(parseRelatedListItem('invalid format')).toBeNull();
      expect(parseRelatedListItem('[[John Doe]]')).toBeNull();
      expect(parseRelatedListItem('')).toBeNull();
      expect(parseRelatedListItem('just text')).toBeNull();
      expect(parseRelatedListItem('one word')).toBeNull();
      expect(parseRelatedListItem('friend')).toBeNull();
    });
  });

  describe('parseRelatedSection', () => {
    it('should parse Related section with list items', () => {
      const content = `# Contact Note

## Related

- friend [[John Doe]]
- sister [[Jane Smith]]
- colleague Bob Johnson

## Notes

Some notes here.`;

      const result = parseRelatedSection(content);
      
      expect(result.hasRelatedHeading).toBe(true);
      expect(result.relatedItems).toHaveLength(3);
      expect(result.relatedItems[0]).toEqual({
        kind: 'friend',
        target: 'John Doe'
      });
      expect(result.relatedItems[1]).toEqual({
        kind: 'sister',
        target: 'Jane Smith'
      });
      expect(result.relatedItems[2]).toEqual({
        kind: 'colleague',
        target: 'Bob Johnson'
      });
    });

    it('should handle case insensitive Related heading', () => {
      const content = `## related

- friend [[John Doe]]`;

      const result = parseRelatedSection(content);
      expect(result.hasRelatedHeading).toBe(true);
      expect(result.relatedItems).toHaveLength(1);
    });

    it('should handle different heading depths', () => {
      const content = `### Related

- friend [[John Doe]]`;

      const result = parseRelatedSection(content);
      expect(result.hasRelatedHeading).toBe(true);
      expect(result.relatedItems).toHaveLength(1);
    });

    it('should return empty when no Related heading', () => {
      const content = `# Contact Note

## Notes

Some notes here.`;

      const result = parseRelatedSection(content);
      expect(result.hasRelatedHeading).toBe(false);
      expect(result.relatedItems).toHaveLength(0);
    });

    it('should handle Related section at end of document', () => {
      const content = `# Contact Note

## Related

- friend [[John Doe]]`;

      const result = parseRelatedSection(content);
      expect(result.hasRelatedHeading).toBe(true);
      expect(result.relatedItems).toHaveLength(1);
    });
  });

  describe('renderRelatedSection', () => {
    it('should render relationships as markdown list', () => {
      const relationships = [
        { kind: 'friend', target: 'John Doe' },
        { kind: 'sister', target: 'Jane Smith' }
      ];

      const result = renderRelatedSection(relationships);
      
      expect(result).toBe(`## Related

- friend [[John Doe]]
- sister [[Jane Smith]]
`);
    });

    it('should sort relationships by kind and target', () => {
      const relationships = [
        { kind: 'sister', target: 'Zoe Smith' },
        { kind: 'friend', target: 'Bob Johnson' },
        { kind: 'friend', target: 'Alice Brown' }
      ];

      const result = renderRelatedSection(relationships);
      
      expect(result).toBe(`## Related

- friend [[Alice Brown]]
- friend [[Bob Johnson]]
- sister [[Zoe Smith]]
`);
    });

    it('should return empty string for no relationships', () => {
      const result = renderRelatedSection([]);
      expect(result).toBe('');
    });
  });

  describe('updateRelatedSection', () => {
    it('should add Related section when none exists', () => {
      const content = `# Contact Note

## Notes

Some notes here.`;

      const relationships = [
        { kind: 'friend', target: 'John Doe' }
      ];

      const result = updateRelatedSection(content, relationships);
      
      expect(result).toBe(`# Contact Note

## Notes

Some notes here.

## Related

- friend [[John Doe]]
`);
    });

    it('should replace existing Related section', () => {
      const content = `# Contact Note

## Related

- old friend [[Old Friend]]

## Notes

Some notes here.`;

      const relationships = [
        { kind: 'friend', target: 'New Friend' }
      ];

      const result = updateRelatedSection(content, relationships);
      
      expect(result).toBe(`# Contact Note

## Related

- friend [[New Friend]]

## Notes

Some notes here.`);
    });

    it('should remove Related section when no relationships', () => {
      const content = `# Contact Note

## Related

- friend [[John Doe]]

## Notes

Some notes here.`;

      const result = updateRelatedSection(content, []);
      
      expect(result).toBe(`# Contact Note

## Notes

Some notes here.`);
    });
  });

  describe('cleanupRelatedHeadings', () => {
    it('should remove empty Related sections when one has content', () => {
      const content = `# Contact Note

## Related

## Related

- friend [[John Doe]]

## Notes`;

      const result = cleanupRelatedHeadings(content);
      
      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[John Doe]]');
      expect(result.match(/## Related/g)).toHaveLength(1);
    });

    it('should fix capitalization of Related heading', () => {
      const content = `## related

- friend [[John Doe]]`;

      const result = cleanupRelatedHeadings(content);
      
      expect(result).toContain('## Related');
      expect(result).not.toContain('## related');
    });

    it('should handle single Related heading correctly', () => {
      const content = `## related

- friend [[John Doe]]`;

      const result = cleanupRelatedHeadings(content);
      
      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[John Doe]]');
      expect(result).not.toContain('## related');
    });
  });
});