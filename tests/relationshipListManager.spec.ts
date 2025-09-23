import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipListManager } from '../src/services/relationshipListManager';
import { RelationshipManager } from '../src/services/relationshipManager';

// Mock Obsidian modules
vi.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(public path: string, public name: string) {}
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

const mockApp = {
  vault: {
    read: vi.fn(),
    modify: vi.fn(),
    getMarkdownFiles: vi.fn(() => []),
    getAbstractFileByPath: vi.fn(),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

describe('RelationshipListManager', () => {
  let listManager: RelationshipListManager;
  let mockRelationshipManager: RelationshipManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRelationshipManager = {} as RelationshipManager;
    listManager = new RelationshipListManager(mockRelationshipManager, mockApp as any);
  });

  describe('parseRelationshipList', () => {
    it('should parse relationship list from markdown content', () => {
      const content = `# Contact
      
## Related

- friend [[John Doe]]
- colleague [[Jane Smith]]
- mentor [[Bob Wilson]]

## Notes
Some notes here`;

      const relationships = listManager.parseRelationshipList(content);

      expect(relationships).toHaveLength(3);
      expect(relationships).toContainEqual({
        relationshipType: 'friend',
        contactName: 'John Doe'
      });
      expect(relationships).toContainEqual({
        relationshipType: 'colleague',
        contactName: 'Jane Smith'
      });
      expect(relationships).toContainEqual({
        relationshipType: 'mentor',
        contactName: 'Bob Wilson'
      });
    });

    it('should handle case insensitive Related header', () => {
      const content = `## related

- friend [[John Doe]]`;

      const relationships = listManager.parseRelationshipList(content);
      expect(relationships).toHaveLength(1);
    });

    it('should handle different header levels', () => {
      const content = `#### Related

- friend [[John Doe]]`;

      const relationships = listManager.parseRelationshipList(content);
      expect(relationships).toHaveLength(1);
    });

    it('should return empty array when no Related section exists', () => {
      const content = `# Contact

## Notes
Some notes`;

      const relationships = listManager.parseRelationshipList(content);
      expect(relationships).toHaveLength(0);
    });

    it('should ignore malformed list items', () => {
      const content = `## Related

- friend [[John Doe]]
- invalid line format
- mentor [[Bob Wilson]]
- also invalid`;

      const relationships = listManager.parseRelationshipList(content);
      expect(relationships).toHaveLength(2);
      expect(relationships.map(r => r.contactName)).toEqual(['John Doe', 'Bob Wilson']);
    });

    it('should stop parsing at the next header of same or higher level', () => {
      const content = `## Related

- friend [[John Doe]]
- colleague [[Jane Smith]]

## Notes

- this [[Should Not]] be parsed
- neither [[Should This]]`;

      const relationships = listManager.parseRelationshipList(content);
      expect(relationships).toHaveLength(2);
    });
  });

  describe('generateRelationshipList', () => {
    it('should generate markdown list from front matter', async () => {
      const mockFile = { path: 'contact.md' } as any;
      const mockFrontmatter = {
        'RELATED[friend]': 'urn:uuid:123-456',
        'RELATED[1:friend]': 'name:Jane Smith',
        'RELATED[colleague]': 'uid:custom-id'
      };

      mockApp.metadataCache.getFileCache = vi.fn(() => ({
        frontmatter: mockFrontmatter
      }));

      // Mock contact name resolution
      const resolveContactNameSpy = vi.spyOn(listManager as any, 'resolveContactName');
      resolveContactNameSpy
        .mockResolvedValueOnce('John Doe')
        .mockResolvedValueOnce('Jane Smith')
        .mockResolvedValueOnce('Bob Wilson');

      const result = await listManager.generateRelationshipList(mockFile);

      expect(result).toContain('- friend [[John Doe]]');
      expect(result).toContain('- friend [[Jane Smith]]');
      expect(result).toContain('- colleague [[Bob Wilson]]');
    });

    it('should handle empty front matter', async () => {
      const mockFile = { path: 'contact.md' } as any;

      mockApp.metadataCache.getFileCache = vi.fn(() => ({
        frontmatter: {}
      }));

      const result = await listManager.generateRelationshipList(mockFile);
      expect(result).toBe('');
    });

    it('should sort relationships by type and name', async () => {
      const mockFile = { path: 'contact.md' } as any;
      const mockFrontmatter = {
        'RELATED[friend]': 'name:Zoe',
        'RELATED[1:friend]': 'name:Alice',
        'RELATED[colleague]': 'name:Bob'
      };

      mockApp.metadataCache.getFileCache = vi.fn(() => ({
        frontmatter: mockFrontmatter
      }));

      const resolveContactNameSpy = vi.spyOn(listManager as any, 'resolveContactName');
      resolveContactNameSpy
        .mockResolvedValueOnce('Zoe')
        .mockResolvedValueOnce('Alice')
        .mockResolvedValueOnce('Bob');

      const result = await listManager.generateRelationshipList(mockFile);
      const lines = result.split('\n');

      // Should be sorted: colleague comes before friend, and Alice before Zoe
      expect(lines[0]).toBe('- colleague [[Bob]]');
      expect(lines[1]).toBe('- friend [[Alice]]');
      expect(lines[2]).toBe('- friend [[Zoe]]');
    });
  });

  describe('injectRelatedSection', () => {
    it('should add Related section when none exists', () => {
      const content = `# Contact

## Notes
Some notes`;

      const relationshipList = '- friend [[John Doe]]';
      const result = (listManager as any).injectRelatedSection(content, relationshipList);

      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[John Doe]]');
    });

    it('should update existing Related section', () => {
      const content = `# Contact

## Related

- old [[Relationship]]

## Notes
Some notes`;

      const relationshipList = '- friend [[John Doe]]';
      const result = (listManager as any).injectRelatedSection(content, relationshipList);

      expect(result).toContain('## Related');
      expect(result).toContain('- friend [[John Doe]]');
      expect(result).not.toContain('- old [[Relationship]]');
    });

    it('should fix Related header capitalization', () => {
      const content = `## related

- old [[Relationship]]`;

      const relationshipList = '- friend [[John Doe]]';
      const result = (listManager as any).injectRelatedSection(content, relationshipList);

      expect(result).toContain('## Related');
      expect(result).not.toContain('## related');
    });

    it('should not add Related section if relationship list is empty', () => {
      const content = `# Contact

## Notes
Some notes`;

      const relationshipList = '';
      const result = (listManager as any).injectRelatedSection(content, relationshipList);

      expect(result).toBe(content);
      expect(result).not.toContain('## Related');
    });
  });
});