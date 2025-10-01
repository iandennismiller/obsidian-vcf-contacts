import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationshipOperations } from '../../../../src/models/contactNote/relationshipOperations';
import { ContactData } from '../../../../src/models/contactNote/contactData';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';

// Mock TFile properly for instanceof checks
vi.mock('obsidian', () => ({
  TFile: class MockTFile {
    basename: string;
    path: string;
    name: string;
    constructor(basename: string, path: string) {
      this.basename = basename;
      this.path = path;
      this.name = path.split('/').pop() || basename;
    }
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
      getFile: vi.fn().mockReturnValue(mockFile),
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
- parent: [[Bob Doe]]
- parent: [[Mary Doe]]
- spouse: [[Jane Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toHaveLength(3);
      expect(relationships[0]).toEqual({
        type: 'parent',
        contactName: 'Bob Doe',
        linkType: 'name'
      });
      expect(relationships[1]).toEqual({
        type: 'parent',
        contactName: 'Mary Doe',
        linkType: 'name'
      });
    });

    it('should handle Related heading with different cases and depths', async () => {
      // According to spec: "The heading is case insensitive: '## related' is equivalent to '## Related'"
      // and "The heading depth is not relevant: works on '### related' or '#### RELATED' too"
      const contentLowercase = `---
UID: test-1
---

## related
- spouse: [[Jane Doe]]

#Contact`;

      const contentUppercase = `---
UID: test-2
---

### RELATED
- friend: [[Bob Smith]]

#Contact`;

      const contentMixedCase = `---
UID: test-3
---

###### ReLaTeD
- colleague: [[Alice Jones]]

#Contact`;

      mockContactData.getContent = vi.fn()
        .mockResolvedValueOnce(contentLowercase)
        .mockResolvedValueOnce(contentUppercase)
        .mockResolvedValueOnce(contentMixedCase);

      // Test lowercase
      let relationships = await relationshipOperations.parseRelatedSection();
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('spouse');

      // Test uppercase
      relationships = await relationshipOperations.parseRelatedSection();
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('friend');

      // Test mixed case
      relationships = await relationshipOperations.parseRelatedSection();
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('colleague');
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
- parent: [[Bob Doe]]
- spouse: [[Jane Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toHaveLength(2);
      expect(relationships[0].contactName).toBe('Bob Doe');
      expect(relationships[0].type).toBe('parent');
      expect(relationships[1].contactName).toBe('Jane Doe');
      expect(relationships[1].type).toBe('spouse');
    });

    it('should handle malformed relationship lines gracefully', async () => {
      const content = `---
UID: john-doe-123
---

#### Related
- parent: [[Bob Doe]]
- invalid line without proper format
- parent: [[Mary Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(content);

      const relationships = await relationshipOperations.parseRelatedSection();

      expect(relationships).toHaveLength(2); // Should skip invalid line
      expect(relationships[0].type).toBe('parent');
      expect(relationships[1].type).toBe('parent');
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
- parent: [[Old Parent]]

#### Notes
Some notes.

#Contact`;

      const newRelationships = [
        { type: 'parent', contactName: 'Bob Doe' },
        { type: 'parent', contactName: 'Mary Doe' }
      ];

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent(newRelationships);

      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('- parent: [[Bob Doe]]')
      );
      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('- parent: [[Mary Doe]]')
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
- parent: [[Bob Doe]]

#Contact`;

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent([]);

      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('#### Related\n\n')
      );
    });

    it('should not modify other parts of the document when updating Related section', async () => {
      // According to spec: "The plugin should not touch any other heading or anything else in the note"
      const originalContent = `---
UID: john-doe-123
FN: John Doe
---

#### Notes
Important notes about John.
- Project details
- Meeting notes

#### Related
- spouse: [[Old Spouse]]

#### Contact Info
Email: john@example.com
Phone: 555-1234

#Contact`;

      const newRelationships = [
        { type: 'spouse', contactName: 'Jane Doe' }
      ];

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent(newRelationships);

      // Should update Related section
      expect(mockContactData.updateContent).toHaveBeenCalledWith(
        expect.stringContaining('- spouse: [[Jane Doe]]')
      );

      // Should preserve other sections
      const updatedContent = vi.mocked(mockContactData.updateContent).mock.calls[0][0] as string;
      expect(updatedContent).toContain('#### Notes');
      expect(updatedContent).toContain('Important notes about John');
      expect(updatedContent).toContain('#### Contact Info');
      expect(updatedContent).toContain('Email: john@example.com');
      expect(updatedContent).toContain('Phone: 555-1234');
    });

    it('should accept gendered terms from user input for gender inference', async () => {
      // According to spec: When user enters gendered terms like "father", "mother",
      // these should trigger gender inference and be stored in genderless form
      const originalContent = `---
UID: john-doe-123
---

#Contact`;

      // User adds gendered relationships
      const genderedRelationships = [
        { type: 'father', contactName: 'Bob Doe' },
        { type: 'mother', contactName: 'Mary Doe' }
      ];

      mockContactData.getContent = vi.fn().mockResolvedValue(originalContent);
      mockContactData.updateContent = vi.fn();

      await relationshipOperations.updateRelatedSectionInContent(genderedRelationships);

      // The relationships should be stored as entered
      // (gender inference processor will convert to genderless form in frontmatter)
      expect(mockContactData.updateContent).toHaveBeenCalled();
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