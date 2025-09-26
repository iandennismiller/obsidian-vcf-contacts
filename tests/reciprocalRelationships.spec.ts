import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';
import {
  getReciprocalRelationshipType,
  isSymmetricRelationship,
  hasReciprocalRelationshipInFrontmatter,
  hasReciprocalRelationshipInRelatedList,
  findMissingReciprocalRelationships,
  fixMissingReciprocalRelationships,
  addReciprocalRelationshipToRelatedList,
  type MissingReciprocal,
  type ReciprocalCheckResult,
  type FixReciprocalResult
} from 'src/util/reciprocalRelationships';

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

vi.mock('src/util/relatedListSync', () => ({
  parseRelatedSection: vi.fn(),
  findContactByName: vi.fn(),
  parseFrontmatterRelationships: vi.fn(),
  syncRelatedListToFrontmatter: vi.fn(),
  updateRelatedSectionInContent: vi.fn()
}));

// Don't mock our own module - we want to test the actual implementation

vi.mock('src/util/genderUtils', () => ({
  convertToGenderlessType: vi.fn((type: string) => {
    // Simplified mock implementation
    const map: Record<string, string> = {
      'father': 'parent',
      'mother': 'parent',
      'son': 'child',
      'daughter': 'child',
      'brother': 'sibling',
      'sister': 'sibling',
      'husband': 'spouse',
      'wife': 'spouse',
      'boyfriend': 'partner',
      'girlfriend': 'partner',
      'uncle': 'auncle',
      'aunt': 'auncle',
      'nephew': 'nibling',
      'niece': 'nibling',
      'grandfather': 'grandparent',
      'grandmother': 'grandparent',
      'grandson': 'grandchild',
      'granddaughter': 'grandchild'
    };
    return map[type] || type;
  })
}));

