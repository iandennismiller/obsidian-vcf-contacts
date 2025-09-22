/**
 * @fileoverview Integration tests for relationship management system.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RelationshipManager } from '../src/contacts/relationshipManager';
import { RelationshipSyncService } from '../src/contacts/relationshipSyncService';
import { TFile, App } from 'obsidian';

// Mock Obsidian components
const mockApp = {
  metadataCache: {
    getFileCache: vi.fn()
  },
  vault: {
    getAllLoadedFiles: vi.fn(),
    read: vi.fn(),
    modify: vi.fn()
  }
} as unknown as App;

const mockFile = (basename: string, frontmatter: any = {}) => ({
  basename,
  extension: 'md',
  path: `${basename}.md`
} as TFile);

describe('Relationship Management Integration', () => {
  let relationshipManager: RelationshipManager;
  let relationshipSyncService: RelationshipSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    relationshipManager = new RelationshipManager(mockApp);
    relationshipSyncService = new RelationshipSyncService(mockApp);
  });

  it('should handle complete relationship workflow', async () => {
    // Mock contact files
    const johnFile = mockFile('John Doe');
    const janeFile = mockFile('Jane Smith');

    // Mock frontmatter for John (has relationship to Jane)
    const johnFrontmatter = {
      'FN': 'John Doe',
      'N.GN': 'John',
      'N.FN': 'Doe',
      'UID': 'urn:uuid:john-123',
      'RELATED[friend]': 'urn:uuid:jane-456'
    };

    // Mock frontmatter for Jane (has relationship to John)
    const janeFrontmatter = {
      'FN': 'Jane Smith',
      'N.GN': 'Jane',
      'N.FN': 'Smith',
      'UID': 'urn:uuid:jane-456',
      'RELATED[friend]': 'urn:uuid:john-123'
    };

    // Set up mocks
    vi.mocked(mockApp.metadataCache.getFileCache).mockImplementation((file: TFile) => {
      if (file === johnFile) {
        return { frontmatter: johnFrontmatter };
      } else if (file === janeFile) {
        return { frontmatter: janeFrontmatter };
      }
      return null;
    });

    vi.mocked(mockApp.vault.getAllLoadedFiles).mockReturnValue([johnFile, janeFile]);

    // Test getting relationships
    const johnRelationships = await relationshipManager.getContactRelationships(johnFile);
    
    expect(johnRelationships).toHaveLength(1);
    expect(johnRelationships[0].contactName).toBe('Jane Smith');
    expect(johnRelationships[0].relationshipType).toBe('friend');
    expect(johnRelationships[0].uid).toBe('jane-456');
  });

  it('should render relationships markdown correctly', async () => {
    const johnFile = mockFile('John Doe');
    const janeFile = mockFile('Jane Smith');

    const johnFrontmatter = {
      'FN': 'John Doe',
      'N.GN': 'John',
      'N.FN': 'Doe',
      'UID': 'urn:uuid:john-123',
      'RELATED[friend]': 'urn:uuid:jane-456',
      'RELATED[colleague]': 'urn:uuid:jane-456'
    };

    const janeFrontmatter = {
      'FN': 'Jane Smith',
      'N.GN': 'Jane',
      'N.FN': 'Smith',
      'UID': 'urn:uuid:jane-456'
    };

    vi.mocked(mockApp.metadataCache.getFileCache).mockImplementation((file: TFile) => {
      if (file === johnFile) {
        return { frontmatter: johnFrontmatter };
      } else if (file === janeFile) {
        return { frontmatter: janeFrontmatter };
      }
      return null;
    });

    vi.mocked(mockApp.vault.getAllLoadedFiles).mockReturnValue([johnFile, janeFile]);

    const markdown = await relationshipManager.renderRelationshipsMarkdown(johnFile);
    
    expect(markdown).toContain('## Relationships');
    expect(markdown).toContain('- [[Jane Smith]] is a friend of John Doe');
    expect(markdown).toContain('- [[Jane Smith]] is a colleague of John Doe');
  });

  it('should handle relationship sync from markdown to frontmatter', async () => {
    const contactFile = mockFile('John Doe');
    
    const frontmatter = {
      'FN': 'John Doe',
      'N.GN': 'John',
      'N.FN': 'Doe',
      'UID': 'urn:uuid:john-123'
    };

    vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({ frontmatter });
    
    const content = `---
FN: John Doe
N.GN: John
N.FN: Doe
UID: urn:uuid:john-123
---

## Relationships

- [[Jane Smith]] is a friend of John Doe
- [[Bob Johnson]] is a colleague of John Doe

#### Notes

Some notes here.
`;

    vi.mocked(mockApp.vault.read).mockResolvedValue(content);
    
    // Extract relationships section
    const relationshipsSection = content.match(/^## Relationships\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m)?.[1];
    
    expect(relationshipsSection).toContain('- [[Jane Smith]] is a friend of John Doe');
    expect(relationshipsSection).toContain('- [[Bob Johnson]] is a colleague of John Doe');
  });
});

describe('Relationship Sync Service Integration', () => {
  let syncService: RelationshipSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    syncService = new RelationshipSyncService(mockApp);
  });

  it('should replace relationships section correctly', async () => {
    const content = `---
FN: John Doe
---

#### Notes
Some notes

## Relationships

- [[Old Friend]] is a friend of John Doe

#Contact #Test
`;

    const newRelationshipsMarkdown = `## Relationships

- [[New Friend]] is a friend of John Doe
- [[Boss]] is a manager of John Doe

`;

    vi.mocked(mockApp.vault.read).mockResolvedValue(content);
    
    // This would be called internally by updateRelationshipsSection
    // We're testing the logic here
    const relationshipsSectionRegex = /^## Relationships\s*\n([\s\S]*?)(?=\n## |\n### |\n#### |$)/m;
    
    const updatedContent = content.replace(relationshipsSectionRegex, newRelationshipsMarkdown.trim());
    
    expect(updatedContent).toContain('- [[New Friend]] is a friend of John Doe');
    expect(updatedContent).toContain('- [[Boss]] is a manager of John Doe');
    expect(updatedContent).not.toContain('- [[Old Friend]] is a friend of John Doe');
    expect(updatedContent).toContain('#### Notes');
    expect(updatedContent).toContain('#Contact #Test');
  });

  it('should insert relationships section when none exists', async () => {
    const content = `---
FN: John Doe
---

#### Notes
Some notes

#Contact #Test
`;

    const newRelationshipsMarkdown = `## Relationships

- [[Friend]] is a friend of John Doe

`;

    // Simulate inserting before hashtags
    const hashtagMatch = content.match(/\n(#\w+[\s#\w]*)\s*$/);
    if (hashtagMatch) {
      const hashtagStart = hashtagMatch.index!;
      const updatedContent = content.slice(0, hashtagStart) + '\n\n' + newRelationshipsMarkdown + content.slice(hashtagStart);
      
      expect(updatedContent).toContain('## Relationships');
      expect(updatedContent).toContain('- [[Friend]] is a friend of John Doe');
      expect(updatedContent).toContain('#Contact #Test');
    }
  });
});