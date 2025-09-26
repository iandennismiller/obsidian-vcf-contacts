import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';
import {
  parseFrontmatterRelationships,
  updateRelatedSectionInContent,
  syncFrontmatterToRelatedList
} from 'src/util/relatedListSync';

// Mock dependencies
vi.mock('obsidian', () => ({
  TFile: vi.fn(),
  App: vi.fn(),
  Notice: vi.fn()
}));

vi.mock('src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('src/util/relatedFieldUtils', () => ({
  formatRelatedValue: vi.fn((uid: string, name: string) => {
    if (uid) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(uid)) {
        return `urn:uuid:${uid}`;
      }
      return `uid:${uid}`;
    }
    return `name:${name}`;
  }),
  extractRelationshipType: vi.fn((key: string) => {
    const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return typeMatch ? typeMatch[1] || 'related' : 'related';
  }),
  parseRelatedValue: vi.fn((value: string) => {
    if (value.startsWith('urn:uuid:')) {
      return { type: 'uuid', value: value.substring(9) };
    } else if (value.startsWith('uid:')) {
      return { type: 'uid', value: value.substring(4) };
    } else if (value.startsWith('name:')) {
      return { type: 'name', value: value.substring(5) };
    }
    return null;
  })
}));

describe('Frontmatter to Related List Sync', () => {
  describe('parseFrontmatterRelationships', () => {
    it('should parse RELATED fields from frontmatter', () => {
      const frontmatter = {
        UID: 'test-uid',
        FN: 'John Doe',
        'RELATED[parent]': 'name:Jane Doe',
        'RELATED[1:parent]': 'uid:bob-doe-123',
        'RELATED[friend]': 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af',
        'RELATED[colleague]': 'name:Alice Smith'
      };

      const relationships = parseFrontmatterRelationships(frontmatter);
      
      expect(relationships).toHaveLength(4);
      
      expect(relationships[0]).toEqual({
        type: 'parent',
        value: 'name:Jane Doe',
        parsedValue: { type: 'name', value: 'Jane Doe' }
      });
      
      expect(relationships[1]).toEqual({
        type: 'parent',
        value: 'uid:bob-doe-123',
        parsedValue: { type: 'uid', value: 'bob-doe-123' }
      });
      
      expect(relationships[2]).toEqual({
        type: 'friend',
        value: 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af',
        parsedValue: { type: 'uuid', value: '03a0e51f-d1aa-4385-8a53-e29025acd8af' }
      });
      
      expect(relationships[3]).toEqual({
        type: 'colleague',
        value: 'name:Alice Smith',
        parsedValue: { type: 'name', value: 'Alice Smith' }
      });
    });

    it('should handle empty frontmatter', () => {
      const frontmatter = {
        UID: 'test-uid',
        FN: 'John Doe'
      };

      const relationships = parseFrontmatterRelationships(frontmatter);
      expect(relationships).toHaveLength(0);
    });

    it('should skip invalid RELATED values', () => {
      const frontmatter = {
        'RELATED[parent]': 'name:Jane Doe',
        'RELATED[friend]': 'invalid-value-format',
        'RELATED[colleague]': null
      };

      const relationships = parseFrontmatterRelationships(frontmatter);
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('parent');
    });
  });

  describe('updateRelatedSectionInContent', () => {
    it('should update existing Related section', () => {
      const content = `---
FN: John Doe
UID: test-uid
---

## Related
- friend [[Alice Smith]]

## Notes
Some notes here`;

      const relationships = [
        { type: 'friend', contactName: 'Alice Smith' },
        { type: 'parent', contactName: 'Jane Doe' },
        { type: 'colleague', contactName: 'Bob Wilson' }
      ];

      const result = updateRelatedSectionInContent(content, relationships);
      
      expect(result).toContain('## Related\n- friend [[Alice Smith]]\n- parent [[Jane Doe]]\n- colleague [[Bob Wilson]]');
      expect(result).toContain('## Notes\nSome notes here');
    });

    it('should add Related section when none exists', () => {
      const content = `---
FN: John Doe
UID: test-uid
---

## Notes
Some notes here`;

      const relationships = [
        { type: 'parent', contactName: 'Jane Doe' }
      ];

      const result = updateRelatedSectionInContent(content, relationships);
      
      expect(result).toContain('## Related\n- parent [[Jane Doe]]');
      expect(result).toContain('## Notes\nSome notes here');
    });

    it('should handle empty relationships by creating empty Related section', () => {
      const content = `---
FN: John Doe
---

## Notes
Some notes here`;

      const relationships: { type: string; contactName: string }[] = [];

      const result = updateRelatedSectionInContent(content, relationships);
      
      expect(result).toContain('## Related\n\n');
      expect(result).toContain('## Notes\nSome notes here');
    });

    it('should add Related section at the end when no other sections exist', () => {
      const content = `---
FN: John Doe
---

Just some content without sections`;

      const relationships = [
        { type: 'friend', contactName: 'Alice Smith' }
      ];

      const result = updateRelatedSectionInContent(content, relationships);
      
      expect(result).toContain('Just some content without sections\n\n## Related\n- friend [[Alice Smith]]');
    });
  });

  describe('syncFrontmatterToRelatedList', () => {
    let mockApp: Partial<App>;
    let mockFile: TFile;

    beforeEach(() => {
      vi.clearAllMocks();
      
      mockApp = {
        vault: {
          read: vi.fn(),
          modify: vi.fn(),
          getMarkdownFiles: vi.fn().mockReturnValue([])
        } as any,
        metadataCache: {
          getFileCache: vi.fn()
        } as any
      };

      mockFile = {
        basename: 'John Doe',
        path: 'Contacts/John Doe.md'
      } as TFile;
    });

    it('should sync missing relationships from frontmatter to Related list', async () => {
      const content = `---
FN: John Doe
UID: john-doe-123
RELATED[parent]: name:Jane Doe
RELATED[friend]: name:Alice Smith
---

## Related
- parent [[Jane Doe]]

## Notes
Some notes`;

      const frontmatter = {
        FN: 'John Doe',
        UID: 'john-doe-123',
        'RELATED[parent]': 'name:Jane Doe',
        'RELATED[friend]': 'name:Alice Smith'
      };

      (mockApp.vault!.read as any).mockResolvedValue(content);
      (mockApp.metadataCache!.getFileCache as any).mockReturnValue({ frontmatter });

      const result = await syncFrontmatterToRelatedList(mockApp as App, mockFile, 'Contacts');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have called modify with updated content including the missing friend relationship
      expect(mockApp.vault!.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('- friend [[Alice Smith]]')
      );
    });

    it('should not modify content when no missing relationships', async () => {
      const content = `---
FN: John Doe
UID: john-doe-123
RELATED[parent]: name:Jane Doe
---

## Related
- parent [[Jane Doe]]

## Notes
Some notes`;

      const frontmatter = {
        FN: 'John Doe',
        UID: 'john-doe-123',
        'RELATED[parent]': 'name:Jane Doe'
      };

      (mockApp.vault!.read as any).mockResolvedValue(content);
      (mockApp.metadataCache!.getFileCache as any).mockReturnValue({ frontmatter });

      const result = await syncFrontmatterToRelatedList(mockApp as App, mockFile, 'Contacts');

      expect(result.success).toBe(true);
      expect(mockApp.vault!.modify).not.toHaveBeenCalled();
    });

    it('should handle files with no frontmatter relationships', async () => {
      const content = `---
FN: John Doe
UID: john-doe-123
---

## Notes
Some notes`;

      const frontmatter = {
        FN: 'John Doe',
        UID: 'john-doe-123'
      };

      (mockApp.vault!.read as any).mockResolvedValue(content);
      (mockApp.metadataCache!.getFileCache as any).mockReturnValue({ frontmatter });

      const result = await syncFrontmatterToRelatedList(mockApp as App, mockFile, 'Contacts');

      expect(result.success).toBe(true);
      expect(mockApp.vault!.modify).not.toHaveBeenCalled();
    });

    it('should create Related section when none exists', async () => {
      const content = `---
FN: John Doe
UID: john-doe-123
RELATED[friend]: name:Alice Smith
---

## Notes
Some notes`;

      const frontmatter = {
        FN: 'John Doe',
        UID: 'john-doe-123',
        'RELATED[friend]': 'name:Alice Smith'
      };

      (mockApp.vault!.read as any).mockResolvedValue(content);
      (mockApp.metadataCache!.getFileCache as any).mockReturnValue({ frontmatter });

      const result = await syncFrontmatterToRelatedList(mockApp as App, mockFile, 'Contacts');

      expect(result.success).toBe(true);
      
      // Should create Related section with the relationship
      expect(mockApp.vault!.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('## Related\n- friend [[Alice Smith]]')
      );
    });
  });
});