describe('reciprocalRelationships', () => {
  describe('getReciprocalRelationshipType', () => {
    it('should return correct reciprocals for asymmetric relationships', () => {
      expect(getReciprocalRelationshipType('parent')).toBe('child');
      expect(getReciprocalRelationshipType('child')).toBe('parent');
      expect(getReciprocalRelationshipType('father')).toBe('child');
      expect(getReciprocalRelationshipType('mother')).toBe('child');
      expect(getReciprocalRelationshipType('son')).toBe('parent');
      expect(getReciprocalRelationshipType('daughter')).toBe('parent');
      expect(getReciprocalRelationshipType('grandparent')).toBe('grandchild');
      expect(getReciprocalRelationshipType('grandchild')).toBe('grandparent');
      expect(getReciprocalRelationshipType('auncle')).toBe('nibling');
      expect(getReciprocalRelationshipType('nibling')).toBe('auncle');
    });

    it('should return same type for symmetric relationships', () => {
      expect(getReciprocalRelationshipType('sibling')).toBe('sibling');
      expect(getReciprocalRelationshipType('spouse')).toBe('spouse');
      expect(getReciprocalRelationshipType('partner')).toBe('partner');
      expect(getReciprocalRelationshipType('friend')).toBe('friend');
      expect(getReciprocalRelationshipType('colleague')).toBe('colleague');
      expect(getReciprocalRelationshipType('relative')).toBe('relative');
      expect(getReciprocalRelationshipType('cousin')).toBe('cousin');
    });

    it('should return null for relationships without reciprocals', () => {
      expect(getReciprocalRelationshipType('boss')).toBeNull();
      expect(getReciprocalRelationshipType('employee')).toBeNull();
      expect(getReciprocalRelationshipType('unknown')).toBeNull();
    });

    it('should handle gendered relationship terms', () => {
      expect(getReciprocalRelationshipType('brother')).toBe('sibling');
      expect(getReciprocalRelationshipType('sister')).toBe('sibling');
      expect(getReciprocalRelationshipType('husband')).toBe('spouse');
      expect(getReciprocalRelationshipType('wife')).toBe('spouse');
    });
  });

  describe('isSymmetricRelationship', () => {
    it('should identify symmetric relationships', () => {
      expect(isSymmetricRelationship('sibling')).toBe(true);
      expect(isSymmetricRelationship('spouse')).toBe(true);
      expect(isSymmetricRelationship('partner')).toBe(true);
      expect(isSymmetricRelationship('friend')).toBe(true);
      expect(isSymmetricRelationship('colleague')).toBe(true);
      expect(isSymmetricRelationship('relative')).toBe(true);
      expect(isSymmetricRelationship('cousin')).toBe(true);
    });

    it('should identify asymmetric relationships', () => {
      expect(isSymmetricRelationship('parent')).toBe(false);
      expect(isSymmetricRelationship('child')).toBe(false);
      expect(isSymmetricRelationship('grandparent')).toBe(false);
      expect(isSymmetricRelationship('grandchild')).toBe(false);
      expect(isSymmetricRelationship('auncle')).toBe(false);
      expect(isSymmetricRelationship('nibling')).toBe(false);
    });
  });

  describe('hasReciprocalRelationshipInFrontmatter', () => {
    let mockApp: App;
    let mockFile: TFile;

    beforeEach(() => {
      mockApp = {
        metadataCache: {
          getFileCache: vi.fn()
        }
      } as any;

      mockFile = {
        path: '/test/Jane Doe.md',
        basename: 'Jane Doe'
      } as TFile;
    });

    it('should return true when reciprocal relationship exists in frontmatter', async () => {
      const { parseFrontmatterRelationships } = await import('src/util/relatedListSync');

      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
        frontmatter: {
          'RELATED[child]': 'name:John Doe'
        }
      } as any);

      vi.mocked(parseFrontmatterRelationships).mockReturnValue([
        {
          type: 'child',
          value: 'name:John Doe',
          parsedValue: { type: 'name', value: 'John Doe' }
        }
      ]);

      const result = await hasReciprocalRelationshipInFrontmatter(
        mockApp,
        mockFile,
        'John Doe',
        'child'
      );

      expect(result).toBe(true);
    });

    it('should return false when reciprocal relationship does not exist', async () => {
      const { parseFrontmatterRelationships } = await import('src/util/relatedListSync');

      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
        frontmatter: {
          'RELATED[sibling]': 'name:Alice Doe'
        }
      } as any);

      vi.mocked(parseFrontmatterRelationships).mockReturnValue([
        {
          type: 'sibling',
          value: 'name:Alice Doe',
          parsedValue: { type: 'name', value: 'Alice Doe' }
        }
      ]);

      const result = await hasReciprocalRelationshipInFrontmatter(
        mockApp,
        mockFile,
        'John Doe',
        'child'
      );

      expect(result).toBe(false);
    });

    it('should handle missing frontmatter gracefully', async () => {
      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue(null);

      const result = await hasReciprocalRelationshipInFrontmatter(
        mockApp,
        mockFile,
        'John Doe',
        'child'
      );

      expect(result).toBe(false);
    });
  });

  describe('hasReciprocalRelationshipInRelatedList', () => {
    let mockApp: App;
    let mockFile: TFile;

    beforeEach(() => {
      mockApp = {
        vault: {
          read: vi.fn()
        }
      } as any;

      mockFile = {
        path: '/test/Jane Doe.md',
        basename: 'Jane Doe'
      } as TFile;
    });

    it('should return true when reciprocal relationship exists in Related list', async () => {
      const { parseRelatedSection } = await import('src/util/relatedListSync');

      vi.mocked(mockApp.vault.read).mockResolvedValue(`---
FN: Jane Doe
UID: jane-123
---

## Related
- child [[John Doe]]
- sibling [[Alice Doe]]
`);

      vi.mocked(parseRelatedSection).mockReturnValue([
        { type: 'child', contactName: 'John Doe', originalType: 'child' },
        { type: 'sibling', contactName: 'Alice Doe', originalType: 'sibling' }
      ]);

      const result = await hasReciprocalRelationshipInRelatedList(
        mockApp,
        mockFile,
        'John Doe',
        'child'
      );

      expect(result).toBe(true);
    });

    it('should return false when reciprocal relationship does not exist', async () => {
      const { parseRelatedSection } = await import('src/util/relatedListSync');

      vi.mocked(mockApp.vault.read).mockResolvedValue(`---
FN: Jane Doe
UID: jane-123
---

## Related
- sibling [[Alice Doe]]
`);

      vi.mocked(parseRelatedSection).mockReturnValue([
        { type: 'sibling', contactName: 'Alice Doe', originalType: 'sibling' }
      ]);

      const result = await hasReciprocalRelationshipInRelatedList(
        mockApp,
        mockFile,
        'John Doe',
        'child'
      );

      expect(result).toBe(false);
    });
  });

  describe('findMissingReciprocalRelationships', () => {
    let mockApp: App;
    let mockFile: TFile;

    beforeEach(() => {
      mockApp = {
        vault: {
          read: vi.fn(),
          getAbstractFileByPath: vi.fn()
        },
        metadataCache: {
          getFileCache: vi.fn()
        }
      } as any;

      mockFile = {
        path: '/test/John Doe.md',
        basename: 'John Doe'
      } as TFile;
    });

    it('should find missing reciprocal relationships', async () => {
      const { parseRelatedSection, findContactByName, parseFrontmatterRelationships } = await import('src/util/relatedListSync');

      // Mock John's file content (John has parent Jane Doe) - first call to vault.read
      vi.mocked(mockApp.vault.read)
        .mockResolvedValueOnce(`---
FN: John Doe
UID: john-123
---

## Related
- parent [[Jane Doe]]
`)
        // Mock Jane's file content for hasReciprocalRelationshipInRelatedList - second call to vault.read
        .mockResolvedValueOnce(`---
FN: Jane Doe
UID: jane-123
---

## Related
- spouse [[Bob Doe]]
`);

      // Mock parseRelatedSection - first call for John's relationships
      vi.mocked(parseRelatedSection)
        .mockReturnValueOnce([
          { type: 'parent', contactName: 'Jane Doe', originalType: 'parent' }
        ])
        // Second call for Jane's relationships (to check if she has reciprocal)
        .mockReturnValueOnce([
          { type: 'spouse', contactName: 'Bob Doe', originalType: 'spouse' }
        ]);

      const janeFile = { path: '/test/Jane Doe.md', basename: 'Jane Doe' } as TFile;
      vi.mocked(findContactByName).mockResolvedValue(janeFile);
      
      // Mock the direct vault method that findContactByName uses
      vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValue(janeFile);

      // Mock Jane's frontmatter (she doesn't have the reciprocal child relationship)
      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
        frontmatter: {
          'RELATED[spouse]': 'name:Bob Doe'  // Jane has a spouse but not child relationship to John
        }
      } as any);

      vi.mocked(parseFrontmatterRelationships).mockReturnValue([
        {
          type: 'spouse',
          value: 'name:Bob Doe',
          parsedValue: { type: 'name', value: 'Bob Doe' }
        }
      ]);

      const result = await findMissingReciprocalRelationships(
        mockApp,
        mockFile,
        '/test'
      );

      expect(result.allReciprocalExists).toBe(false);
      expect(result.missingReciprocals).toHaveLength(1);
      expect(result.missingReciprocals[0]).toEqual({
        targetFile: janeFile,
        targetName: 'Jane Doe',
        reciprocalType: 'child',
        sourceContactName: 'John Doe'
      });
    });

    it('should return empty array when all reciprocals exist', async () => {
      const { parseRelatedSection, findContactByName, parseFrontmatterRelationships } = await import('src/util/relatedListSync');

      // Mock John's file content (John has parent Jane) - first call to vault.read
      vi.mocked(mockApp.vault.read).mockResolvedValueOnce(`---
FN: John Doe
UID: john-123
---

## Related
- parent [[Jane Doe]]
`);

      // Mock parseRelatedSection - first call for John's relationships
      vi.mocked(parseRelatedSection).mockReturnValueOnce([
        { type: 'parent', contactName: 'Jane Doe', originalType: 'parent' }
      ]);

      const janeFile = { path: '/test/Jane Doe.md', basename: 'Jane Doe' } as TFile;
      vi.mocked(findContactByName).mockResolvedValue(janeFile);
      
      // Mock the direct vault method that findContactByName uses  
      vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValue(janeFile);

      // Mock Jane's frontmatter (she DOES have the reciprocal child relationship)
      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
        frontmatter: {
          'RELATED[child]': 'name:John Doe'  // Jane correctly has John as child
        }
      } as any);

      vi.mocked(parseFrontmatterRelationships).mockReturnValue([
        {
          type: 'child',
          value: 'name:John Doe',
          parsedValue: { type: 'name', value: 'John Doe' }
        }
      ]);

      const result = await findMissingReciprocalRelationships(
        mockApp,
        mockFile,
        '/test'
      );

      expect(result.allReciprocalExists).toBe(true);
      expect(result.missingReciprocals).toHaveLength(0);
    });
  });

  describe('addReciprocalRelationshipToRelatedList', () => {
    let mockApp: App;
    let mockFile: TFile;

    beforeEach(() => {
      mockApp = {
        vault: {
          read: vi.fn(),
          modify: vi.fn()
        }
      } as any;

      mockFile = {
        path: '/test/Jane Doe.md',
        basename: 'Jane Doe'
      } as TFile;
    });

    it('should add reciprocal relationship to Related list', async () => {
      const { parseRelatedSection, updateRelatedSectionInContent } = await import('src/util/relatedListSync');

      const originalContent = `---
FN: Jane Doe
UID: jane-123
---

## Related
- spouse [[Bob Doe]]
`;

      const expectedContent = `---
FN: Jane Doe
UID: jane-123
---

## Related
- spouse [[Bob Doe]]
- child [[John Doe]]
`;

      vi.mocked(mockApp.vault.read).mockResolvedValue(originalContent);

      vi.mocked(parseRelatedSection).mockReturnValue([
        { type: 'spouse', contactName: 'Bob Doe', originalType: 'spouse' }
      ]);

      vi.mocked(updateRelatedSectionInContent).mockReturnValue(expectedContent);

      const result = await addReciprocalRelationshipToRelatedList(
        mockApp,
        mockFile,
        'child',
        'John Doe'
      );

      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(mockFile, expectedContent);
    });

    it('should not add duplicate reciprocal relationships', async () => {
      const { parseRelatedSection } = await import('src/util/relatedListSync');

      const content = `---
FN: Jane Doe
UID: jane-123
---

## Related
- child [[John Doe]]
`;

      vi.mocked(mockApp.vault.read).mockResolvedValue(content);

      vi.mocked(parseRelatedSection).mockReturnValue([
        { type: 'child', contactName: 'John Doe', originalType: 'child' }
      ]);

      const result = await addReciprocalRelationshipToRelatedList(
        mockApp,
        mockFile,
        'child',
        'John Doe'
      );

      expect(result).toBe(true);
      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });
  });

  describe('fixMissingReciprocalRelationships', () => {
    let mockApp: App;
    let mockFile: TFile;

    beforeEach(() => {
      mockApp = {
        vault: {
          read: vi.fn(),
          modify: vi.fn(),
          getAbstractFileByPath: vi.fn()
        },
        metadataCache: {
          getFileCache: vi.fn()
        }
      } as any;

      mockFile = {
        path: '/test/John Doe.md',
        basename: 'John Doe'
      } as TFile;
    });

    it('should successfully fix missing reciprocal relationships', async () => {
      const { 
        parseRelatedSection, 
        findContactByName, 
        parseFrontmatterRelationships,
        syncRelatedListToFrontmatter,
        updateRelatedSectionInContent
      } = await import('src/util/relatedListSync');

      // Mock vault.read to return different content based on the file
      vi.mocked(mockApp.vault.read).mockImplementation(async (file: TFile) => {
        if (file.basename === 'John Doe') {
          return `---
FN: John Doe
UID: john-123
---

## Related
- parent [[Jane Doe]]
`;
        } else if (file.basename === 'Jane Doe') {
          return `---
FN: Jane Doe
UID: jane-123
---

## Related
`;
        }
        throw new Error(`Unexpected file: ${file.basename}`);
      });

      // Mock parseRelatedSection to return different content based on the call order
      let parseRelatedSectionCallCount = 0;
      vi.mocked(parseRelatedSection).mockImplementation((content: string) => {
        parseRelatedSectionCallCount++;
        if (parseRelatedSectionCallCount === 1) {
          // First call: John's relationships
          return [{ type: 'parent', contactName: 'Jane Doe', originalType: 'parent' }];
        } else {
          // Later calls: Jane's relationships (empty initially)
          return [];
        }
      });

      const janeFile = { path: '/test/Jane Doe.md', basename: 'Jane Doe' } as TFile;
      vi.mocked(findContactByName).mockResolvedValue(janeFile);
      
      // Mock the direct vault method that findContactByName uses
      vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValue(janeFile);

      // Mock Jane's frontmatter (missing reciprocal)
      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
        frontmatter: {}
      } as any);

      vi.mocked(parseFrontmatterRelationships).mockReturnValue([]);

      const expectedContent = `---
FN: Jane Doe
UID: jane-123
---

## Related
- child [[John Doe]]
`;

      vi.mocked(updateRelatedSectionInContent).mockReturnValue(expectedContent);

      // Mock successful sync
      vi.mocked(syncRelatedListToFrontmatter).mockResolvedValue({
        success: true,
        errors: []
      });

      const result = await fixMissingReciprocalRelationships(
        mockApp,
        mockFile,
        '/test'
      );

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle case with no missing reciprocals', async () => {
      const { parseRelatedSection, findContactByName, parseFrontmatterRelationships } = await import('src/util/relatedListSync');

      vi.mocked(mockApp.vault.read).mockResolvedValue(`---
FN: John Doe
UID: john-123
---

## Related
- parent [[Jane Doe]]
`);

      vi.mocked(parseRelatedSection).mockReturnValue([
        { type: 'parent', contactName: 'Jane Doe', originalType: 'parent' }
      ]);

      const janeFile = { path: '/test/Jane Doe.md', basename: 'Jane Doe' } as TFile;
      vi.mocked(findContactByName).mockResolvedValue(janeFile);
      
      // Mock the direct vault method that findContactByName uses
      vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValue(janeFile);

      // Mock Jane's frontmatter (has reciprocal)
      vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
        frontmatter: {
          'RELATED[child]': 'name:John Doe'
        }
      } as any);

      vi.mocked(parseFrontmatterRelationships).mockReturnValue([
        {
          type: 'child',
          value: 'name:John Doe',
          parsedValue: { type: 'name', value: 'John Doe' }
        }
      ]);

      const result = await fixMissingReciprocalRelationships(
        mockApp,
        mockFile,
        '/test'
      );

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});