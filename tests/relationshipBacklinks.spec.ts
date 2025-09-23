import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getReciprocalRelationshipKind, 
  shouldHaveReciprocalRelationship 
} from 'src/util/relationshipKinds';
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
        if (file.path === 'john.md') {
          return {
            frontmatter: {
              UID: '12345',
              FN: 'John Doe',
              'RELATED[friend]': 'RELATED;TYPE=friend:name:Alice Smith'
            }
          };
        } else if (file.path === 'alice.md') {
          return {
            frontmatter: {
              UID: '67890',
              FN: 'Alice Smith'
              // Missing reciprocal friend relationship
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
        target: 'name:Alice Smith',
        key: 'RELATED[friend]'
      });
    }
    return relationships;
  })
}));

describe('Relationship Backlink Verification', () => {
  let service: RelationshipGraphService;

  beforeEach(() => {
    service = new RelationshipGraphService();
    vi.clearAllMocks();
  });

  it('should identify reciprocal relationship kinds correctly', () => {
    expect(getReciprocalRelationshipKind('friend')).toBe('friend');
    expect(getReciprocalRelationshipKind('parent')).toBe('child');
    expect(getReciprocalRelationshipKind('child')).toBe('parent');
    expect(getReciprocalRelationshipKind('sibling')).toBe('sibling');
    expect(getReciprocalRelationshipKind('spouse')).toBe('spouse');
    expect(getReciprocalRelationshipKind('grandparent')).toBe('grandchild');
    expect(getReciprocalRelationshipKind('auncle')).toBe('auncle');
    expect(getReciprocalRelationshipKind('contact')).toBe(null); // No reciprocal
  });

  it('should identify which relationships should have reciprocals', () => {
    expect(shouldHaveReciprocalRelationship('friend')).toBe(true);
    expect(shouldHaveReciprocalRelationship('parent')).toBe(true);
    expect(shouldHaveReciprocalRelationship('sibling')).toBe(true);
    expect(shouldHaveReciprocalRelationship('contact')).toBe(false);
  });

  it('should detect and add missing reciprocal relationships', async () => {
    // Create contacts with asymmetric relationships
    const john = { uid: '12345', fullName: 'John Doe', file: { path: 'john.md' } };
    const alice = { uid: '67890', fullName: 'Alice Smith', file: { path: 'alice.md' } };

    service.addContactNode('name:John Doe', john);
    service.addContactNode('name:Alice Smith', alice);

    // John has Alice as friend, but Alice doesn't have John as friend (missing backlink)
    service.addRelationship('name:John Doe', 'name:Alice Smith', 'friend');

    // Get relationships before backlink verification
    const johnRelsBefore = service.getContactRelationships('name:John Doe');
    const aliceRelsBefore = service.getContactRelationships('name:Alice Smith');

    expect(johnRelsBefore).toHaveLength(1);
    expect(aliceRelsBefore).toHaveLength(0); // Missing reciprocal

    // Run backlink verification
    await service.verifyAndAddMissingBacklinks();

    // Get relationships after backlink verification
    const johnRelsAfter = service.getContactRelationships('name:John Doe');
    const aliceRelsAfter = service.getContactRelationships('name:Alice Smith');

    expect(johnRelsAfter).toHaveLength(1); // Should remain the same
    expect(aliceRelsAfter).toHaveLength(1); // Should now have reciprocal relationship

    expect(aliceRelsAfter[0].kind).toBe('friend');
    expect(aliceRelsAfter[0].targetContactId).toBe('name:John Doe');

    const { updateContactRelatedFrontMatter } = await import('src/util/relationshipFrontMatter');
    expect(updateContactRelatedFrontMatter).toHaveBeenCalled();
  });

  it('should handle parent-child reciprocal relationships correctly', async () => {
    const parent = { uid: '11111', fullName: 'Parent Person', file: { path: 'parent.md' } };
    const child = { uid: '22222', fullName: 'Child Person', file: { path: 'child.md' } };

    service.addContactNode('name:Parent Person', parent);
    service.addContactNode('name:Child Person', child);

    // Parent has child relationship, but child is missing parent relationship
    service.addRelationship('name:Parent Person', 'name:Child Person', 'parent');

    await service.verifyAndAddMissingBacklinks();

    const childRels = service.getContactRelationships('name:Child Person');
    expect(childRels).toHaveLength(1);
    expect(childRels[0].kind).toBe('child'); // Reciprocal of parent is child
    expect(childRels[0].targetContactId).toBe('name:Parent Person');
  });

  it('should not add reciprocal for non-reciprocal relationships', async () => {
    const contact1 = { uid: '33333', fullName: 'Contact One', file: { path: 'contact1.md' } };
    const contact2 = { uid: '44444', fullName: 'Contact Two', file: { path: 'contact2.md' } };

    service.addContactNode('name:Contact One', contact1);
    service.addContactNode('name:Contact Two', contact2);

    // Contact relationship is not reciprocal by design
    service.addRelationship('name:Contact One', 'name:Contact Two', 'contact');

    await service.verifyAndAddMissingBacklinks();

    const contact2Rels = service.getContactRelationships('name:Contact Two');
    expect(contact2Rels).toHaveLength(0); // Should not have added reciprocal
  });
});