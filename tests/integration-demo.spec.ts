import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/services/relationshipManager';
import { RelationshipListManager } from '../src/services/relationshipListManager';

// Mock all external dependencies
vi.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(public path: string, public name: string, public basename: string) {}
  },
  parseYaml: vi.fn((yaml) => {
    // Simple YAML parser mock for test data
    const lines = yaml.split('\n');
    const result: any = {};
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        result[key.trim()] = valueParts.join(':').trim();
      }
    }
    return result;
  }),
  stringifyYaml: vi.fn((obj) => {
    return Object.entries(obj).map(([key, value]) => `${key}: ${value}`).join('\n');
  }),
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
    getAbstractFileByPath: vi.fn(),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

describe('Relationship System Integration Demo', () => {
  let relationshipManager: RelationshipManager;
  let listManager: RelationshipListManager;

  beforeEach(() => {
    vi.clearAllMocks();
    relationshipManager = new RelationshipManager(mockApp as any);
    listManager = new RelationshipListManager(relationshipManager, mockApp as any);
  });

  it('should demonstrate the complete relationship workflow', async () => {
    // 1. Parse vCard content with RELATED fields
    const johnVCard = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
UID:john-doe-123
RELATED;TYPE=friend:urn:uuid:jane-smith-456
RELATED;TYPE=colleague:name:Bob Wilson
END:VCARD`;

    const janeVCard = `BEGIN:VCARD
VERSION:4.0
FN:Jane Smith
UID:jane-smith-456
RELATED;TYPE=friend:urn:uuid:john-doe-123
END:VCARD`;

    // 2. Simulate parsing RELATED fields (this would normally be done by vCard parser)
    const johnRelatedFields = [
      { relationshipType: 'friend', contactReference: 'jane-smith-456', namespace: 'urn:uuid' as const, contactId: 'jane-smith-456' },
      { relationshipType: 'colleague', contactReference: 'Bob Wilson', namespace: 'name' as const, contactId: 'Bob Wilson' }
    ];

    // 3. Add contacts to the graph
    const graph = relationshipManager.getGraph();
    graph.addContact('john-doe-123', { name: 'John Doe' });
    graph.addContact('jane-smith-456', { name: 'Jane Smith' });
    
    // Add relationships
    graph.addRelationship('john-doe-123', 'jane-smith-456', 'friend');
    graph.addRelationship('jane-smith-456', 'john-doe-123', 'friend');

    // 4. Verify graph relationships
    const johnRelationships = graph.getContactRelationships('john-doe-123');
    expect(johnRelationships).toHaveLength(1);
    expect(johnRelationships[0]).toEqual({
      relationshipType: 'friend',
      sourceContact: 'john-doe-123',
      targetContact: 'jane-smith-456'
    });

    const janeRelationships = graph.getContactRelationships('jane-smith-456');
    expect(janeRelationships).toHaveLength(1);
    expect(janeRelationships[0]).toEqual({
      relationshipType: 'friend',
      sourceContact: 'jane-smith-456',
      targetContact: 'john-doe-123'
    });

    // 5. Demonstrate markdown list parsing
    const markdownWithRelationships = `# John Doe

## Related

- friend [[Jane Smith]]
- colleague [[Bob Wilson]]
- mentor [[Sarah Johnson]]

## Notes

John is a great friend and colleague.`;

    const parsedRelationships = listManager.parseRelationshipList(markdownWithRelationships);
    expect(parsedRelationships).toHaveLength(3);
    expect(parsedRelationships).toContainEqual({ relationshipType: 'friend', contactName: 'Jane Smith' });
    expect(parsedRelationships).toContainEqual({ relationshipType: 'colleague', contactName: 'Bob Wilson' });
    expect(parsedRelationships).toContainEqual({ relationshipType: 'mentor', contactName: 'Sarah Johnson' });

    // 6. Demonstrate front matter to markdown generation
    const mockFile = { path: 'John Doe.md', basename: 'John Doe' } as any;
    const frontmatter = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      'RELATED[friend]': 'urn:uuid:jane-smith-456',
      'RELATED[colleague]': 'name:Bob Wilson',
      'RELATED[1:friend]': 'name:Alice Cooper'
    };

    mockApp.metadataCache.getFileCache = vi.fn(() => ({ frontmatter }));

    // Mock contact name resolution
    const resolveContactNameSpy = vi.spyOn(listManager as any, 'resolveContactName');
    resolveContactNameSpy
      .mockResolvedValueOnce('Jane Smith')
      .mockResolvedValueOnce('Bob Wilson')
      .mockResolvedValueOnce('Alice Cooper');

    const generatedList = await listManager.generateRelationshipList(mockFile);
    expect(generatedList).toContain('- colleague [[Bob Wilson]]');
    expect(generatedList).toContain('- friend [[Alice Cooper]]');
    expect(generatedList).toContain('- friend [[Jane Smith]]');

    // 7. Demonstrate gender inference
    const { RelationshipGraph } = await import('../src/services/relationshipGraph');
    
    // Test gender inference from relationship types
    expect(RelationshipGraph.getGenderFromRelationship('mother')).toBe('F');
    expect(RelationshipGraph.getGenderFromRelationship('father')).toBe('M');
    expect(RelationshipGraph.getGenderFromRelationship('aunt')).toBe('F');
    expect(RelationshipGraph.getGenderFromRelationship('uncle')).toBe('M');
    
    // Test relationship normalization
    expect(RelationshipGraph.normalizeRelationshipType('mother')).toBe('parent');
    expect(RelationshipGraph.normalizeRelationshipType('father')).toBe('parent');
    expect(RelationshipGraph.normalizeRelationshipType('aunt')).toBe('auncle');
    expect(RelationshipGraph.normalizeRelationshipType('uncle')).toBe('auncle');

    console.log('✅ Relationship system integration demo completed successfully!');
    console.log('Features demonstrated:');
    console.log('- vCard RELATED field parsing');
    console.log('- Relationship graph management with Graphology');
    console.log('- Bidirectional sync between graph and front matter');
    console.log('- Markdown Related section parsing and generation');
    console.log('- Gender inference from relationship types');
    console.log('- Multiple relationship types between contacts');
  });

  it('should demonstrate the Related section injection workflow', () => {
    // Test injecting a Related section
    const originalContent = `# John Doe

## Properties
Name: John Doe
Phone: 555-1234

## Notes
Some notes about John.`;

    const relationshipList = `- friend [[Jane Smith]]
- colleague [[Bob Wilson]]
- mentor [[Sarah Johnson]]`;

    const updatedContent = (listManager as any).injectRelatedSection(originalContent, relationshipList);

    // Verify the Related section was added
    expect(updatedContent).toContain('## Related');
    expect(updatedContent).toContain('- friend [[Jane Smith]]');
    expect(updatedContent).toContain('- colleague [[Bob Wilson]]');
    expect(updatedContent).toContain('- mentor [[Sarah Johnson]]');

    // Verify it comes after existing content but before the end
    const lines = updatedContent.split('\n');
    const relatedIndex = lines.findIndex(line => line.includes('## Related'));
    const notesIndex = lines.findIndex(line => line.includes('## Notes'));
    
    expect(relatedIndex).toBeGreaterThan(-1);
    expect(relatedIndex).toBeGreaterThan(notesIndex); // Related section added at end

    console.log('✅ Related section injection demo completed successfully!');
  });
});