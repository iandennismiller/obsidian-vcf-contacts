import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/services/relationshipManager';
import { RelationshipEventManager } from '../src/services/relationshipEventManager';

// Mock all external dependencies
vi.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(public path: string, public name: string, public basename: string) {}
  },
  parseYaml: vi.fn(),
  stringifyYaml: vi.fn(),
}));

vi.mock('../src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => mockApp),
}));

vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/contacts/contactFrontmatter', () => ({
  getFrontmatterFromFiles: vi.fn(() => Promise.resolve([])),
  updateFrontMatterValue: vi.fn(),
}));

vi.mock('../src/services/relationshipListManager', () => ({
  RelationshipListManager: vi.fn().mockImplementation(() => ({
    parseRelationshipList: vi.fn(() => []),
  })),
}));

const mockApp = {
  vault: {
    read: vi.fn(),
    modify: vi.fn(),
    getMarkdownFiles: vi.fn(() => []),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

describe('RelationshipManager REV Optimization', () => {
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    vi.clearAllMocks();
    relationshipManager = new RelationshipManager(mockApp as any);
  });

  describe('haveRelatedFieldsChanged', () => {
    it('should return false when no changes', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = { 'RELATED[friend]': 'urn:uuid:123' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(false);
    });

    it('should return true when field value changed', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = { 'RELATED[friend]': 'urn:uuid:456' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return true when field added', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = { 
        'RELATED[friend]': 'urn:uuid:123', 
        'RELATED[colleague]': 'urn:uuid:789' 
      };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return true when field removed', () => {
      const existing = { 
        'RELATED[friend]': 'urn:uuid:123', 
        'RELATED[colleague]': 'urn:uuid:789' 
      };
      const newFields = { 'RELATED[friend]': 'urn:uuid:123' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return false when both are empty', () => {
      const existing = {};
      const newFields = {};
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(false);
    });

    it('should return true when going from empty to having fields', () => {
      const existing = {};
      const newFields = { 'RELATED[friend]': 'urn:uuid:123' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return true when going from having fields to empty', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = {};
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });
  });

  describe('Related section change detection', () => {
    it('should only trigger sync when Related section content actually changes', () => {
      const content1 = `# Contact

## Related

- friend [[John Doe]]
- colleague [[Jane Smith]]

## Notes`;

      const content2 = `# Contact

## Related

- friend [[John Doe]]
- colleague [[Jane Smith]]

## Notes
Some additional notes here.`;

      const content3 = `# Contact

## Related

- friend [[John Doe]]
- colleague [[Jane Smith]]
- mentor [[Bob Wilson]]

## Notes`;

      const eventManager = new RelationshipEventManager(relationshipManager, mockApp as any);
      
      const hash1 = (eventManager as any).extractRelatedSectionContent(content1);
      const hash2 = (eventManager as any).extractRelatedSectionContent(content2);
      const hash3 = (eventManager as any).extractRelatedSectionContent(content3);

      // Same Related section, different notes - should not trigger update
      expect(hash1).toBe(hash2);
      
      // Different Related section - should trigger update
      expect(hash1).not.toBe(hash3);
      
      console.log('✅ Related section change detection working correctly');
    });

    it('should handle empty Related sections', () => {
      const contentWithoutRelated = `# Contact

## Notes
Just some notes.`;

      const eventManager = new RelationshipEventManager(relationshipManager, mockApp as any);
      const hash = (eventManager as any).extractRelatedSectionContent(contentWithoutRelated);
      
      expect(hash).toBe('');
    });
  });
});