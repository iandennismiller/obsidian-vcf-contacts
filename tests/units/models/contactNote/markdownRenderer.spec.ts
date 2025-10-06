/**
 * Unit tests for MarkdownRenderer service
 */

import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from '../../../../src/models/contactNote/services/MarkdownRenderer';
import { Gender } from '../../../../src/models/contactNote/types';

describe('MarkdownRenderer', () => {
  describe('render', () => {
    it('should render basic contact record as markdown', () => {
      const record = {
        'N.FN': 'Doe',
        'N.GN': 'John',
        'FN': 'John Doe',
        'EMAIL[WORK]': 'john@example.com'
      };

      const result = MarkdownRenderer.render(record, '#contact');

      // Check for frontmatter delimiters
      expect(result).toContain('---\n');
      
      // Check for name fields in order
      expect(result).toContain('N.GN: John');
      expect(result).toContain('N.FN: Doe');
      expect(result).toContain('FN: John Doe');
      
      // Check for email field
      expect(result).toContain('EMAIL[WORK]: john@example.com');
      
      // Check for sections
      expect(result).toContain('#### Notes');
      expect(result).toContain('## Related');
      
      // Check for hashtags
      expect(result).toContain('#contact');
    });

    it('should handle NOTE field separately', () => {
      const record = {
        'FN': 'John Doe',
        'NOTE': 'Important\\nnotes'
      };

      const result = MarkdownRenderer.render(record, '');

      // NOTE should appear in Notes section, not frontmatter
      expect(result).toContain('#### Notes\nImportant\nnotes');
      
      // NOTE should not appear in frontmatter
      const frontmatterSection = result.split('---\n')[1];
      expect(frontmatterSection).not.toContain('NOTE:');
    });

    it('should process CATEGORIES as hashtags', () => {
      const record = {
        'FN': 'John Doe',
        'CATEGORIES': 'family,friend'
      };

      const result = MarkdownRenderer.render(record, '#contact');

      expect(result).toContain('#family #friend');
    });

    it('should render RELATED fields in Related section', () => {
      const record = {
        'FN': 'John Doe',
        'RELATED[Spouse]': 'Jane Doe'
      };

      const result = MarkdownRenderer.render(record, '');

      expect(result).toContain('## Related');
      expect(result).toContain('- spouse [[Jane Doe]]');
    });

    it('should apply gender-aware relationship terms when genderLookup provided', () => {
      const record = {
        'FN': 'John Doe',
        'RELATED[Parent]': 'Jane Doe'
      };

      const genderLookup = (name: string): Gender => {
        if (name === 'Jane Doe') return 'F';
        return 'U';
      };

      const result = MarkdownRenderer.render(record, '', genderLookup);

      // Should convert 'parent' to 'mother' for female contact
      expect(result).toContain('- mother [[Jane Doe]]');
    });

    it('should handle UID-based RELATED values', () => {
      const record = {
        'FN': 'John Doe',
        'RELATED[Spouse]': 'urn:uuid:12345-67890'
      };

      const result = MarkdownRenderer.render(record, '');

      expect(result).toContain('## Related');
      expect(result).toContain('- spouse [[urn:uuid:12345-67890]]');
    });

    it('should create empty Related section when no relationships', () => {
      const record = {
        'FN': 'John Doe',
        'EMAIL[WORK]': 'john@example.com'
      };

      const result = MarkdownRenderer.render(record, '');

      expect(result).toContain('## Related\n');
      // Should not have any list items
      expect(result).not.toContain('- ');
    });

    it('should sort fields by importance (name, priority, address, other)', () => {
      const record = {
        'NOTE': 'Custom field',
        'EMAIL[WORK]': 'john@example.com',
        'ADR[HOME].STREET': '123 Main St',
        'N.FN': 'Doe',
        'FN': 'John Doe'
      };

      const result = MarkdownRenderer.render(record, '');
      
      // Extract frontmatter section
      const frontmatterMatch = result.match(/---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch).not.toBeNull();
      
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const lines = frontmatter.split('\n');
        
        // Name fields should come first
        const fnIndex = lines.findIndex(l => l.includes('FN:'));
        const emailIndex = lines.findIndex(l => l.includes('EMAIL'));
        const adrIndex = lines.findIndex(l => l.includes('ADR'));
        
        expect(fnIndex).toBeGreaterThanOrEqual(0);
        expect(emailIndex).toBeGreaterThanOrEqual(0);
        expect(adrIndex).toBeGreaterThanOrEqual(0);
        
        // Name should come before priority (email)
        expect(fnIndex).toBeLessThan(emailIndex);
        // Priority should come before address
        expect(emailIndex).toBeLessThan(adrIndex);
      }
    });

    it('should handle empty record', () => {
      const result = MarkdownRenderer.render({}, '');

      expect(result).toContain('---\n');
      expect(result).toContain('#### Notes');
      expect(result).toContain('## Related');
    });

    it('should preserve hashtags parameter', () => {
      const record = { 'FN': 'John Doe' };
      const hashtags = '#person #important';

      const result = MarkdownRenderer.render(record, hashtags);

      expect(result).toContain('#person #important');
    });
  });
});
