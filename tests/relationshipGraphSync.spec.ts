import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationshipGraphService } from 'src/services/relationshipGraph';

// Mock dependencies
vi.mock('src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => ({
    metadataCache: {
      getFileCache: vi.fn((file) => {
        if (file.path === 'contact1.md') {
          return {
            frontmatter: {
              UID: '12345',
              FN: 'John Doe',
              'RELATED[friend]': 'RELATED;TYPE=friend:name:Jane Smith',
              'RELATED[colleague]': 'RELATED;TYPE=colleague:name:Bob Wilson'
            }
          };
        } else if (file.path === 'contact2.md') {
          return {
            frontmatter: {
              UID: '67890',
              FN: 'Jane Smith',
              'RELATED[friend]': 'RELATED;TYPE=friend:name:John Doe'
            }
          };
        }
        return null;
      })
    }
  }))
}));

vi.mock('src/util/relationshipFrontMatter', () => ({
  updateContactRelatedFrontMatter: vi.fn(),
  parseRelatedFromFrontMatter: vi.fn((frontMatter) => {
    const relationships = [];
    if (frontMatter['RELATED[friend]']) {
      relationships.push({
        kind: 'friend',
        target: 'name:Jane Smith',
        key: 'RELATED[friend]'
      });
    }
    if (frontMatter['RELATED[colleague]']) {
      relationships.push({
        kind: 'colleague', 
        target: 'name:Bob Wilson',
        key: 'RELATED[colleague]'
      });
    }
    return relationships;
  })
}));

describe('RelationshipGraphService Sync Verification', () => {
  let service: RelationshipGraphService;

  beforeEach(() => {
    service = new RelationshipGraphService();
    vi.clearAllMocks();
  });

  it('should detect when graph and front matter are out of sync', () => {
    const graphRelationships = [
      { kind: 'friend', targetContactId: 'name:Jane Smith' },
      { kind: 'colleague', targetContactId: 'name:Bob Wilson' },
      { kind: 'parent', targetContactId: 'name:Mary Doe' } // Extra relationship in graph
    ];

    const frontMatterRelationships = [
      { kind: 'friend', target: 'name:Jane Smith' },
      { kind: 'colleague', target: 'name:Bob Wilson' }
    ];

    const needsSync = (service as any).compareRelationships(graphRelationships, frontMatterRelationships);
    expect(needsSync).toBe(true);
  });

  it('should detect when graph and front matter are in sync', () => {
    const graphRelationships = [
      { kind: 'friend', targetContactId: 'name:Jane Smith' },
      { kind: 'colleague', targetContactId: 'name:Bob Wilson' }
    ];

    const frontMatterRelationships = [
      { kind: 'friend', target: 'name:Jane Smith' },
      { kind: 'colleague', target: 'name:Bob Wilson' }
    ];

    const needsSync = (service as any).compareRelationships(graphRelationships, frontMatterRelationships);
    expect(needsSync).toBe(false);
  });

  it('should sync all contacts when syncAllContactsWithFrontMatter is called', async () => {
    // Add some test contacts to the graph
    const contact1 = { uid: '12345', fullName: 'John Doe', file: { path: 'contact1.md' } };
    const contact2 = { uid: '67890', fullName: 'Jane Smith', file: { path: 'contact2.md' } };

    service.addContactNode('uid:12345', contact1);
    service.addContactNode('uid:67890', contact2);

    // Add relationships that might differ from front matter
    service.addRelationship('uid:12345', 'uid:67890', 'friend');
    service.addRelationship('uid:12345', 'name:Bob Wilson', 'colleague');
    service.addRelationship('uid:12345', 'name:Extra Person', 'parent'); // This won't be in front matter

    await service.syncAllContactsWithFrontMatter();

    const { updateContactRelatedFrontMatter } = await import('src/util/relationshipFrontMatter');
    expect(updateContactRelatedFrontMatter).toHaveBeenCalled();
  });

  it('should provide correct graph statistics', () => {
    const contact1 = { uid: '12345', fullName: 'John Doe' };
    const contact2 = { uid: '67890', fullName: 'Jane Smith' };

    service.addContactNode('uid:12345', contact1);
    service.addContactNode('uid:67890', contact2);
    service.addRelationship('uid:12345', 'uid:67890', 'friend');

    const stats = service.getGraphStats();
    expect(stats.nodeCount).toBe(2);
    expect(stats.edgeCount).toBe(1);
  });
});