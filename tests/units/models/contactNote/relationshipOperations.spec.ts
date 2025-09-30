import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationshipOperations } from '../../../../src/models/contactNote/relationshipOperations';
import { ContactData } from '../../../../src/models/contactNote/contactData';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../../../../src/settings/settings.d';

// Mock TFile properly for instanceof checks
vi.mock('obsidian', () => ({
  TFile: class MockTFile {
    constructor(public basename: string, public path: string) {
      this.name = path.split('/').pop() || basename;
    }
    basename: string;
    path: string;
    name: string;
  },
  App: class MockApp {}
}));

describe('RelationshipOperations', () => {
  let mockContactData: Partial<ContactData>;
  let mockFile: TFile;
  let relationshipOperations: RelationshipOperations;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFile = new (TFile as any)('john-doe', 'Contacts/john-doe.md');

    mockContactData = {
      getContent: vi.fn(),
      updateContent: vi.fn(),
      getFrontmatter: vi.fn(),
      file: mockFile,
      getApp: vi.fn().mockReturnValue({
        vault: {
          getMarkdownFiles: vi.fn(),
          getAbstractFileByPath: vi.fn()
        },
        metadataCache: {
          getFileCache: vi.fn()
        }
      })
    };

    relationshipOperations = new RelationshipOperations(mockContactData as ContactData);
  });

  describe('parseRelatedSection', () => {
    it('should parse relationships from Related section', async () => {
      const content = `---
UID: john-doe-123
FN: John Doe
---

#### Related
- father: [[Bob Doe]]
- mother: [[Mary Doe]]
- spouse: [[Jane Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toHaveLength(3);
      expect(relationships[0]).toEqual({
        type: 'father',
        contactName: 'Bob Doe',
        linkType: 'name'
      });
      expect(relationships[1]).toEqual({
        type: 'mother',
        contactName: 'Mary Doe',
        linkType: 'name'
      });
    });

    it('should handle empty Related section', async () => {
      const content = `---
UID: john-doe-123
FN: John Doe
---

#### Notes
Some notes here.

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toEqual([]);
    });

    it('should handle multiple relationship formats', async () => {
      const content = `---
UID: john-doe-123
---

#### Related
- father: [[Bob Doe]]
- [[Jane Doe]] (spouse)

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toHaveLength(2);
      expect(relationships[0].contactName).toBe('Bob Doe');
      expect(relationships[0].type).toBe('father');
      expect(relationships[1].contactName).toBe('Jane Doe');
      expect(relationships[1].type).toBe('spouse');
    });

    it('should handle malformed relationship lines gracefully', async () => {
      const content = `---
UID: john-doe-123
---

#### Related
- father: [[Bob Doe]]
- invalid line without proper format
- mother: [[Mary Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toHaveLength(2); // Should skip invalid line
      expect(relationships[0].type).toBe('father');
      expect(relationships[1].type).toBe('mother');
    });
  });

  describe('parseFrontmatterRelationships', () => {
    it('should parse RELATED fields from frontmatter', async () => {
      const frontmatter = {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'RELATED[spouse]': 'name:Jane Doe',
        'RELATED[child]': 'urn:uuid:child-123',
        'RELATED[1:child]': 'name:Tommy Doe'
      };

      mockContactData.getFrontmatter = vi.fn().mockReturnValue(frontmatter);

      const relationships = await relationshipOperations.parseFrontmatterRelationships();

      expect(relationships).toHaveLength(3);
      expect(relationships[0].type).toBe('spouse');
      expect(relationships[0].value).toBe('name:Jane Doe');
      expect(relationships[1].type).toBe('child');
      expect(relationships[1].value).toBe('urn:uuid:child-123');
    });

    it('should handle empty frontmatter', async () => {
      mockContactData.getFrontmatter = vi.fn().mockReturnValue({});

      const relationships = await relationshipOperations.parseFrontmatterRelationships();

      expect(relationships).toEqual([]);
    });

    it('should ignore non-RELATED fields', async () => {
      const frontmatter = {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        'RELATED[spouse]': 'name:Jane Doe'
      };

      mockContactData.getFrontmatter = vi.fn().mockReturnValue(frontmatter);

      const relationships = await relationshipOperations.parseFrontmatterRelationships();

      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('spouse');
    });
  });

  describe('updateRelatedSectionInContent', () => {
    it('should update existing Related section', async () => {
      const originalContent = `---
UID: john-doe-123
---

#### Related
- father: [[Old Father]]

#### Notes
Some notes.

#Contact`;

      const newRelationships = [
        { type: 'father', contactName: 'Bob Doe' },
        { type: 'mother', contactName: 'Mary Doe' }
      ];

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent(newRelationships);

      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('- father: [[Bob Doe]]')
      );
      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('- mother: [[Mary Doe]]')
      );
    });

    it('should add Related section when it does not exist', async () => {
      const originalContent = `---
UID: john-doe-123
---

#### Notes
Some notes.

#Contact`;

      const newRelationships = [
        { type: 'spouse', contactName: 'Jane Doe' }
      ];

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent(newRelationships);

      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('#### Related\n- spouse: [[Jane Doe]]')
      );
    });

    it('should handle empty relationships array', async () => {
      const originalContent = `---
UID: john-doe-123
---

#### Related
- father: [[Bob Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent([]);

      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('#### Related\n\n')
      );
    });
  });

  describe('findContactByName', () => {
    it('should find contact file by name', async () => {
      const mockFiles = [
        { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile,
        { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile
      ];

      const mockApp = mockContactData.getApp!();
      mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);

      const foundFile = await (relationshipOperations as any).findContactByName('Jane Doe');

      expect(foundFile).toBe(mockFiles[1]);
    });

    it('should return null when contact not found', async () => {
      const mockFiles = [
        { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile
      ];

      const mockApp = mockContactData.getApp!();
      mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);

      const foundFile = await (relationshipOperations as any).findContactByName('Nonexistent Contact');

      expect(foundFile).toBeNull();
    });

    it('should handle files outside contacts folder', async () => {
      const mockFiles = [
        { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile,
        { basename: 'jane-doe', path: 'Other/jane-doe.md' } as TFile
      ];

      const mockApp = mockContactData.getApp!();
      mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);

      const foundFile = await (relationshipOperations as any).findContactByName('Jane Doe');

      expect(foundFile).toBeNull(); // Should not find files outside contacts folder
    });
  });

  describe('resolveContact', () => {
    it('should resolve contact with UID', async () => {
      const mockFile = { basename: 'jane-doe' } as TFile;
      const mockApp = mockContactData.getApp!();
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { UID: 'jane-doe-456' }
      });

      // Mock findContactByName to return a file
      vi.spyOn(relationshipOperations as any, 'findContactByName').mockResolvedValue(mockFile);

      const resolved = await (relationshipOperations as any).resolveContact('Jane Doe');

      expect(resolved).toEqual({
        name: 'Jane Doe',
        uid: 'jane-doe-456',
        file: mockFile,
        gender: expect.any(Object) // Gender will be resolved by ContactData
      });
    });

    it('should resolve contact without UID', async () => {
      const mockFile = { basename: 'jane-doe' } as TFile;
      const mockApp = mockContactData.getApp!();
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { FN: 'Jane Doe' }
      });

      vi.spyOn(relationshipOperations as any, 'findContactByName').mockResolvedValue(mockFile);

      const resolved = await (relationshipOperations as any).resolveContact('Jane Doe');

      expect(resolved).toEqual({
        name: 'Jane Doe',
        uid: '',
        file: mockFile,
        gender: expect.any(Object)
      });
    });

    it('should return null when contact cannot be resolved', async () => {
      vi.spyOn(relationshipOperations as any, 'findContactByName').mockResolvedValue(null);

      const resolved = await (relationshipOperations as any).resolveContact('Nonexistent Contact');

      expect(resolved).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle content read errors in parseRelatedSection', async () => {
      mockContactData.getContent = vi.fn().mockRejectedValue(new Error('Read error'));

      await expect(relationshipOperations.parseRelatedSection()).rejects.toThrow('Read error');
    });

    it('should handle content update errors in updateRelatedSectionInContent', async () => {
      const content = 'test content';
      mockContactData.getContent = vi.fn().mockResolvedValue(content);
      mockContactData.updateContent = vi.fn().mockRejectedValue(new Error('Update error'));

      await expect(relationshipOperations.updateRelatedSectionInContent([]))
        .rejects.toThrow('Update error');
    });

    it('should handle vault errors in findContactByName', async () => {
      const mockApp = mockContactData.getApp!();
      mockApp.vault.getMarkdownFiles = vi.fn().mockImplementation(() => {
        throw new Error('Vault error');
      });

      const foundFile = await (relationshipOperations as any).findContactByName('Test');

      expect(foundFile).toBeNull();
    });
  });
});