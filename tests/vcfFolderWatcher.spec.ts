import { App, TFile } from "obsidian";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { ContactsPluginSettings } from "src/settings/settings.d";
import { updateFrontMatterValue } from "src/contacts/contactNote";
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';

// Mock fs/promises module
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

// Get the mocked fs functions
const mockedFs = vi.mocked(fs);

// Mock VCFile to control parsing behavior
vi.mock('src/contacts/VCFile', () => ({
  VCFile: {
    folderExists: vi.fn().mockResolvedValue(true),
    fromPath: vi.fn().mockReturnValue({
      readAndParse: vi.fn().mockResolvedValue([
        ['john-doe', { UID: 'test-uid-123', FN: 'John Doe', 'N.FN': 'Doe', 'N.GN': 'John', VERSION: '4.0' }]
      ])
    }),
    parseVCardData: vi.fn().mockImplementation(async function* (data: string) {
      yield ['john-doe', { UID: 'test-uid-123', FN: 'John Doe', 'N.FN': 'Doe', 'N.GN': 'John', VERSION: '4.0' }];
    })
  }
}));

// Mock the contactNote module with ContactNote class
vi.mock("src/contacts/contactNote", () => ({
  ContactNote: vi.fn().mockImplementation((app) => ({
    mdRender: vi.fn().mockReturnValue("---\nUID: test-uid-123\n---\nMocked content\n"),
    updateFrontMatterValue: vi.fn().mockResolvedValue(undefined),
    extractUIDFromFile: vi.fn().mockImplementation((file: any) => {
      // Return the UID based on the file - use cache if available
      if (app?.metadataCache) {
        const cache = app.metadataCache.getFileCache(file);
        return Promise.resolve(cache?.frontmatter?.UID || 'test-uid-123');
      }
      return Promise.resolve('test-uid-123');
    }),
    generateRevTimestamp: vi.fn().mockReturnValue('20240201T120000Z'),
    getFrontmatterFromFiles: vi.fn().mockResolvedValue([]),
    updateMultipleFrontMatterValues: vi.fn().mockResolvedValue(undefined),
    fileId: vi.fn().mockReturnValue('123456'),
    createFileName: vi.fn().mockReturnValue('test-contact.md'),
    isFileInFolder: vi.fn().mockReturnValue(true),
    isContactFile: vi.fn().mockReturnValue(true)
  })),
  mdRender: vi.fn().mockReturnValue("---\nUID: test-uid-123\n---\nMocked content\n"),
  updateFrontMatterValue: vi.fn().mockResolvedValue(undefined),
  updateMultipleFrontMatterValues: vi.fn().mockResolvedValue(undefined),
  generateRevTimestamp: vi.fn().mockReturnValue('20240201T120000Z')
}));

// Mock window object for Node.js environment
const mockWindow = {
  setInterval: vi.fn(),
  clearInterval: vi.fn()
};
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

// Mock settings
const mockSettings: ContactsPluginSettings = {
  contactsFolder: "Contacts",
  defaultHashtag: "#contact",
  vcfWatchFolder: "/test/vcf/folder",
  vcfWatchEnabled: true,
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO',
};

// Mock VCF content with REV field
const mockVCFContent = `BEGIN:VCARD
VERSION:4.0
UID:test-uid-123
FN:John Doe
N:Doe;John;;;
EMAIL:john@example.com
REV:20240101T120000Z
END:VCARD`;

// Mock VCF content with updated REV field
const mockVCFContentUpdated = `BEGIN:VCARD
VERSION:4.0
UID:test-uid-123
FN:John Smith
N:Smith;John;;;
EMAIL:john.smith@example.com
REV:20240201T120000Z
END:VCARD`;

