import { App, TFile } from "obsidian";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { ContactsPluginSettings } from "src/settings/settings.d";
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

// Mock the mdRender function to avoid stringifyYaml issues in tests
vi.mock("src/contacts/contactMdTemplate", () => ({
  mdRender: vi.fn().mockReturnValue("---\nUID: test-uid-123\n---\nMocked content\n")
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

    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue({});
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([mockFile]);
    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);
    mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(true);
    mockApp.vault.adapter.list = vi.fn().mockResolvedValue({ files: [] });

    await watcher.start();
    
    expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();
    expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledWith(mockFile);
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

  it('should find contact file by UID', async () => {
    const mockFile = { path: 'Contacts/john-doe.md' } as TFile;
    const mockCache = {
      frontmatter: { UID: 'test-uid-123' }
    };

    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([mockFile]);
    mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(mockCache);

    const foundFile = await (watcher as any).findContactFileByUID('test-uid-123');
    
    expect(foundFile).toBe(mockFile);
    expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledWith(mockFile);
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

    const shouldUpdate = await (watcher as any).shouldUpdateContact(vcfRecord, mockFile);
    
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

    const shouldUpdate = await (watcher as any).shouldUpdateContact(vcfRecord, mockFile);
    
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

    // Mock the find contact file method
    const findContactSpy = vi.spyOn(watcher as any, 'findContactFileByUID').mockResolvedValue(mockFile);
    const shouldUpdateSpy = vi.spyOn(watcher as any, 'shouldUpdateContact').mockResolvedValue(true);
    const updateSpy = vi.spyOn(watcher as any, 'updateExistingContact').mockResolvedValue(undefined);

    // Mock fs operations instead of adapter operations
    mockedFs.stat.mockResolvedValue({ mtimeMs: Date.now() } as any);
    mockedFs.readFile.mockResolvedValue(mockVCFContentUpdated);
    
    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue({});
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([]);

    await (watcher as any).processVCFFile('/test/vcf/folder/contact.vcf');
    
    expect(findContactSpy).toHaveBeenCalledWith('test-uid-123');
    expect(shouldUpdateSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled();
  });

  it('should parse REV dates correctly in various formats', () => {
    const watcher = new VCFolderWatcher(mockApp, mockSettings);
    
    // Test vCard format
    const date1 = (watcher as any).parseRevisionDate('20240101T120000Z');
    expect(date1).toEqual(new Date('2024-01-01T12:00:00Z'));
    
    // Test ISO format
    const date2 = (watcher as any).parseRevisionDate('2024-01-01T12:00:00Z');
    expect(date2).toEqual(new Date('2024-01-01T12:00:00Z'));
    
    // Test invalid format
    const date3 = (watcher as any).parseRevisionDate('invalid-date');
    expect(date3).toBeNull();
    
    // Test empty string
    const date4 = (watcher as any).parseRevisionDate('');
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
});