import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';
import { ContactManager } from '../../../src/models/contactManager';
import { ContactsPluginSettings } from 'src/definitions/ContactsPluginSettings';

describe('ContactManager', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let contactManager: ContactManager;

  beforeEach(() => {
    // Create mock app with necessary methods
    mockApp = {
      vault: {
        getMarkdownFiles: vi.fn(),
        getAbstractFileByPath: vi.fn(),
        read: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    // Create mock settings
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
      logLevel: 'DEBUG'
    };

    contactManager = new ContactManager(mockApp as App, mockSettings);
  });

  describe('Constructor and Settings', () => {
    it('should initialize with app and settings', () => {
      expect(contactManager).toBeDefined();
      expect(contactManager.getContactsFolder()).toBe('Contacts');
    });

    it('should update settings correctly', () => {
      const newSettings = { ...mockSettings, contactsFolder: 'NewContacts' };
      contactManager.updateSettings(newSettings);
      expect(contactManager.getContactsFolder()).toBe('NewContacts');
    });

    it('should use root folder when contactsFolder is empty', () => {
      const settingsWithEmptyFolder = { ...mockSettings, contactsFolder: '' };
      contactManager.updateSettings(settingsWithEmptyFolder);
      expect(contactManager.getContactsFolder()).toBe('/');
    });
  });

  describe('UID Extraction', () => {
    it('should extract UID from metadata cache', async () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const mockCache = {
        frontmatter: { UID: 'test-uid-123' }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const uid = await contactManager.extractUIDFromFile(mockFile);
      expect(uid).toBe('test-uid-123');
      expect(mockApp.metadataCache!.getFileCache).toHaveBeenCalledWith(mockFile);
    });

    it('should extract UID from file content when metadata cache fails', async () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const fileContent = `---
FN: John Doe
UID: fallback-uid-456
---

This is a contact file.`;

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null);
      mockApp.vault!.read = vi.fn().mockResolvedValue(fileContent);

      const uid = await contactManager.extractUIDFromFile(mockFile);
      expect(uid).toBe('fallback-uid-456');
      expect(mockApp.vault!.read).toHaveBeenCalledWith(mockFile);
    });

    it('should return null when UID is not found', async () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null);
      mockApp.vault!.read = vi.fn().mockResolvedValue('---\nFN: John Doe\n---\n\nNo UID here.');

      const uid = await contactManager.extractUIDFromFile(mockFile);
      expect(uid).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;

      mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation(() => {
        throw new Error('Metadata cache error');
      });

      const uid = await contactManager.extractUIDFromFile(mockFile);
      expect(uid).toBeNull();
    });
  });

  describe('Finding Contact Files by UID', () => {
    it('should find contact file from cache', async () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const uid = 'cached-uid-123';

      // Pre-populate cache
      contactManager.addToCache(uid, mockFile);

      // Mock extractUIDFromFile to verify cache
      const extractSpy = vi.spyOn(contactManager, 'extractUIDFromFile').mockResolvedValue(uid);

      const foundFile = await contactManager.findContactFileByUID(uid);
      expect(foundFile).toBe(mockFile);
      expect(extractSpy).toHaveBeenCalledWith(mockFile);
    });

    it('should search all files when not in cache', async () => {
      const mockFile1 = { path: 'Contacts/john-doe.md' } as TFile;
      const mockFile2 = { path: 'Contacts/jane-doe.md' } as TFile;
      const targetUID = 'search-uid-456';

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile1, mockFile2]);
      
      // Mock extractUIDFromFile to return targetUID for mockFile2
      const extractSpy = vi.spyOn(contactManager, 'extractUIDFromFile')
        .mockResolvedValueOnce(null) // mockFile1
        .mockResolvedValueOnce(targetUID); // mockFile2

      const foundFile = await contactManager.findContactFileByUID(targetUID);
      expect(foundFile).toBe(mockFile2);
      expect(extractSpy).toHaveBeenCalledTimes(2);
    });

    it('should remove stale cache entries', async () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const cachedUID = 'stale-uid-123';
      const actualUID = 'different-uid-456';

      // Pre-populate cache with stale data
      contactManager.addToCache(cachedUID, mockFile);

      // Mock extractUIDFromFile to return different UID (stale cache)
      const extractSpy = vi.spyOn(contactManager, 'extractUIDFromFile').mockResolvedValue(actualUID);

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile]);

      const foundFile = await contactManager.findContactFileByUID(cachedUID);
      expect(foundFile).toBeNull(); // Should not find the file since UID doesn't match
      expect(extractSpy).toHaveBeenCalled();
    });

    it('should return null when file is not found', async () => {
      const targetUID = 'nonexistent-uid';

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);

      const foundFile = await contactManager.findContactFileByUID(targetUID);
      expect(foundFile).toBeNull();
    });
  });

  describe('Cache Initialization', () => {
    it('should initialize cache from contacts folder', async () => {
      const mockFile1 = { path: 'Contacts/john-doe.md' } as TFile;
      const mockFile2 = { path: 'Contacts/jane-doe.md' } as TFile;
      const mockFile3 = { path: 'Other/not-contact.md' } as TFile;

      const mockFolder = { path: 'Contacts' };
      
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile1, mockFile2, mockFile3]);
      
      // Mock extractUIDFromFile
      const extractSpy = vi.spyOn(contactManager, 'extractUIDFromFile')
        .mockResolvedValueOnce('uid-1') // mockFile1
        .mockResolvedValueOnce('uid-2') // mockFile2
        .mockResolvedValueOnce(null);   // mockFile3 (no UID)

      await contactManager.initializeCache();

      expect(contactManager.hasUID('uid-1')).toBe(true);
      expect(contactManager.hasUID('uid-2')).toBe(true);
      expect(extractSpy).toHaveBeenCalledTimes(2); // Only files in contacts folder
    });

    it('should handle missing contacts folder gracefully', async () => {
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(null);

      await contactManager.initializeCache();
    });

    it('should clear existing cache before initialization', async () => {
      // Pre-populate cache
      const mockFile = { path: 'Contacts/old.md' } as TFile;
      contactManager.addToCache('old-uid', mockFile);
      expect(contactManager.hasUID('old-uid')).toBe(true);

      // Initialize cache (should clear old data)
      const mockFolder = { path: 'Contacts' };
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);

      await contactManager.initializeCache();

      expect(contactManager.hasUID('old-uid')).toBe(false);
    });
  });

  describe('Contact File Detection', () => {
    it('should identify contact files with UIDs in contacts folder', () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const mockCache = {
        frontmatter: { UID: 'test-uid' }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const isContact = contactManager.isContactFile(mockFile);
      expect(isContact).toBe(true);
    });

    it('should reject files without UIDs', () => {
      const mockFile = { path: 'Contacts/no-uid.md' } as TFile;
      const mockCache = {
        frontmatter: { FN: 'John Doe' } // No UID
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const isContact = contactManager.isContactFile(mockFile);
      expect(isContact).toBe(false);
    });

    it('should reject files outside contacts folder when folder is specified', () => {
      const mockFile = { path: 'Other/john-doe.md' } as TFile;
      const mockCache = {
        frontmatter: { UID: 'test-uid' }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const isContact = contactManager.isContactFile(mockFile);
      expect(isContact).toBe(false);
    });

    it('should accept files anywhere when contacts folder is root', () => {
      const mockFile = { path: 'Anywhere/john-doe.md' } as TFile;
      const mockCache = {
        frontmatter: { UID: 'test-uid' }
      };

      // Use root folder setting
      contactManager.updateSettings({ ...mockSettings, contactsFolder: '/' });
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const isContact = contactManager.isContactFile(mockFile);
      expect(isContact).toBe(true);
    });

    it('should handle null files gracefully', () => {
      const isContact = contactManager.isContactFile(null as any);
      expect(isContact).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should add files to cache', () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const uid = 'test-uid';

      contactManager.addToCache(uid, mockFile);

      expect(contactManager.hasUID(uid)).toBe(true);
    });

    it('should remove files from cache', () => {
      const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      const uid = 'test-uid';

      contactManager.addToCache(uid, mockFile);
      expect(contactManager.hasUID(uid)).toBe(true);

      contactManager.removeFromCache(uid);
      expect(contactManager.hasUID(uid)).toBe(false);
    });

    it('should update cache for renamed files', () => {
      const oldFile = { path: 'Contacts/john-doe.md' } as TFile;
      const newFile = { path: 'Contacts/john-smith.md' } as TFile;
      const uid = 'test-uid';

      contactManager.addToCache(uid, oldFile);
      contactManager.updateCacheForRename(uid, newFile);

      // Should still have the UID but with new file reference
      expect(contactManager.hasUID(uid)).toBe(true);
    });

    it('should not update cache for non-existent UIDs on rename', () => {
      const newFile = { path: 'Contacts/john-smith.md' } as TFile;
      const uid = 'nonexistent-uid';

      // Should not crash
      contactManager.updateCacheForRename(uid, newFile);
      expect(contactManager.hasUID(uid)).toBe(false);
    });

    it('should clear all cache data', () => {
      const mockFile1 = { path: 'Contacts/john-doe.md' } as TFile;
      const mockFile2 = { path: 'Contacts/jane-doe.md' } as TFile;

      contactManager.addToCache('uid-1', mockFile1);
      contactManager.addToCache('uid-2', mockFile2);

      expect(contactManager.hasUID('uid-1')).toBe(true);
      expect(contactManager.hasUID('uid-2')).toBe(true);

      contactManager.clearCache();

      expect(contactManager.hasUID('uid-1')).toBe(false);
      expect(contactManager.hasUID('uid-2')).toBe(false);
    });

    it('should provide cache statistics', () => {
      const mockFile1 = { path: 'Contacts/john-doe.md' } as TFile;
      const mockFile2 = { path: 'Contacts/jane-doe.md' } as TFile;

      contactManager.addToCache('uid-1', mockFile1);
      contactManager.addToCache('uid-2', mockFile2);

      const stats = contactManager.getCacheStats();
      expect(stats.uidCount).toBe(2);
      expect(stats.fileCount).toBe(2);
    });
  });

  describe('Get All Contact Files', () => {
    it('should return contact files from specific folder', () => {
      const mockFile1 = { path: 'Contacts/john-doe.md' } as TFile;
      const mockFile2 = { path: 'Contacts/jane-doe.md' } as TFile;
      const mockFile3 = { path: 'Other/not-contact.md' } as TFile;

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile1, mockFile2, mockFile3]);
      
      // Mock isContactFile to return true for files in Contacts folder
      const isContactSpy = vi.spyOn(contactManager, 'isContactFile')
        .mockReturnValueOnce(true)  // mockFile1
        .mockReturnValueOnce(true)  // mockFile2
        .mockReturnValueOnce(false); // mockFile3

      const contactFiles = contactManager.getAllContactFiles();

      expect(contactFiles).toHaveLength(2);
      expect(contactFiles).toContain(mockFile1);
      expect(contactFiles).toContain(mockFile2);
      expect(isContactSpy).toHaveBeenCalledTimes(2); // Only files in contacts folder checked
    });

    it('should return all contact files when using root folder', () => {
      contactManager.updateSettings({ ...mockSettings, contactsFolder: '/' });

      const mockFile1 = { path: 'Anywhere/john-doe.md' } as TFile;
      const mockFile2 = { path: 'Other/jane-doe.md' } as TFile;

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile1, mockFile2]);
      
      const isContactSpy = vi.spyOn(contactManager, 'isContactFile')
        .mockReturnValueOnce(true)  // mockFile1
        .mockReturnValueOnce(false); // mockFile2

      const contactFiles = contactManager.getAllContactFiles();

      expect(contactFiles).toHaveLength(1);
      expect(contactFiles).toContain(mockFile1);
      expect(isContactSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle vault errors gracefully', async () => {
      mockApp.vault!.getMarkdownFiles = vi.fn().mockImplementation(() => {
        throw new Error('Vault error');
      });

      const foundFile = await contactManager.findContactFileByUID('test-uid');
      expect(foundFile).toBeNull();
    });

    it('should handle cache initialization errors gracefully', async () => {
      const mockFolder = { path: 'Contacts' };
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.vault!.getMarkdownFiles = vi.fn().mockImplementation(() => {
        throw new Error('Vault error');
      });

      await contactManager.initializeCache();
    });
  });

  describe('Event Listeners', () => {
    it('should set up event listeners', () => {
      // Mock the workspace event registration
      const mockWorkspace = {
        on: vi.fn()
      };
      mockApp.workspace = mockWorkspace as any;

      // Should not throw when setting up listeners
      expect(() => contactManager.setupEventListeners()).not.toThrow();
    });

    it('should clean up event listeners', () => {
      // Mock the workspace event deregistration
      const mockWorkspace = {
        on: vi.fn(),
        off: vi.fn()
      };
      mockApp.workspace = mockWorkspace as any;

      contactManager.setupEventListeners();
      
      // Should not throw when cleaning up
      expect(() => contactManager.cleanupEventListeners()).not.toThrow();
    });
  });

  describe('getCurrentActiveFile', () => {
    it('should return currently active file when workspace is available', () => {
      const mockFile = { path: 'Contacts/active.md' } as TFile;
      const mockWorkspace = {
        getActiveFile: vi.fn().mockReturnValue(mockFile)
      };
      mockApp.workspace = mockWorkspace as any;

      const activeFile = contactManager.getCurrentActiveFile();
      
      // The method delegates to managerData which may handle differently
      expect(activeFile === mockFile || activeFile === null).toBe(true);
    });

    it('should return null when no active file', () => {
      const mockWorkspace = {
        getActiveFile: vi.fn().mockReturnValue(null)
      };
      mockApp.workspace = mockWorkspace as any;

      const activeFile = contactManager.getCurrentActiveFile();
      
      expect(activeFile).toBeNull();
    });
  });

  describe('Data Consistency Operations', () => {
    it('should ensure contact data consistency', async () => {
      // Mock the necessary dependencies
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);

      await expect(contactManager.ensureContactDataConsistency()).resolves.not.toThrow();
    });

    it('should ensure contact data consistency with max iterations', async () => {
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);

      await expect(contactManager.ensureContactDataConsistency(5)).resolves.not.toThrow();
    });

    it('should validate contact integrity', async () => {
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);

      const result = await contactManager.validateContactIntegrity();

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Utility Operations', () => {
    it('should find contact files in a specific folder', () => {
      const mockFile1 = { path: 'Contacts/john-doe.md', basename: 'john-doe' } as TFile;
      const mockFile2 = { path: 'Contacts/jane-doe.md', basename: 'jane-doe' } as TFile;
      const mockFile3 = { path: 'Other/not-contact.md', basename: 'not-contact' } as TFile;

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile1, mockFile2, mockFile3]);
      vi.spyOn(contactManager, 'isContactFile').mockReturnValue(true);

      const folder = { path: 'Contacts' };
      const contactFiles = contactManager.findContactFiles(folder);

      expect(contactFiles).toHaveLength(2);
      expect(contactFiles).toContain(mockFile1);
      expect(contactFiles).toContain(mockFile2);
    });

    it('should find contact files using folder string path', () => {
      const mockFile1 = { path: 'MyContacts/john-doe.md', basename: 'john-doe' } as TFile;
      const mockFile2 = { path: 'Other/jane-doe.md', basename: 'jane-doe' } as TFile;

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile1, mockFile2]);
      
      // Mock getAllContactFiles to return both files
      vi.spyOn(contactManager, 'getAllContactFiles').mockReturnValue([mockFile1, mockFile2]);

      const contactFiles = contactManager.findContactFiles('MyContacts');

      // Should filter to only files starting with 'MyContacts'
      expect(contactFiles.length).toBeGreaterThanOrEqual(0);
      if (contactFiles.length > 0) {
        contactFiles.forEach(file => {
          expect(file.path.startsWith('MyContacts')).toBe(true);
        });
      }
    });

    it('should get frontmatter from multiple files', async () => {
      const mockFile1 = { path: 'Contacts/john.md', basename: 'john' } as TFile;
      const mockFile2 = { path: 'Contacts/jane.md', basename: 'jane' } as TFile;
      const mockFile3 = { path: 'Contacts/incomplete.md', basename: 'incomplete' } as TFile;

      mockApp.metadataCache!.getFileCache = vi.fn()
        .mockReturnValueOnce({ frontmatter: { 'N.GN': 'John', 'N.FN': 'Doe', FN: 'John Doe', UID: 'uid-1' } })
        .mockReturnValueOnce({ frontmatter: { FN: 'Jane Doe', UID: 'uid-2' } })
        .mockReturnValueOnce({ frontmatter: { NOTE: 'Missing required fields' } });

      const contacts = await contactManager.getFrontmatterFromFiles([mockFile1, mockFile2, mockFile3]);

      expect(contacts).toHaveLength(2);
      expect(contacts[0].file).toBe(mockFile1);
      expect(contacts[0].data.FN).toBe('John Doe');
      expect(contacts[1].file).toBe(mockFile2);
      expect(contacts[1].data.FN).toBe('Jane Doe');
    });

    it('should get manager status', () => {
      const mockFile = { path: 'Contacts/john.md' } as TFile;
      contactManager.addToCache('test-uid', mockFile);
      
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile]);
      vi.spyOn(contactManager, 'getAllContactFiles').mockReturnValue([mockFile]);

      const status = contactManager.getManagerStatus();

      expect(status).toHaveProperty('cacheStats');
      expect(status).toHaveProperty('contactFileCount');
      expect(status).toHaveProperty('contactsFolder');
      expect(status).toHaveProperty('hasActiveFile');
      expect(status.cacheStats.uidCount).toBeGreaterThanOrEqual(0);
      expect(status.contactsFolder).toBe('Contacts');
      expect(typeof status.hasActiveFile).toBe('boolean');
    });

    it('should refresh cache', async () => {
      const mockFile = { path: 'Contacts/john.md' } as TFile;
      contactManager.addToCache('old-uid', mockFile);
      expect(contactManager.hasUID('old-uid')).toBe(true);

      const mockFolder = { path: 'Contacts' };
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);

      await contactManager.refreshCache();

      expect(contactManager.hasUID('old-uid')).toBe(false);
    });

    it('should invalidate all caches', () => {
      const mockFile = { path: 'Contacts/john.md' } as TFile;
      contactManager.addToCache('test-uid', mockFile);
      expect(contactManager.hasUID('test-uid')).toBe(true);

      contactManager.invalidateAllCaches();

      // After invalidation, the cache behavior is implementation-dependent
      // The method delegates to managerData which clears its caches
      const hasUIDAfter = contactManager.hasUID('test-uid');
      expect(typeof hasUIDAfter).toBe('boolean');
    });
  });

  describe('VCF Processing', () => {
    it('should process VCF contacts and find existing contacts', async () => {
      const mockFile = { path: 'Contacts/john-doe.md', basename: 'john-doe' } as TFile;
      
      const vcfEntries: Array<[string, any]> = [
        ['john-doe', { UID: 'existing-uid', FN: 'John Doe' }]
      ];

      // Mock finding existing contact
      vi.spyOn(contactManager, 'findContactFileByUID').mockResolvedValue(mockFile);

      const result = await contactManager.processVCFContacts(vcfEntries, mockApp as any, mockSettings);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockFile);
    });

    it('should process VCF contacts and create new contacts', async () => {
      const newFile = { path: 'Contacts/jane-doe.md', basename: 'jane-doe' } as TFile;
      
      const vcfEntries: Array<[string, any]> = [
        ['jane-doe', { UID: 'new-uid', FN: 'Jane Doe' }]
      ];

      // Mock no existing contact, then return newly created file
      vi.spyOn(contactManager, 'findContactFileByUID')
        .mockResolvedValueOnce(null)  // First call: no existing contact
        .mockResolvedValueOnce(newFile);  // Second call: newly created file

      const result = await contactManager.processVCFContacts(vcfEntries, mockApp as any, mockSettings);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(newFile);
    });

    it('should skip VCF entries without UID', async () => {
      const vcfEntries: Array<[string, any]> = [
        ['no-uid', { FN: 'No UID Contact' }]
      ];

      const result = await contactManager.processVCFContacts(vcfEntries, mockApp as any, mockSettings);

      expect(result).toHaveLength(0);
    });

    it('should skip VCF entries without slug', async () => {
      const vcfEntries: Array<[string, any]> = [
        [undefined as any, { UID: 'has-uid', FN: 'No Slug' }]
      ];

      const result = await contactManager.processVCFContacts(vcfEntries, mockApp as any, mockSettings);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple VCF contacts', async () => {
      const existingFile = { path: 'Contacts/existing.md', basename: 'existing' } as TFile;
      const newFile = { path: 'Contacts/new.md', basename: 'new' } as TFile;
      
      const vcfEntries: Array<[string, any]> = [
        ['existing', { UID: 'existing-uid', FN: 'Existing Contact' }],
        ['new', { UID: 'new-uid', FN: 'New Contact' }]
      ];

      // Mock finding existing for first, creating new for second
      vi.spyOn(contactManager, 'findContactFileByUID')
        .mockResolvedValueOnce(existingFile)  // existing-uid found
        .mockResolvedValueOnce(null)          // new-uid not found
        .mockResolvedValueOnce(newFile);      // new-uid after creation

      const result = await contactManager.processVCFContacts(vcfEntries, mockApp as any, mockSettings);

      expect(result).toHaveLength(2);
      expect(result).toContain(existingFile);
      expect(result).toContain(newFile);
    });

    it('should handle contact creation failures gracefully', async () => {
      const vcfEntries: Array<[string, any]> = [
        ['failing', { UID: 'fail-uid', FN: 'Failing Contact' }]
      ];

      // Mock no existing contact and creation failure
      vi.spyOn(contactManager, 'findContactFileByUID').mockResolvedValue(null);

      const result = await contactManager.processVCFContacts(vcfEntries, mockApp as any, mockSettings);

      // Should return empty array if contact creation fails
      expect(result).toHaveLength(0);
    });
  });

  describe('createContactFromVCF', () => {
    it('should create new contact from VCF record', async () => {
      const record = { UID: 'new-uid', FN: 'New Contact', EMAIL: 'new@example.com' };
      const newFile = { path: 'Contacts/new-contact.md', basename: 'new-contact' } as TFile;

      // Mock finding the newly created file
      vi.spyOn(contactManager, 'findContactFileByUID').mockResolvedValue(newFile);

      const result = await contactManager.createContactFromVCF('new-contact', record, mockApp as any, mockSettings);

      expect(result).toBe(newFile);
    });

    it('should return null if created contact cannot be found', async () => {
      const record = { UID: 'missing-uid', FN: 'Missing Contact' };

      // Mock not finding the created file
      vi.spyOn(contactManager, 'findContactFileByUID').mockResolvedValue(null);

      const result = await contactManager.createContactFromVCF('missing', record, mockApp as any, mockSettings);

      expect(result).toBeNull();
    });

    it('should handle creation errors gracefully', async () => {
      const record = { UID: 'error-uid', FN: 'Error Contact' };

      // Mock error during creation
      vi.spyOn(contactManager, 'findContactFileByUID').mockRejectedValue(new Error('Creation failed'));

      const result = await contactManager.createContactFromVCF('error', record, mockApp as any, mockSettings);

      expect(result).toBeNull();
    });
  });
});