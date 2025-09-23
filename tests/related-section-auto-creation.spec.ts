import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipListManager } from '../src/services/relationshipListManager';
import { RelationshipManager } from '../src/services/relationshipManager';

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

describe('Related Section Auto-Creation', () => {
  let relationshipManager: RelationshipManager;
  let listManager: RelationshipListManager;

  beforeEach(() => {
    vi.clearAllMocks();
    relationshipManager = new RelationshipManager(mockApp as any);
    listManager = new RelationshipListManager(relationshipManager, mockApp as any);
  });

  describe('Adding Related heading when needed', () => {
    it('should add Related heading when forceAddHeading is true', () => {
      const contentWithoutRelated = `# John Doe

## Properties
Name: John Doe

## Notes
Some notes about John.`;

      const emptyRelationshipList = '';
      
      const result = (listManager as any).injectRelatedSection(contentWithoutRelated, emptyRelationshipList, true);
      
      expect(result).toContain('## Related');
      expect(result).not.toBe(contentWithoutRelated); // Content should change
      
      console.log('✅ Related heading added when forced');
    });

    it('should not add Related heading without content or force flag', () => {
      const contentWithoutRelated = `# John Doe

## Properties
Name: John Doe

## Notes
Some notes about John.`;

      const emptyRelationshipList = '';
      
      const result = (listManager as any).injectRelatedSection(contentWithoutRelated, emptyRelationshipList, false);
      
      expect(result).toBe(contentWithoutRelated); // Content should not change
      expect(result).not.toContain('## Related');
      
      console.log('✅ Related heading not added without force or content');
    });

    it('should add Related heading when there is content even without force flag', () => {
      const contentWithoutRelated = `# John Doe

## Properties
Name: John Doe

## Notes
Some notes about John.`;

      const relationshipList = '- friend [[Jane Smith]]';
      
      const result = (listManager as any).injectRelatedSection(contentWithoutRelated, relationshipList, false);
      
      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[Jane Smith]]');
      expect(result).not.toBe(contentWithoutRelated); // Content should change
      
      console.log('✅ Related heading added when there is content');
    });

    it('should update existing Related section regardless of force flag', () => {
      const contentWithRelated = `# John Doe

## Properties
Name: John Doe

## related

- old [[Relationship]]

## Notes
Some notes about John.`;

      const newRelationshipList = '- friend [[Jane Smith]]';
      
      const result = (listManager as any).injectRelatedSection(contentWithRelated, newRelationshipList, false);
      
      expect(result).toContain('## Related'); // Should fix capitalization
      expect(result).toContain('- friend [[Jane Smith]]');
      expect(result).not.toContain('- old [[Relationship]]');
      
      console.log('✅ Existing Related section updated correctly');
    });
  });

  describe('RelationshipManager Related section creation', () => {
    it('should ensure Related section exists when needed', async () => {
      const mockFile = { path: 'contact.md' } as any;
      const contentWithoutRelated = `# Contact

## Notes
Some notes.`;

      mockApp.vault.read = vi.fn().mockResolvedValue(contentWithoutRelated);
      mockApp.vault.modify = vi.fn();

      await (relationshipManager as any).ensureRelatedSectionExists(mockFile);

      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('## Related')
      );
      
      console.log('✅ RelationshipManager ensures Related section exists');
    });

    it('should not modify content if Related section already exists', async () => {
      const mockFile = { path: 'contact.md' } as any;
      const contentWithRelated = `# Contact

## Related

- friend [[John Doe]]

## Notes
Some notes.`;

      mockApp.vault.read = vi.fn().mockResolvedValue(contentWithRelated);
      mockApp.vault.modify = vi.fn();

      await (relationshipManager as any).ensureRelatedSectionExists(mockFile);

      expect(mockApp.vault.modify).not.toHaveBeenCalled();
      
      console.log('✅ RelationshipManager does not modify when Related section exists');
    });
  });
});