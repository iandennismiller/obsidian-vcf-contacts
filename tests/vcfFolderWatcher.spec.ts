import { App, TFile } from "obsidian";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { ContactsPluginSettings } from "src/settings/settings.d";
import { describe, expect, it, vi, beforeEach } from 'vitest';

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
  vcfWatchPollingInterval: 30
};

// Mock VCF content
const mockVCFContent = `BEGIN:VCARD
VERSION:4.0
UID:test-uid-123
FN:John Doe
N:Doe;John;;;
EMAIL:john@example.com
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
          read: vi.fn()
        },
        getAbstractFileByPath: vi.fn(),
        getMarkdownFiles: vi.fn(() => [])
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
    const mockStat = { mtime: Date.now() };
    
    mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(true);
    mockApp.vault.adapter.list = vi.fn().mockResolvedValue({ 
      files: ['/test/vcf/folder/contact.vcf'] 
    });
    mockApp.vault.adapter.stat = vi.fn().mockResolvedValue(mockStat);
    mockApp.vault.adapter.read = vi.fn().mockResolvedValue(mockVCFContent);
    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue({});
    mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([]);

    await watcher.start();
    
    expect(mockApp.vault.adapter.list).toHaveBeenCalledWith('/test/vcf/folder');
    expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('/test/vcf/folder/contact.vcf');
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
});