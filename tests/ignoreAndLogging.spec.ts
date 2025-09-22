import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCFolderWatcher } from 'src/services/vcfFolderWatcher';
import type { ContactsPluginSettings } from 'src/settings/settings.d';
import type { App } from 'obsidian';

// Mock the logging service
vi.mock('src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clearLogs: vi.fn(),
    getLogs: vi.fn(() => []),
    getLogsAsString: vi.fn(() => '')
  }
}));

// Mock obsidian imports
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  Modal: vi.fn()
}));

// Mock other dependencies
vi.mock('src/contacts/vcard', () => ({
  vcard: {
    parse: vi.fn()
  }
}));

vi.mock('src/file/file', () => ({
  createContactFile: vi.fn()
}));

vi.mock('src/contacts/contactMdTemplate', () => ({
  mdRender: vi.fn(() => 'mock md content')
}));

describe('VCFolderWatcher - Ignore Functionality', () => {
  let mockApp: App;
  let watcher: VCFolderWatcher;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    // Create a more complete mock app
    mockApp = {
      vault: {
        adapter: {
          exists: vi.fn(),
          stat: vi.fn(),
          read: vi.fn(),
          list: vi.fn()
        }
      },
      metadataCache: {
        getFileCache: vi.fn()
      },
      workspace: {
        getActiveFile: vi.fn()
      }
    } as any;

    mockSettings = {
      contactsFolder: "Contacts",
      defaultHashtag: "#contact",
      vcfWatchFolder: "/test/vcf/folder",
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfIgnoreFilenames: ['ignored.vcf', 'malformed.vcf'],
      vcfIgnoreUIDs: ['ignored-uid-123', 'problematic-uid-456']
    };

    watcher = new VCFolderWatcher(mockApp, mockSettings);
  });

  it('should respect ignored filenames setting', async () => {
    const { loggingService } = await import('src/services/loggingService');
    
    // Mock file system operations
    mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(true);
    mockApp.vault.adapter.list = vi.fn().mockResolvedValue({
      files: [
        '/test/vcf/folder/ignored.vcf',
        '/test/vcf/folder/normal.vcf',
        '/test/vcf/folder/malformed.vcf'
      ]
    });
    mockApp.vault.adapter.stat = vi.fn().mockResolvedValue({ mtime: Date.now() });
    mockApp.vault.adapter.read = vi.fn().mockResolvedValue('mock vcf content');

    // Mock vcard parsing to return empty for ignored files
    const { vcard } = await import('src/contacts/vcard');
    vcard.parse = vi.fn().mockImplementation(async function* (content) {
      // Don't yield anything for ignored files
    });

    // Start the watcher (this will trigger initial scan)
    await watcher.start();

    // Verify that logging service was called for ignored files
    expect(loggingService.info).toHaveBeenCalledWith('Skipping ignored VCF file: ignored.vcf');
    expect(loggingService.info).toHaveBeenCalledWith('Skipping ignored VCF file: malformed.vcf');
    
    // Normal file should be processed
    expect(loggingService.info).toHaveBeenCalledWith('Processing VCF file: normal.vcf');
  });

  it('should respect ignored UIDs setting', async () => {
    const { loggingService } = await import('src/services/loggingService');
    const { vcard } = await import('src/contacts/vcard');
    
    // Mock file system operations
    mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(true);
    mockApp.vault.adapter.list = vi.fn().mockResolvedValue({
      files: ['/test/vcf/folder/contact.vcf']
    });
    mockApp.vault.adapter.stat = vi.fn().mockResolvedValue({ mtime: Date.now() });
    mockApp.vault.adapter.read = vi.fn().mockResolvedValue('mock vcf content');

    // Mock vcard parsing to return contacts with different UIDs
    vcard.parse = vi.fn().mockImplementation(async function* (content) {
      yield ['ignored-contact', { UID: 'ignored-uid-123', FN: 'Ignored Contact' }];
      yield ['normal-contact', { UID: 'normal-uid-789', FN: 'Normal Contact' }];
      yield ['problematic-contact', { UID: 'problematic-uid-456', FN: 'Problematic Contact' }];
    });

    // Start the watcher (this will trigger initial scan)
    await watcher.start();

    // Verify that logging service was called for ignored UIDs
    expect(loggingService.info).toHaveBeenCalledWith('Skipping ignored UID: ignored-uid-123');
    expect(loggingService.info).toHaveBeenCalledWith('Skipping ignored UID: problematic-uid-456');
  });

  it('should log configuration changes', async () => {
    const { loggingService } = await import('src/services/loggingService');
    
    const newSettings: ContactsPluginSettings = {
      ...mockSettings,
      vcfWatchEnabled: false,
      vcfWatchFolder: '/new/folder',
      vcfIgnoreFilenames: ['new-ignored.vcf'],
      vcfIgnoreUIDs: ['new-ignored-uid']
    };

    await watcher.updateSettings(newSettings);

    expect(loggingService.info).toHaveBeenCalledWith('VCF watch enabled changed: true → false');
    expect(loggingService.info).toHaveBeenCalledWith('VCF watch folder changed: /test/vcf/folder → /new/folder');
  });
});