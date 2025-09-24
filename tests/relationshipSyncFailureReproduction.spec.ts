import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipSyncManager } from '../src/relationships/relationshipSyncManager';
import { RelationshipContentParser } from '../src/relationships/relationshipContentParser';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';
import { TFile } from 'obsidian';

// Mock the updateFrontMatterValue function
vi.mock('../src/contacts/contactFrontmatter', () => ({
  updateFrontMatterValue: vi.fn().mockResolvedValue(undefined)
}));

// Mock logging service
vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Relationship Sync Failure Reproduction', () => {
  let syncManager: RelationshipSyncManager;
  let contentParser: RelationshipContentParser;
  let graph: RelationshipGraph;
  let mockApp: any;
  let mockFile: TFile;

  beforeEach(() => {
    // Create mock app with vault and metadataCache
    mockApp = {
      vault: {
        read: vi.fn(),
        getMarkdownFiles: vi.fn().mockReturnValue([]),
        getAbstractFileByPath: vi.fn().mockReturnValue(null)
      },
      metadataCache: {
        getFileCache: vi.fn()
      }
    };

    // Create mock file
    mockFile = {
      path: 'Contacts/John Doe.md',
      basename: 'John Doe'
    } as TFile;

    // Initialize components
    graph = new RelationshipGraph();
    syncManager = new RelationshipSyncManager(mockApp, graph);
    contentParser = new RelationshipContentParser(mockApp);
  });

  it('should sync Related list relationships to front matter when contacts are not found in graph', async () => {
    // Setup: Contact file with existing front matter and Related list that has more relationships
    const existingFrontMatter = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      'RELATED[parent]': 'Jane Doe'  // Only one relationship in front matter
    };

    const fileContent = `---
UID: john-doe-123
FN: John Doe
RELATED[parent]: Jane Doe
---

# John Doe

## Related
- mother [[Jane Doe]]
- father [[Bob Doe]]
- sister [[Alice Doe]]
- friend [[Charlie Smith]]
`;

    // Mock file cache to return existing front matter
    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: existingFrontMatter
    });

    // Mock vault.read to return the file content
    mockApp.vault.read.mockResolvedValue(fileContent);

    // Parse the Related section from the content
    const relatedSection = contentParser.extractRelatedSection(fileContent);
    expect(relatedSection).toBeTruthy();
    
    const relationships = contentParser.parseRelatedSection(relatedSection!);
    expect(relationships).toHaveLength(4); // mother, father, sister, friend

    // Log the relationships found
    console.log('Found relationships:', relationships);

    // Add the main contact to graph
    graph.addContact('john-doe-123', 'John Doe', 'M', mockFile);

    // Call the merge method directly
    await syncManager.mergeRelatedListToFrontmatter(mockFile, relationships);

    // Verify that the updateFrontMatterValue was called for the new relationships
    const { updateFrontMatterValue } = await import('../src/contacts/contactFrontmatter');
    
    // Should have been called to clear existing fields and set new ones
    expect(updateFrontMatterValue).toHaveBeenCalled();
    
    // Get all the calls to updateFrontMatterValue
    const calls = vi.mocked(updateFrontMatterValue).mock.calls;
    console.log('updateFrontMatterValue calls:', calls);
    
    // Should have calls for setting the new relationships
    const setCalls = calls.filter(call => call[2] !== ''); // Non-empty values
    expect(setCalls.length).toBeGreaterThan(1); // Should have multiple relationships
    
    // Verify that all relationships from Related list are represented
    const setCallValues = setCalls.map(call => call[2]);
    expect(setCallValues).toContain('Jane Doe'); // mother (should be normalized to parent)
    expect(setCallValues).toContain('Bob Doe');  // father (should be normalized to parent)
    expect(setCallValues).toContain('Alice Doe'); // sister (should be normalized to sibling)
    expect(setCallValues).toContain('Charlie Smith'); // friend
  });

  it('should handle relationships where contact names resolve to UIDs', async () => {
    // Setup: Add target contacts to the graph so they can be found by UID
    graph.addContact('jane-doe-456', 'Jane Doe', 'F');
    graph.addContact('bob-doe-789', 'Bob Doe', 'M');

    const existingFrontMatter = {
      UID: 'john-doe-123',
      FN: 'John Doe'
      // No existing RELATED fields
    };

    const fileContent = `---
UID: john-doe-123
FN: John Doe
---

# John Doe

## Related
- mother [[Jane Doe]]
- father [[Bob Doe]]
`;

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: existingFrontMatter
    });

    mockApp.vault.read.mockResolvedValue(fileContent);

    const relatedSection = contentParser.extractRelatedSection(fileContent);
    const relationships = contentParser.parseRelatedSection(relatedSection!);
    
    graph.addContact('john-doe-123', 'John Doe', 'M', mockFile);

    await syncManager.mergeRelatedListToFrontmatter(mockFile, relationships);

    const { updateFrontMatterValue } = await import('../src/contacts/contactFrontmatter');
    const calls = vi.mocked(updateFrontMatterValue).mock.calls;
    
    // Should have calls to set relationships with UIDs instead of names
    const setCalls = calls.filter(call => call[2] !== '');
    expect(setCalls.length).toBeGreaterThan(0);
    
    const setCallValues = setCalls.map(call => call[2]);
    // Should contain the UIDs of the found contacts
    expect(setCallValues).toContain('jane-doe-456');
    expect(setCallValues).toContain('bob-doe-789');
  });

  it('should preserve existing front matter relationships while adding new ones from Related list', async () => {
    const existingFrontMatter = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      'RELATED[parent]': 'existing-parent-uid',
      'RELATED[1:friend]': 'existing-friend-uid'
    };

    const fileContent = `---
UID: john-doe-123
FN: John Doe
RELATED[parent]: existing-parent-uid
RELATED[1:friend]: existing-friend-uid
---

# John Doe

## Related
- mother [[New Mother]]
- friend [[New Friend]]
`;

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: existingFrontMatter
    });

    const relatedSection = contentParser.extractRelatedSection(fileContent);
    const relationships = contentParser.parseRelatedSection(relatedSection!);
    
    graph.addContact('john-doe-123', 'John Doe', 'M', mockFile);

    await syncManager.mergeRelatedListToFrontmatter(mockFile, relationships);

    const { updateFrontMatterValue } = await import('../src/contacts/contactFrontmatter');
    const calls = vi.mocked(updateFrontMatterValue).mock.calls;
    
    const setCalls = calls.filter(call => call[2] !== '');
    const setCallValues = setCalls.map(call => call[2]);
    
    // Should preserve existing relationships
    expect(setCallValues).toContain('existing-parent-uid');
    expect(setCallValues).toContain('existing-friend-uid');
    
    // Should add new relationships
    expect(setCallValues).toContain('New Mother');
    expect(setCallValues).toContain('New Friend');
    
    // Should have more relationships than just the existing ones
    expect(setCalls.length).toBeGreaterThan(2);
  });
});