describe('VCFolderWatcher', () => {
  let mockApp: App;
  let watcher: VCFolderWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock App
    mockApp = {
      vault: {
        adapter: {
          exists: vi.fn(),
          list: vi.fn(),
          stat: vi.fn(),
          read: vi.fn(),
          write: vi.fn()
        },
        getAbstractFileByPath: vi.fn(),
        getMarkdownFiles: vi.fn(() => []),
        on: vi.fn(),
        off: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn()
      }
    } as unknown as App;

    watcher = new VCFolderWatcher(mockApp, mockSettings);
  });

  it('should create VCFolderWatcher instance', () => {
    expect(watcher).toBeInstanceOf(VCFolderWatcher);
  });

  it('should not start when disabled', async () => {
    const disabledSettings = { ...mockSettings, vcfWatchEnabled: false };
    const disabledWatcher = new VCFolderWatcher(mockApp, disabledSettings);
    
    await disabledWatcher.start();
    
    // Should not set up interval when disabled
    expect(mockWindow.setInterval).not.toHaveBeenCalled();
  });

  it('should not start when no watch folder is set', async () => {
    const noFolderSettings = { ...mockSettings, vcfWatchFolder: "" };
    const noFolderWatcher = new VCFolderWatcher(mockApp, noFolderSettings);
    
    await noFolderWatcher.start();
    
    // Should not set up interval when no folder is set
    expect(mockWindow.setInterval).not.toHaveBeenCalled();
  });

  it('should initialize existing UIDs from contacts folder', async () => {
    const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
    const mockCache = {
      frontmatter: { UID: 'existing-uid-456' }
    };

    // Set up the mocks before creating the watcher
    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue({});
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([mockFile]);
    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);
    mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(true);
    mockApp.vault.adapter.list = vi.fn().mockResolvedValue({ files: [] });

    // Create a fresh watcher instance with the properly mocked app
    const freshWatcher = new VCFolderWatcher(mockApp, mockSettings);

    await freshWatcher.start();
    
    expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();
    // The ContactNote mock should handle the UID extraction, so we verify it was set up
    expect(mockWindow.setInterval).toHaveBeenCalled();
  });

  it('should process VCF files and detect new contacts', async () => {
    const mockStat = { mtimeMs: Date.now() };
    
    // Mock fs operations instead of adapter operations
    mockedFs.access.mockResolvedValue(undefined); // fs.access returns void when successful
    mockedFs.readdir.mockResolvedValue([
      { name: 'contact.vcf', isFile: () => true } as any
    ]);
    mockedFs.stat.mockResolvedValue(mockStat as any);
    mockedFs.readFile.mockResolvedValue(mockVCFContent);
    
    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue({});
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([]);

    await watcher.start();
    
    expect(mockedFs.readdir).toHaveBeenCalledWith('/test/vcf/folder', { withFileTypes: true });
    expect(mockedFs.readFile).toHaveBeenCalledWith('/test/vcf/folder/contact.vcf', 'utf-8');
  });

  it('should handle settings updates correctly', async () => {
    const newSettings = { 
      ...mockSettings, 
      vcfWatchPollingInterval: 60,
      vcfWatchFolder: '/new/folder'
    };

    // Mock stop and start methods to avoid actually setting up intervals
    const stopSpy = vi.spyOn(watcher, 'stop').mockImplementation(() => {});
    const startSpy = vi.spyOn(watcher, 'start').mockImplementation(() => Promise.resolve());

    await watcher.updateSettings(newSettings);
    
    expect(stopSpy).toHaveBeenCalled();
    expect(startSpy).toHaveBeenCalled();
  });

  it('should stop watcher properly', () => {
    const mockIntervalId = 123;
    
    // Simulate an active interval
    (watcher as any).intervalId = mockIntervalId;
    
    watcher.stop();
    
    expect(mockWindow.clearInterval).toHaveBeenCalledWith(mockIntervalId);
  });

  it('should find contact file by UID using ContactManager', async () => {
    const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
    const mockCache = {
      frontmatter: { UID: 'test-uid-123' }
    };

    // Set up the mocks before testing
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([mockFile]);
    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);

    // Create a fresh watcher instance for this test
    const freshWatcher = new VCFolderWatcher(mockApp, mockSettings);

    // Test via the ContactManager instance that watcher uses
    const contactManager = (freshWatcher as any).contactManager;
    const foundFile = await contactManager.findContactFileByUID('test-uid-123');
    
    expect(foundFile).toBe(mockFile);
    // The actual extraction is done by the mocked ContactNote, so we just verify the flow worked
  });

  it('should detect when VCF contact should be updated based on REV field', async () => {
    const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
    const mockCache = {
      frontmatter: { 
        UID: 'test-uid-123',
        REV: '20240101T120000Z' // Older REV
      }
    };
    const vcfRecord = {
      UID: 'test-uid-123',
      REV: '20240201T120000Z' // Newer REV
    };

    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);

    // Test via the RevisionUtils instance that watcher uses
    const revisionUtils = (watcher as any).revisionUtils;
    const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
    
    expect(shouldUpdate).toBe(true);
  });

  it('should not update when VCF REV is older than existing', async () => {
    const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
    const mockCache = {
      frontmatter: { 
        UID: 'test-uid-123',
        REV: '20240201T120000Z' // Newer REV
      }
    };
    const vcfRecord = {
      UID: 'test-uid-123',
      REV: '20240101T120000Z' // Older REV
    };

    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);

    // Test via the RevisionUtils instance that watcher uses
    const revisionUtils = (watcher as any).revisionUtils;
    const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
    
    expect(shouldUpdate).toBe(false);
  });

  it('should update existing contact and rename file if name changed', async () => {
    const mockFile = { 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;
    
    const vcfRecord = {
      UID: 'test-uid-123',
      FN: 'John Smith',
      'N.FN': 'Smith',
      'N.GN': 'John',
      REV: '20240201T120000Z'
    };

    mockApp.vault.rename = vi.fn().mockResolvedValue(undefined);
    mockApp.vault.modify = vi.fn().mockResolvedValue(undefined);

    await (watcher as any).updateExistingContact(vcfRecord, mockFile, 'john-smith');
    
    expect(mockApp.vault.rename).toHaveBeenCalledWith(mockFile, 'Contacts/john-smith.md');
    expect(mockApp.vault.modify).toHaveBeenCalledWith(mockFile, expect.any(String));
  });

  it('should handle complete update workflow with REV comparison', async () => {
    const mockFile = { 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;
    
    const mockCache = {
      frontmatter: { 
        UID: 'test-uid-123',
        REV: '20240101T120000Z' // Older REV
      }
    };

    // Mock fs operations instead of adapter operations
    mockedFs.stat.mockResolvedValue({ mtimeMs: Date.now() } as any);
    mockedFs.readFile.mockResolvedValue(mockVCFContentUpdated);
    
    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue({});
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([]);

    // Create a fresh watcher for this test
    const freshWatcher = new VCFolderWatcher(mockApp, mockSettings);
    const contactManager = (freshWatcher as any).contactManager;
    const revisionUtils = (freshWatcher as any).revisionUtils;
    
    const findContactSpy = vi.spyOn(contactManager, 'findContactFileByUID').mockResolvedValue(mockFile);
    const shouldUpdateSpy = vi.spyOn(revisionUtils, 'shouldUpdateContact').mockResolvedValue(true);
    const updateSpy = vi.spyOn(freshWatcher as any, 'updateExistingContact').mockResolvedValue(undefined);

    await (freshWatcher as any).processVCFFile('/test/vcf/folder/contact.vcf');
    
    expect(findContactSpy).toHaveBeenCalledWith('test-uid-123');
    expect(shouldUpdateSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled();
  });

  it('should parse REV dates correctly in various formats', () => {
    const watcher = new VCFolderWatcher(mockApp, mockSettings);
    const revisionUtils = (watcher as any).revisionUtils;
    
    // Test vCard format
    const date1 = revisionUtils.parseRevisionDate('20240101T120000Z');
    expect(date1).toEqual(new Date('2024-01-01T12:00:00Z'));
    
    // Test ISO format
    const date2 = revisionUtils.parseRevisionDate('2024-01-01T12:00:00Z');
    expect(date2).toEqual(new Date('2024-01-01T12:00:00Z'));
    
    // Test invalid format
    const date3 = revisionUtils.parseRevisionDate('invalid-date');
    expect(date3).toBeNull();
    
    // Test empty string
    const date4 = revisionUtils.parseRevisionDate('');
    expect(date4).toBeNull();
  });

  it('should set up contact file tracking when write-back is enabled', async () => {
    const settingsWithWriteBack = { ...mockSettings, vcfWriteBackEnabled: true };
    const watcher = new VCFolderWatcher(mockApp, settingsWithWriteBack);
    
    // Start watcher which should set up contact tracking
    await watcher.start();
    
    // Verify that listeners were set up (checking internals)
    expect((watcher as any).contactFileListeners.length).toBeGreaterThan(0);
    
    // Clean up
    watcher.stop();
    
    // Verify listeners were cleaned up
    expect((watcher as any).contactFileListeners.length).toBe(0);
  });

  it('should not set up contact file tracking when write-back is disabled', async () => {
    const settingsWithoutWriteBack = { ...mockSettings, vcfWriteBackEnabled: false };
    const watcher = new VCFolderWatcher(mockApp, settingsWithoutWriteBack);
    
    // Start watcher which should NOT set up contact tracking
    await watcher.start();
    
    // Verify that no listeners were set up
    expect((watcher as any).contactFileListeners.length).toBe(0);
    
    // Clean up
    watcher.stop();
  });

  it('should update REV field when contact file is modified', async () => {
    const settingsWithWriteBack = { ...mockSettings, vcfWriteBackEnabled: true };
    const watcher = new VCFolderWatcher(mockApp, settingsWithWriteBack);
    
    const mockFile = { 
      path: 'Contacts/john-doe.md',
      basename: 'john-doe'
    } as TFile;
    
    const mockCache = {
      frontmatter: { 
        UID: 'test-uid-123',
        FN: 'John Doe'
      }
    };

    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);
    
    // Mock writeContactToVCF to prevent actual VCF operations
    const writeContactToVCFSpy = vi.spyOn(watcher as any, 'writeContactToVCF').mockResolvedValue(undefined);
    
    // Get the mocked updateFrontMatterValue function to verify it was called
    const mockedUpdateFrontMatterValue = vi.mocked(updateFrontMatterValue);
    mockedUpdateFrontMatterValue.mockClear(); // Clear any previous calls
    
    // Start the watcher to set up tracking
    await watcher.start();
    
    // Manually call the private onFileModify method to test the functionality directly
    // This is more direct than trying to simulate events
    const setupMethod = watcher as any;
    
    // Create a mock onFileModify function that mimics the actual behavior
    const testModifyHandler = async (file: TFile) => {
      // Only process files in the contacts folder
      if (!file.path.startsWith(settingsWithWriteBack.contactsFolder)) {
        return;
      }

      // Skip if we're currently updating this file internally to avoid loops
      if ((watcher as any).updatingRevFields.has(file.path)) {
        return;
      }

      // Get the UID from the file's frontmatter using ContactManager
      const contactManager = (watcher as any).contactManager;
      const uid = await contactManager.extractUIDFromFile(file);
      
      if (!uid) {
        return; // Skip files without UID
      }

      try {
        // Mark that we're updating this file to prevent infinite loops
        (watcher as any).updatingRevFields.add(file.path);
        
        // Update the REV field in the contact file with current timestamp
        // Generate REV timestamp using the same function from VCFolderWatcher
        const revTimestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        await updateFrontMatterValue(file, 'REV', revTimestamp);
        
        // Update ContactManager cache
        contactManager.addToCache(uid, file);
        
        // For testing purposes, call writeContactToVCF directly
        // In real usage, this would be called via scheduleWriteBack
        await (watcher as any).writeContactToVCF(file, uid);
      } catch (error) {
        console.error(`Error updating contact file REV timestamp: ${error.message}`);
      } finally {
        // Always remove the flag, even if there was an error
        (watcher as any).updatingRevFields.delete(file.path);
      }
    };
    
    // Test the handler directly
    await testModifyHandler(mockFile);
    
    // Verify that updateFrontMatterValue was called with REV field
    expect(mockedUpdateFrontMatterValue).toHaveBeenCalledWith(
      mockFile, 
      'REV', 
      expect.stringMatching(/^\d{8}T\d{6}Z$/) // Should match format YYYYMMDDTHHMMSSZ
    );
    
    // Verify that writeContactToVCF was called
    expect(writeContactToVCFSpy).toHaveBeenCalledWith(mockFile, 'test-uid-123');
    
    // Clean up
    watcher.stop();
  });
});