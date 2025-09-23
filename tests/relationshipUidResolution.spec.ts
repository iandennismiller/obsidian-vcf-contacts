import { describe, it, expect, vi } from 'vitest';
import { frontMatterToRelationshipList, findContactByUid } from 'src/util/relationshipMarkdown';

// Mock dependencies
vi.mock('src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => ({
    vault: {
      getMarkdownFiles: vi.fn(() => [
        { path: 'john-doe.md' },
        { path: 'jane-smith.md' }
      ])
    },
    metadataCache: {
      getFileCache: vi.fn((file) => {
        if (file.path === 'john-doe.md') {
          return {
            frontmatter: {
              UID: '12345-abcde',
              FN: 'John Doe',
              GENDER: 'male'
            }
          };
        } else if (file.path === 'jane-smith.md') {
          return {
            frontmatter: {
              UID: '67890-fghij',
              FN: 'Jane Smith',
              GENDER: 'female'
            }
          };
        }
        return null;
      })
    }
  }))
}));

vi.mock('src/services/relationshipGraph', () => ({
  relationshipGraphService: {
    parseContactReference: vi.fn((ref) => {
      if (ref.startsWith('urn:uuid:')) {
        return { namespace: 'urn:uuid', value: ref.substring(9) };
      } else if (ref.startsWith('name:')) {
        return { namespace: 'name', value: ref.substring(5) };
      }
      return null;
    }),
    getContactNode: vi.fn(() => null) // Simulate contact not in graph
  }
}));

vi.mock('src/util/relationshipKinds', () => ({
  getGenderedRelationshipKind: vi.fn((kind, gender) => {
    if (kind === 'auncle' && gender === 'male') return 'uncle';
    if (kind === 'auncle' && gender === 'female') return 'aunt';
    return kind;
  })
}));

describe('Relationship List UID Resolution', () => {
  it('should resolve UID references to contact names in Related list', () => {
    const relationships = [
      {
        kind: 'friend',
        target: 'urn:uuid:12345-abcde',
        key: 'RELATED[friend]'
      },
      {
        kind: 'auncle',
        target: 'urn:uuid:67890-fghij', 
        key: 'RELATED[auncle]'
      }
    ];

    const result = frontMatterToRelationshipList(relationships);

    expect(result).toHaveLength(2);
    expect(result[0].targetName).toBe('John Doe'); // Should be name, not UID
    expect(result[0].targetLink).toBe('[[John Doe]]');
    expect(result[1].targetName).toBe('Jane Smith'); // Should be name, not UID
    expect(result[1].targetLink).toBe('[[Jane Smith]]');
    expect(result[1].kind).toBe('aunt'); // Should use gendered form
  });

  it('should find contact by UID', () => {
    const contact = findContactByUid('12345-abcde');
    expect(contact).toEqual({ path: 'john-doe.md' });
  });
});