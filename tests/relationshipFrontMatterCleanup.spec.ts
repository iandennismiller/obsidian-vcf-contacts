import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/relationships/relationshipManager';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';
import type { ContactsPluginSettings } from '../src/settings/settings.d';

const mockSettings: ContactsPluginSettings = {
  contactsFolder: 'Contacts',
  defaultHashtag: '',
  vcfWatchFolder: '',
  vcfWatchEnabled: false,
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO',
};

describe('RelationshipManager Front Matter Cleanup', () => {
  let mockApp: any;
  let graph: RelationshipGraph;
  let manager: RelationshipManager;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn()
      },
      workspace: {
        on: vi.fn()
      }
    };
    
    manager = new RelationshipManager(mockApp, mockSettings);
    graph = (manager as any).graph;
  });

  it('should not add RELATED fields with blank values', () => {
    // Test that blank values are filtered out during parsing
    const frontmatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe',
      'RELATED[1:child]': '', // Blank value
      'RELATED[2:sibling]': '   ', // Whitespace only
      'RELATED[3:friend]': null, // Null value
      'RELATED[4:spouse]': undefined // Undefined value
    };

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const result = parseMethod(frontmatter);

    // Should only include the parent relationship, not the blank ones
    expect(result).toEqual([
      { type: 'parent', value: 'Jane Doe' }
    ]);
  });

  it('should handle orphaned array indices with invalid relationship kinds', () => {
    // Test parsing front matter with invalid relationship types
    const frontmatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe',
      'RELATED[1:doesnotexist]': 'Invalid Person', // Invalid relationship type
      'RELATED[2:anotherbadtype]': 'Another Invalid', // Another invalid type
      'RELATED[3:child]': 'Valid Child'
    };

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const result = parseMethod(frontmatter);

    // Should only include valid relationship types
    expect(result).toEqual([
      { type: 'parent', value: 'Jane Doe' },
      { type: 'child', value: 'Valid Child' }
    ]);
  });

  it('should clean up front matter by filtering out blank and invalid values', () => {
    // Test that the parsing logic properly filters out problematic entries
    const frontmatter = {
      UID: 'test-uid',
      'RELATED[parent]': 'Jane Doe',           // Valid
      'RELATED[1:child]': '',                  // Blank - should be filtered
      'RELATED[2:sibling]': '   ',             // Whitespace only - should be filtered  
      'RELATED[3:doesnotexist]': 'Person',     // Invalid type - should be filtered
      'RELATED[4:spouse]': null,               // Null - should be filtered
      'RELATED[5:friend]': 'Valid Friend',     // Valid
      'RELATED[6:badtype]': 'Invalid Type'     // Invalid type - should be filtered
    };

    const parseMethod = (manager as any).parseRelatedFromFrontmatter.bind(manager);
    const result = parseMethod(frontmatter);

    // Should only include valid relationship types with non-blank values
    expect(result).toEqual([
      { type: 'parent', value: 'Jane Doe' },
      { type: 'friend', value: 'Valid Friend' }
    ]);
  });
});