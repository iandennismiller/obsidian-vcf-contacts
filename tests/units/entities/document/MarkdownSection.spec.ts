import { describe, it, expect } from 'vitest';
import { MarkdownSection } from '../../../../src/models/contactNote/entities/document/MarkdownSection';

describe('MarkdownSection', () => {
  describe('Creation', () => {
    it('should create section with name, level, and content', () => {
      const section = MarkdownSection.create('Test Section', 2, 'Content here');
      
      expect(section.getName()).toBe('Test Section');
      expect(section.getLevel()).toBe(2);
      expect(section.getContent()).toBe('Content here');
    });

    it('should clamp level to 1-6 range', () => {
      const section1 = MarkdownSection.create('Test', 0, 'content');
      const section2 = MarkdownSection.create('Test', 7, 'content');
      
      expect(section1.getLevel()).toBe(1);
      expect(section2.getLevel()).toBe(6);
    });
  });

  describe('Getters', () => {
    it('should get name', () => {
      const section = MarkdownSection.create('Related', 2, 'content');
      expect(section.getName()).toBe('Related');
    });

    it('should get level', () => {
      const section = MarkdownSection.create('Contact', 3, 'content');
      expect(section.getLevel()).toBe(3);
    });

    it('should get content', () => {
      const content = '- item 1\n- item 2';
      const section = MarkdownSection.create('Test', 2, content);
      expect(section.getContent()).toBe(content);
    });
  });

  describe('Content Detection', () => {
    it('should detect empty section', () => {
      const empty = MarkdownSection.create('Empty', 2, '');
      const whitespace = MarkdownSection.create('Whitespace', 2, '   \n  \t  ');
      const notEmpty = MarkdownSection.create('NotEmpty', 2, 'content');
      
      expect(empty.isEmpty()).toBe(true);
      expect(whitespace.isEmpty()).toBe(true);
      expect(notEmpty.isEmpty()).toBe(false);
    });
  });

  describe('Markdown Conversion', () => {
    it('should convert to markdown with content', () => {
      const section = MarkdownSection.create('Related', 2, '- friend [[John]]');
      const markdown = section.toMarkdown();
      
      expect(markdown).toContain('## Related');
      expect(markdown).toContain('- friend [[John]]');
    });

    it('should convert to markdown without content', () => {
      const section = MarkdownSection.create('Empty', 2, '');
      const markdown = section.toMarkdown();
      
      expect(markdown).toBe('## Empty\n');
    });

    it('should use correct heading level', () => {
      const section1 = MarkdownSection.create('H1', 1, 'content');
      const section2 = MarkdownSection.create('H3', 3, 'content');
      const section5 = MarkdownSection.create('H5', 5, 'content');
      
      expect(section1.toMarkdown()).toMatch(/^# H1/);
      expect(section2.toMarkdown()).toMatch(/^### H3/);
      expect(section5.toMarkdown()).toMatch(/^##### H5/);
    });
  });

  describe('Equality', () => {
    it('should be equal with same properties', () => {
      const section1 = MarkdownSection.create('Test', 2, 'content');
      const section2 = MarkdownSection.create('Test', 2, 'content');
      
      expect(section1.equals(section2)).toBe(true);
    });

    it('should not be equal with different name', () => {
      const section1 = MarkdownSection.create('Test1', 2, 'content');
      const section2 = MarkdownSection.create('Test2', 2, 'content');
      
      expect(section1.equals(section2)).toBe(false);
    });

    it('should not be equal with different level', () => {
      const section1 = MarkdownSection.create('Test', 2, 'content');
      const section2 = MarkdownSection.create('Test', 3, 'content');
      
      expect(section1.equals(section2)).toBe(false);
    });

    it('should not be equal with different content', () => {
      const section1 = MarkdownSection.create('Test', 2, 'content1');
      const section2 = MarkdownSection.create('Test', 2, 'content2');
      
      expect(section1.equals(section2)).toBe(false);
    });
  });

  describe('String Representation', () => {
    it('should have string representation', () => {
      const section = MarkdownSection.create('Test', 2, 'Some content here');
      const str = section.toString();
      
      expect(str).toContain('Test');
      expect(str).toContain('level=2');
      expect(str).toContain('chars');
    });
  });

  describe('Abstract Methods', () => {
    it('should have parse method', () => {
      const section = MarkdownSection.create('Test', 2, 'content');
      expect(typeof section.parse).toBe('function');
      expect(section.parse()).toBeDefined();
    });

    it('should have validate method', () => {
      const section = MarkdownSection.create('Test', 2, 'content');
      expect(typeof section.validate).toBe('function');
      
      const result = section.validate();
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('issues');
    });
  });
});
