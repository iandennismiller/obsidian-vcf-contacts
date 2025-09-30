import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactManagerData } from '../../../../src/models/contactManager/contactManagerData';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/definitions/ContactsPluginSettings';

describe('ContactManagerData', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let contactManagerData: ContactManagerData;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      vault: {
        getMarkdownFiles: vi.fn(),
        read: vi.fn(),
        modify: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      } as any,
      workspace: {
        getActiveFile: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
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

    contactManagerData = new ContactManagerData(mockApp as App, mockSettings);
  });

  describe('constructor', () => {
    it('should initialize with app and settings', () => {
      expect(contactManagerData.getApp()).toBe(mockApp);
      expect(contactManagerData.getSettings()).toBe(mockSettings);
      expect(contactManagerData.getContactsFolder()).toBe('Contacts');
    });
  });

  describe('settings management', () => {
    it('should update settings and invalidate cache', () => {
      const newSettings = { ...mockSettings, contactsFolder: 'NewContacts' };
      
      contactManagerData.updateSettings(newSettings);
      
      expect(contactManagerData.getSettings()).toBe(newSettings);
      expect(contactManagerData.getContactsFolder()).toBe('NewContacts');
    });

    it('should handle empty contacts folder gracefully', () => {
      const settingsWithEmptyFolder = { ...mockSettings, contactsFolder: '' };
      
      contactManagerData.updateSettings(settingsWithEmptyFolder);
      
      expect(contactManagerData.getContactsFolder()).toBe('/');
    });
  });

  describe('UID cache management', () => {
    it('should add UID to cache', () => {
      contactManagerData.addToUIDCache('test-uid-123');
      
      expect(contactManagerData.hasUID('test-uid-123')).toBe(true);
      expect(contactManagerData.hasUID('non-existent-uid')).toBe(false);
    });

    it('should remove UID from cache', () => {
      contactManagerData.addToUIDCache('test-uid-123');
      expect(contactManagerData.hasUID('test-uid-123')).toBe(true);
      
      contactManagerData.removeFromUIDCache('test-uid-123');
      expect(contactManagerData.hasUID('test-uid-123')).toBe(false);
    });

    it('should clear UID cache', () => {
      contactManagerData.addToUIDCache('uid-1');
      contactManagerData.addToUIDCache('uid-2');
      
      contactManagerData.clearUIDCache();
      
      expect(contactManagerData.hasUID('uid-1')).toBe(false);
      expect(contactManagerData.hasUID('uid-2')).toBe(false);
    });

    it('should get all cached UIDs', () => {
      contactManagerData.addToUIDCache('uid-1');
      contactManagerData.addToUIDCache('uid-2');
      
      const uids = contactManagerData.getAllUIDs();
      
      expect(uids).toEqual(['uid-1', 'uid-2']);
    });
  });

  describe('contact files cache management', () => {
    const mockFile1 = { 
      basename: 'contact1', 
      path: 'Contacts/contact1.md',
      name: 'contact1.md'
    } as TFile;
    const mockFile2 = { 
      basename: 'contact2', 
      path: 'Contacts/contact2.md',
      name: 'contact2.md'
    } as TFile;

    it('should set and get contact file by UID', () => {
      contactManagerData.setContactFile('uid-1', mockFile1);
      
      expect(contactManagerData.getContactFile('uid-1')).toBe(mockFile1);
      expect(contactManagerData.getContactFile('non-existent')).toBeNull();
    });

    it('should remove contact file from cache', () => {
      contactManagerData.setContactFile('uid-1', mockFile1);
      expect(contactManagerData.getContactFile('uid-1')).toBe(mockFile1);
      
      contactManagerData.removeContactFile('uid-1');
      expect(contactManagerData.getContactFile('uid-1')).toBeNull();
    });

    it('should get all contact files', () => {
      contactManagerData.setContactFile('uid-1', mockFile1);
      contactManagerData.setContactFile('uid-2', mockFile2);
      
      const files = contactManagerData.getAllContactFiles();
      
      expect(files).toHaveLength(2);
      expect(files).toContain(mockFile1);
      expect(files).toContain(mockFile2);
    });

    it('should clear contact files cache', () => {
      contactManagerData.setContactFile('uid-1', mockFile1);
      contactManagerData.setContactFile('uid-2', mockFile2);
      
      contactManagerData.clearContactFiles();
      
      expect(contactManagerData.getContactFile('uid-1')).toBeNull();
      expect(contactManagerData.getContactFile('uid-2')).toBeNull();
      expect(contactManagerData.getAllContactFiles()).toHaveLength(0);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate contact files cache', () => {
      const mockFiles = [
        { path: 'Contacts/contact1.md' } as TFile,
        { path: 'Contacts/contact2.md' } as TFile
      ];
      
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);
      
      // First call should populate cache
      contactManagerData.getContactFilesFromVault();
      
      // Invalidate cache
      contactManagerData.invalidateContactFilesCache();
      
      // Next call should fetch fresh data
      const files = contactManagerData.getContactFilesFromVault();
      
      expect(mockApp.vault!.getMarkdownFiles).toHaveBeenCalledTimes(2);
    });
  });

  describe('vault integration', () => {
    it('should get contact files from vault with caching', () => {
      const mockFiles = [
        { path: 'Contacts/contact1.md', basename: 'contact1' } as TFile,
        { path: 'Contacts/contact2.md', basename: 'contact2' } as TFile,
        { path: 'Other/note.md', basename: 'note' } as TFile
      ];
      
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);
      
      const contactFiles = contactManagerData.getContactFilesFromVault();
      
      // Should only return files in contacts folder
      expect(contactFiles).toHaveLength(2);
      expect(contactFiles[0].path).toBe('Contacts/contact1.md');
      expect(contactFiles[1].path).toBe('Contacts/contact2.md');
      
      // Second call should use cache
      contactManagerData.getContactFilesFromVault();
      expect(mockApp.vault!.getMarkdownFiles).toHaveBeenCalledTimes(1);
    });

    it('should handle vault errors gracefully', () => {
      mockApp.vault!.getMarkdownFiles = vi.fn().mockImplementation(() => {
        throw new Error('Vault error');
      });
      
      const files = contactManagerData.getContactFilesFromVault();
      
      expect(files).toEqual([]);
    });
  });

  describe('active file tracking', () => {
    it('should set and get current active file', () => {
      const mockFile = { path: 'Contacts/active.md' } as TFile;
      
      contactManagerData.setCurrentActiveFile(mockFile);
      expect(contactManagerData.getCurrentActiveFile()).toBe(mockFile);
    });

    it('should clear current active file', () => {
      const mockFile = { path: 'Contacts/active.md' } as TFile;
      
      contactManagerData.setCurrentActiveFile(mockFile);
      contactManagerData.setCurrentActiveFile(null);
      
      expect(contactManagerData.getCurrentActiveFile()).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should provide accurate cache statistics', () => {
      contactManagerData.addToUIDCache('uid-1');
      contactManagerData.addToUIDCache('uid-2');
      
      const mockFile = { path: 'Contacts/test.md' } as TFile;
      contactManagerData.setContactFile('uid-1', mockFile);
      
      const stats = contactManagerData.getCacheStats();
      
      expect(stats.uidCacheSize).toBe(2);
      expect(stats.contactFilesCacheSize).toBe(1);
      expect(stats.hasContactFilesCache).toBe(false); // Initially false
    });
  });

  describe('event handling preparation', () => {
    it('should store event reference for cleanup', () => {
      const mockEventRef = { id: 'test-event' } as any;
      
      contactManagerData.setEventRef(mockEventRef);
      expect(contactManagerData.getEventRef()).toBe(mockEventRef);
    });

    it('should clear event reference', () => {
      const mockEventRef = { id: 'test-event' } as any;
      
      contactManagerData.setEventRef(mockEventRef);
      contactManagerData.setEventRef(null);
      
      expect(contactManagerData.getEventRef()).toBeNull();
    });
  });
});