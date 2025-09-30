import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactData } from '../../../../src/models/contactNote/contactData';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/definitions/ContactsPluginSettings';

describe('ContactData', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockFile: TFile;
  let contactData: ContactData;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };

    mockFile = {
      basename: 'john-doe',
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    contactData = new ContactData(mockApp as App, mockFile);
  });

  describe('getContent', () => {
    it('should retrieve file content from vault', async () => {
      const mockContent = `---
UID: john-doe-123
FN: John Doe
EMAIL: john@example.com
---

## Notes
Contact notes here.

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(mockContent);

      const result = await contactData.getContent();

      expect(result).toBe(mockContent);
      expect(mockApp.vault!.read).toHaveBeenCalledWith(mockFile);
    });

    it('should handle read errors gracefully', async () => {
      mockApp.vault!.read = vi.fn().mockRejectedValue(new Error('File not found'));

      await expect(contactData.getContent()).rejects.toThrow('File not found');
    });
  });

  describe('updateContent', () => {
    it('should update file content in vault', async () => {
      const newContent = `---
UID: john-doe-123
FN: John Doe Updated
EMAIL: john.updated@example.com
---

## Notes
Updated notes.

#Contact`;

      mockApp.vault!.modify = vi.fn().mockResolvedValue(undefined);

      await contactData.updateContent(newContent);

      expect(mockApp.vault!.modify).toHaveBeenCalledWith(mockFile, newContent);
    });

    it('should handle write errors gracefully', async () => {
      mockApp.vault!.modify = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(contactData.updateContent('new content')).rejects.toThrow('Permission denied');
    });

    it('should clear cache after content update', async () => {
      const originalContent = 'original content';
      const newContent = 'updated content';
      
      // First read should cache the content
      mockApp.vault!.read = vi.fn().mockResolvedValue(originalContent);
      const firstRead = await contactData.getContent();
      expect(firstRead).toBe(originalContent);

      // Update content should clear cache
      mockApp.vault!.modify = vi.fn().mockResolvedValue(undefined);
      mockApp.vault!.read = vi.fn().mockResolvedValue(newContent);
      
      await contactData.updateContent(newContent);

      // Next read should get fresh content
      const secondRead = await contactData.getContent();
      expect(secondRead).toBe(newContent);
    });
  });

  describe('getFrontmatter', () => {
    it('should extract frontmatter from metadata cache', async () => {
      const mockFrontmatter = {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        'RELATED[spouse]': 'name:Jane Doe'
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: mockFrontmatter
      });

      const result = await contactData.getFrontmatter();

      expect(result).toEqual(mockFrontmatter);
      expect(mockApp.metadataCache!.getFileCache).toHaveBeenCalledWith(mockFile);
    });

    it('should return empty object when no frontmatter', async () => {
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({});
      mockApp.vault!.read = vi.fn().mockResolvedValue('no frontmatter content');

      const result = await contactData.getFrontmatter();

      expect(result).toEqual({});
    });

    it('should return empty object when no file cache', async () => {
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null);
      mockApp.vault!.read = vi.fn().mockResolvedValue('no frontmatter content');

      const result = await contactData.getFrontmatter();

      expect(result).toEqual({});
    });
  });

  describe('caching behavior', () => {
    it('should cache content on first read', async () => {
      const mockContent = 'file content';
      mockApp.vault!.read = vi.fn().mockResolvedValue(mockContent);

      // First read
      await contactData.getContent();
      // Second read
      await contactData.getContent();

      // Should only read from vault once
      expect(mockApp.vault!.read).toHaveBeenCalledTimes(1);
    });

    it('should provide fresh content after cache clear', async () => {
      const originalContent = 'original';
      const updatedContent = 'updated';

      mockApp.vault!.read = vi.fn()
        .mockResolvedValueOnce(originalContent)
        .mockResolvedValueOnce(updatedContent);

      // First read caches content
      const first = await contactData.getContent();
      expect(first).toBe(originalContent);

      // Clear cache
      contactData.invalidateAllCaches();

      // Next read should fetch fresh content
      const second = await contactData.getContent();
      expect(second).toBe(updatedContent);
      expect(mockApp.vault!.read).toHaveBeenCalledTimes(2);
    });
  });

  describe('file properties', () => {
    it('should expose file properties', () => {
      expect(contactData.getFile()).toBe(mockFile);
      expect(contactData.getFile().basename).toBe('john-doe');
      expect(contactData.getFile().path).toBe('Contacts/john-doe.md');
    });
  });

  describe('error resilience', () => {
    it('should handle corrupt file cache gracefully', async () => {
      // Simulate corrupted cache that throws when accessed
      mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation(() => {
        throw new Error('Cache corruption');
      });
      mockApp.vault!.read = vi.fn().mockResolvedValue('no frontmatter content');

      const result = await contactData.getFrontmatter();

      expect(result).toEqual({});
    });

    it('should handle vault read timeouts', async () => {
      // Simulate long timeout
      mockApp.vault!.read = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      await expect(contactData.getContent()).rejects.toThrow('Timeout');
    });
  });

  describe('content validation', () => {
    it('should handle various content formats', async () => {
      const testCases = [
        '', // Empty file
        '# Just a heading', // No frontmatter
        '---\n---\n', // Empty frontmatter
        '---\nUID: test\n---\nContent' // Normal format
      ];

      for (const content of testCases) {
        mockApp.vault!.read = vi.fn().mockResolvedValue(content);
        contactData.invalidateAllCaches();
        
        const result = await contactData.getContent();
        expect(result).toBe(content);
      }
    });
  });
});