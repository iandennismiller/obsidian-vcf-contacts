import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App, TFolder } from 'obsidian';
import {
  parseRelatedSection,
  findContactByName,
  resolveContact,
  inferGenderFromRelationship,
  convertToGenderlessType,
  syncRelatedListToFrontmatter
} from 'src/util/relatedListSync';

// Mock dependencies
vi.mock('obsidian', () => ({
  TFile: vi.fn(),
  App: vi.fn(),
  TFolder: vi.fn(),
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

vi.mock('src/contacts/contactFrontmatter', () => ({
  updateMultipleFrontMatterValues: vi.fn(),
  updateFrontMatterValue: vi.fn()
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
  })
}));

describe('relatedListSync', () => {
  describe('parseRelatedSection', () => {
    it('should parse Related section with various relationship types', () => {
      const content = `---
FN: John Doe
---

## Related
- friend [[Alice Smith]]
- father [[Bob Doe]]
- colleague [[Carol Johnson]]
- sister [[Diana Doe]]

Some other content`;

      const relationships = parseRelatedSection(content);
      expect(relationships).toHaveLength(4);
      
      expect(relationships[0]).toEqual({
        type: 'friend',
        contactName: 'Alice Smith',
        originalType: 'friend'
      });
      
      expect(relationships[1]).toEqual({
        type: 'father',
        contactName: 'Bob Doe',
        originalType: 'father'
      });
      
      expect(relationships[2]).toEqual({
        type: 'colleague',
        contactName: 'Carol Johnson',
        originalType: 'colleague'
      });
      
      expect(relationships[3]).toEqual({
        type: 'sister',
        contactName: 'Diana Doe',
        originalType: 'sister'
      });
    });

    it('should handle empty Related section', () => {
      const content = `---
FN: John Doe
---

## Related

Some other content`;

      const relationships = parseRelatedSection(content);
      expect(relationships).toHaveLength(0);
    });

    it('should handle missing Related section', () => {
      const content = `---
FN: John Doe
---

Some content without Related section`;

      const relationships = parseRelatedSection(content);
      expect(relationships).toHaveLength(0);
    });

    it('should handle malformed list items', () => {
      const content = `---
FN: John Doe
---

## Related
- friend [[Alice Smith]]
- invalid item without brackets
- [[Missing relationship type]]
- another friend [[Bob Johnson]]

Some other content`;

      const relationships = parseRelatedSection(content);
      expect(relationships).toHaveLength(2);
      
      expect(relationships[0]).toEqual({
        type: 'friend',
        contactName: 'Alice Smith',
        originalType: 'friend'
      });
      
      expect(relationships[1]).toEqual({
        type: 'another friend',
        contactName: 'Bob Johnson',
        originalType: 'another friend'
      });
    });
  });

  describe('inferGenderFromRelationship', () => {
    it('should infer male gender from male relationship terms', () => {
      expect(inferGenderFromRelationship('father')).toBe('M');
      expect(inferGenderFromRelationship('dad')).toBe('M');
      expect(inferGenderFromRelationship('uncle')).toBe('M');
      expect(inferGenderFromRelationship('brother')).toBe('M');
      expect(inferGenderFromRelationship('son')).toBe('M');
      expect(inferGenderFromRelationship('husband')).toBe('M');
      expect(inferGenderFromRelationship('grandfather')).toBe('M');
      expect(inferGenderFromRelationship('grandson')).toBe('M');
    });

    it('should infer female gender from female relationship terms', () => {
      expect(inferGenderFromRelationship('mother')).toBe('F');
      expect(inferGenderFromRelationship('mom')).toBe('F');
      expect(inferGenderFromRelationship('aunt')).toBe('F');
      expect(inferGenderFromRelationship('sister')).toBe('F');
      expect(inferGenderFromRelationship('daughter')).toBe('F');
      expect(inferGenderFromRelationship('wife')).toBe('F');
      expect(inferGenderFromRelationship('grandmother')).toBe('F');
      expect(inferGenderFromRelationship('granddaughter')).toBe('F');
    });

    it('should return null for genderless terms', () => {
      expect(inferGenderFromRelationship('friend')).toBeNull();
      expect(inferGenderFromRelationship('colleague')).toBeNull();
      expect(inferGenderFromRelationship('neighbor')).toBeNull();
      expect(inferGenderFromRelationship('parent')).toBeNull();
      expect(inferGenderFromRelationship('child')).toBeNull();
    });

    it('should handle case insensitive input', () => {
      expect(inferGenderFromRelationship('FATHER')).toBe('M');
      expect(inferGenderFromRelationship('Mother')).toBe('F');
      expect(inferGenderFromRelationship('UnCLE')).toBe('M');
    });
  });

  describe('convertToGenderlessType', () => {
    it('should convert parent terms to genderless', () => {
      expect(convertToGenderlessType('father')).toBe('parent');
      expect(convertToGenderlessType('mother')).toBe('parent');
      expect(convertToGenderlessType('dad')).toBe('parent');
      expect(convertToGenderlessType('mom')).toBe('parent');
      expect(convertToGenderlessType('daddy')).toBe('parent');
      expect(convertToGenderlessType('mommy')).toBe('parent');
    });

    it('should convert aunt/uncle terms to genderless', () => {
      expect(convertToGenderlessType('aunt')).toBe('auncle');
      expect(convertToGenderlessType('uncle')).toBe('auncle');
    });

    it('should convert child terms to genderless', () => {
      expect(convertToGenderlessType('son')).toBe('child');
      expect(convertToGenderlessType('daughter')).toBe('child');
    });

    it('should convert sibling terms to genderless', () => {
      expect(convertToGenderlessType('brother')).toBe('sibling');
      expect(convertToGenderlessType('sister')).toBe('sibling');
    });

    it('should convert spouse terms to genderless', () => {
      expect(convertToGenderlessType('husband')).toBe('spouse');
      expect(convertToGenderlessType('wife')).toBe('spouse');
    });

    it('should convert grandparent terms to genderless', () => {
      expect(convertToGenderlessType('grandfather')).toBe('grandparent');
      expect(convertToGenderlessType('grandmother')).toBe('grandparent');
    });

    it('should convert grandchild terms to genderless', () => {
      expect(convertToGenderlessType('grandson')).toBe('grandchild');
      expect(convertToGenderlessType('granddaughter')).toBe('grandchild');
    });

    it('should return unchanged for already genderless terms', () => {
      expect(convertToGenderlessType('friend')).toBe('friend');
      expect(convertToGenderlessType('colleague')).toBe('colleague');
      expect(convertToGenderlessType('neighbor')).toBe('neighbor');
      expect(convertToGenderlessType('mentor')).toBe('mentor');
    });

    it('should handle case insensitive input', () => {
      expect(convertToGenderlessType('FATHER')).toBe('parent');
      expect(convertToGenderlessType('Sister')).toBe('sibling');
      expect(convertToGenderlessType('UnCLE')).toBe('auncle');
    });
  });

  describe('findContactByName', () => {
    let mockApp: Partial<App>;
    let mockVault: any;

    beforeEach(() => {
      mockVault = {
        getAbstractFileByPath: vi.fn()
      };
      
      mockApp = {
        vault: mockVault
      };
    });

    it('should find contact by direct path', async () => {
      const mockFile = { basename: 'John Doe' } as TFile;
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = await findContactByName(
        mockApp as App,
        'John Doe',
        'Contacts'
      );

      expect(result).toBe(mockFile);
      expect(mockVault.getAbstractFileByPath).toHaveBeenCalledWith('Contacts/John Doe.md');
    });

    it('should return null when contact not found', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);

      const result = await findContactByName(
        mockApp as App,
        'Nonexistent Contact',
        'Contacts'
      );

      expect(result).toBeNull();
    });

    it('should search in folder children when direct path fails', async () => {
      const mockFile = { basename: 'John Doe' } as TFile;
      const mockFolder = {
        children: [mockFile, { basename: 'Other File' }]
      };

      mockVault.getAbstractFileByPath
        .mockReturnValueOnce(null) // First call (direct path) returns null
        .mockReturnValueOnce(mockFolder); // Second call (folder) returns folder

      const result = await findContactByName(
        mockApp as App,
        'John Doe',
        'Contacts'
      );

      expect(result).toBe(mockFile);
    });
  });

  describe('resolveContact', () => {
    let mockApp: Partial<App>;

    beforeEach(() => {
      vi.clearAllMocks();
      
      mockApp = {
        vault: {
          getAbstractFileByPath: vi.fn()
        },
        metadataCache: {
          getFileCache: vi.fn()
        }
      };
    });

    it('should resolve contact with UID and gender', async () => {
      const mockFile = { basename: 'John Doe' } as TFile;
      const mockCache = {
        frontmatter: {
          UID: 'urn:uuid:12345678-1234-1234-1234-123456789012',
          GENDER: 'M'
        }
      };

      (mockApp.vault!.getAbstractFileByPath as any).mockReturnValue(mockFile);
      (mockApp.metadataCache!.getFileCache as any).mockReturnValue(mockCache);

      const result = await resolveContact(
        mockApp as App,
        'John Doe',
        'Contacts'
      );

      expect(result).toEqual({
        name: 'John Doe',
        uid: 'urn:uuid:12345678-1234-1234-1234-123456789012',
        file: mockFile,
        gender: 'M'
      });
    });

    it('should return null when contact file not found', async () => {
      (mockApp.vault!.getAbstractFileByPath as any).mockReturnValue(null);

      const result = await resolveContact(
        mockApp as App,
        'Nonexistent Contact',
        'Contacts'
      );

      expect(result).toBeNull();
    });

    it('should return null when contact has no UID', async () => {
      const mockFile = { basename: 'John Doe' } as TFile;
      const mockCache = {
        frontmatter: {
          FN: 'John Doe'
          // No UID
        }
      };

      (mockApp.vault!.getAbstractFileByPath as any).mockReturnValue(mockFile);
      (mockApp.metadataCache!.getFileCache as any).mockReturnValue(mockCache);

      const result = await resolveContact(
        mockApp as App,
        'John Doe',
        'Contacts'
      );

      expect(result).toBeNull();
    });
  });
});