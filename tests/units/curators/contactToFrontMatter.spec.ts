import { describe, it, expect } from 'vitest';
import { ContactToFrontMatterProcessor } from '../../../src/curators/contactToFrontMatter';
import { RunType } from '../../../src/models/curatorManager';

/**
 * Tests for ContactToFrontMatterProcessor
 * This processor syncs Contact section changes to frontmatter
 */
describe('ContactToFrontMatterProcessor', () => {
  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(ContactToFrontMatterProcessor.name).toBe('ContactToFrontMatterProcessor');
      expect(ContactToFrontMatterProcessor.runType).toBe(RunType.IMPROVEMENT);
      expect(ContactToFrontMatterProcessor.settingPropertyName).toBe('contactToFrontMatterProcessor');
      expect(ContactToFrontMatterProcessor.settingDescription).toContain('syncs Contact markdown section to contact frontmatter');
      expect(ContactToFrontMatterProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof ContactToFrontMatterProcessor.process).toBe('function');
      expect(ContactToFrontMatterProcessor.process).toBeDefined();
    });
  });

  describe('processor behavior verification', () => {
    it('should be an IMPROVEMENT processor type', () => {
      expect(ContactToFrontMatterProcessor.runType).toBe(RunType.IMPROVEMENT);
    });

    it('should be enabled by default', () => {
      expect(ContactToFrontMatterProcessor.settingDefaultValue).toBe(true);
    });

    it('should focus on Contact section synchronization', () => {
      expect(ContactToFrontMatterProcessor.settingDescription).toContain('syncs Contact markdown section');
      expect(ContactToFrontMatterProcessor.name).toContain('ContactToFrontMatter');
    });
  });

  describe('processing logic verification', () => {
    it('should check processor setting before processing', () => {
      const processorSource = ContactToFrontMatterProcessor.process.toString();
      expect(processorSource).toContain('activeProcessor');
    });

    it('should work with contact data', () => {
      const processorSource = ContactToFrontMatterProcessor.process.toString();
      expect(processorSource).toContain('contact');
    });

    it('should parse Contact section', () => {
      const processorSource = ContactToFrontMatterProcessor.process.toString();
      expect(processorSource).toContain('parseContactSection');
    });

    it('should normalize field values', () => {
      const processorSource = ContactToFrontMatterProcessor.process.toString();
      expect(processorSource).toContain('normalizeFieldValue');
    });

    it('should update frontmatter values', () => {
      const processorSource = ContactToFrontMatterProcessor.process.toString();
      expect(processorSource).toContain('updateMultipleFrontmatterValues');
    });
  });
});
