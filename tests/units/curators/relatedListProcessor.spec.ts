import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RelatedListProcessor } from "../../../src/curators/relatedList";
import { RunType } from "../../../src/interfaces";
import { setupCuratorMocks, cleanupCuratorMocks, createMockContact, createMockContactNote } from '../../setup/curatorMocks';
import { sampleContacts } from '../../fixtures/curatorTestData';
import type { Contact } from '../../../src/models/contactNote/types';

// Mock the dependencies
vi.mock('../../../src/context/sharedAppContext', () => ({
  getApp: vi.fn(),
}));

vi.mock('../../../src/context/sharedSettingsContext', () => ({
  getSettings: vi.fn(),
}));

vi.mock('../../../src/models', () => ({
  ContactNote: vi.fn(),
}));

describe('RelatedListProcessor', () => {
  let mockContactNote: ReturnType<typeof createMockContactNote>;
  let mockApp: any;
  let mockSettings: any;

  beforeEach(() => {
    const mocks = setupCuratorMocks();
    mockContactNote = mocks.mockContactNote;
    mockApp = mocks.mockApp;
    mockSettings = mocks.mockSettings;

    // Setup the mocks for each test
    const { getApp } = require('../../../src/context/sharedAppContext');
    const { getSettings } = require('../../../src/context/sharedSettingsContext');
    const { ContactNote } = require('../../../src/models');
    
    vi.mocked(getApp).mockReturnValue(mockApp);
    vi.mocked(getSettings).mockReturnValue(mockSettings);
    vi.mocked(ContactNote).mockImplementation(() => mockContactNote);
  });

  afterEach(() => {
    cleanupCuratorMocks();
  });

  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(RelatedListProcessor.name).toBe('RelatedListProcessor');
      expect(RelatedListProcessor.runType).toBe(RunType.INPROVEMENT);
      expect(RelatedListProcessor.settingPropertyName).toBe('relatedListProcessor');
      expect(RelatedListProcessor.settingDescription).toContain('syncs Related markdown');
      expect(RelatedListProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof RelatedListProcessor.process).toBe('function');
      expect(RelatedListProcessor.process).toBeDefined();
    });
  });

  describe('process function', () => {
    it('should return undefined when processor is disabled', async () => {
      mockSettings.relatedListProcessor = false;
      const contact = createMockContact();

      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeUndefined();
    });

    it('should return undefined when contact has no Related section relationships', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([]);
      const contact = createMockContact();

      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.parseRelatedSection).toHaveBeenCalled();
    });

    it('should return undefined when all relationships already exist in frontmatter', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([
        {
          key: 'spouse',
          type: 'spouse',
          value: 'Jane Doe',
          parsedValue: { type: 'name', value: 'Jane Doe' }
        }
      ]);
      
      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.syncRelatedListToFrontmatter).not.toHaveBeenCalled();
    });

    it('should sync missing relationships from Related section to frontmatter', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' },
        { type: 'child', contactName: 'Tommy Doe', originalType: 'child' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([
        // Only spouse exists in frontmatter, child is missing
        {
          key: 'spouse',
          type: 'spouse',
          value: 'Jane Doe',
          parsedValue: { type: 'name', value: 'Jane Doe' }
        }
      ]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Added 1 missing relationship to frontmatter');
      expect(mockContactNote.syncRelatedListToFrontmatter).toHaveBeenCalled();
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalledWith('REV', expect.any(String));
    });

    it('should handle multiple missing relationships', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' },
        { type: 'child', contactName: 'Tommy Doe', originalType: 'child' },
        { type: 'parent', contactName: 'Mary Doe', originalType: 'parent' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]); // No existing relationships
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Added 3 missing relationships to frontmatter');
      expect(mockContactNote.syncRelatedListToFrontmatter).toHaveBeenCalled();
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalledWith('REV', expect.any(String));
    });

    it('should use plural form for multiple relationships', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'child', contactName: 'Tommy Doe', originalType: 'child' },
        { type: 'child', contactName: 'Sally Doe', originalType: 'child' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result?.message).toContain('Added 2 missing relationships');
      expect(result?.message).not.toContain('relationship to'); // Should be plural
    });

    it('should use singular form for single relationship', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result?.message).toContain('Added 1 missing relationship to');
      expect(result?.message).not.toContain('relationships'); // Should be singular
    });

    it('should handle sync failures gracefully', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: false,
        errors: ['Sync failed']
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.updateFrontmatterValue).not.toHaveBeenCalled();
    });

    it('should handle sync warnings but still succeed', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: ['Warning: Minor issue'] // Success with warnings
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Added 1 missing relationship');
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalledWith('REV', expect.any(String));
    });

    it('should handle processing errors gracefully', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockRejectedValue(new Error('Parse error'));

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeUndefined(); // Should not crash
    });
  });

  describe('relationship comparison logic', () => {
    it('should correctly identify missing relationships', async () => {
      mockSettings.relatedListProcessor = true;
      
      // Related section has spouse and child
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' },
        { type: 'child', contactName: 'Tommy Doe', originalType: 'child' }
      ]);
      
      // Frontmatter only has spouse
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([
        {
          key: 'spouse',
          type: 'spouse',
          value: 'Jane Doe',
          parsedValue: { type: 'name', value: 'Jane Doe' }
        }
      ]);
      
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Added 1 missing relationship');
    });

    it('should handle case-insensitive relationship type matching', async () => {
      mockSettings.relatedListProcessor = true;
      
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'Spouse', contactName: 'Jane Doe', originalType: 'Spouse' } // Capital S
      ]);
      
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([
        {
          key: 'spouse',
          type: 'spouse', // lowercase s
          value: 'Jane Doe',
          parsedValue: { type: 'name', value: 'Jane Doe' }
        }
      ]);

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toBeUndefined(); // Should recognize as same relationship
    });
  });

  describe('result formatting', () => {
    it('should return proper CuratorQueItem structure', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result).toMatchObject({
        name: 'RelatedListProcessor',
        runType: RunType.INPROVEMENT,
        file: contact.file,
        message: expect.stringContaining('Added'),
        render: expect.any(Function),
        renderGroup: expect.any(Function)
      });
    });

    it('should include contact file name in message', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });

      const contact = createMockContact();
      const result = await RelatedListProcessor.process(contact);

      expect(result?.message).toContain(contact.file.name);
    });
  });

  describe('REV timestamp handling', () => {
    it('should update REV timestamp after successful sync', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: true,
        errors: []
      });
      mockContactNote.generateRevTimestamp.mockReturnValue('20240315T123456Z');

      const contact = createMockContact();
      await RelatedListProcessor.process(contact);

      expect(mockContactNote.generateRevTimestamp).toHaveBeenCalled();
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalledWith('REV', '20240315T123456Z');
    });

    it('should not update REV timestamp if sync fails', async () => {
      mockSettings.relatedListProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' }
      ]);
      mockContactNote.parseFrontmatterRelationships.mockResolvedValue([]);
      mockContactNote.syncRelatedListToFrontmatter.mockResolvedValue({
        success: false,
        errors: ['Sync failed']
      });

      const contact = createMockContact();
      await RelatedListProcessor.process(contact);

      expect(mockContactNote.generateRevTimestamp).not.toHaveBeenCalled();
      expect(mockContactNote.updateFrontmatterValue).not.toHaveBeenCalled();
    });
  });
});